# Скрипт запуска бэкенда через PM2 (с автоперезапуском)
# Использование: .\start-backend-pm2.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 Запуск бэкенда через PM2..." -ForegroundColor Green

# Переходим в директорию бэкенда
$backendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $backendDir

# Проверяем наличие PM2
$pm2Installed = Get-Command pm2 -ErrorAction SilentlyContinue
if (-not $pm2Installed) {
    Write-Host "📦 Установка PM2..." -ForegroundColor Cyan
    npm install -g pm2
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Ошибка установки PM2!" -ForegroundColor Red
        exit 1
    }
}

# Проверяем наличие .env файла
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  Файл .env не найден!" -ForegroundColor Yellow
    if (Test-Path "env.example") {
        Copy-Item "env.example" ".env"
        Write-Host "✅ Создан файл .env из env.example" -ForegroundColor Green
        Write-Host "⚠️  Не забудьте настроить DATABASE_URL в .env!" -ForegroundColor Yellow
    }
}

# Проверяем наличие node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Установка зависимостей..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Ошибка установки зависимостей!" -ForegroundColor Red
        exit 1
    }
}

# Останавливаем существующий процесс, если запущен
Write-Host "🛑 Остановка существующих процессов PM2..." -ForegroundColor Cyan
pm2 stop telegram-mini-app-backend 2>$null
pm2 delete telegram-mini-app-backend 2>$null

# Запускаем через PM2
Write-Host "▶️  Запуск сервера через PM2..." -ForegroundColor Cyan
pm2 start npm --name "telegram-mini-app-backend" -- start
pm2 save

Write-Host "✅ Бэкенд запущен через PM2!" -ForegroundColor Green
Write-Host "📊 Просмотр статуса: pm2 status" -ForegroundColor Cyan
Write-Host "📋 Просмотр логов: pm2 logs telegram-mini-app-backend" -ForegroundColor Cyan
Write-Host "🛑 Остановка: pm2 stop telegram-mini-app-backend" -ForegroundColor Cyan

# Показываем статус
pm2 status
