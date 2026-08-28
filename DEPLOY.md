# Выкладка ShapeCraft на Timeweb (Fair Amalthea)

Сервер: **Fair Amalthea**, IP `201.24.50.235`, домен `shapecraft.ru` уже привязан.

Neon и Vercel **не нужны** — Docker + SQLite на вашем сервере.

---

## Самый простой способ — одна команда в консоли Timeweb

### 1. Откройте консоль сервера

Timeweb Cloud → **Облачные серверы** → **Fair Amalthea** → **Консоль** (или VNC).

### 2. Вставьте и нажмите Enter

```bash
curl -fsSL https://raw.githubusercontent.com/mirnyi519-prog/shapecraft/master/scripts/install-on-server.sh | bash
```

Скрипт сам:
- установит Docker (если нет)
- скачает проект в `/opt/shapecraft`
- создаст `.env` с случайным `AUTH_SECRET`
- запустит `docker compose up -d --build`
- настроит nginx для `shapecraft.ru`

Установка занимает **5–10 минут**.

### 3. Задайте пароли

```bash
nano /opt/shapecraft/.env
```

Измените `OWNER_PASSWORD` и `PARTNER_PASSWORD`, затем:

```bash
cd /opt/shapecraft && docker compose up -d --build
```

### 4. HTTPS (после того как сайт откроется по http)

```bash
certbot --nginx -d shapecraft.ru -d www.shapecraft.ru
```

---

## Вход на сайте

- Логин: `admin`
- Пароль: из `OWNER_PASSWORD` в `/opt/shapecraft/.env`

---

## Обновление после изменений в GitHub

```bash
cd /opt/shapecraft
git pull
docker compose up -d --build
```

---

## Если есть SSH с Windows

```powershell
cd C:\Users\Администратор\Projects\shapecraft
powershell -ExecutionPolicy Bypass -File scripts/install-on-server.ps1 -ServerHost 201.24.50.235
```

Потребуется пароль root от сервера (Timeweb → Fair Amalthea → доступ SSH).

---

## Локально (разработка)

```powershell
npm run dev
```

http://localhost:3000
