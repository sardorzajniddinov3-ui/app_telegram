require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { createPool } = require('./db/pool');
const { migrate } = require('./db/migrate');
const { createApp } = require('./app');

async function main() {
  // Читаем PORT из переменных окружения (Railway автоматически устанавливает его)
  const PORT = process.env.PORT || 3000;
  const databaseUrl = process.env.DATABASE_URL;
  const runMigrations = String(process.env.RUN_MIGRATIONS || '').toLowerCase() === 'true';

  // Проверяем обязательные переменные окружения
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required. Please set it in environment variables.');
  }

  console.log('Starting server...');
  console.log(`PORT: ${PORT}`);
  console.log(`RUN_MIGRATIONS: ${runMigrations}`);

  // Создаем пул подключений к БД
  let pool;
  try {
    pool = createPool(databaseUrl);
    console.log('Database pool created');
  } catch (err) {
    console.error('Failed to create database pool:', err);
    throw err;
  }

  // Выполняем миграции, если нужно
  if (runMigrations) {
    try {
      console.log('Running migrations...');
      await migrate({ pool });
      console.log('Migrations completed');
    } catch (err) {
      console.error('Migration error:', err);
      throw err;
    }
  }

  // Создаем Express приложение
  const app = express();
  
  // 1. САМОЕ ПЕРВОЕ - CORS
  app.use(cors({ origin: '*' }));
  
  // 2. Потом JSON
  app.use(express.json());
  
  // 3. Потом логи (опционально)
  app.use((req, res, next) => {
    console.log('Request:', req.method, req.url);
    next();
  });
  
  // Проверка здоровья сервера (чтобы Railway не убивал процесс)
  app.get('/', (req, res) => {
    res.status(200).send('Server is running and healthy! 🚀');
  });

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
  });
  
  // 4. Потом роуты
  createApp({ pool, app });

  // Запускаем сервер на 0.0.0.0 для Railway (принимает соединения извне)
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server started on port ${PORT}`);
  });

  // Обработка ошибок сервера
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use`);
    } else {
      console.error('❌ Server error:', err);
    }
    process.exit(1);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    
    server.close(async () => {
      console.log('HTTP server closed');
      
      try {
        await pool.end();
        console.log('Database pool closed');
        process.exit(0);
      } catch (err) {
        console.error('Error closing database pool:', err);
        process.exit(1);
      }
    });

    // Принудительное завершение через 10 секунд
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Запускаем только если файл вызван напрямую (не при импорте)
if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Fatal startup error:', err);
    console.error(err.stack);
    process.exit(1);
  });
}

