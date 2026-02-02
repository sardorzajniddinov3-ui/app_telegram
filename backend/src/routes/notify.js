const express = require('express');

function notifyRouter() {
  const router = express.Router();

  // GET /api/notify/test - тестовый endpoint для проверки
  router.get('/test', (req, res) => {
    res.json({ 
      success: true, 
      message: 'Notify router is working',
      hasBotToken: !!process.env.TELEGRAM_BOT_TOKEN,
      hasAdminId: !!process.env.TELEGRAM_ADMIN_ID
    });
  });

  // POST /api/notify/payment
  router.post('/payment', async (req, res) => {
    try {
      const { amount, tariffName, userInfo, userId } = req.body;

      const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      const ADMIN_ID = process.env.TELEGRAM_ADMIN_ID;

      console.log('📨 Payment notification request received:', {
        amount,
        tariffName,
        userInfo,
        userId,
        hasBotToken: !!BOT_TOKEN,
        hasAdminId: !!ADMIN_ID,
        botTokenLength: BOT_TOKEN ? BOT_TOKEN.length : 0,
        adminId: ADMIN_ID,
        fullBody: JSON.stringify(req.body)
      });

      if (!BOT_TOKEN || !ADMIN_ID) {
        console.warn('⚠️ TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_ID not set, skipping notification');
        console.warn('   BOT_TOKEN:', BOT_TOKEN ? 'SET' : 'NOT SET');
        console.warn('   ADMIN_ID:', ADMIN_ID ? 'SET' : 'NOT SET');
        return res.json({ success: true, skipped: true, reason: 'Missing environment variables' });
      }

      // Экранируем специальные символы в названии тарифа для HTML
      const safeTariffName = (tariffName || 'Не указан')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      
      const safeUserInfo = (userInfo || 'Не указано')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      const message = `
💰 <b>Новая заявка на оплату!</b>
---------------------------
💵 <b>Сумма:</b> ${amount} сум
📦 <b>Тариф:</b> ${safeTariffName}
💳 <b>Реквизиты/Карта:</b> <code>${safeUserInfo}</code>
👤 <b>ID пользователя:</b> <code>${userId || 'Не указан'}</code>
---------------------------
`;

      console.log('📤 Sending notification to Telegram...', {
        messageLength: message.length,
        tariffName: tariffName,
        safeTariffName: safeTariffName
      });

      const telegramRequest = {
        chat_id: ADMIN_ID,
        text: message,
        parse_mode: 'HTML',
      };

      console.log('📤 Telegram API request:', {
        url: `https://api.telegram.org/bot${BOT_TOKEN.substring(0, 10)}.../sendMessage`,
        chatId: ADMIN_ID,
        messagePreview: message.substring(0, 100) + '...'
      });

      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telegramRequest),
      });

      console.log('📥 Telegram API response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Telegram API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
          tariffName: tariffName,
          requestBody: JSON.stringify(telegramRequest)
        });
        // Возвращаем ошибку, но с кодом 200, чтобы не ломать процесс оплаты на фронтенде
        return res.status(200).json({ 
          success: false, 
          error: 'Failed to send notification', 
          details: errorText,
          status: response.status
        });
      }

      const responseData = await response.json();
      console.log('✅ Telegram notification sent successfully:', {
        ok: responseData.ok,
        messageId: responseData.result?.message_id,
        tariffName: tariffName
      });
      return res.json({ success: true, messageId: responseData.result?.message_id });
    } catch (error) {
      console.error('❌ Telegram Notification Error:', {
        error: error.message,
        stack: error.stack,
        name: error.name,
        body: req.body
      });
      // Не возвращаем ошибку клиенту, чтобы не ломать процесс оплаты
      return res.status(200).json({ 
        success: false, 
        error: error.message,
        type: error.name
      });
    }
  });

  return router;
}

module.exports = { notifyRouter };
