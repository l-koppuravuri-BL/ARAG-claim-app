import os
import json
import urllib.request
import urllib.error

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
ALLOWED_EMAILS = [
    email.strip().lower() 
    for email in os.environ.get("ALLOWED_EMAILS", "").split(",") 
    if email.strip()
]

def verify_token(auth_header):
    if not auth_header or not auth_header.startswith("Bearer "):
        raise ValueError("Missing or invalid Authorization header")

    token = auth_header[7:]  # Strip 'Bearer '

    # Enable bypass for local development
    if os.environ.get("NODE_ENV") == "development" and token == "dev-token":
        dev_email = "dev-user@example.com"
        return {
            "userId": dev_email,
            "tenantId": ALLOWED_EMAILS[0] if ALLOWED_EMAILS else dev_email,
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
            # We just need to check that the audience matches our client ID
            aud = data.get("aud")
            if aud != GOOGLE_CLIENT_ID:
                raise ValueError("Token audience does not match GOOGLE_CLIENT_ID")
                
            email = data.get("email", "").lower()
            if not email:
                raise ValueError("Email not found in token")
                
            # Verify email allowlist
            if ALLOWED_EMAILS and email not in ALLOWED_EMAILS:
                raise PermissionError(f"Access denied for email: {email}")
                
            # Use the first whitelisted email as the tenantId partition key for shared family access
            primary_tenant = ALLOWED_EMAILS[0] if ALLOWED_EMAILS else email
                
            return {
                "userId": email,
                "tenantId": primary_tenant,
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
