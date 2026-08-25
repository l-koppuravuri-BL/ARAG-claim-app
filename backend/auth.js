const { OAuth2Client } = require('google-auth-library');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
// Parse comma-separated list of allowed emails
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

const client = new OAuth2Client(CLIENT_ID);

async function verifyToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }

  const token = authHeader.substring(7); // Remove 'Bearer '

  // Allow bypass in local development
  if (process.env.NODE_ENV === 'development' && token === 'dev-token') {
    return {
      userId: 'dev-user@example.com',
      email: 'dev-user@example.com',
      name: 'Development User',
      picture: ''
    };
  }
  
  if (!CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID is not configured on the backend');
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const email = payload.email.toLowerCase();
    
    // Check if email is in the allowlist
    if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(email)) {
      throw new Error(`Access denied for email: ${email}`);
    }
    
    return {
      userId: email, // Use email as user identifier
      email: email,
      name: payload.name,
      picture: payload.picture
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

module.exports = { verifyToken };
