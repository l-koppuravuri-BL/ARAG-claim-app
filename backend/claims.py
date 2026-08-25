import os
import json
import uuid
from datetime import datetime, timezone

TABLE_NAME = os.environ.get("CLAIMS_TABLE_NAME", "ClaimsTable")
# Fallback to local DB if not in AWS Lambda environment or explicitly requested
USE_LOCAL_DB = os.environ.get("USE_LOCAL_DB", "false").lower() == "true" or "AWS_REGION" not in os.environ

LOCAL_DB_PATH = os.path.join(os.path.dirname(__file__), "local_db.json")

def read_local_db():
    if not os.path.exists(LOCAL_DB_PATH):
        with open(LOCAL_DB_PATH, "w", encoding="utf-8") as f:
            json.dump([], f)
        return []
    try:
        with open(LOCAL_DB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error reading local DB: {e}")
        return []

def write_local_db(data):
    try:
        with open(LOCAL_DB_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Error writing local DB: {e}")

# AWS DynamoDB Resource Setup
dynamodb = None
table = None

if not USE_LOCAL_DB:
    try:
        import boto3
        dynamodb = boto3.resource("dynamodb")
        table = dynamodb.Table(TABLE_NAME)
    except Exception as e:
        print(f"Failed to initialize DynamoDB, falling back to local database: {e}")
        USE_LOCAL_DB = True

def list_claims(user_id):
    if USE_LOCAL_DB:
        db = read_local_db()
        return [claim for claim in db if claim.get("userId") == user_id]

    try:
        from boto3.dynamodb.conditions import Key
        response = table.query(
            KeyConditionExpression=Key("userId").eq(user_id)
        )
        return response.get("Items", [])
    except Exception as e:
        print(f"DynamoDB query error: {e}")
        raise RuntimeError(f"Failed to list claims: {str(e)}")

def get_claim(user_id, claim_id):
    if USE_LOCAL_DB:
        db = read_local_db()
        for claim in db:
            if claim.get("userId") == user_id and claim.get("id") == claim_id:
                return claim
        return None

    try:
        response = table.get_item(Key={"userId": user_id, "id": claim_id})
        return response.get("Item")
    except Exception as e:
        print(f"DynamoDB get error: {e}")
        raise RuntimeError(f"Failed to get claim: {str(e)}")

def create_claim(user_id, claim_data):
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    claim_id = claim_data.get("id") or str(uuid.uuid4())
    
    new_claim = {
        **claim_data,
        "id": claim_id,
        "userId": user_id,
        "createdAt": now,
        "updatedAt": now
    }

    if not USE_LOCAL_DB:
        from decimal import Decimal
        def convert_to_decimal(val):
            if isinstance(val, float):
                return Decimal(str(val))
            if isinstance(val, dict):
                return {k: convert_to_decimal(v) for k, v in val.items()}
            if isinstance(val, list):
                return [convert_to_decimal(i) for i in val]
            return val
        
        db_claim = convert_to_decimal(new_claim)
        try:
            table.put_item(Item=db_claim)
        except Exception as e:
            print(f"DynamoDB put error: {e}")
            raise RuntimeError(f"Failed to create claim: {str(e)}")
    else:
        db = read_local_db()
        db.append(new_claim)
        write_local_db(db)

    return new_claim

def update_claim(user_id, claim_id, claim_data):
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    if USE_LOCAL_DB:
        db = read_local_db()
        for idx, claim in enumerate(db):
            if claim.get("userId") == user_id and claim.get("id") == claim_id:
                updated_claim = {
                    **claim,
                    **claim_data,
                    "id": claim_id,
                    "userId": user_id,
                    "updatedAt": now
                }
                db[idx] = updated_claim
                write_local_db(db)
                return updated_claim
        raise ValueError("Claim not found")

    existing = get_claim(user_id, claim_id)
    if not existing:
        raise ValueError("Claim not found")

    updated_claim = {
        **existing,
        **claim_data,
        "id": claim_id,
        "userId": user_id,
        "updatedAt": now
    }

    from decimal import Decimal
    def convert_to_decimal(val):
        if isinstance(val, float):
            return Decimal(str(val))
        if isinstance(val, dict):
            return {k: convert_to_decimal(v) for k, v in val.items()}
        if isinstance(val, list):
            return [convert_to_decimal(i) for i in val]
        return val

    db_claim = convert_to_decimal(updated_claim)
    try:
        table.put_item(Item=db_claim)
        return updated_claim
    except Exception as e:
        print(f"DynamoDB update error: {e}")
        raise RuntimeError(f"Failed to update claim: {str(e)}")

def delete_claim(user_id, claim_id):
    if USE_LOCAL_DB:
        db = read_local_db()
        new_db = [claim for claim in db if not (claim.get("userId") == user_id and claim.get("id") == claim_id)]
        if len(db) == len(new_db):
            raise ValueError("Claim not found")
        write_local_db(new_db)
        return {"success": True}

    try:
        table.delete_item(Key={"userId": user_id, "id": claim_id})
        return {"success": True}
    except Exception as e:
        print(f"DynamoDB delete error: {e}")
        raise RuntimeError(f"Failed to delete claim: {str(e)}")
