---
name: world-trends-agent
description: >-
  Еженедельная подборка «В мире» для ShapeCraft: исследует тренды 3D-печати игрушек,
  формирует 15 статей (5 дорогих, 5 средних, 5 дешёвых) и импортирует в проект.
  Используй, когда пользователь просит обновить «В мире», подборку трендов,
  weekly world trends, или аналитику игрушек для 3D-печати.
---

# Агент подборки «В мире» (ShapeCraft)

Бесплатная замена OpenAI-бота: аналитику делает агент Cursor, сайт только импортирует JSON.

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
      "sourceUrl": "https://...",
      "imageUrl": null
    }
  ]
}
```

Правила:
- `description` — минимум 20 символов, на **русском**
- `sourceUrl` — рабочая ссылка на страницу модели
- `imageUrl` — можно `null` (сайт подтянет og:image сам)
- Ровно **5 + 5 + 5** по tier

4. **Импорт локально**:

```bash
npm run world:import -- --force
```

Файл по умолчанию: `data/world-import.json`. Другой путь:

```bash
npm run world:import -- data/my-batch.json --force
```

5. **Деплой** (если нужно на shapecraft.ru):

```bash
git add data/world-import.json
git commit -m "Update world trends weekly batch."
git push
```

На сервере: `update-on-server.sh`, **или** в админке **В мире → вставить JSON → Импортировать**.

## Альтернатива: импорт через админку

1. Сгенерировать JSON (шаг 3).
2. Админ → https://shapecraft.ru/world → блок «Импорт от агента Cursor».
3. Вставить JSON → **Импортировать подборку** (галочка «Перезаписать неделю» при необходимости).

## Проверка

- `npm run build` — без ошибок
- В админке `/world` — 3 блока по 5 карточек
- У статей есть описание и ссылка «Источник»

## Шаблон

См. `data/world-trends-template.json` — только структура, не использовать как готовую подборку.
