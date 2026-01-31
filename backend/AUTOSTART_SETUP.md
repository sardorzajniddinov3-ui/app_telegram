# Настройка автозапуска бэкенда

Этот документ описывает, как настроить автоматический запуск бэкенда при старте Windows.

## Вариант 1: PM2 (Рекомендуется)

PM2 - это процесс-менеджер для Node.js, который автоматически перезапускает приложение при сбоях.

### Установка и настройка:

1. **Установите PM2 глобально:**
   ```powershell
   npm install -g pm2
   ```

2. **Запустите бэкенд через PM2:**
   ```powershell
   cd backend
   .\start-backend-pm2.ps1
   ```

3. **Настройте автозапуск PM2 при старте Windows:**
   ```powershell
   pm2 startup
   pm2 save
   ```

   PM2 создаст задачу в планировщике Windows автоматически.

### Управление:

- **Просмотр статуса:** `pm2 status`
- **Просмотр логов:** `pm2 logs telegram-mini-app-backend`
- **Остановка:** `pm2 stop telegram-mini-app-backend`
- **Перезапуск:** `pm2 restart telegram-mini-app-backend`
- **Удаление из автозапуска:** `pm2 unstartup`

## Вариант 2: Автоматическая настройка через скрипт

**Требует прав администратора!**

1. Откройте PowerShell **от имени администратора**

2. Перейдите в папку backend:
   ```powershell
   cd D:\apptg\apptg111\apptg111\apptg\telegram-mini-app\backend
   ```

3. Запустите скрипт настройки:
   ```powershell
   .\setup-autostart.ps1
   ```

Скрипт автоматически:
- Установит PM2 (если не установлен)
- Создаст задачу в планировщике Windows
- Запустит бэкенд

## Вариант 3: Ручная настройка через планировщик задач

1. Откройте **Планировщик задач** (taskschd.msc)

2. Создайте новую задачу:
   - **Имя:** `TelegramMiniAppBackend`
   - **Триггер:** При входе в систему
   - **Действие:** Запуск программы
     - **Программа:** `powershell.exe`
     - **Аргументы:** `-NoProfile -ExecutionPolicy Bypass -File "D:\apptg\apptg111\apptg111\apptg\telegram-mini-app\backend\start-backend-pm2.ps1"`
     - **Рабочая папка:** `D:\apptg\apptg111\apptg111\apptg\telegram-mini-app\backend`

3. В настройках:
   - ✅ Разрешить выполнение при питании от батареи
   - ✅ Запускать задачу при подключении к сети переменного тока
   - ✅ Перезапускать при сбое (3 попытки, интервал 1 минута)

## Проверка работы

После настройки автозапуска:

1. Перезагрузите компьютер
2. После входа в систему проверьте статус:
   ```powershell
   pm2 status
   ```
3. Или проверьте в браузере: `http://localhost:3000/api/tests`

## Устранение проблем

### Бэкенд не запускается автоматически:

1. Проверьте логи PM2:
   ```powershell
   pm2 logs telegram-mini-app-backend
   ```

2. Проверьте файл `.env` - правильно ли указан `DATABASE_URL`?

3. Проверьте, запущен ли PostgreSQL

4. Проверьте задачу в планировщике:
   - Откройте `taskschd.msc`
   - Найдите задачу `TelegramMiniAppBackend`
   - Проверьте последний результат выполнения

### PM2 не сохраняет процессы:

```powershell
pm2 save
pm2 startup
```

### Удаление автозапуска:

**Через PM2:**
```powershell
pm2 delete telegram-mini-app-backend
pm2 unstartup
```

**Через планировщик задач:**
- Откройте `taskschd.msc`
- Найдите задачу `TelegramMiniAppBackend`
- Удалите её
