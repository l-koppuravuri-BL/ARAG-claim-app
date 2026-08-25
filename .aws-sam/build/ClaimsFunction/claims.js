const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, PutCommand, DeleteCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

const TABLE_NAME = process.env.CLAIMS_TABLE_NAME || 'Claims';
// If not running in Lambda (no AWS_REGION) or explicitly set to use local database
const USE_LOCAL_DB = process.env.USE_LOCAL_DB === 'true' || !process.env.AWS_REGION;

// Local JSON DB file configuration
const LOCAL_DB_PATH = path.join(__dirname, 'local_db.json');

function readLocalDb() {
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify([]));
    return [];
  }
  try {
    const data = fs.readFileSync(LOCAL_DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading local DB file:', err);
    return [];
  }
}

function writeLocalDb(data) {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error writing local DB file:', err);
  }
}

// AWS DynamoDB Client configuration
let ddbDocClient = null;
if (!USE_LOCAL_DB) {
  const ddbClient = new DynamoDBClient({});
  ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
}

async function listClaims(userId) {
  if (USE_LOCAL_DB) {
    const db = readLocalDb();
    return db.filter(claim => claim.userId === userId);
  }

  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId,
    },
  };

  try {
    const data = await ddbDocClient.send(new QueryCommand(params));
    return data.Items || [];
  } catch (error) {
    console.error('DynamoDB query error:', error);
    throw new Error(`Failed to list claims: ${error.message}`);
  }
}

async function getClaim(userId, id) {
  if (USE_LOCAL_DB) {
    const db = readLocalDb();
    return db.find(claim => claim.userId === userId && claim.id === id) || null;
  }

  const params = {
    TableName: TABLE_NAME,
    Key: { userId, id },
  };

  try {
    const data = await ddbDocClient.send(new GetCommand(params));
    return data.Item || null;
  } catch (error) {
    console.error('DynamoDB get error:', error);
    throw new Error(`Failed to get claim: ${error.message}`);
  }
}

async function createClaim(userId, claimData) {
  const now = new Date().toISOString();
  const id = claimData.id || crypto.randomUUID();
  const newClaim = {
    ...claimData,
    id,
    userId,
    createdAt: now,
    updatedAt: now,
  };

  if (USE_LOCAL_DB) {
    const db = readLocalDb();
    db.push(newClaim);
    writeLocalDb(db);
    return newClaim;
  }

  const params = {
    TableName: TABLE_NAME,
    Item: newClaim,
  };

  try {
    await ddbDocClient.send(new PutCommand(params));
    return newClaim;
  } catch (error) {
    console.error('DynamoDB put error:', error);
    throw new Error(`Failed to create claim: ${error.message}`);
  }
}

async function updateClaim(userId, id, claimData) {
  const now = new Date().toISOString();

  if (USE_LOCAL_DB) {
    const db = readLocalDb();
    const index = db.findIndex(claim => claim.userId === userId && claim.id === id);
    if (index === -1) {
      throw new Error('Claim not found');
    }
    const updatedClaim = {
      ...db[index],
      ...claimData,
      id,
      userId,
      updatedAt: now,
    };
    db[index] = updatedClaim;
    writeLocalDb(db);
    return updatedClaim;
  }

  const existing = await getClaim(userId, id);
  if (!existing) {
    throw new Error('Claim not found');
  }

  const updatedClaim = {
    ...existing,
    ...claimData,
    id,
    userId,
    updatedAt: now,
  };

  const params = {
    TableName: TABLE_NAME,
    Item: updatedClaim,
  };

  try {
    await ddbDocClient.send(new PutCommand(params));
    return updatedClaim;
  } catch (error) {
    console.error('DynamoDB update error:', error);
    throw new Error(`Failed to update claim: ${error.message}`);
  }
}

async function deleteClaim(userId, id) {
  if (USE_LOCAL_DB) {
    const db = readLocalDb();
    const newDb = db.filter(claim => !(claim.userId === userId && claim.id === id));
    if (db.length === newDb.length) {
      throw new Error('Claim not found');
    }
    writeLocalDb(newDb);
    return { success: true };
  }

  const params = {
    TableName: TABLE_NAME,
    Key: { userId, id },
  };

  try {
    await ddbDocClient.send(new DeleteCommand(params));
    return { success: true };
  } catch (error) {
    console.error('DynamoDB delete error:', error);
    throw new Error(`Failed to delete claim: ${error.message}`);
  }
}

module.exports = {
  listClaims,
  getClaim,
  createClaim,
  updateClaim,
  deleteClaim,
};
