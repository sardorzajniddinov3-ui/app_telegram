# Установка Supabase CLI и деплой функции

## Вариант 1: Установка Supabase CLI через npm (рекомендуется)

### Шаг 1: Установка Supabase CLI

```powershell
npm install -g supabase
```

Если npm не работает, попробуйте установить через PowerShell (требуются права администратора):

```powershell
# Скачать и установить вручную
# 1. Перейдите на https://github.com/supabase/cli/releases
# 2. Скачайте последнюю версию для Windows (supabase_windows_amd64.zip)
# 3. Распакуйте и добавьте в PATH
```

### Шаг 2: Логин в Supabase

```powershell
supabase login
```

### Шаг 3: Связывание проекта

```powershell
cd apptg111/apptg/telegram-mini-app
supabase link --project-ref rjfchznkmulatifulele
```

### Шаг 4: Деплой функции

```powershell
supabase functions deploy explain-answer
```

---

## Вариант 2: Деплой через веб-интерфейс Supabase Dashboard

### Шаг 1: Откройте Supabase Dashboard

1. Перейдите на https://supabase.com/dashboard
2. Войдите в свой аккаунт
3. Выберите проект `rjfchznkmulatifulele`

### Шаг 2: Создайте Edge Function

1. В левом меню найдите раздел **Edge Functions**
2. Нажмите **Create a new function**
3. Название функции: `explain-answer`
4. Скопируйте код из файла `index.ts` в редактор

### Шаг 3: Добавьте секрет GEMINI_API_KEY

1. Перейдите в **Project Settings** → **Edge Functions** → **Secrets**
2. Нажмите **Add new secret**
3. **Name**: `GEMINI_API_KEY`
4. **Value**: ваш API ключ от Google Gemini
5. Нажмите **Save**

### Шаг 4: Сохраните и задеплойте

1. Нажмите **Deploy** в редакторе функции
2. Дождитесь завершения деплоя

---

## Проверка работы

После деплоя функция будет доступна по адресу:
```
https://rjfchznkmulatifulele.supabase.co/functions/v1/explain-answer
```

### Тестирование через curl:

```powershell
curl -X POST https://rjfchznkmulatifulele.supabase.co/functions/v1/explain-answer `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer YOUR_ANON_KEY" `
  -d '{\"question\": \"Что означает красный сигнал светофора?\", \"wrongAnswer\": \"Можно ехать\", \"correctAnswer\": \"Остановиться\"}'
```

---

## Получение Google Gemini API ключа

1. Перейдите на https://aistudio.google.com/app/apikey
2. Войдите в Google аккаунт
3. Нажмите **Create API Key**
4. Скопируйте ключ и добавьте его в Supabase Secrets
