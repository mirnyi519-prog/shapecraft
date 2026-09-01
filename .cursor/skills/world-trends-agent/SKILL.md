---
name: world-trends-agent
description: >-
  Еженедельная подборка «В мире» для ShapeCraft: исследует тренды 3D-печати сувениров,
  формирует 15 статей (5 дорогих, 5 средних, 5 дешёвых) и импортирует в проект.
  Используй, когда пользователь просит обновить «В мире», подборку трендов,
  weekly world trends, или аналитику сувениров для 3D-печати.
---

# Агент подборки «В мире» (ShapeCraft)

Аналитику делает агент Cursor. Сайт сам подтягивает JSON с GitHub и фото с MakerWorld.

## Задача

Подготовить **ровно 15 статей** — по **5** в каждом сегменте:

| priceTier | Сегмент | Ориентир цены |
|-----------|---------|---------------|
| `expensive` | Премиум | от 2500 ₽ |
| `medium` | Средний | 800–2500 ₽ |
| `cheap` | Бюджет | до 800 ₽ |

## Алгоритм

1. **Исследование** — WebSearch по запросам:
   - `makerworld trending toys 2026`
   - `printables popular articulated toy`
   - `3d print toys bestseller etsy`
   - `reddit 3dprinting toy model popular`

2. **Отбор** — реальные модели с публичными страницами (MakerWorld, Printables, Thingiverse, Cults3D).

3. **JSON** — сохранить в `data/world-import.json`:

```json
{
  "articles": [
    {
      "name": "Название модели",
      "description": "2–4 предложения на русском: что это, почему в тренде, кому подойдёт.",
      "priceTier": "expensive",
      "priceLabel": "3000–4500 ₽",
      "sourceUrl": "https://makerworld.com/en/models/123456-...",
      "imageUrl": null
    }
  ]
}
```

Правила:
- `description` — минимум 20 символов, на **русском**; в тексте пиши **«сувенир»**, не «игрушка»
- `sourceUrl` — рабочая ссылка на страницу модели (для MakerWorld — с числовым id)
- `imageUrl` — можно `null`: сайт сам возьмёт cover через Bambu API
- Ровно **5 + 5 + 5** по tier

4. **Коммит + push** в GitHub:

```bash
git add data/world-import.json
git commit -m "Update world trends weekly batch."
git push
```

5. **Синхронизация на shapecraft.ru**:

```bash
npm run world:publish -- --force
```

Или полный цикл локально + prod:

```bash
npm run world:import -- --force --publish
```

Сервер забирает JSON с GitHub (`WORLD_SYNC_URL`), скачивает фото, сохраняет в БД.

6. **Админка** `/world` — если неделя устарела, синхронизация запускается **автоматически** при открытии страницы. Кнопка «Обновить подборку сейчас» — вручную.

## Настройка `.env` (один раз)

```env
WORLD_IMPORT_SECRET=длинная-случайная-строка
WORLD_PUBLISH_URL=https://shapecraft.ru/api/world/import
WORLD_SYNC_URL=https://raw.githubusercontent.com/mirnyi519-prog/shapecraft/master/data/world-import.json
```

Тот же `WORLD_IMPORT_SECRET` — в `/opt/shapecraft/.env` на сервере.

**Cron на сервере** (понедельник 9:00):

```bash
0 9 * * 1 /opt/shapecraft/scripts/world-trends-sync.sh >> /var/log/shapecraft-world.log 2>&1
```

## Проверка

- `npm run build` — без ошибок
- Ответ sync: `imagesLoaded: 15`
- В админке `/world` — 3 блока по 5 карточек **с фото**

## Шаблон

См. `data/world-trends-template.json` — только структура, не использовать как готовую подборку.
