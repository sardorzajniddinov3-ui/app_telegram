require('dotenv').config();

const { createPool } = require('./db/pool');
const { migrate } = require('./db/migrate');
const { createApp } = require('./app');

async function main() {
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  const databaseUrl = process.env.DATABASE_URL;
  const runMigrations = String(process.env.RUN_MIGRATIONS || '').toLowerCase() === 'true';

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = createPool(databaseUrl);

  if (runMigrations) {
    await migrate({ pool });
  }

  const app = createApp({ pool });

  const server = app.listen(port, () => {
    console.log(`API listening on :${port}`);
  });

  const shutdown = async () => {
    console.log('Shutting down...');
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}

