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

  // POST /api/admin/broadcast - массовая рассылка
  // body: { message?: string, photo?: string, photoDataUrl?: string, userIds: number[] }
  router.post('/broadcast', telegramAuth, adminOnly(pool), async (req, res) => {
    try {
      const rawMessage = req.body && req.body.message;
      const rawPhoto = req.body && req.body.photo;
      const rawPhotoDataUrl = req.body && req.body.photoDataUrl;
      const rawUserIds = req.body && req.body.userIds;
      const message = typeof rawMessage === 'string' ? rawMessage.trim() : '';
      const photo = typeof rawPhoto === 'string' ? rawPhoto.trim() : '';
      const photoDataUrl = typeof rawPhotoDataUrl === 'string' ? rawPhotoDataUrl.trim() : '';
      const hasLocalPhoto = Boolean(photoDataUrl);
      let broadcastPhoto = photo;

      if (!message && !photo && !hasLocalPhoto) {
        return res.status(400).json({ error: 'Message or photo is required' });
      }

      if ((photo || hasLocalPhoto) && message.length > 1024) {
        return res.status(400).json({ error: 'Caption is too long (max 1024 chars for photo)' });
      }

      // userIds: либо массив от фронта, либо fallback к БД
      let userIdList = [];
      if (Array.isArray(rawUserIds) && rawUserIds.length > 0) {
        userIdList = rawUserIds
          .map(id => Number(id))
          .filter(id => Number.isFinite(id) && id > 0);
      } else {
        // fallback: пробуем получить из БД (может не работать при недоступности)
        try {
          const { rows } = await pool.query(
            'SELECT telegram_id FROM users WHERE telegram_id IS NOT NULL ORDER BY telegram_id'
          );
          userIdList = rows.map(r => Number(r.telegram_id)).filter(id => id > 0);
        } catch (dbErr) {
          console.error('DB fallback failed:', dbErr.message);
          return res.status(500).json({ error: 'userIds required: database not available' });
        }
      }

      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        return res.status(500).json({ error: 'Bot token not configured' });
      }

      if (hasLocalPhoto) {
        const match = photoDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (!match) {
          return res.status(400).json({ error: 'Invalid photoDataUrl format' });
        }

        const mimeType = match[1];
        const base64Payload = match[2];
        const imageBuffer = Buffer.from(base64Payload, 'base64');
        if (!imageBuffer.length) {
          return res.status(400).json({ error: 'Empty image data' });
        }

        if (imageBuffer.length > 10 * 1024 * 1024) {
          return res.status(400).json({ error: 'Image is too large (max 10MB)' });
        }

        const extensionByMime = {
          'image/jpeg': 'jpg',
          'image/jpg': 'jpg',
          'image/png': 'png',
          'image/webp': 'webp',
          'image/gif': 'gif'
        };
        const ext = extensionByMime[mimeType] || 'jpg';

        const fileForm = new FormData();
        fileForm.append('chat_id', String(req.telegramUser.id));
        if (message) {
          fileForm.append('caption', message);
          fileForm.append('parse_mode', 'HTML');
        }
        fileForm.append('photo', new Blob([imageBuffer], { type: mimeType }), `broadcast.${ext}`);

        const uploadResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: 'POST',
          body: fileForm
        });
        const uploadData = await uploadResponse.json();

        if (!uploadResponse.ok || !uploadData.ok) {
          return res.status(400).json({ error: uploadData.description || 'Failed to upload photo to Telegram' });
        }

        const variants = uploadData.result && uploadData.result.photo;
        const bestVariant = Array.isArray(variants) && variants.length ? variants[variants.length - 1] : null;
        if (!bestVariant || !bestVariant.file_id) {
          return res.status(500).json({ error: 'Failed to get Telegram file_id for image' });
        }

        broadcastPhoto = bestVariant.file_id;
      }

      const users = userIdList.map(id => ({ telegram_id: id }));

      if (!users.length) {
        return res.json({ ok: true, sent: 0, failed: 0, total: 0 });
      }

      let sent = 0;
      let failed = 0;
      const failedUsers = [];

      for (let i = 0; i < users.length; i += 1) {
        const telegramId = users[i].telegram_id;

        try {
          const method = broadcastPhoto ? 'sendPhoto' : 'sendMessage';
          const payload = broadcastPhoto
            ? {
              chat_id: telegramId,
              photo: broadcastPhoto,
              caption: message || undefined,
              parse_mode: 'HTML'
            }
            : {
              chat_id: telegramId,
              text: message,
              parse_mode: 'HTML'
            };

          const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const data = await response.json();
          if (response.ok && data.ok) {
            sent += 1;
          } else {
            failed += 1;
            failedUsers.push({ telegramId, error: data.description || 'Unknown error' });
          }
        } catch (err) {
          failed += 1;
          failedUsers.push({ telegramId, error: err.message || 'Network error' });
        }

        if (i < users.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      return res.json({
        ok: true,
        sent,
        failed,
        total: users.length,
        failedUsers: failedUsers.length ? failedUsers : undefined
      });
    } catch (err) {
      console.error('Broadcast error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

module.exports = { createAdminRouter, isAdmin, MAIN_ADMIN_TELEGRAM_ID };

