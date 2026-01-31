# Скрипт настройки автозапуска бэкенда при старте Windows
# Требует прав администратора!
# Использование: .\setup-autostart.ps1

$ErrorActionPreference = "Stop"

# Проверяем права администратора
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "❌ Этот скрипт требует прав администратора!" -ForegroundColor Red
    Write-Host "💡 Запустите PowerShell от имени администратора" -ForegroundColor Yellow
    exit 1
}

Write-Host "⚙️  Настройка автозапуска бэкенда..." -ForegroundColor Green

# Получаем пути
$backendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptPath = Join-Path $backendDir "start-backend-pm2.ps1"
$nodePath = (Get-Command node).Source
$npmPath = (Get-Command npm).Source

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

# Настраиваем PM2 для автозапуска
Write-Host "🔄 Настройка PM2 startup..." -ForegroundColor Cyan
pm2 startup | Out-Null

# Создаем задачу в планировщике Windows как альтернативу
Write-Host "📅 Создание задачи в планировщике Windows..." -ForegroundColor Cyan

$taskName = "TelegramMiniAppBackend"
$taskDescription = "Автозапуск бэкенда Telegram Mini App"

# Удаляем существующую задачу, если есть
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "🗑️  Удалена существующая задача" -ForegroundColor Yellow
}

# Создаем действие (запуск PowerShell скрипта)
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" `
    -WorkingDirectory $backendDir

# Создаем триггер (при входе пользователя)
$trigger = New-ScheduledTaskTrigger -AtLogOn

# Настраиваем параметры
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

# Создаем задачу
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive

try {
    Register-ScheduledTask -TaskName $taskName `
        -Description $taskDescription `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Principal $principal | Out-Null
    
    Write-Host "✅ Задача создана успешно!" -ForegroundColor Green
    Write-Host "📋 Имя задачи: $taskName" -ForegroundColor Cyan
    Write-Host "💡 Бэкенд будет запускаться автоматически при входе в Windows" -ForegroundColor Cyan
    Write-Host "🔧 Управление: taskschd.msc" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Ошибка создания задачи: $_" -ForegroundColor Red
    exit 1
}

# Запускаем бэкенд сейчас
Write-Host "🚀 Запуск бэкенда..." -ForegroundColor Cyan
& $scriptPath

Write-Host ""
Write-Host "✅ Настройка завершена!" -ForegroundColor Green
Write-Host "📊 Проверка статуса: pm2 status" -ForegroundColor Cyan
