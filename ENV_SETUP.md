# 📝 Настройка переменных окружения

## ⚠️ ВАЖНО: Supabase Configuration

**Для проекта необходимо настроить переменные окружения Supabase!**

### Создайте файл `.env` в корне проекта `telegram-mini-app`:

```env
# Supabase Configuration
# Получите эти значения из Supabase Dashboard: Settings → API

# URL вашего Supabase проекта
VITE_SUPABASE_URL=https://psjtbcotmnfvgulziara.supabase.co

# Anon/Public ключ из Supabase Dashboard
# Settings → API → Project API keys → anon/public
# ⚠️ ВАЖНО: Ключ должен быть от проекта psjtbcotmnfvgulziara!
# Если в JWT токене указан другой ref (например, memoqljluizvccomaind) - это НЕПРАВИЛЬНЫЙ ключ!
VITE_SUPABASE_ANON_KEY=ваш_anon_key_от_проекта_psjtbcotmnfvgulziara

# Backend API URL (опционально)
VITE_BACKEND_URL=http://localhost:3000
```

### Инструкция по получению значений:

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard)
2. Выберите проект **psjtbcotmnfvgulziara**
3. Перейдите: **Settings** → **API**
4. Скопируйте:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`
5. Создайте файл `.env` в корне проекта `telegram-mini-app`
6. Вставьте скопированные значения

**Важно:** Не коммитьте файл `.env` в git! Добавьте его в `.gitignore`.

## Примеры для разных платформ

### Railway:
```env
VITE_API_URL=https://your-app-name.railway.app
```

### Render:
```env
VITE_API_URL=https://your-app-name.onrender.com
```

### Vercel:
```env
VITE_API_URL=https://your-app-name.vercel.app
```

### Разработка с туннелем (ngrok):
```env
VITE_API_URL=https://abc123.ngrok.io
```

## Важно

- После изменения `.env` перезапустите dev сервер
- В продакшене задайте `VITE_API_URL` с публичным URL backend
- Файлы `.env` не должны попадать в git (добавьте в `.gitignore`)
