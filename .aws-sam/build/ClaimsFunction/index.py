import json
import os
from decimal import Decimal
import auth
import claims

# Decimal encoder to handle DynamoDB numeric types in json.dumps
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            if obj % 1 == 0:
                return int(obj)
            else:
                return float(obj)
        return super(DecimalEncoder, self).default(obj)

cors_headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Content-Type": "application/json"
}

def send_response(status_code, body_data):
    return {
        "statusCode": status_code,
        "headers": cors_headers,
        "body": json.dumps(body_data, cls=DecimalEncoder)
    }

def handler(event, context):
    print("Received event:", json.dumps(event))

    # Support both API Gateway HTTP API (Payload v2) and REST API (Payload v1)
    method = event.get("httpMethod")
    if not method and "requestContext" in event and "http" in event["requestContext"]:
        method = event["requestContext"]["http"].get("method")

    event_path = event.get("path")
    if not event_path and "requestContext" in event and "http" in event["requestContext"]:
        event_path = event["requestContext"]["http"].get("path")

    # Handle CORS preflight
    if method == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": cors_headers,
            "body": ""
        }

    # Extract authorization header (handle case insensitivity)
    headers = event.get("headers", {})
    auth_header = headers.get("Authorization") or headers.get("authorization")

    if not auth_header:
        return send_response(401, {"error": "Unauthorized: Missing Authorization header"})

    try:
        user = auth.verify_token(auth_header)
    except PermissionError as pe:
        return send_response(403, {"error": str(pe)})
    except Exception as e:
        return send_response(401, {"error": str(e)})

    user_id = user["userId"]
    tenant_id = user["tenantId"]

    # Extract ID parameter from pathParameters or parse path
    path_parameters = event.get("pathParameters") or {}
    claim_id = path_parameters.get("id")

    if not claim_id and event_path:
        parts = [p for p in event_path.split("/") if p]
        if len(parts) > 1 and parts[0] == "claims":
            claim_id = parts[1]

    # Routing
    try:
        # GET /claims
        if method == "GET" and (event_path == "/claims" or event_path.endswith("/claims")):
            claims_list = claims.list_claims(tenant_id)
            return send_response(200, claims_list)

        # GET /claims/{id}
        elif method == "GET" and claim_id:
            claim = claims.get_claim(tenant_id, claim_id)
            if not claim:
                return send_response(404, {"error": "Claim not found"})
            return send_response(200, claim)

        # POST /claims
        elif method == "POST" and (event_path == "/claims" or event_path.endswith("/claims")):
            body_str = event.get("body", "{}")
            body = json.loads(body_str) if body_str else {}
            body["createdBy"] = user_id
            new_claim = claims.create_claim(tenant_id, body)
            return send_response(201, new_claim)

        # PUT /claims/{id}
        elif method == "PUT" and claim_id:
            body_str = event.get("body", "{}")
            body = json.loads(body_str) if body_str else {}
            body["updatedBy"] = user_id
            updated_claim = claims.update_claim(tenant_id, claim_id, body)
            return send_response(200, updated_claim)

        # DELETE /claims/{id}
        elif method == "DELETE" and claim_id:
            claims.delete_claim(tenant_id, claim_id)
            return send_response(200, {"message": "Claim deleted successfully"})

        else:
            return send_response(404, {"error": f"Route not found: {method} {event_path}"})

    except ValueError as ve:
        return send_response(404, {"error": str(ve)})
    except Exception as e:
        print("Internal error:", str(e))
        return send_response(500, {"error": f"Internal Server Error: {str(e)}"})

# Built-in local HTTP server for development
if __name__ == "__main__":
    from http.server import HTTPServer, BaseHTTPRequestHandler
    from urllib.parse import urlparse
    
    os.environ["NODE_ENV"] = "development"
    os.environ["USE_LOCAL_DB"] = "true"
    os.environ["ALLOWED_EMAILS"] = "dev-user@example.com"
    
    PORT = 3001
    
    class DevServerHandler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            # Suppress default server console spam
            pass

        def do_OPTIONS(self):
            self.send_response(200)
            for k, v in cors_headers.items():
                self.send_header(k, v)
            self.end_headers()

        def handle_request(self):
            parsed_url = urlparse(self.path)
            path_str = parsed_url.path
            
            # Read body content
            content_length = int(self.headers.get('Content-Length', 0))
            body_bytes = self.rfile.read(content_length) if content_length > 0 else b""
            body_str = body_bytes.decode("utf-8")
            
            # Formulate mock Lambda event
            event = {
                "httpMethod": self.command,
                "path": path_str,
                "headers": dict(self.headers),
                "body": body_str
            }
            
            # Invoke handler
            result = handler(event, None)
            
            self.send_response(result["statusCode"])
            for k, v in result["headers"].items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(result["body"].encode("utf-8"))

        def do_GET(self): self.handle_request()
        def do_POST(self): self.handle_request()
        def do_PUT(self): self.handle_request()
        def do_DELETE(self): self.handle_request()
        
    print("\n===============================================================")
    print(f"🚀 [DEV SERVER] Claims Tracker Python API at http://localhost:{PORT}")
    print("🔐 [DEV SERVER] Auth bypass enabled. Header: 'Authorization: Bearer dev-token'")
    print(f"📂 [DEV SERVER] Local DB file: {os.path.join(os.path.dirname(__file__), 'local_db.json')}")
    print("===============================================================\n")
    
    server = HTTPServer(("localhost", PORT), DevServerHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Dev Server...")
        server.server_close()
