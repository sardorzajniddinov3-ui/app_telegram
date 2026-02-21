const express = require('express');
const { telegramAuth } = require('../middleware/telegramAuth');

const MAIN_ADMIN_TELEGRAM_ID = 473842863; // Всегда админ

/**
 * Проверка админ-доступа через БД
 * @param {import('pg').Pool} pool
 */
async function isAdmin(pool, telegramId) {
  if (!telegramId || !Number.isFinite(Number(telegramId))) return false;
  const id = Number(telegramId);
  
  // Главный админ всегда имеет доступ
  if (id === MAIN_ADMIN_TELEGRAM_ID) return true;
  
  // Проверяем в БД
  const { rows } = await pool.query(
    'SELECT 1 FROM admins WHERE telegram_id = $1 LIMIT 1',
    [id]
  );
  return rows.length > 0;
}

/**
 * Middleware для проверки админ-доступа
 * @param {import('pg').Pool} pool
 */
function adminOnly(pool) {
  return async (req, res, next) => {
    const id = req.telegramUser && req.telegramUser.id ? Number(req.telegramUser.id) : null;
    const hasAccess = await isAdmin(pool, id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

function mainAdminOnly(req, res, next) {
  const id = req.telegramUser && req.telegramUser.id ? Number(req.telegramUser.id) : null;
  if (id !== MAIN_ADMIN_TELEGRAM_ID) {
    return res.status(403).json({ error: 'Forbidden: main admin only' });
  }
  next();
}

/**
 * @param {import('pg').Pool} pool
 */
function createAdminRouter(pool) {
  const router = express.Router();

  // GET /api/admin/admins - список всех администраторов
  router.get('/admins', telegramAuth, adminOnly(pool), async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `
        SELECT
          telegram_id AS "telegramId",
          created_at AS "createdAt",
          created_by AS "createdBy"
        FROM admins
        ORDER BY created_at ASC
        `
      );
      res.json({ admins: rows });
    } catch (err) {
      console.error('Error fetching admins:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/admin/admins - добавить администратора
  router.post('/admins', telegramAuth, adminOnly(pool), async (req, res) => {
    try {
      const telegramId = Number(req.body && req.body.telegramId);
      const currentAdminId = req.telegramUser && req.telegramUser.id ? Number(req.telegramUser.id) : null;

      if (!Number.isFinite(telegramId) || telegramId <= 0) {
        return res.status(400).json({ error: 'Invalid telegramId' });
      }

      // Нельзя добавить самого себя (если уже админ)
      if (telegramId === currentAdminId) {
        return res.status(400).json({ error: 'Cannot add yourself' });
      }

      // Проверяем, не является ли уже админом
      const existing = await pool.query(
        'SELECT 1 FROM admins WHERE telegram_id = $1 LIMIT 1',
        [telegramId]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'User is already an admin' });
      }

      // Добавляем админа
      const { rows } = await pool.query(
        `
        INSERT INTO admins (telegram_id, created_by)
        VALUES ($1, $2)
        RETURNING
          telegram_id AS "telegramId",
          created_at AS "createdAt",
          created_by AS "createdBy"
        `,
        [telegramId, currentAdminId || MAIN_ADMIN_TELEGRAM_ID]
      );

      res.json({ ok: true, admin: rows[0] });
    } catch (err) {
      console.error('Error adding admin:', err);
      if (err.code === '23505') { // Unique violation
        return res.status(400).json({ error: 'User is already an admin' });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE /api/admin/admins/:telegramId - удалить администратора
  router.delete('/admins/:telegramId', telegramAuth, adminOnly(pool), async (req, res) => {
    try {
      const telegramId = Number(req.params.telegramId);
      const currentAdminId = req.telegramUser && req.telegramUser.id ? Number(req.telegramUser.id) : null;

      if (!Number.isFinite(telegramId) || telegramId <= 0) {
        return res.status(400).json({ error: 'Invalid telegramId' });
      }

      // Нельзя удалить главного админа
      if (telegramId === MAIN_ADMIN_TELEGRAM_ID) {
        return res.status(400).json({ error: 'Cannot remove main admin' });
      }

      // Нельзя удалить самого себя
      if (telegramId === currentAdminId) {
        return res.status(400).json({ error: 'Cannot remove yourself' });
      }

      const { rowCount } = await pool.query(
        'DELETE FROM admins WHERE telegram_id = $1',
        [telegramId]
      );

      if (rowCount === 0) {
        return res.status(404).json({ error: 'Admin not found' });
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('Error removing admin:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/admin/check - проверить, является ли текущий пользователь админом
  router.get('/check', telegramAuth, async (req, res) => {
    try {
      const id = req.telegramUser && req.telegramUser.id ? Number(req.telegramUser.id) : null;
      const hasAccess = await isAdmin(pool, id);
      res.json({ isAdmin: hasAccess });
    } catch (err) {
      console.error('Error checking admin status:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/admin/subscriptions/active
  router.get('/subscriptions/active', telegramAuth, adminOnly(pool), async (_req, res) => {
    const { rows } = await pool.query(
      `
      SELECT
        telegram_id AS "telegramId",
        COALESCE(first_name, '') || CASE WHEN last_name IS NULL THEN '' ELSE ' ' || last_name END AS "name",
        subscription_status AS "subscriptionStatus",
        subscription_expires_at AS "subscriptionExpiresAt"
      FROM users
      WHERE subscription_status = 'active'
        AND subscription_expires_at IS NOT NULL
        AND subscription_expires_at > NOW()
      ORDER BY subscription_expires_at ASC
      `
    );
    res.json({ users: rows });
  });

  // POST /api/admin/subscriptions/grant
  // body: { telegramId: number|string, days?: number }
  router.post('/subscriptions/grant', telegramAuth, adminOnly(pool), async (req, res) => {
    const telegramId = Number(req.body && req.body.telegramId);
    const daysRaw = req.body && req.body.days != null ? Number(req.body.days) : 30;
    const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.floor(daysRaw) : 30;

    if (!Number.isFinite(telegramId) || telegramId <= 0) {
      return res.status(400).json({ error: 'Invalid telegramId' });
    }

    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    // Upsert minimal user; name fields can be filled later via /api/auth when user opens app
    const { rows } = await pool.query(
      `
      INSERT INTO users (telegram_id, subscription_status, subscription_expires_at)
      VALUES ($1, 'active', $2)
      ON CONFLICT (telegram_id)
      DO UPDATE SET
        subscription_status = 'active',
        subscription_expires_at = EXCLUDED.subscription_expires_at,
        updated_at = NOW()
      RETURNING
        telegram_id AS "telegramId",
        subscription_status AS "subscriptionStatus",
        subscription_expires_at AS "subscriptionExpiresAt"
      `,
      [telegramId, expiresAt.toISOString()]
    );

    res.json({ ok: true, user: rows[0] });
  });

  // POST /api/admin/broadcast - массовая рассылка сообщений
  // body: { message: string }
  router.post('/broadcast', telegramAuth, mainAdminOnly, async (req, res) => {
    try {
      const message = req.body && req.body.message;
      const currentAdminId = req.telegramUser && req.telegramUser.id ? Number(req.telegramUser.id) : null;

      // Проверяем, что сообщение не пустое
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message is required' });
      }

      // Проверяем токен бота
      const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      if (!BOT_TOKEN) {
        return res.status(500).json({ error: 'Bot token not configured' });
      }

      console.log(`Admin ${currentAdminId} starting broadcast. Message: "${message.substring(0, 50)}..."`);

      // Получаем всех пользователей из Supabase
      const { rows: users } = await pool.query(
        'SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL ORDER BY telegram_id'
      );

      if (users.length === 0) {
        return res.json({ ok: true, sent: 0, failed: 0, message: 'No users found' });
      }

      console.log(`Found ${users.length} users for broadcast`);

      let sent = 0;
      let failed = 0;
      const failedUsers = [];

      // Отправляем сообщения с задержкой
      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const telegramId = user.telegram_id;

        try {
          const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              chat_id: telegramId,
              text: message,
              parse_mode: 'HTML'
            })
          });

          const result = await response.json();

          if (response.ok && result.ok) {
            sent++;
            console.log(`✅ Message sent to ${telegramId}`);
          } else {
            failed++;
            failedUsers.push({ telegramId, error: result.description || 'Unknown error' });
            console.log(`❌ Failed to send to ${telegramId}: ${result.description || 'Unknown error'}`);
          }
        } catch (error) {
          failed++;
          failedUsers.push({ telegramId, error: error.message });
          console.log(`❌ Error sending to ${telegramId}: ${error.message}`);
        }

        // Добавляем задержку между отправками (100ms между сообщениями)
        if (i < users.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`Broadcast completed. Sent: ${sent}, Failed: ${failed}`);

      res.json({
        ok: true,
        sent,
        failed,
        total: users.length,
        failedUsers: failedUsers.length > 0 ? failedUsers : undefined
      });

    } catch (err) {
      console.error('Error in broadcast:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

module.exports = { createAdminRouter, isAdmin, MAIN_ADMIN_TELEGRAM_ID };

