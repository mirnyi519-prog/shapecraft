import { Badge, Card } from "@/components/ui";

const NOW_TOYS = [
  {
    name: "Капитан Прайм",
    note: "собирает команду, образ СберПрайма",
  },
  {
    name: "КотоДрайв",
    note: "доехать до места",
  },
  {
    name: "БыстроКот",
    note: "принести заказ",
  },
  {
    name: "МультиКуся",
    note: "кино и мультфильмы",
  },
  {
    name: "Леди Мелодия",
    note: "музыка и аудиосказки",
  },
];

const NEXT_COSTUMES = [
  "Биг Хит",
  "Моланг Бургер",
  "Айс Де Люкс",
  "Кофе",
  "Картофель фри",
  "Яблочные дольки",
  "Морковные дольки",
  "Коробочка Кидз Комбо",
];

/**
 * Срез на 2 октября 2026.
 * В России «Хэппи Мил» — это «Кидз Комбо» сети «Вкусно — и точка».
 */
export function HappyMealNote() {
  return (
    <Card title="Сейчас в Хэппи Мил">
      <p className="text-sm leading-relaxed text-[var(--muted)]">
        В России это «Кидз Комбо» сети «Вкусно — и точка». В наборе одна
        случайная фигурка. Срез на 2 октября 2026.
      </p>

      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">До 5 октября</h3>
          <Badge tone="warning">сейчас</Badge>
        </div>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Суперкоманда СберКота и Куси — 5 героев. Серия с 8 сентября.
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {NOW_TOYS.map((toy) => (
            <li
              key={toy.name}
              className="rounded-xl bg-[var(--bg)] px-3 py-2 text-sm"
            >
              <span className="font-medium">{toy.name}</span>
              <span className="text-[var(--muted)]"> — {toy.note}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5">
        <h3 className="text-base font-semibold">С 6 октября</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Ластик Моланг и один из 8 съёмных костюмов в виде блюд сети. Коробку
          можно превратить в ещё одного Моланга, QR ведёт в игру.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {NEXT_COSTUMES.map((name) => (
            <li key={name}>
              <Badge tone="neutral">{name}</Badge>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
