# Скрипт запуска бэкенда
# Использование: .\start-backend.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 Запуск бэкенда Telegram Mini App..." -ForegroundColor Green

# Переходим в директорию бэкенда
$backendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $backendDir

# Проверяем наличие .env файла
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  Файл .env не найден!" -ForegroundColor Yellow
    Write-Host "📝 Создайте файл .env на основе env.example" -ForegroundColor Yellow
    if (Test-Path "env.example") {
        Copy-Item "env.example" ".env"
        Write-Host "✅ Создан файл .env из env.example" -ForegroundColor Green
        Write-Host "⚠️  Не забудьте настроить DATABASE_URL в .env!" -ForegroundColor Yellow
    }
    exit 1
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

# Запускаем бэкенд
Write-Host "▶️  Запуск сервера..." -ForegroundColor Cyan
npm start
