# Деплой ShapeCraft на shapecraft.ru (Vercel)

Домена достаточно — хостинг поднимем на **Vercel** (бесплатный тариф).

## Шаг 1. База данных Neon (PostgreSQL, бесплатно)

1. Откройте https://neon.tech и войдите через GitHub
2. **New Project** → название `shapecraft`
3. Скопируйте **Connection string** (PostgreSQL, pooled)

## Шаг 2. Vercel

1. Откройте https://vercel.com/new
2. Import репозитория: `mirnyi519-prog/shapecraft`
3. **Environment Variables** (Production):

| Переменная | Значение |
|------------|----------|
| `DATABASE_URL` | строка из Neon |
| `AUTH_SECRET` | случайная строка 32+ символов |
| `OWNER_LOGIN` | `admin` |
| `OWNER_PASSWORD` | ваш пароль |
| `PARTNER_LOGIN` | `partner` |
| `PARTNER_PASSWORD` | пароль партнёра |

4. **Deploy**

5. После деплоя: **Storage** → **Create Blob Store** → привязать к проекту  
   (добавит `BLOB_READ_WRITE_TOKEN` автоматически)

6. **Redeploy** проект после создания Blob

## Шаг 3. Домен shapecraft.ru

В Vercel: **Project → Settings → Domains → Add** → `shapecraft.ru`

Vercel покажет DNS-записи. В панели регистратора домена (REG.RU, nic.ru и т.п.):

**Вариант A (рекомендуется):**
```
A     @    76.76.21.21
CNAME www  cname.vercel-dns.com
```

**Вариант B:** делегировать NS на Vercel (если предложит)

Подождите 5–30 минут — сайт откроется на https://shapecraft.ru

## Шаг 4. Проверка

- https://shapecraft.ru — витрина
- https://shapecraft.ru/login — вход (`admin` / ваш пароль)

## Локальная разработка

Для локального запуска нужен PostgreSQL (Neon dev branch или Docker):

```bash
# в .env:
DATABASE_URL="postgresql://..."
npm run dev
```

Или Docker (VPS-путь):

```bash
docker compose up -d --build
```
