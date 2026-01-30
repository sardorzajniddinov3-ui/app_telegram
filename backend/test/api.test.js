const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { newDb } = require('pg-mem');

const { createApp } = require('../src/app');

function loadSchemaSql() {
  return fs.readFileSync(path.join(__dirname, '..', 'src', 'db', 'schema.sql'), 'utf8');
}

async function seed(pool) {
  // One test with 2 questions
  const t = await pool.query(
    `INSERT INTO tests (title, description) VALUES ('Sample Test', 'Desc') RETURNING id`
  );
  const testId = t.rows[0].id;

  const q1 = await pool.query(
    `INSERT INTO questions (test_id, text, sort_order) VALUES ($1, $2, 0) RETURNING id`,
    [testId, 'Q1']
  );
  const q1Id = q1.rows[0].id;
  await pool.query(
    `INSERT INTO answers (question_id, text, is_correct, sort_order)
     VALUES ($1, 'A1', true, 0), ($1, 'A2', false, 1)`,
    [q1Id]
  );

  const q2 = await pool.query(
    `INSERT INTO questions (test_id, text, sort_order) VALUES ($1, $2, 1) RETURNING id`,
    [testId, 'Q2']
  );
  const q2Id = q2.rows[0].id;
  await pool.query(
    `INSERT INTO answers (question_id, text, is_correct, sort_order)
     VALUES ($1, 'B1', false, 0), ($1, 'B2', true, 1)`,
    [q2Id]
  );

  return { testId };
}

describe('Telegram Mini App API', () => {
  let db;
  let pool;
  let app;
  let seeded;

  beforeAll(async () => {
    db = newDb({ autoCreateForeignKeyIndices: true });
    const pg = db.adapters.createPg();
    pool = new pg.Pool();

    await pool.query(loadSchemaSql());
    seeded = await seed(pool);
    app = createApp({ pool });
  });

  afterAll(async () => {
    await pool.end();
  });

  test('POST /api/auth upserts user by telegram_id', async () => {
    const res = await request(app)
      .post('/api/auth')
      .send({ user: { id: 123, username: 'alice', first_name: 'Alice' } })
      .expect(200);

    expect(res.body.user).toBeTruthy();
    expect(res.body.user.telegram_id).toBe(123);
    expect(res.body.user.username).toBe('alice');
  });

  test('GET /api/tests returns list with question_count', async () => {
    const res = await request(app).get('/api/tests').expect(200);
    expect(Array.isArray(res.body.tests)).toBe(true);
    expect(res.body.tests.length).toBe(1);
    expect(res.body.tests[0].question_count).toBe(2);
  });

  test('GET /api/tests/:id returns questions and answers', async () => {
    const res = await request(app)
      .get(`/api/tests/${seeded.testId}`)
      .expect(200);

    expect(res.body.test).toBeTruthy();
    expect(res.body.questions.length).toBe(2);
    expect(res.body.questions[0].answers.length).toBe(2);
  });

  test('POST /api/results requires telegram user', async () => {
    await request(app)
      .post('/api/results')
      .send({ testId: seeded.testId, correct: 1, total: 2 })
      .expect(401);
  });

  test('POST /api/results saves result', async () => {
    const res = await request(app)
      .post('/api/results')
      .send({
        user: { id: 555, username: 'bob' },
        testId: seeded.testId,
        correct: 2,
        total: 2,
        answered: 2,
        timeSeconds: 15
      })
      .expect(201);

    expect(res.body.result).toBeTruthy();
    expect(res.body.result.test_id).toBe(seeded.testId);
    expect(res.body.result.percentage).toBe(100);
  });
});

