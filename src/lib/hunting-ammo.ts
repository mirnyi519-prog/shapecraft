/** Какой патрон брать на кого и в какой сезон. Ключи видов — те же, что у команд бота (/utka, /kaban…). */

export type AmmoSeason = "spring" | "early" | "autumn" | "winter";

export const AMMO_SEASONS: { id: AmmoSeason; title: string; months: string; monthList: number[] }[] = [
  { id: "spring", title: "Весна", months: "март – май", monthList: [3, 4, 5] },
  { id: "early", title: "Лето и начало осени", months: "июнь – сентябрь", monthList: [6, 7, 8, 9] },
  { id: "autumn", title: "Осень", months: "октябрь – ноябрь", monthList: [10, 11] },
  { id: "winter", title: "Зима", months: "декабрь – февраль", monthList: [12, 1, 2] },
];

export type AmmoTip = {
  /** «№4–№3», «пуля», «картечь 6,2–8,0 мм». */
  shot: string;
  /** Диаметр дроби, если речь о номере. */
  mm?: string;
  /** Навеска для 12 калибра. */
  load?: string;
  note: string;
};

export type AmmoSpecies = {
  key: string;
  title: string;
  /** Что ограничивают Правила охоты — показываем в конце рекомендации. */
  rule?: string;
  seasons: Partial<Record<AmmoSeason, AmmoTip>>;
};

const BIRD_RULE = "Правила охоты: по пернатой — дробь не крупнее 5 мм, пули нельзя (п. 62.21).";
const HOOFED_RULE = "Правила охоты: по копытным дробь запрещена (п. 62.5).";

export const AMMO_TABLE: AmmoSpecies[] = [
  {
    key: "utka",
    title: "Утка",
    rule: BIRD_RULE,
    seasons: {
      spring: { shot: "№5–№6", mm: "3,0–2,75 мм", load: "32–34 г", note: "Селезень у подсадной или чучел, выстрел 20–35 м." },
      early: { shot: "№7–№6", mm: "2,5–2,75 мм", load: "30–32 г", note: "Открытие: молодая утка, выстрелы близкие." },
      autumn: { shot: "№4–№3", mm: "3,25–3,5 мм", load: "34–36 г", note: "Пролётная утка в пере и жире; по нырку и крупной крякве — №3–№2." },
    },
  },
  {
    key: "gus",
    title: "Гусь",
    rule: BIRD_RULE,
    seasons: {
      spring: { shot: "№1–№00", mm: "4,0–4,5 мм", load: "36–42 г", note: "На чучела, подпускать на 30–35 м; на дальних перелётах — №000–№0000." },
      early: { shot: "№1–№0", mm: "4,0–4,25 мм", load: "36–40 г", note: "Молодой гусь на кормёжке, выстрелы ближе." },
      autumn: { shot: "№00–№0000", mm: "4,5–5,0 мм", load: "38–42 г", note: "Крупный пролётный гусь. Крупнее 5 мм брать нельзя." },
    },
  },
  {
    key: "valdshnep",
    title: "Вальдшнеп",
    rule: BIRD_RULE,
    seasons: {
      spring: { shot: "№9–№8", mm: "2,0–2,25 мм", load: "28–32 г", note: "Тяга, выстрел 15–25 м в сумерках." },
      early: { shot: "№8–№7", mm: "2,25–2,5 мм", load: "30–32 г", note: "С легавой в мелколесье." },
      autumn: { shot: "№7–№6", mm: "2,5–2,75 мм", load: "30–32 г", note: "Высыпки, птица жирная и крепче на рану." },
    },
  },
  {
    key: "teterev",
    title: "Тетерев и глухарь",
    rule: BIRD_RULE,
    seasons: {
      spring: { shot: "№3–№1", mm: "3,5–4,0 мм", load: "34–36 г", note: "Токовик из шалаша; глухарь на току — №0–№00." },
      early: { shot: "№7–№6", mm: "2,5–2,75 мм", load: "30–32 г", note: "Выводки с легавой, молодая птица." },
      autumn: { shot: "№5–№3", mm: "3,0–3,5 мм", load: "32–36 г", note: "С подхода и с чучел; глухарь — №1–№0." },
      winter: { shot: "№3–№1", mm: "3,5–4,0 мм", load: "34–36 г", note: "С чучел и подъезда, выстрелы дальние." },
    },
  },
  {
    key: "bekas",
    title: "Бекас, дупель, болотная дичь",
    rule: BIRD_RULE,
    seasons: {
      early: { shot: "№10–№9", mm: "1,75–2,0 мм", load: "28 г", note: "Бекас с легавой, выстрел близкий и быстрый." },
      autumn: { shot: "№9–№8", mm: "2,0–2,25 мм", load: "28–30 г", note: "Дупель и коростель — №8–№7." },
    },
  },
  {
    key: "zayac",
    title: "Заяц",
    seasons: {
      autumn: { shot: "№3–№1", mm: "3,5–4,0 мм", load: "34–36 г", note: "С гончими, заяц ещё в летнем меху." },
      winter: { shot: "№1–№0", mm: "4,0–4,25 мм", load: "36 г", note: "Беляк в зимнем меху, по пороше и с гончими." },
    },
  },
  {
    key: "lisa",
    title: "Лиса и енотовидная собака",
    seasons: {
      autumn: { shot: "№1–№0", mm: "4,0–4,25 мм", load: "36 г", note: "Енотовидная собака — №2–№1." },
      winter: { shot: "№0–№000", mm: "4,25–4,75 мм", load: "36–40 г", note: "Зимний мех, с гончими или загоном, выстрелы дальше." },
    },
  },
  {
    key: "volk",
    title: "Волк",
    seasons: {
      spring: { shot: "картечь 6,2–7,15 мм или пуля", note: "Крупный и живучий зверь: дробь не брать." },
      early: { shot: "картечь 6,2–7,15 мм или пуля", note: "Крупный и живучий зверь: дробь не брать." },
      autumn: { shot: "картечь 6,2–8,0 мм или пуля", note: "Загон с флажками — картечь, с подхода — пуля или нарезное." },
      winter: { shot: "картечь 6,2–8,0 мм или пуля", note: "Загон с флажками — картечь, с подхода — пуля или нарезное." },
    },
  },
  {
    key: "bobr",
    title: "Бобр",
    seasons: {
      autumn: { shot: "№0000 или картечь 5,25–6,2 мм", note: "Выстрел на 15–25 м; подранок уходит под воду. Способы уточнить у егеря." },
      winter: { shot: "№0000 или картечь 5,25–6,2 мм", note: "Выстрел на 15–25 м; подранок уходит под воду. Способы уточнить у егеря." },
    },
  },
  {
    key: "barsuk",
    title: "Барсук",
    seasons: {
      early: { shot: "картечь 5,6–6,2 мм или пуля", note: "Зверь крепкий на рану; чаще охотятся у нор с норными собаками. Уточнить у егеря." },
      autumn: { shot: "картечь 5,6–6,2 мм или пуля", note: "Зверь крепкий на рану; чаще охотятся у нор с норными собаками. Уточнить у егеря." },
    },
  },
  {
    key: "kaban",
    title: "Кабан",
    rule: "Правила охоты: дробь запрещена, картечь — от 7,5 мм (п. 62.5); с 1 января по конец февраля загоном и с собаками нельзя (п. 62.16).",
    seasons: {
      early: { shot: "пуля (12 к.) или нарезное", note: "Вышка, подкормка; по сеголетку на коротких дистанциях — картечь 7,55–8,5 мм." },
      autumn: { shot: "пуля (12 к.) или нарезное", note: "Загон — пуля, выстрел до 50 м; картечь 8,0–8,5 мм — только накоротке, до 25 м." },
      winter: { shot: "пуля (12 к.) или нарезное", note: "Зверь в жиру и в зимней щетине — только пуля; в январе–феврале — с вышки, без загона." },
    },
  },
  {
    key: "los",
    title: "Лось",
    rule: "Правила охоты: только пуля — дробь и картечь по лосю запрещены (п. 62.5).",
    seasons: {
      early: { shot: "нарезное или пуля (12 к.)", note: "Охота на рёву (сентябрь), выстрел с подхода." },
      autumn: { shot: "нарезное или пуля (12 к.)", note: "Загон и подход; на практике — нарезное от 7,62 мм." },
      winter: { shot: "нарезное или пуля (12 к.)", note: "Загон по снегу; пулю для гладкоствола — на 50 м." },
    },
  },
  {
    key: "kosulya",
    title: "Косуля",
    rule: "Правила охоты: дробь запрещена, картечь — от 5 мм (п. 62.5).",
    seasons: {
      early: { shot: "нарезное или пуля", note: "С подхода и засидки — лучше нарезное." },
      autumn: { shot: "пуля или картечь 5,6–6,2 мм", note: "Загон: картечь — только до 25 м, дальше пуля." },
      winter: { shot: "пуля или картечь 5,6–6,2 мм", note: "Загон: картечь — только до 25 м, дальше пуля." },
    },
  },
  {
    key: "olen",
    title: "Олень",
    rule: HOOFED_RULE,
    seasons: {
      early: { shot: "нарезное", note: "На рёву (сентябрь), выстрел с подхода." },
      autumn: { shot: "нарезное или пуля (12 к.)", note: "Загон и подход." },
      winter: { shot: "нарезное или пуля (12 к.)", note: "Загон и подход." },
    },
  },
];

export const AMMO_GENERAL: string[] = [
  "Навеска указана для 12 калибра. Для 16 и 20 калибра — меньше навеска и, по привычке многих, номер на единицу мельче, чтобы осыпь оставалась плотной.",
  "Стальная дробь легче свинцовой — бери на 1–2 номера крупнее.",
  "Перед сезоном отстреляй ружьё на 35 м: какой номер даёт лучшую осыпь, тот и бери.",
  "Это общие рекомендации охотников, а не требования закона. Обязательные ограничения — в строке «Правила охоты».",
];

/** Российская шкала дроби: номер → диаметр. */
export const SHOT_SIZES: { number: string; mm: string }[] = [
  { number: "№10", mm: "1,75" },
  { number: "№9", mm: "2,0" },
  { number: "№8", mm: "2,25" },
  { number: "№7", mm: "2,5" },
  { number: "№6", mm: "2,75" },
  { number: "№5", mm: "3,0" },
  { number: "№4", mm: "3,25" },
  { number: "№3", mm: "3,5" },
  { number: "№2", mm: "3,75" },
  { number: "№1", mm: "4,0" },
  { number: "№0", mm: "4,25" },
  { number: "№00", mm: "4,5" },
  { number: "№000", mm: "4,75" },
  { number: "№0000", mm: "5,0" },
];

export function seasonForMonth(month: number): AmmoSeason {
  return AMMO_SEASONS.find((season) => season.monthList.includes(month))!.id;
}

export function seasonTitle(season: AmmoSeason): string {
  return AMMO_SEASONS.find((item) => item.id === season)!.title;
}

/** Рекомендация на нужный сезон; если в этот сезон вида нет — ближайший следующий сезон с данными. */
export function pickAmmo(
  key: string,
  season: AmmoSeason,
): { species: AmmoSpecies; season: AmmoSeason; tip: AmmoTip; exact: boolean } | null {
  const species = AMMO_TABLE.find((item) => item.key === key);
  if (!species) {
    return null;
  }
  const order = AMMO_SEASONS.map((item) => item.id);
  const from = order.indexOf(season);
  for (let shift = 0; shift < order.length; shift += 1) {
    const candidate = order[(from + shift) % order.length];
    const tip = species.seasons[candidate];
    if (tip) {
      return { species, season: candidate, tip, exact: shift === 0 };
    }
  }
  return null;
}

export function formatAmmoTip(tip: AmmoTip): string {
  const details = [tip.mm, tip.load ? `навеска ${tip.load}` : null].filter(Boolean).join(", ");
  return details ? `${tip.shot} (${details})` : tip.shot;
}
