const express = require('express');

function testsRouter({ pool }) {
  const router = express.Router();

  // GET /api/tests – список тестов
  router.get('/tests', async (_req, res) => {
    const result = await pool.query(
      `
      SELECT
        t.id,
        t.title,
        t.description,
        COUNT(q.id)::int AS question_count
      FROM tests t
      LEFT JOIN questions q ON q.test_id = t.id
      GROUP BY t.id
      ORDER BY t.id ASC
      `
    );

    res.json({ tests: result.rows });
  });

  // GET /api/tests/:id – вопросы и ответы
  router.get('/tests/:id', async (req, res) => {
    const testId = Number(req.params.id);
    if (!testId || Number.isNaN(testId)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid test id' });
    }

    const testRes = await pool.query(
      `SELECT id, title, description FROM tests WHERE id = $1`,
      [testId]
    );

    if (testRes.rowCount === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Test not found' });
    }

    const qaRes = await pool.query(
      `
      SELECT
        q.id AS question_id,
        q.text AS question_text,
        q.image_url AS question_image_url,
        q.sort_order AS question_sort_order,
        a.id AS answer_id,
        a.text AS answer_text,
        a.is_correct AS answer_is_correct,
        a.sort_order AS answer_sort_order
      FROM questions q
      LEFT JOIN answers a ON a.question_id = q.id
      WHERE q.test_id = $1
      ORDER BY q.sort_order ASC, q.id ASC, a.sort_order ASC, a.id ASC
      `,
      [testId]
    );

    const questionsById = new Map();
    for (const row of qaRes.rows) {
      if (!questionsById.has(row.question_id)) {
        questionsById.set(row.question_id, {
          id: row.question_id,
          text: row.question_text,
          imageUrl: row.question_image_url,
          answers: []
        });
      }

      if (row.answer_id) {
        questionsById.get(row.question_id).answers.push({
          id: row.answer_id,
          text: row.answer_text,
          // NOTE: many clients should not receive isCorrect; but requirement says "answers",
          // so we include it (useful for admin/testing). Remove if you want strict exam mode.
          isCorrect: row.answer_is_correct
        });
      }
    }

    return res.json({
      test: testRes.rows[0],
      questions: Array.from(questionsById.values())
    });
  });

  return router;
}

module.exports = { testsRouter };

