---
name: world-trends-agent
description: >-
  Еженедельная подборка «В мире» для ShapeCraft: исследует тренды 3D-печати игрушек,
  формирует 15 статей (5 дорогих, 5 средних, 5 дешёвых) и импортирует в проект.
  Используй, когда пользователь просит обновить «В мире», подборку трендов,
  weekly world trends, или аналитику игрушек для 3D-печати.
---

# Агент подборки «В мире» (ShapeCraft)

Бесплатная замена OpenAI-бота: аналитику делает агент Cursor, сайт импортирует JSON и сам подтягивает фото.

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
- `description` — минимум 20 символов, на **русском**
- `sourceUrl` — рабочая ссылка на страницу модели
- `imageUrl` — можно `null`: сайт сам возьмёт cover через Bambu API (MakerWorld) и сохранит локально
- Ровно **5 + 5 + 5** по tier

4. **Импорт + автовыгрузка на shapecraft.ru**:

```bash
npm run world:import -- --force --publish
```

- `--force` — перезаписать подборку текущей недели
- `--publish` — отправить JSON на prod (`WORLD_PUBLISH_URL`) с секретом `WORLD_IMPORT_SECRET`

Локально без prod:

```bash
npm run world:import -- --force
```

Только выгрузка готового JSON:

```bash
npm run world:publish -- --force
```

5. **Проверка** — в ответе должно быть `imagesLoaded: 15` (или близко). Если меньше — проверьте `sourceUrl` (для MakerWorld нужен числовой id в URL).

## Настройка `.env` (один раз)

```env
WORLD_IMPORT_SECRET=длинная-случайная-строка
WORLD_PUBLISH_URL=https://shapecraft.ru/api/world/import
```

Тот же `WORLD_IMPORT_SECRET` должен быть в `.env` на сервере (`/opt/shapecraft/.env`) и контейнер пересобран.

## Альтернатива: импорт через админку

1. Сгенерировать JSON (шаг 3).
2. Админ → `/world` → вставить JSON → **Импортировать подборку**.

## Проверка

- `npm run build` — без ошибок
- В админке `/world` — 3 блока по 5 карточек **с фото**
- У статей есть описание и ссылка «Источник»

## Шаблон

См. `data/world-trends-template.json` — только структура, не использовать как готовую подборку.
