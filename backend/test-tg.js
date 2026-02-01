require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_ADMIN_ID;

console.log('Попытка отправки...');
console.log('Токен:', token ? 'Найден (скрыт)' : 'НЕ НАЙДЕН!');
console.log('ID админа:', chatId);

fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        chat_id: chatId,
        text: '✅ ТЕСТ: Если вы это читаете, бот работает!'
    })
})
.then(res => res.json())
.then(data => {
    console.log('Ответ Telegram:', data);
})
.catch(err => {
    console.error('Ошибка:', err);
});