const path = require('path');
const { verifyToken } = require('./auth');
const claimsDb = require('./claims');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event));

  // Extract HTTP method and path
  const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method);
  const eventPath = event.path || (event.requestContext && event.requestContext.http && event.requestContext.http.path);
  const pathParameters = event.pathParameters || {};

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Response helper
  const sendResponse = (statusCode, data) => ({
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(data)
  });

  try {
    // 1. Authenticate request
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
      return sendResponse(401, { error: 'Unauthorized: Missing Authorization token' });
    }

    let user;
    try {
      user = await verifyToken(authHeader);
    } catch (authError) {
      return sendResponse(403, { error: authError.message });
    }

    const userId = user.userId;

    // 2. Routing logic
    // Match GET /claims
    if (method === 'GET' && (eventPath === '/claims' || eventPath.endsWith('/claims'))) {
      const claims = await claimsDb.listClaims(userId);
      return sendResponse(200, claims);
    }

    // Match GET /claims/{id}
    if (method === 'GET' && pathParameters.id) {
      const claim = await claimsDb.getClaim(userId, pathParameters.id);
      if (!claim) {
        return sendResponse(404, { error: 'Claim not found' });
      }
      return sendResponse(200, claim);
    }

    // Match POST /claims
    if (method === 'POST' && (eventPath === '/claims' || eventPath.endsWith('/claims'))) {
      const body = event.body ? JSON.parse(event.body) : {};
      const newClaim = await claimsDb.createClaim(userId, body);
      return sendResponse(201, newClaim);
    }

    // Match PUT /claims/{id}
    if (method === 'PUT' && pathParameters.id) {
      const body = event.body ? JSON.parse(event.body) : {};
      const updatedClaim = await claimsDb.updateClaim(userId, pathParameters.id, body);
      return sendResponse(200, updatedClaim);
    }

    // Match DELETE /claims/{id}
    if (method === 'DELETE' && pathParameters.id) {
      await claimsDb.deleteClaim(userId, pathParameters.id);
      return sendResponse(200, { message: 'Claim deleted successfully' });
    }

    return sendResponse(404, { error: `Route not found: ${method} ${eventPath}` });

  } catch (error) {
    console.error('Handler error:', error);
    return sendResponse(500, { error: `Internal Server Error: ${error.message}` });
  }
};

// Local HTTP Server for local development (runs when executed directly)
if (require.main === module) {
  const http = require('http');
  const PORT = process.env.PORT || 3001;

  // Set environment variables for local dev if not set
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  process.env.USE_LOCAL_DB = process.env.USE_LOCAL_DB || 'true';
  process.env.ALLOWED_EMAILS = process.env.ALLOWED_EMAILS || 'dev-user@example.com';

  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      // Build mock Lambda event
      const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
      const pathParts = parsedUrl.pathname.split('/');
      // Match path like /claims or /claims/123-abc
      const id = pathParts.length > 2 && pathParts[1] === 'claims' ? pathParts[2] : null;

      const event = {
        httpMethod: req.method,
        path: parsedUrl.pathname,
        headers: req.headers,
        body: body,
        pathParameters: id ? { id } : null
      };

      try {
        const result = await exports.handler(event);
        res.writeHead(result.statusCode, result.headers);
        res.end(result.body);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  });

  server.listen(PORT, () => {
    console.log(`\n===============================================================`);
    console.log(`🚀 [DEV SERVER] Claims Tracker API running at http://localhost:${PORT}`);
    console.log(`🔐 [DEV SERVER] Auth bypass enabled. Header: "Authorization: Bearer dev-token"`);
    console.log(`📂 [DEV SERVER] Using local database file: ${path.join(__dirname, 'local_db.json')}`);
    console.log(`===============================================================\n`);
  });
}
