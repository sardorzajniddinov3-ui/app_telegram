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
        adminId: ADMIN_ID
      });

      if (!BOT_TOKEN || !ADMIN_ID) {
        console.warn('⚠️ TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_ID not set, skipping notification');
        console.warn('   BOT_TOKEN:', BOT_TOKEN ? 'SET' : 'NOT SET');
        console.warn('   ADMIN_ID:', ADMIN_ID ? 'SET' : 'NOT SET');
        return res.json({ success: true, skipped: true, reason: 'Missing environment variables' });
      }

      const message = `
💰 <b>Новая заявка на оплату!</b>
---------------------------
💵 <b>Сумма:</b> ${amount} сум
📦 <b>Тариф:</b> ${tariffName || 'Не указан'}
💳 <b>Реквизиты/Карта:</b> <code>${userInfo || 'Не указано'}</code>
👤 <b>ID пользователя:</b> <code>${userId || 'Не указан'}</code>
---------------------------
`;

      console.log('📤 Sending notification to Telegram...');
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ADMIN_ID,
          text: message,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Telegram API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        return res.status(500).json({ success: false, error: 'Failed to send notification', details: errorText });
      }

      const responseData = await response.json();
      console.log('✅ Telegram notification sent successfully:', responseData);
      return res.json({ success: true });
    } catch (error) {
      console.error('Telegram Notification Error:', error);
      // Не возвращаем ошибку клиенту, чтобы не ломать процесс оплаты
      return res.json({ success: false, error: error.message });
    }
  });

  return router;
}

module.exports = { notifyRouter };
