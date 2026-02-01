const express = require('express');
const cors = require('cors');

const { authRouter } = require('./routes/auth');
const { testsRouter } = require('./routes/tests');
const { resultsRouter } = require('./routes/results');
const { createAdminRouter } = require('./routes/admin');
const { subscriptionRouter } = require('./routes/subscription');
const { notifyRouter } = require('./routes/notify');

function createApp({ pool }) {
  if (!pool) throw new Error('pool is required');

  const app = express();

  // Настройка CORS максимально открыто (для Vercel, Localhost, Telegram)
  app.use(cors({
    origin: '*', // Разрешаем всем (Vercel, Localhost, Telegram)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
  
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.use('/api', authRouter({ pool }));
  app.use('/api', testsRouter({ pool }));
  app.use('/api', resultsRouter({ pool }));
  app.use('/api', subscriptionRouter({ pool }));
  app.use('/api/notify', notifyRouter());
  app.use('/api/admin', createAdminRouter(pool));

  // Error handler
  app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  return app;
}

module.exports = { createApp };

