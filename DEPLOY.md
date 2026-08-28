# ShapeCraft → shapecraft.ru за 10 минут

## Шаг 1. База (Neon, бесплатно)

1. Откройте **https://neon.tech** → Sign up через GitHub  
2. **New Project** → имя `shapecraft` → Create  
3. На главной скопируйте **Connection string** (PostgreSQL)  
   Пример: `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`

## Шаг 2. Vercel (хостинг, бесплатно)

1. Откройте **https://vercel.com/new/import?s=https://github.com/mirnyi519-prog/shapecraft**  
2. Нажмите **Import** → Deploy (пока без переменных — упадёт, это нормально)  
3. **Settings → Environment Variables** — добавьте:

| Name | Value |
|------|-------|
| `DATABASE_URL` | строка из Neon (шаг 1) |
| `AUTH_SECRET` | `shapecraft-prod-7f3k9m2x8q1w5n4r6t` (или своя длинная строка) |
| `OWNER_LOGIN` | `admin` |
| `OWNER_PASSWORD` | ваш пароль |
| `PARTNER_LOGIN` | `partner` |
| `PARTNER_PASSWORD` | пароль партнёра |

4. **Deployments → ... → Redeploy** (пересобрать с переменными)

5. **Storage → Create Database → Blob** → Create → Connect to Project  
6. Ещё раз **Redeploy**

## Шаг 3. Домен shapecraft.ru

1. Vercel → проект → **Settings → Domains**  
2. Add: `shapecraft.ru` и `www.shapecraft.ru`  
3. У регистратора домена (REG.RU / nic.ru / Timeweb) добавьте:

```
Тип   Имя   Значение
A     @     76.76.21.21
CNAME www   cname.vercel-dns.com
```

4. Подождите 5–30 мин → **https://shapecraft.ru**

## Вход на сайте

- Логin: `admin`  
- Пароль: тот, что указали в `OWNER_PASSWORD`

## Локально (как сейчас)

Для разработки на ПК — Docker:

```bash
docker compose up -d --build
```

Сайт: http://localhost:3000
