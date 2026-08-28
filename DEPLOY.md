# Деплой ShapeCraft → shapecraft.ru

## Через PowerShell (рекомендуется)

### 1. Один раз — подготовка

Создайте файл `.env.production` в корне проекта:

```env
NEON_API_KEY=neon_api_xxxxxxxx
OWNER_PASSWORD=ваш-пароль
PARTNER_PASSWORD=пароль-партнёра
```

API key Neon: https://console.neon.tech/app/settings/api-keys

Войдите в Vercel:

```powershell
npx vercel login
```

### 2. Деплой

```powershell
npm run deploy
```

Скрипт сам: создаст базу Neon → настроит Vercel → задеплоит → привяжет домен.

### 3. DNS у регистратора домена

```
A     @     76.76.21.21
CNAME www   cname.vercel-dns.com
```

Через 5–30 мин: **https://shapecraft.ru**

Вход: `admin` / ваш пароль из `.env.production`

---

## Локально (Docker)

```powershell
docker compose up -d --build
```

Сайт: http://localhost:3000
