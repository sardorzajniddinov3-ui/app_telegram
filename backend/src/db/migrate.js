const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { createPool } = require('./pool');

async function migrate({ pool }) {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const pool = createPool(databaseUrl);
  try {
    await migrate({ pool });
    console.log('Migrations applied.');
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

module.exports = { migrate };

