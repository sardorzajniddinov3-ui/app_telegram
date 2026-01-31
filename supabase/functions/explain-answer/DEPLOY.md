# Деплой Edge Function для объяснения ошибок

## Команда для деплоя:

```bash
cd apptg111/apptg/telegram-mini-app
supabase functions deploy explain-answer
```

## Настройка переменных окружения:

Перед деплоем убедитесь, что в Supabase Dashboard добавлен секрет `GEMINI_API_KEY`:

1. Откройте Supabase Dashboard
2. Перейдите в раздел **Project Settings** → **Edge Functions** → **Secrets**
3. Добавьте секрет:
   - **Name**: `GEMINI_API_KEY`
   - **Value**: ваш API ключ от Google Gemini

## Проверка работы:

После деплоя функция будет доступна по адресу:
```
https://rjfchznkmulatifulele.supabase.co/functions/v1/explain-answer
```

## Тестирование:

Вы можете протестировать функцию через curl:

```bash
curl -X POST https://rjfchznkmulatifulele.supabase.co/functions/v1/explain-answer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "question": "Что означает красный сигнал светофора?",
    "wrongAnswer": "Можно ехать",
    "correctAnswer": "Остановиться"
  }'
```
