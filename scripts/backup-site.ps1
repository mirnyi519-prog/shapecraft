# Скачивает бэкап shapecraft.ru на этот ПК.
# База, фото и .env живут на сервере, в GitHub их нет.
#
#   powershell -ExecutionPolicy Bypass -File scripts/backup-site.ps1             — свежий бэкап сейчас
#   powershell -ExecutionPolicy Bypass -File scripts/backup-site.ps1 -SetupKey   — один раз: вход без пароля
#   powershell -ExecutionPolicy Bypass -File scripts/backup-site.ps1 -Schedule   — каждый день в 12:00
# Пока ключ ~/.ssh/shapecraft_backup не настроен, OpenSSH спросит пароль root.

param(
    [string]$ServerHost = "201.24.50.235",
    [string]$User = "root",
    [string]$BackupRoot = "",
    [int]$Keep = 8,
    [switch]$SetupKey,
    [switch]$Schedule
)

$ErrorActionPreference = "Stop"
$target = "${User}@${ServerHost}"
# Отдельный ключ без фразы-пароля: основной id_ed25519 может быть с фразой, а задача по расписанию её не введёт.
$keyPath = Join-Path $env:USERPROFILE ".ssh\shapecraft_backup"
$sshOpts = @("-o", "ConnectTimeout=20")
if (Test-Path $keyPath) {
    $sshOpts += @("-i", $keyPath, "-o", "IdentitiesOnly=yes", "-o", "BatchMode=yes")
}

if ($SetupKey) {
    if (-not (Test-Path $keyPath)) {
        New-Item -ItemType Directory -Force -Path (Split-Path $keyPath) | Out-Null
        # Start-Process, потому что PowerShell 5.1 теряет пустой аргумент -N "".
        $keygen = Start-Process -FilePath "ssh-keygen" -NoNewWindow -Wait -PassThru `
            -ArgumentList "-q -t ed25519 -N `"`" -C shapecraft-backup -f `"$keyPath`""
        if ($keygen.ExitCode -ne 0 -or -not (Test-Path $keyPath)) {
            throw "Не удалось создать ключ $keyPath"
        }
    }
    $pub = (Get-Content -Raw "$keyPath.pub").Trim()
    Write-Host "Сейчас спросит пароль root один раз..." -ForegroundColor Cyan
    $pub | & ssh -o ConnectTimeout=20 $target 'umask 077; mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys'
    if ($LASTEXITCODE -ne 0) {
        throw "Не удалось добавить ключ на сервер"
    }
    & ssh -i $keyPath -o IdentitiesOnly=yes -o BatchMode=yes $target "echo ok" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Ключ добавлен, но вход без пароля не работает"
    }
    Write-Host "Готово: вход без пароля работает." -ForegroundColor Green
    exit 0
}

if ($Schedule) {
    $action = New-ScheduledTaskAction -Execute "powershell.exe" `
        -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PSCommandPath`""
    $trigger = New-ScheduledTaskTrigger -Daily -At 12:00
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable
    Register-ScheduledTask -TaskName "ShapeCraft backup" -Action $action -Trigger $trigger `
        -Settings $settings -Description "Копия shapecraft.ru на этот ПК" -Force | Out-Null
    Write-Host "Задача «ShapeCraft backup» — каждый день в 12:00 (или при включении ПК, если пропущено)." -ForegroundColor Green
    exit 0
}

if (-not $BackupRoot) {
    $BackupRoot = Join-Path $env:USERPROFILE "Backups\shapecraft"
}

$stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$dest = Join-Path $BackupRoot $stamp
New-Item -ItemType Directory -Force -Path $dest | Out-Null

$scriptPath = Join-Path $PSScriptRoot "backup-on-server.sh"
if (-not (Test-Path $scriptPath)) {
    throw "Не найден $scriptPath"
}

Write-Host "Подключение к ${target}..." -ForegroundColor Cyan
$script = (Get-Content -Raw -Path $scriptPath) -replace "`r`n", "`n" -replace "`r", "`n"
$remoteOut = $script | & ssh @sshOpts $target "bash -s"
if ($LASTEXITCODE -ne 0) {
    throw "Сервер не собрал архив. Проверьте вход: scripts/backup-site.ps1 -SetupKey"
}

$remoteTar = ""
foreach ($line in @($remoteOut)) {
    if ($line -match '^BACKUP_PATH=(/tmp/shapecraft-.*\.tar\.gz)\s*$') {
        $remoteTar = $Matches[1]
    }
}
if (-not $remoteTar) {
    throw "Сервер не вернул путь к архиву: $remoteOut"
}

$archive = Join-Path $dest "shapecraft.tar.gz"
Write-Host "Скачиваю $remoteTar" -ForegroundColor Cyan
& scp @sshOpts "${target}:${remoteTar}" $archive
if ($LASTEXITCODE -ne 0) {
    throw "Не удалось скачать архив"
}

& ssh @sshOpts $target "rm -f '$remoteTar'" | Out-Null

Write-Host "Распаковка..." -ForegroundColor Cyan
& tar -xzf $archive -C $dest
Remove-Item $archive

$dirs = Get-ChildItem $BackupRoot -Directory | Sort-Object Name -Descending
if ($dirs.Count -gt $Keep) {
    $dirs | Select-Object -Skip $Keep | Remove-Item -Recurse -Force
}

Write-Host ""
Write-Host "Бэкап готов: $dest" -ForegroundColor Green
Write-Host "  prod.db   — база сайта"
Write-Host "  uploads   — фото"
Write-Host "  site.env  — пароли и ключи, никому не отправлять"
