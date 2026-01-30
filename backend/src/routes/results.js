const express = require('express');
const { telegramAuth } = require('../middleware/telegramAuth');

function resultsRouter({ pool }) {
  const router = express.Router();

  // POST /api/results – сохранить результат
  router.post('/results', telegramAuth, async (req, res) => {
    const telegramUser = req.telegramUser;
    const telegramId = Number(telegramUser.id);

    const testId = Number(req.body.testId);
    const correct = Number(req.body.correct ?? 0);
    const total = Number(req.body.total ?? 0);
    const answered = Number(req.body.answered ?? correct);
    const timeSeconds = req.body.timeSeconds !== undefined && req.body.timeSeconds !== null
      ? Number(req.body.timeSeconds)
      : null;

    if (!testId || Number.isNaN(testId)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid testId' });
    }
    if (Number.isNaN(correct) || correct < 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid correct' });
    }
    if (Number.isNaN(total) || total < 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid total' });
    }

    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

    // Ensure user exists (upsert light)
    const userRes = await pool.query(
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
      RETURNING id
      `,
      [
        telegramId,
        telegramUser.username || null,
        telegramUser.first_name || null,
        telegramUser.last_name || null,
        telegramUser.language_code || null,
        telegramUser.photo_url || null
      ]
    );

    const userId = userRes.rows[0].id;

    const resultRes = await pool.query(
      `
      INSERT INTO results (user_id, test_id, correct, total, answered, percentage, time_seconds)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, user_id, test_id, correct, total, answered, percentage, time_seconds, created_at
      `,
      [userId, testId, correct, total, answered, percentage, timeSeconds]
    );

    return res.status(201).json({ result: resultRes.rows[0] });
  });

  return router;
}

module.exports = { resultsRouter };

