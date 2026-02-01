const { authRouter } = require('./routes/auth');
const { testsRouter } = require('./routes/tests');
const { resultsRouter } = require('./routes/results');
const { createAdminRouter } = require('./routes/admin');
const { subscriptionRouter } = require('./routes/subscription');
const { notifyRouter } = require('./routes/notify');

function createApp({ pool, app }) {
  if (!pool) throw new Error('pool is required');
  if (!app) throw new Error('app is required');

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

