# Быстрый запуск бэкенда с автозапуском

## Самый простой способ (1 команда)

Откройте PowerShell **от имени администратора** и выполните:

```powershell
cd D:\apptg\apptg111\apptg111\apptg\telegram-mini-app\backend
.\setup-autostart.ps1
```

Этот скрипт автоматически:
- ✅ Установит PM2 (если нужно)
- ✅ Настроит автозапуск при старте Windows
- ✅ Запустит бэкенд прямо сейчас

## Обычный запуск (без автозапуска)

Если нужно просто запустить бэкенд сейчас:

```powershell
cd D:\apptg\apptg111\apptg111\apptg\telegram-mini-app\backend
.\start-backend-pm2.ps1
```

## Проверка работы

После запуска проверьте:

```powershell
pm2 status
```

Должен быть процесс `telegram-mini-app-backend` в статусе `online`.

## Просмотр логов

```powershell
pm2 logs telegram-mini-app-backend
```

## Остановка

```powershell
pm2 stop telegram-mini-app-backend
```

## Перезапуск

```powershell
pm2 restart telegram-mini-app-backend
```

## Удаление автозапуска

```powershell
pm2 delete telegram-mini-app-backend
pm2 unstartup
```

---

**Важно:** Убедитесь, что:
- ✅ PostgreSQL запущен
- ✅ Файл `.env` настроен правильно (особенно `DATABASE_URL`)
- ✅ Порт 3000 свободен
