const express = require('express');
const { telegramAuth } = require('../middleware/telegramAuth');

function subscriptionRouter({ pool }) {
  const router = express.Router();

  // GET /api/subscription/me
  router.get('/me', telegramAuth, async (req, res) => {
    const telegramId = Number(req.telegramUser.id);

    const { rows } = await pool.query(
      `
      SELECT
        telegram_id AS "telegramId",
        subscription_status AS "subscriptionStatus",
        subscription_expires_at AS "subscriptionExpiresAt"
      FROM users
      WHERE telegram_id = $1
      `,
      [telegramId]
    );

    const row = rows[0] || null;
    const now = Date.now();
    const expiresAtMs = row?.subscriptionExpiresAt ? new Date(row.subscriptionExpiresAt).getTime() : null;
    const active = row?.subscriptionStatus === 'active' && expiresAtMs && expiresAtMs > now;

    return res.json({
      telegramId,
      subscriptionStatus: row?.subscriptionStatus || 'inactive',
      subscriptionExpiresAt: row?.subscriptionExpiresAt || null,
      active
    });
  });

  return router;
}

module.exports = { subscriptionRouter };

