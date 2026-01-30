const { Pool } = require('pg');

function createPool(databaseUrl) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  // Many hosted Postgres providers require SSL. Local usually doesn't.
  const isLocal =
    databaseUrl.includes('localhost') ||
    databaseUrl.includes('127.0.0.1') ||
    databaseUrl.includes('postgres://postgres:postgres@');

  return new Pool({
    connectionString: databaseUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false }
  });
}

module.exports = { createPool };

