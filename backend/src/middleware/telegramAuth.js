function extractTelegramUser(req) {
  // Preferred: body.user (from initDataUnsafe.user)
  const bodyUser = req.body && req.body.user ? req.body.user : null;
  if (bodyUser && bodyUser.id) return bodyUser;

  // Alternative: header x-telegram-user-id (простой fallback)
  const userIdHeader = req.headers['x-telegram-user-id'];
  if (userIdHeader) {
    const userId = Number(userIdHeader);
    if (Number.isFinite(userId) && userId > 0) {
      return { id: userId };
    }
  }

  // Alternative: header x-telegram-user: base64 encoded JSON или plain JSON
  const header = req.headers['x-telegram-user'];
  const isEncoded = req.headers['x-telegram-user-encoded'] === 'base64';
  
  if (typeof header === 'string' && header.trim()) {
    try {
      let decoded = header;
      
      // Если заголовок закодирован в base64, декодируем
      if (isEncoded) {
        try {
          // В Node.js используем Buffer для декодирования base64
          const buffer = Buffer.from(header, 'base64');
          decoded = buffer.toString('utf8');
        } catch (e) {
          // Если не base64, пробуем как обычный JSON
          decoded = header;
        }
      }
      
      const parsed = JSON.parse(decoded);
      if (parsed && parsed.id) return parsed;
    } catch (_) {
      // Игнорируем ошибки парсинга
    }
  }

  // Alternative: body.initDataUnsafe.user (some clients send whole initDataUnsafe)
  const unsafeUser = req.body && req.body.initDataUnsafe && req.body.initDataUnsafe.user
    ? req.body.initDataUnsafe.user
    : null;
  if (unsafeUser && unsafeUser.id) return unsafeUser;

  return null;
}

function telegramAuth(req, res, next) {
  const user = extractTelegramUser(req);
  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Telegram user not provided (expected initDataUnsafe.user)'
    });
  }

  req.telegramUser = user;
  next();
}

module.exports = { telegramAuth, extractTelegramUser };

