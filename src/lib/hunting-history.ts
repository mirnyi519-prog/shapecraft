import { MOOIR_ORIGIN, ymdKey } from "@/lib/hunting-shared";

/** Срок в году открытия: [начало ММ-ДД, конец ММ-ДД, номер документа на mooir.ru]; конец раньше начала — следующий год. */
type Fact = [string, string, number];

export type SeasonRule = {
  id: string;
  label: string;
  /** Команды бота по видам (utka, gus…), к которым относится срок. */
  species: string[];
  /** Закономерность, по которой МООиР ставит срок (анализ распоряжений 2017–2026), на ней и построена оценка. */
  rule: string;
  note?: string;
  /** Примерный срок сезона, который открывается в году year. */
  estimate: (year: number) => { start: string; end: string };
  /** Факт по распоряжениям для Шатуры; null — в Шатуре не открывали. Года нет — распоряжения на mooir.ru нет. */
  history: Record<number, Fact | null>;
};

/** Годы, которые показываем в таблице фактов (последние 3 сезона). */
export const HISTORY_YEARS = [2024, 2025, 2026];

/** n-я суббота месяца, ГГГГ-ММ-ДД. */
export function nthSaturday(year: number, month: number, n: number): string {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return ymdKey(year, month, 1 + ((6 - firstWeekday + 7) % 7) + 7 * (n - 1));
}

function shift(key: string, days: number): string {
  return new Date(Date.parse(`${key}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

function lastOfFebruary(year: number): string {
  return ymdKey(year, 2, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28);
}

const fixed = (start: string, end: string) => (year: number) => ({
  start: `${year}-${start}`,
  end: `${end < start ? year + 1 : year}-${end}`,
});

const untilFebruary = (start: string) => (year: number) => ({ start: `${year}-${start}`, end: lastOfFebruary(year + 1) });

const repeat = (start: string, end: string, ids: Record<number, number>): Record<number, Fact> =>
  Object.fromEntries(Object.entries(ids).map(([year, id]) => [year, [start, end, id]]));

/** Распоряжения о пушных зверях (август). */
const FUR_ORDERS = { 2024: 1463, 2025: 1518, 2026: 1558 };
/** Приказы по копытным; за остальные годы на mooir.ru их нет. */
const HOOFED_ORDERS = { 2025: 1517 };

export const SEASON_RULES: SeasonRule[] = [
  {
    id: "spring-decoy",
    label: "Весна: селезни уток с подсадной из укрытия",
    species: ["utka"],
    rule: "20 марта – 10 мая, с 2021 года без изменений",
    estimate: fixed("03-20", "05-10"),
    history: repeat("03-20", "05-10", { 2024: 1433, 2025: 1480, 2026: 1535 }),
  },
  {
    id: "spring",
    label: "Весна: гуси, селезни уток, вальдшнеп, тетерев, глухарь",
    species: ["utka", "gus", "valdshnep", "teterev"],
    rule: "10 дней со 2-й субботы апреля (8–14 апреля): так было в 2018–2020, 2025 и 2026; в 2021–2023 — с 1-й субботы, в 2017 и 2024 — с 3-й",
    estimate: (year) => {
      const start = nthSaturday(year, 4, 2);
      return { start, end: shift(start, 9) };
    },
    history: {
      2024: ["04-20", "04-29", 1435],
      2025: ["04-12", "04-21", 1486],
      2026: ["04-11", "04-20", 1535],
    },
  },
  {
    id: "summer-water",
    label: "Лето–осень: утки, гуси, лысуха; бекас, дупель; перепел, куропатка",
    species: ["utka", "gus", "bekas"],
    rule: "со 2-й субботы августа (8–14 августа) — так каждый год с 2018-го, в 2017-м была 3-я; по 30 ноября (в 2018–2020 — по 15 ноября)",
    estimate: (year) => ({ start: nthSaturday(year, 8, 2), end: `${year}-11-30` }),
    history: {
      2024: ["08-10", "11-30", 1460],
      2025: ["08-09", "11-30", 1510],
      2026: ["08-08", "11-30", 1556],
    },
  },
  {
    id: "summer-forest",
    label: "Лето–осень: вальдшнеп, рябчик, тетерев",
    species: ["valdshnep", "teterev"],
    rule: "ровно через неделю после утки — с 3-й субботы августа (15–21 августа), все 10 лет; по 31 декабря",
    estimate: (year) => ({ start: shift(nthSaturday(year, 8, 2), 7), end: `${year}-12-31` }),
    history: {
      2024: ["08-17", "12-31", 1460],
      2025: ["08-16", "12-31", 1510],
      2026: ["08-15", "12-31", 1556],
    },
  },
  {
    id: "dogs-marsh",
    label: "С легавой или спаниелем: бекас, дупель",
    species: ["bekas"],
    rule: "25 июля – 30 ноября",
    estimate: fixed("07-25", "11-30"),
    history: repeat("07-25", "11-30", { 2024: 1459, 2025: 1509, 2026: 1555 }),
  },
  {
    id: "dogs-forest",
    label: "С легавой или спаниелем: вальдшнеп, рябчик, куропатка",
    species: ["valdshnep"],
    rule: "5 августа – 1 января",
    estimate: fixed("08-05", "01-01"),
    history: repeat("08-05", "01-01", { 2024: 1459, 2025: 1509, 2026: 1555 }),
  },
  {
    id: "hare",
    label: "Заяц-беляк, русак",
    species: ["zayac"],
    rule: "15 сентября – конец февраля",
    estimate: untilFebruary("09-15"),
    history: repeat("09-15", "02-28", FUR_ORDERS),
  },
  {
    id: "fox",
    label: "Лиса, енотовидная собака",
    species: ["lisa"],
    rule: "15 сентября – конец февраля",
    estimate: untilFebruary("09-15"),
    history: repeat("09-15", "02-28", FUR_ORDERS),
  },
  {
    id: "wolf",
    label: "Волк",
    species: ["volk"],
    rule: "1 августа – 31 марта (с 2021 года), под контролем егеря",
    estimate: fixed("08-01", "03-31"),
    history: repeat("08-01", "03-31", FUR_ORDERS),
  },
  {
    id: "badger",
    label: "Барсук",
    species: ["barsuk"],
    rule: "15 августа – 31 октября, но квоту Шатуре дают не каждый год",
    note: "Шатура была в списке в 2022, 2024, 2025; в 2021, 2023 и 2026 — нет.",
    estimate: fixed("08-15", "10-31"),
    history: { 2024: ["08-15", "10-31", 1463], 2025: ["08-15", "10-31", 1518], 2026: null },
  },
  {
    id: "beaver",
    label: "Бобр",
    species: ["bobr"],
    rule: "1 октября – конец февраля",
    estimate: untilFebruary("10-01"),
    history: repeat("10-01", "02-28", FUR_ORDERS),
  },
  {
    id: "fur-small",
    label: "Норка, куница, белка, хорь, горностай, ласка",
    species: [],
    rule: "15 октября – конец февраля (с 2021 года)",
    estimate: untilFebruary("10-15"),
    history: repeat("10-15", "02-28", FUR_ORDERS),
  },
  {
    id: "elk-rut",
    label: "Лось, олень — взрослые самцы на гону",
    species: ["los", "olen"],
    rule: "1–30 сентября, только из засады или с подхода, по квоте",
    estimate: fixed("09-01", "09-30"),
    history: repeat("09-01", "09-30", HOOFED_ORDERS),
  },
  {
    id: "elk",
    label: "Лось — все",
    species: ["los"],
    rule: "15 сентября – 10 января, по квоте",
    estimate: fixed("09-15", "01-10"),
    history: { 2025: ["09-15", "01-10", 1517] },
  },
  {
    id: "deer",
    label: "Косуля, олень — все",
    species: ["kosulya", "olen"],
    rule: "1 октября – 10 января, по квоте",
    estimate: fixed("10-01", "01-10"),
    history: repeat("10-01", "01-10", HOOFED_ORDERS),
  },
  {
    id: "boar",
    label: "Кабан",
    species: ["kaban"],
    rule: "по Правилам охоты 1 июня – конец февраля; распоряжений МООиР с 2016 года нет — квоту уточнять у егеря",
    note: "С 1 января загоном, нагоном и с собаками нельзя; при карантине по АЧС — тоже.",
    estimate: untilFebruary("06-01"),
    history: {},
  },
];

export function factRange(year: number, fact: Fact): { start: string; end: string } {
  const [start, end] = fact;
  const endYear = end < start ? year + 1 : year;
  return { start: `${year}-${start}`, end: end === "02-28" ? lastOfFebruary(endYear) : `${endYear}-${end}` };
}

export function factUrl(fact: Fact): string {
  return `${MOOIR_ORIGIN}/official/prikras/${fact[2]}/`;
}

export type EstimatedWindow = { rule: SeasonRule; start: string; end: string };

const DECIDED_WITHIN_DAYS = 31;

/**
 * Примерные сроки по виду вокруг даты: открытые в этот день и ближайшее открытие каждого срока.
 * decided — начала сезонов из настоящих распоряжений (любых, и где Шатуры нет): такой сезон уже не угадываем.
 */
export function estimateWindows(species: string, day: string, decided: string[] = []): EstimatedWindow[] {
  const year = Number(day.slice(0, 4));
  const windows: EstimatedWindow[] = [];
  for (const rule of SEASON_RULES.filter((item) => item.species.includes(species))) {
    const candidates = [year - 1, year, year + 1]
      .map((y) => ({ rule, ...rule.estimate(y) }))
      .filter((window) => window.end >= day)
      .filter(
        (window) =>
          !decided.some(
            (start) => Math.abs(Date.parse(start) - Date.parse(window.start)) <= DECIDED_WITHIN_DAYS * 86_400_000,
          ),
      );
    const open = candidates.find((window) => window.start <= day);
    const next = candidates.find((window) => window.start > day);
    if (open) windows.push(open);
    if (next) windows.push(next);
  }
  return windows.sort((a, b) => a.start.localeCompare(b.start));
}

export const ESTIMATE_SOURCE =
  "Примерно — по закономерностям распоряжений МООиР 2017–2026 годов (весна — 2-я суббота апреля, лето — 2-я суббота августа), в таблице — последние 3 сезона. Точные даты МООиР публикует: весна — в конце февраля – марте, лето и осень — в июле – августе.";
