import { Badge, Card } from "@/components/ui";

const CURRENT_STORY =
  "https://www.sostav.ru/publication/vkusno-i-tochka-dobavila-geroev-sberprajma-v-kidz-kombo-86886.html";
const NEXT_STORY =
  "https://www.retail.ru/rbc/pressreleases/zheltyy-burger-s-lilovym-syrom-i-rozovye-medalony-vkusno-i-tochka-zapuskaet-kollaboratsiyu-s-molang/";
const MENU = "https://vkusnoitochka.ru/menu/kidz-kombo";

const NOW_TOYS = [
  {
    name: "Капитан Прайм",
    note: "собирает команду, образ СберПрайма",
  },
  {
    name: "КотоДрайв",
    note: "доехать до места, едет на бургере",
  },
  {
    name: "БыстроКот",
    note: "принести заказ, кепка и рюкзак",
  },
  {
    name: "МультиКуся",
    note: "кино и мультфильмы",
  },
  {
    name: "Леди Мелодия",
    note: "музыка и аудиосказки, с микрофоном",
  },
];

const NOW_PHOTOS = [
  {
    src: "https://cdn.sostav.ru/images/news/2026/09/12/f5ua47t3.jpg",
    alt: "БыстроКот с рюкзаком и КотоДрайв на бургере",
    caption: "БыстроКот и КотоДрайв",
  },
  {
    src: "https://cdn.sostav.ru/images/news/2026/09/12/vfcvz5pc.jpg",
    alt: "Три фигурки: кошка в синей форме, Капитан Прайм в белом костюме и кошка с микрофоном",
    caption: "Капитан Прайм, МультиКуся и Леди Мелодия",
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
 * Фото текущей серии — пресс-кадры из материала Sostav.
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
          Суперкоманда СберКота и Куси — 5 героев. Серия с 8 сентября.{" "}
          <StoryLink href={CURRENT_STORY}>Материал Sostav</StoryLink>
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {NOW_PHOTOS.map((photo) => (
            <a
              key={photo.src}
              href={CURRENT_STORY}
              target="_blank"
              rel="noreferrer"
              className="group overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)]"
            >
              {/* Внешний кадр прессы: обычный img, без оптимизатора Next. */}
              <img
                src={photo.src}
                alt={photo.alt}
                className="aspect-[3/2] w-full object-cover object-left transition group-hover:opacity-90"
              />
              <span className="block px-3 py-2 text-sm font-medium">
                {photo.caption}
              </span>
            </a>
          ))}
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {NOW_TOYS.map((toy) => (
            <li key={toy.name}>
              <a
                href={CURRENT_STORY}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl bg-[var(--bg)] px-3 py-2 text-sm hover:bg-[var(--brand-soft)]"
              >
                <span className="font-medium">{toy.name}</span>
                <span className="text-[var(--muted)]"> — {toy.note}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5">
        <h3 className="text-base font-semibold">С 6 октября</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Ластик Моланг и один из 8 съёмных костюмов в виде блюд сети. Коробку
          можно превратить в ещё одного Моланга, QR ведёт в игру.{" "}
          <StoryLink href={NEXT_STORY}>Пресс-релиз Retail.ru</StoryLink>
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {NEXT_COSTUMES.map((name) => (
            <li key={name}>
              <a href={NEXT_STORY} target="_blank" rel="noreferrer">
                <Badge tone="neutral">{name}</Badge>
              </a>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-sm">
        <StoryLink href={MENU}>Меню Кидз Комбо на сайте сети</StoryLink>
      </p>
    </Card>
  );
}

function StoryLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-[var(--brand)] underline-offset-2 hover:underline"
    >
      {children}
    </a>
  );
}
