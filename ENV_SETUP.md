# 📝 Настройка переменных окружения

## Создание .env файлов

### Для папки `src/`:

Создайте файл `src/.env`:

```env
# Backend API URL
# Для локальной разработки:
VITE_API_URL=http://localhost:3000

# Для продакшена (замените на ваш URL):
# VITE_API_URL=https://your-backend.railway.app
```

### Для папки `web/`:

Создайте файл `web/.env`:

```env
# Backend API URL
# Для локальной разработки:
VITE_API_URL=http://localhost:3000

# Для продакшена (замените на ваш URL):
# VITE_API_URL=https://your-backend.railway.app
```

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
