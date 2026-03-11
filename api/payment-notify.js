export default async function handler(req, res) {
    // Настройка CORS
    res.setHeader('Access-Control-Allow-Credentials', true)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version')

    if (req.method === 'OPTIONS') {
        res.status(200).end()
        return
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { amount, tariffName, userInfo, userId, receiptUrl, planName, senderInfo } = req.body;

        // Поддержка старых (tariffName, userInfo) и новых (planName, senderInfo) переменных
        const finalPlanName = planName || tariffName || 'Не указан';
        const finalSenderInfo = senderInfo || userInfo || 'Не указана';

        // ID админа из требований
        const ADMIN_TELEGRAM_ID = '473842863';
        // Используем токен бота из переменных окружения
        const BOT_TOKEN = process.env.BOT_TOKEN;

        if (!BOT_TOKEN) {
            console.error('Bot token is missing in Vercel environment');
            return res.status(500).json({ error: 'Server configuration error' });
        }

        const messageText = `💰 Новая заявка на оплату!
---------------------------
💵 Сумма: ${amount} сум
📦 Тариф: ${finalPlanName}
💳 Реквизиты/Карта: ${finalSenderInfo}
👤 ID пользователя: ${userId}
---------------------------`;

        let telegramApiUrl = '';
        let payload = {};

        // Если есть ссылка на чек, отправляем фото с подписью
        // Иначе отправляем текстовое сообщение
        if (receiptUrl) {
            telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;
            payload = {
                chat_id: ADMIN_TELEGRAM_ID,
                photo: receiptUrl,
                caption: messageText
            };
        } else {
            telegramApiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
            payload = {
                chat_id: ADMIN_TELEGRAM_ID,
                text: messageText
            };
        }

        const telegramRes = await fetch(telegramApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const telegramData = await telegramRes.json();

        if (!telegramRes.ok) {
            console.error('Telegram API Error:', telegramData);
            return res.status(500).json({ error: 'Failed to notify admin', details: telegramData });
        }

        return res.status(200).json({ success: true, message: 'Notification sent successfully' });
    } catch (error) {
        console.error('Server error in payment-notify:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
