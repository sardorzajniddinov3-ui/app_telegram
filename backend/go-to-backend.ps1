# Быстрый переход в папку backend
# Использование: .\go-to-backend.ps1

$backendPath = "D:\apptg\apptg111\apptg111\apptg\telegram-mini-app\backend"

if (Test-Path $backendPath) {
    Set-Location $backendPath
    Write-Host "✅ Перешли в папку backend" -ForegroundColor Green
    Write-Host "📁 Текущая директория: $(Get-Location)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Доступные команды:" -ForegroundColor Yellow
    Write-Host "  npm install  - установить зависимости" -ForegroundColor White
    Write-Host "  npm start    - запустить сервер" -ForegroundColor White
    Write-Host "  npm run dev  - запустить в режиме разработки" -ForegroundColor White
} else {
    Write-Host "❌ Папка не найдена: $backendPath" -ForegroundColor Red
    Write-Host "Проверьте путь к проекту" -ForegroundColor Yellow
}
