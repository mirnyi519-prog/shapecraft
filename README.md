# ShapeCraft

Учёт 3D-печати для партнёрской продажи игрушек: товары, продажи, расчёт 50/50.

## Быстрый старт (локально)

```bash
npm install
npm run db:setup
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000)

### Тестовые пользователи

| Роль | Логин | Пароль |
|------|-------|--------|
| Админ (вы) | admin | shapecraft123 |
| Партнёр | partner | shapecraft123 |

Пароли задаются в `.env` (`OWNER_PASSWORD`, `PARTNER_PASSWORD`).

## Деплой на сервер (Docker)

На VPS с Docker:

```bash
git clone <repo> shapecraft
cd shapecraft
cp .env.example .env
# задайте AUTH_SECRET, OWNER_PASSWORD, PARTNER_PASSWORD
docker compose up -d --build
```

Сайт: `http://SERVER_IP:3000`

### Домен shapecraft.ru

1. A-запись домена → IP сервера
2. Nginx + HTTPS (certbot), прокси на `127.0.0.1:3000`

Пример nginx:

```nginx
server {
  server_name shapecraft.ru www.shapecraft.ru;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 20M;
  }
}
```

```bash
certbot --nginx -d shapecraft.ru -d www.shapecraft.ru
```
