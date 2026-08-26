import os
import json
import urllib.request
import urllib.error

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")

# Standard single-tenant whitelist fallback
ALLOWED_EMAILS = [
    email.strip().lower() 
    for email in os.environ.get("ALLOWED_EMAILS", "").split(",") 
    if email.strip()
]

# Advanced multi-tenant whitelists & mappings
# Format: tenantName1:email1,email2;tenantName2:email3,email4
TENANT_MAP_ENV = os.environ.get("TENANT_MAP", "")
TENANT_MAPPING = {}
ALL_ALLOWED_EMAILS = set(ALLOWED_EMAILS)

if TENANT_MAP_ENV:
    for group in TENANT_MAP_ENV.split(";"):
        if not group.strip() or ":" not in group:
            continue
        try:
            tenant_id, emails_str = group.split(":", 1)
            tenant_id = tenant_id.strip()
            emails = [e.strip().lower() for e in emails_str.split(",") if e.strip()]
            
            TENANT_MAPPING[tenant_id] = emails
            for email in emails:
                ALL_ALLOWED_EMAILS.add(email)
        except Exception as e:
            print(f"Error parsing tenant map group '{group}': {e}")

def get_user_tenant(email):
    # If advanced mapping is configured, find the tenant matching the email
    if TENANT_MAP_ENV:
        for tenant_id, emails in TENANT_MAPPING.items():
            if email in emails:
                return tenant_id
    
    # Fallback: all emails in ALLOWED_EMAILS share the first email as tenant ID
    return ALLOWED_EMAILS[0] if ALLOWED_EMAILS else email

def verify_token(auth_header):
    if not auth_header or not auth_header.startswith("Bearer "):
        raise ValueError("Missing or invalid Authorization header")

    token = auth_header[7:]  # Strip 'Bearer '

    # Enable bypass for local development
    if os.environ.get("NODE_ENV") == "development" and token == "dev-token":
        dev_email = "dev-user@example.com"
        tenant_id = get_user_tenant(dev_email)
        return {
            "userId": dev_email,
            "tenantId": tenant_id,
            "name": "Development User",
            "picture": ""
        }

    if not GOOGLE_CLIENT_ID:
        raise ValueError("GOOGLE_CLIENT_ID is not configured on the backend")

    # Call Google tokeninfo API to verify the token
    url = f"https://oauth2.googleapis.com/tokeninfo?id_token={token}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode("utf-8"))
            
            # Verify signature, expiration, and audience (handled by tokeninfo API)
            aud = data.get("aud")
            if aud != GOOGLE_CLIENT_ID:
                raise ValueError("Token audience does not match GOOGLE_CLIENT_ID")
                
            email = data.get("email", "").lower()
            if not email:
                raise ValueError("Email not found in token")
                
            # Verify email allowlist
            if ALL_ALLOWED_EMAILS and email not in ALL_ALLOWED_EMAILS:
                raise PermissionError(f"Access denied for email: {email}")
                
            # Determine tenant
            tenant_id = get_user_tenant(email)
                
            return {
                "userId": email,
                "tenantId": tenant_id,
                "name": data.get("name"),
                "picture": data.get("picture")
            }
    except urllib.error.HTTPError as e:
        error_msg = e.read().decode("utf-8")
        print(f"Tokeninfo HTTP error: {e.code} - {error_msg}")
        raise ValueError(f"Invalid Google ID token: {error_msg}")
    except Exception as e:
        print(f"Token verification unexpected error: {str(e)}")
        raise ValueError(f"Token verification failed: {str(e)}")
