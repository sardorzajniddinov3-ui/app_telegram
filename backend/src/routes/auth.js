const express = require('express');
const { extractTelegramUser } = require('../middleware/telegramAuth');

function authRouter({ pool }) {
  const router = express.Router();

  // POST /api/auth – сохранить пользователя
  router.post('/auth', async (req, res) => {
    const user = extractTelegramUser(req);
    if (!user) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Telegram user not provided (expected initDataUnsafe.user)'
      });
    }

    const telegramId = Number(user.id);
    if (!telegramId || Number.isNaN(telegramId)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid user.id' });
    }

    const username = user.username || null;
    const firstName = user.first_name || null;
    const lastName = user.last_name || null;
    const languageCode = user.language_code || null;
    const photoUrl = user.photo_url || null;

    const result = await pool.query(
      `
      INSERT INTO users (telegram_id, username, first_name, last_name, language_code, photo_url)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (telegram_id) DO UPDATE SET
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        language_code = EXCLUDED.language_code,
        photo_url = EXCLUDED.photo_url,
        updated_at = NOW()
      RETURNING id, telegram_id, username, first_name, last_name, language_code, photo_url, created_at, updated_at
      `,
      [telegramId, username, firstName, lastName, languageCode, photoUrl]
    );

    return res.json({ user: result.rows[0] });
  });

  return router;
}

module.exports = { authRouter };

