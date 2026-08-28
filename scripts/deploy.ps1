# ShapeCraft — деплой на Vercel через PowerShell
# Запуск: npm run deploy
#   или:  powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1

param(
    [string]$Domain = "shapecraft.ru",
    [string]$ProjectName = "shapecraft",
    [string]$NeonApiKey = $env:NEON_API_KEY,
    [string]$DatabaseUrl = $env:DATABASE_URL,
    [string]$AuthSecret = $env:AUTH_SECRET,
    [string]$OwnerLogin = $env:OWNER_LOGIN,
    [string]$OwnerPassword = $env:OWNER_PASSWORD,
    [string]$PartnerLogin = $env:PARTNER_LOGIN,
    [string]$PartnerPassword = $env:PARTNER_PASSWORD,
    [switch]$SkipDomain
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

function Import-EnvFile($path) {
    if (-not (Test-Path $path)) { return }
    Get-Content $path | ForEach-Object {
        if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
        $parts = $_ -split '=', 2
        if ($parts.Count -eq 2) {
            $key = $parts[0].Trim()
            $val = $parts[1].Trim().Trim('"')
            if (-not [string]::IsNullOrEmpty($key) -and -not (Get-Variable -Name $key -ErrorAction SilentlyContinue)) {
                Set-Variable -Name $key -Value $val -Scope Script
            }
            if ($key -eq "NEON_API_KEY") { $script:NeonApiKey = $val }
            if ($key -eq "DATABASE_URL") { $script:DatabaseUrl = $val }
            if ($key -eq "AUTH_SECRET") { $script:AuthSecret = $val }
            if ($key -eq "OWNER_LOGIN") { $script:OwnerLogin = $val }
            if ($key -eq "OWNER_PASSWORD") { $script:OwnerPassword = $val }
            if ($key -eq "PARTNER_LOGIN") { $script:PartnerLogin = $val }
            if ($key -eq "PARTNER_PASSWORD") { $script:PartnerPassword = $val }
        }
    }
}

Import-EnvFile ".env.production"
Import-EnvFile ".env"

function Write-Step($text) {
    Write-Host ""
    Write-Host "==> $text" -ForegroundColor Cyan
}

function Ensure-VercelLogin {
    Write-Step "Проверка входа в Vercel"
    npx vercel whoami 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Нужен вход в Vercel (откроется браузер)..." -ForegroundColor Yellow
        npx vercel login
        if ($LASTEXITCODE -ne 0) { throw "Не удалось войти в Vercel" }
    }
    $user = npx vercel whoami 2>$null
    Write-Host "Vercel: $user" -ForegroundColor Green
}

function Ensure-NeonDatabase {
    if ($DatabaseUrl) {
        Write-Host "DATABASE_URL уже задан" -ForegroundColor Green
        return $DatabaseUrl
    }

    Write-Step "Создание базы Neon"
    if (-not $NeonApiKey) {
        Write-Host "Получите API key: https://console.neon.tech/app/settings/api-keys" -ForegroundColor Yellow
        $NeonApiKey = Read-Host "Вставьте NEON_API_KEY"
    }

    $env:NEON_API_KEY = $NeonApiKey
    $existingJson = npx neonctl projects list -o json 2>$null
    $existing = @()
    if ($existingJson) { $existing = ($existingJson | ConvertFrom-Json) }
    $project = $existing | Where-Object { $_.name -eq $ProjectName } | Select-Object -First 1

    if (-not $project) {
        Write-Host "Создаю проект Neon: $ProjectName"
        $createdJson = npx neonctl projects create --name $ProjectName -o json
        $created = $createdJson | ConvertFrom-Json
        $projectId = $created.id
        if (-not $projectId) { $projectId = $created.project.id }
    } else {
        $projectId = $project.id
        Write-Host "Проект Neon уже есть: $ProjectName"
    }

    $conn = npx neonctl connection-string --project-id $projectId --pooled -o json 2>$null | ConvertFrom-Json
    if ($conn.connection_uri) {
        return $conn.connection_uri.Trim()
    }
    $connRaw = npx neonctl connection-string --project-id $projectId --pooled 2>$null
    if (-not $connRaw) { throw "Не удалось получить DATABASE_URL из Neon" }
    return ($connRaw | Select-Object -Last 1).ToString().Trim()
}

function Read-Config {
    Write-Step "Настройки приложения"

    if (-not $AuthSecret) {
        $AuthSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
        Write-Host "AUTH_SECRET сгенерирован автоматически"
    }
    if (-not $OwnerLogin) { $OwnerLogin = "admin" }
    if (-not $PartnerLogin) { $PartnerLogin = "partner" }
    if (-not $OwnerPassword) {
        $OwnerPassword = Read-Host "Пароль админа (OWNER_PASSWORD)" -AsSecureString
        $OwnerPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($OwnerPassword)
        )
    }
    if (-not $PartnerPassword) {
        $PartnerPassword = Read-Host "Пароль партнёра (PARTNER_PASSWORD)" -AsSecureString
        $PartnerPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($PartnerPassword)
        )
    }
}

function Set-VercelEnv($name, $value) {
    npx vercel env rm $name production -y 2>$null | Out-Null
    $value | npx vercel env add $name production --force --yes 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        $value | npx vercel env add $name production --force
    }
    Write-Host "  env: $name" -ForegroundColor DarkGray
}

function Ensure-VercelProject {
    Write-Step "Привязка проекта Vercel"
    if (-not (Test-Path ".vercel/project.json")) {
        npx vercel link --yes --project $ProjectName 2>$null
        if ($LASTEXITCODE -ne 0) {
            npx vercel link --yes
        }
    }
}

function Set-AllEnv($dbUrl) {
    Write-Step "Переменные окружения на Vercel"
    Set-VercelEnv "DATABASE_URL" $dbUrl
    Set-VercelEnv "AUTH_SECRET" $AuthSecret
    Set-VercelEnv "OWNER_LOGIN" $OwnerLogin
    Set-VercelEnv "OWNER_PASSWORD" $OwnerPassword
    Set-VercelEnv "PARTNER_LOGIN" $PartnerLogin
    Set-VercelEnv "PARTNER_PASSWORD" $PartnerPassword
}

function Ensure-BlobStore {
    Write-Step "Хранилище фото (Vercel Blob)"
    $storeName = "$ProjectName-uploads"
    npx vercel blob create-store $storeName --access public --region fra1 --yes 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Blob store уже есть или создан ранее" -ForegroundColor Yellow
    }
}

function Deploy-Production {
    Write-Step "Деплой на production"
    npx vercel deploy --prod --yes
    if ($LASTEXITCODE -ne 0) { throw "Деплoy не удался" }
}

function Add-Domain {
    if ($SkipDomain) { return }
    Write-Step "Привязка домена $Domain"
    npx vercel domains add $Domain 2>$null
    npx vercel domains add "www.$Domain" 2>$null
    Write-Host ""
    Write-Host "DNS у регистратора домена:" -ForegroundColor Yellow
    Write-Host "  A     @     76.76.21.21"
    Write-Host "  CNAME www   cname.vercel-dns.com"
}

# --- main ---
Write-Host "ShapeCraft deploy" -ForegroundColor White -BackgroundColor DarkBlue

Ensure-VercelLogin
$DatabaseUrl = Ensure-NeonDatabase
Read-Config
Ensure-VercelProject
Set-AllEnv $DatabaseUrl
Ensure-BlobStore
Deploy-Production
Add-Domain

Write-Host ""
Write-Host "Готово!" -ForegroundColor Green
Write-Host "Сайт: https://$Domain (после настройки DNS)"
Write-Host "Временный URL: см. вывод vercel deploy выше"
Write-Host "Вход: $OwnerLogin / (ваш пароль)"
