# Запуск установки на сервер Timeweb из Windows (нужен SSH-доступ).
# Пример:
#   .\scripts\install-on-server.ps1 -Host 201.24.50.235 -User root

param(
    [Parameter(Mandatory = $true)]
    [string]$ServerHost,

    [string]$User = "root",
    [int]$Port = 22
)

$ErrorActionPreference = "Stop"

$remoteScript = @'
curl -fsSL https://raw.githubusercontent.com/mirnyi519-prog/shapecraft/master/scripts/install-on-server.sh | bash
'@

Write-Host "Подключение к ${User}@${ServerHost}:${Port}..." -ForegroundColor Cyan
Write-Host "Потребуется пароль SSH от сервера Fair Amalthea." -ForegroundColor Yellow

ssh -p $Port "${User}@${ServerHost}" $remoteScript

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Готово! Откройте https://shapecraft.ru" -ForegroundColor Green
} else {
    Write-Host "SSH не удался. Используйте консоль Timeweb (VNC) и одну команду:" -ForegroundColor Yellow
    Write-Host 'curl -fsSL https://raw.githubusercontent.com/mirnyi519-prog/shapecraft/master/scripts/install-on-server.sh | bash'
}
