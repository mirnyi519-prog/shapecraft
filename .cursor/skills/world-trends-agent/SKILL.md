---
name: world-trends-agent
description: >-
  Еженедельная подборка «В мире» для ShapeCraft: исследует тренды 3D-печати сувениров,
  дописывает новые модели (5 дорогих, 5 средних, 5 дешёвых) без повторов и импортирует в проект.
  Используй, когда пользователь просит обновить «В мире», подборку трендов,
  weekly world trends, или аналитику сувениров для 3D-печати.
---

# Агент подборки «В мире» (ShapeCraft)

Аналитику делает агент Cursor. Сайт сам подтягивает JSON с GitHub и фото с MakerWorld.

## Задача

Подборка **копится**. Уже записанные модели не переписывать и не удалять. Каждый раз **добавлять** ещё по **5** новых в каждый сегмент. Повторять источник нельзя: ни текущий `data/world-import.json`, ни модели из прошлых коммитов этого файла.

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
- Новые модели дописывать **в конец** массива. Старые объекты не менять
- В каждом сегменте после добавления должно быть минимум 5, без верхней планки «ровно 5»
- Перед отбором выписать id из `sourceUrl` (`/models/123`) уже лежащих в файле и в `git log -p -- data/world-import.json`. Совпавший id не брать

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
- Ответ sync: `imagesLoaded` совпадает с числом статей
- В админке `/world` — 3 блока, в каждом и старые модели, и новые, **с фото**

## Шаблон

См. `data/world-trends-template.json` — только структура, не использовать как готовую подборку.
