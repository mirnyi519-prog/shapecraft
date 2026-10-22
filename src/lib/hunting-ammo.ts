/**
 * Какой патрон брать на кого и в какой сезон — по перечню охотничьих ресурсов ст. 11 закона № 209-ФЗ.
 * Ключи у популярных видов совпадают с командами бота (/utka, /kaban…).
 */

export type AmmoSeason = "spring" | "early" | "autumn" | "winter";

export const AMMO_SEASONS: { id: AmmoSeason; title: string; months: string; monthList: number[] }[] = [
  { id: "spring", title: "Весна", months: "март – май", monthList: [3, 4, 5] },
  { id: "early", title: "Лето и начало осени", months: "июнь – сентябрь", monthList: [6, 7, 8, 9] },
  { id: "autumn", title: "Осень", months: "октябрь – ноябрь", monthList: [10, 11] },
  { id: "winter", title: "Зима", months: "декабрь – февраль", monthList: [12, 1, 2] },
];

export type AmmoGroup = "hoofed" | "bear" | "fur" | "birds";

export const AMMO_GROUPS: { id: AmmoGroup; title: string; emoji: string; words: RegExp }[] = [
  { id: "hoofed", title: "Копытные", emoji: "🦌", words: /копытн/i },
  { id: "bear", title: "Медведь", emoji: "🐻", words: /медвед/i },
  { id: "fur", title: "Пушные", emoji: "🐾", words: /пушн|зверь|звер[яи]/i },
  { id: "birds", title: "Пернатая дичь", emoji: "🦆", words: /пернат|птиц|дичь/i },
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
  group: AmmoGroup;
  /** Как вид называют в сообщениях: «рябчик», «на рябчика». */
  match: RegExp;
  /** Основные виды — в общей подборке /patron. */
  popular?: boolean;
  /** Ограничения Правил охоты и закона — показываем отдельной строкой. */
  rule?: string;
  seasons: Partial<Record<AmmoSeason, AmmoTip>>;
};

const RULE_BIRD = "По пернатой — дробь не крупнее 5 мм, пули нельзя (п. 62.21).";
const RULE_BIRD_RIFLE =
  "По пернатой — дробь не крупнее 5 мм (п. 62.21); нарезное — только 5,6 мм кольцевого воспламенения (п. 62.19).";
const RULE_HOOFED_BULLET = "Только пуля: дробь и картечь по этому виду запрещены (п. 62.5).";
const RULE_HOOFED_BUCK5 = "Дробь запрещена, картечь — не мельче 5 мм (п. 62.5).";
const RULE_RIFLE_57 = "Нарезное — калибром не более 5,7 мм (п. 62.20).";
const RULE_RIFLE_8 = "Нарезное — калибром не более 8 мм (п. 62.20).";
const RULE_RED_BOOK = "Многие подвиды в Красной книге — добыча запрещена (ст. 11.1 закона об охоте); уточнить по региону.";

const both = (tip: AmmoTip): Partial<Record<AmmoSeason, AmmoTip>> => ({ autumn: tip, winter: tip });
const allYear = (tip: AmmoTip): Partial<Record<AmmoSeason, AmmoTip>> => ({
  spring: tip,
  early: tip,
  autumn: tip,
  winter: tip,
});

const TRAPS: AmmoTip = {
  shot: "отлов (капканы, ловушки)",
  note: "Ружейная охота на этот вид почти не ведётся.",
};

export const AMMO_TABLE: AmmoSpecies[] = [
  // ── Копытные ──
  {
    key: "kaban",
    title: "Кабан",
    group: "hoofed",
    match: /кабан|секач|подсвин|сеголет/i,
    popular: true,
    rule: "Дробь запрещена, картечь — от 7,5 мм (п. 62.5); с 1 января по конец февраля загоном и с собаками нельзя (п. 62.16).",
    seasons: {
      early: { shot: "пуля (12 к.) или нарезное", note: "Вышка, подкормка; по сеголетку накоротке — картечь 7,55–8,5 мм." },
      autumn: { shot: "пуля (12 к.) или нарезное", note: "Загон — пуля, выстрел до 50 м; картечь 8,0–8,5 мм — только до 25 м." },
      winter: { shot: "пуля (12 к.) или нарезное", note: "Зверь в жиру и зимней щетине — только пуля; в январе–феврале — с вышки, без загона." },
    },
  },
  {
    key: "los",
    title: "Лось",
    group: "hoofed",
    match: /лос(ь|я|ей|ю|ям|ем)(?![а-яё])/i,
    popular: true,
    rule: RULE_HOOFED_BULLET,
    seasons: {
      early: { shot: "нарезное или пуля (12 к.)", note: "На рёву (сентябрь), выстрел с подхода." },
      autumn: { shot: "нарезное или пуля (12 к.)", note: "Загон и подход; на практике — нарезное от 7,62 мм." },
      winter: { shot: "нарезное или пуля (12 к.)", note: "Загон по снегу; пулю для гладкоствола — на 50 м." },
    },
  },
  {
    key: "kosulya",
    title: "Косуля",
    group: "hoofed",
    match: /косул/i,
    popular: true,
    rule: RULE_HOOFED_BUCK5,
    seasons: {
      early: { shot: "нарезное или пуля", note: "С подхода и засидки — лучше нарезное." },
      autumn: { shot: "пуля или картечь 5,6–6,2 мм", note: "Загон: картечь — только до 25 м, дальше пуля." },
      winter: { shot: "пуля или картечь 5,6–6,2 мм", note: "Загон: картечь — только до 25 м, дальше пуля." },
    },
  },
  {
    key: "olen",
    title: "Благородный олень (марал, изюбрь)",
    group: "hoofed",
    match: /(?<!(?:северн|пятнист)\S*\s)олен|марал|изюбр/i,
    popular: true,
    rule: RULE_HOOFED_BULLET,
    seasons: {
      early: { shot: "нарезное от 7,62 мм", note: "На рёву (сентябрь), выстрел с подхода." },
      autumn: { shot: "нарезное или пуля (12 к.)", note: "Загон и подход." },
      winter: { shot: "нарезное или пуля (12 к.)", note: "Загон и подход." },
    },
  },
  {
    key: "pyatnistyj_olen",
    title: "Пятнистый олень",
    group: "hoofed",
    match: /пятнист/i,
    rule: RULE_HOOFED_BULLET,
    seasons: {
      early: { shot: "нарезное", note: "На гону (сентябрь – октябрь), с подхода." },
      autumn: { shot: "нарезное или пуля (12 к.)", note: "Подход и загон, выстрел 50–150 м." },
      winter: { shot: "нарезное или пуля (12 к.)", note: "Подход и загон." },
    },
  },
  {
    key: "lan",
    title: "Лань",
    group: "hoofed",
    match: /(?<![а-яё])лан(ь|и|ей|ям)(?![а-яё])/i,
    rule: RULE_HOOFED_BULLET,
    seasons: {
      autumn: { shot: "нарезное", note: "Чаще в огороженных и закреплённых угодьях, с вышки или подхода." },
      winter: { shot: "нарезное", note: "С вышки или подхода." },
    },
  },
  {
    key: "severnyj_olen",
    title: "Дикий северный олень",
    group: "hoofed",
    match: /северн\S* олен/i,
    rule: RULE_HOOFED_BUCK5,
    seasons: {
      early: { shot: "нарезное", note: "Открытая тундра, дальние выстрелы 150–250 м." },
      autumn: { shot: "нарезное", note: "Открытая тундра и тайга, дальние выстрелы." },
      winter: { shot: "нарезное", note: "Открытая местность, дальние выстрелы." },
    },
  },
  {
    key: "kabarga",
    title: "Кабарга",
    group: "hoofed",
    match: /кабарг/i,
    rule: RULE_HOOFED_BUCK5,
    seasons: both({ shot: "нарезное или картечь 5,25–5,6 мм", note: "Мелкий зверь: картечь — только накоротке, до 25 м." }),
  },
  {
    key: "gornye",
    title: "Горные: сибирский козёл, туры, серна, снежный баран, муфлон",
    group: "hoofed",
    match: /козер|горн\S* коз|(?<![а-яё])тур(?![а-яё])|тур(а|ов|ы)(?![а-яё])|серн|снежн\S* бара|муфлон/i,
    rule: `${RULE_HOOFED_BULLET} ${RULE_RED_BOOK}`,
    seasons: {
      early: { shot: "нарезное с оптикой", note: "Горы, выстрелы 200–300 м — настильный калибр и пристрелка на дальность." },
      autumn: { shot: "нарезное с оптикой", note: "Гон, выстрелы 200–300 м." },
      winter: { shot: "нарезное с оптикой", note: "Выстрелы 200–300 м." },
    },
  },
  {
    key: "ovcebyk",
    title: "Овцебык, гибриды зубра с бизоном",
    group: "hoofed",
    match: /овцебык|зубр|бизон/i,
    rule: RULE_HOOFED_BULLET,
    seasons: both({ shot: "нарезное крупного калибра (от 9 мм)", note: "Очень крупный зверь — тяжёлая пуля, точный выстрел. Охота только по лицензии хозяйства." }),
  },
  {
    key: "saigak",
    title: "Сайгак",
    group: "hoofed",
    match: /сайгак/i,
    rule: "Занесён в Красную книгу — добыча запрещена; уточнить.",
    seasons: {},
  },

  // ── Медведь ──
  {
    key: "medved",
    title: "Медведь",
    group: "bear",
    match: /медвед/i,
    rule: "Дробь и картечь запрещены (п. 62.5); нельзя добывать медвежат до года и медведиц с медвежатами (п. 62.18).",
    seasons: {
      spring: { shot: "нарезное от 7,62 мм (лучше 9 мм и крупнее)", note: "На привадах после выхода из берлоги, выстрел 30–80 м." },
      early: { shot: "нарезное от 7,62 мм", note: "На овсах и привадах (август–сентябрь), вечерняя засидка." },
      autumn: { shot: "нарезное от 7,62 мм или пуля (12 к.)", note: "Овсы, подход; с напарником и резервным ружьём." },
      winter: { shot: "нарезное крупного калибра, резерв — пуля (12 к.)", note: "На берлоге, выстрел накоротке — тяжёлая пуля." },
    },
  },

  // ── Пушные ──
  {
    key: "volk",
    title: "Волк",
    group: "fur",
    match: /волк|волч/i,
    popular: true,
    seasons: {
      spring: { shot: "картечь 6,2–7,15 мм или пуля", note: "Крупный и живучий зверь: дробь не брать." },
      early: { shot: "картечь 6,2–7,15 мм или пуля", note: "Крупный и живучий зверь: дробь не брать." },
      autumn: { shot: "картечь 6,2–8,0 мм или пуля", note: "Загон с флажками — картечь, с подхода — пуля или нарезное." },
      winter: { shot: "картечь 6,2–8,0 мм или пуля", note: "Загон с флажками — картечь, с подхода — пуля или нарезное." },
    },
  },
  {
    key: "shakal",
    title: "Шакал",
    group: "fur",
    match: /шакал/i,
    seasons: allYear({ shot: "№0–№0000 или картечь 5,25 мм", mm: "4,25–5,0 мм", load: "36–40 г", note: "На вабу и привадах ночью, выстрел 20–35 м." }),
  },
  {
    key: "lisa",
    title: "Лиса и енотовидная собака",
    group: "fur",
    match: /лис|енотов/i,
    popular: true,
    seasons: {
      autumn: { shot: "№1–№0", mm: "4,0–4,25 мм", load: "36 г", note: "Енотовидная собака — №2–№1." },
      winter: { shot: "№0–№000", mm: "4,25–4,75 мм", load: "36–40 г", note: "Зимний мех, с гончими или загоном, выстрелы дальше." },
    },
  },
  {
    key: "korsak",
    title: "Корсак",
    group: "fur",
    match: /корсак/i,
    rule: RULE_RIFLE_57,
    seasons: both({ shot: "№1–№0 или нарезное 5,6 мм", mm: "4,0–4,25 мм", load: "36 г", note: "Степь, выстрелы дальние — с подъезда." }),
  },
  {
    key: "pesec",
    title: "Песец",
    group: "fur",
    match: /песц|песец/i,
    seasons: both({ shot: "№1–№000", mm: "4,0–4,75 мм", load: "36–40 г", note: "Тундра, зимний мех; чаще добывают капканами." }),
  },
  {
    key: "enot",
    title: "Енот-полоскун",
    group: "fur",
    match: /полоскун/i,
    rule: RULE_RIFLE_57,
    seasons: both({ shot: "№1–№0", mm: "4,0–4,25 мм", load: "36 г", note: "С собаками, ночью у водоёмов." }),
  },
  {
    key: "rys",
    title: "Рысь",
    group: "fur",
    match: /(?<![а-яё])рыс(ь|и|ей|ью)(?![а-яё])/i,
    rule: RULE_RIFLE_8,
    seasons: both({ shot: "картечь 5,6–6,2 мм или нарезное", note: "Тропление и загон, с лайками; зверь крепок на рану." }),
  },
  {
    key: "rosomaha",
    title: "Росомаха",
    group: "fur",
    match: /росомах/i,
    rule: RULE_RIFLE_8,
    seasons: both({ shot: "картечь 6,2 мм или нарезное", note: "Тропление по снегу; чаще добывают капканами." }),
  },
  {
    key: "barsuk",
    title: "Барсук",
    group: "fur",
    match: /барсук/i,
    popular: true,
    rule: RULE_RIFLE_8,
    seasons: {
      early: { shot: "картечь 5,6–6,2 мм или пуля", note: "Зверь крепкий на рану; чаще у нор с норными собаками. Уточнить у егеря." },
      autumn: { shot: "картечь 5,6–6,2 мм или пуля", note: "Зверь крепкий на рану; чаще у нор с норными собаками. Уточнить у егеря." },
    },
  },
  {
    key: "bobr",
    title: "Бобр",
    group: "fur",
    match: /бобр/i,
    popular: true,
    rule: RULE_RIFLE_8,
    seasons: both({ shot: "№0000 или картечь 5,25–6,2 мм", note: "Выстрел на 15–25 м; подранок уходит под воду. Способы уточнить у егеря." }),
  },
  {
    key: "vydra",
    title: "Выдра",
    group: "fur",
    match: /выдр/i,
    seasons: both({ ...TRAPS, note: "В основном капканами; ружейная охота редка — уточнить у охотпользователя." }),
  },
  {
    key: "sobol",
    title: "Соболь, куницы, харза",
    group: "fur",
    match: /собол|куниц|харз/i,
    rule: RULE_RIFLE_57,
    seasons: both({ shot: "нарезное 5,6 мм кольцевого или №5–№3", mm: "3,0–3,5 мм", load: "28–32 г", note: "С лайкой, зверёк на дереве — малопулька бережёт шкурку." }),
  },
  {
    key: "belka",
    title: "Белка и летяга",
    group: "fur",
    match: /белк|летяг/i,
    rule: `${RULE_RIFLE_57} Можно пневматикой (п. 62.22).`,
    seasons: both({ shot: "нарезное 5,6 мм кольцевого или №9–№7", mm: "2,0–2,5 мм", load: "24–28 г", note: "С лайкой, выстрел по голове, чтобы не портить шкурку." }),
  },
  {
    key: "melkie_kunye",
    title: "Горностай, колонок, солонгой, ласка, норки, хори",
    group: "fur",
    match: /горност|колонок|колонк|солонго|ласк|норк|хор(ь|я|ей|ём)(?![а-яё])|хорьк/i,
    rule: RULE_RIFLE_57,
    seasons: both({ shot: "капканы; при отстреле — №7–№5", mm: "2,5–3,0 мм", load: "24–28 г", note: "Мелкий ценный мех: дробь мелкая, навеска лёгкая." }),
  },
  {
    key: "dikie_koshki",
    title: "Дикие кошки (лесной и камышовый кот)",
    group: "fur",
    match: /(?<![а-яё])кот(а|у|ов|ом)?(?![а-яё])|кошк/i,
    rule: `${RULE_RIFLE_57} ${RULE_RED_BOOK}`,
    seasons: both({ shot: "№1–№0", mm: "4,0–4,25 мм", load: "36 г", note: "С собаками, у тростников и в пойменных лесах." }),
  },
  {
    key: "zayac",
    title: "Заяц (беляк, русак)",
    group: "fur",
    match: /зай|заяц|беляк|русак/i,
    popular: true,
    rule: RULE_RIFLE_57,
    seasons: {
      autumn: { shot: "№3–№1", mm: "3,5–4,0 мм", load: "34–36 г", note: "С гончими, заяц ещё в летнем меху." },
      winter: { shot: "№1–№0", mm: "4,0–4,25 мм", load: "36 г", note: "Беляк в зимнем меху, по пороше и с гончими." },
    },
  },
  {
    key: "krolik",
    title: "Дикий кролик",
    group: "fur",
    match: /кролик/i,
    rule: RULE_RIFLE_57,
    seasons: both({ shot: "№7–№5", mm: "2,5–3,0 мм", load: "30–32 г", note: "С подхода и с норными собаками, выстрелы близкие." }),
  },
  {
    key: "surok",
    title: "Сурки",
    group: "fur",
    match: /сурк|сурок/i,
    seasons: {
      early: { shot: "нарезное малого калибра (5,6 мм)", note: "Степь и горы, выстрел 80–150 м с упора; конец лета — начало осени." },
    },
  },
  {
    key: "ondatra",
    title: "Ондатра",
    group: "fur",
    match: /ондатр/i,
    rule: RULE_RIFLE_57,
    seasons: {
      spring: { shot: "№5–№3", mm: "3,0–3,5 мм", load: "30–32 г", note: "С лодки или с подхода по воде; часто — капканами." },
      autumn: { shot: "№5–№3", mm: "3,0–3,5 мм", load: "30–32 г", note: "С лодки или с подхода по воде; часто — капканами." },
    },
  },
  {
    key: "melkie_gryzuny",
    title: "Суслики, бурундуки, хомяки, кроты, водяная полёвка",
    group: "fur",
    match: /суслик|бурундук|хомяк|крот|полёвк|полевк/i,
    seasons: { early: TRAPS, autumn: TRAPS },
  },

  // ── Пернатая дичь ──
  {
    key: "utka",
    title: "Утка",
    group: "birds",
    match: /(?<![а-яё])ут(ка|ки|ок|ку|кам)(?![а-яё])|селез|кряков|чирк|нырок|нырк/i,
    popular: true,
    rule: RULE_BIRD,
    seasons: {
      spring: { shot: "№5–№6", mm: "3,0–2,75 мм", load: "32–34 г", note: "Селезень у подсадной или чучел, выстрел 20–35 м." },
      early: { shot: "№7–№6", mm: "2,5–2,75 мм", load: "30–32 г", note: "Открытие: молодая утка, выстрелы близкие." },
      autumn: { shot: "№4–№3", mm: "3,25–3,5 мм", load: "34–36 г", note: "Пролётная утка в пере и жире; по нырку и крупной крякве — №3–№2." },
    },
  },
  {
    key: "gus",
    title: "Гусь",
    group: "birds",
    match: /(?<![а-яё])гус/i,
    popular: true,
    rule: RULE_BIRD,
    seasons: {
      spring: { shot: "№1–№00", mm: "4,0–4,5 мм", load: "36–42 г", note: "На чучела, подпускать на 30–35 м; на дальних перелётах — №000–№0000." },
      early: { shot: "№1–№0", mm: "4,0–4,25 мм", load: "36–40 г", note: "Молодой гусь на кормёжке, выстрелы ближе." },
      autumn: { shot: "№00–№0000", mm: "4,5–5,0 мм", load: "38–42 г", note: "Крупный пролётный гусь. Крупнее 5 мм брать нельзя." },
    },
  },
  {
    key: "kazarka",
    title: "Казарки",
    group: "birds",
    match: /казарк/i,
    rule: `${RULE_BIRD} Краснозобая и некоторые другие казарки — в Красной книге.`,
    seasons: {
      spring: { shot: "№3–№1", mm: "3,5–4,0 мм", load: "34–36 г", note: "Мельче гуся — на чучела, выстрел 25–35 м." },
      autumn: { shot: "№3–№1", mm: "3,5–4,0 мм", load: "34–36 г", note: "На чучела и перелётах." },
    },
  },
  {
    key: "lysuha",
    title: "Лысуха и камышница",
    group: "birds",
    match: /лысух|камышниц/i,
    rule: RULE_BIRD,
    seasons: {
      early: { shot: "№6–№5", mm: "2,75–3,0 мм", load: "30–32 г", note: "С лодки и подхода у тростников." },
      autumn: { shot: "№5–№3", mm: "3,0–3,5 мм", load: "32–34 г", note: "Птица крепкая на рану, в пере." },
    },
  },
  {
    key: "teterev",
    title: "Тетерев",
    group: "birds",
    match: /тетер/i,
    popular: true,
    rule: RULE_BIRD_RIFLE,
    seasons: {
      spring: { shot: "№3–№1", mm: "3,5–4,0 мм", load: "34–36 г", note: "Токовик из шалаша, выстрел 30–40 м." },
      early: { shot: "№7–№6", mm: "2,5–2,75 мм", load: "30–32 г", note: "Выводки с легавой, молодая птица." },
      autumn: { shot: "№5–№3", mm: "3,0–3,5 мм", load: "32–36 г", note: "С подхода и с чучел." },
      winter: { shot: "№3–№1", mm: "3,5–4,0 мм", load: "34–36 г", note: "С чучел и подъезда, выстрелы дальние." },
    },
  },
  {
    key: "gluhar",
    title: "Глухарь",
    group: "birds",
    match: /глухар/i,
    rule: RULE_BIRD_RIFLE,
    seasons: {
      spring: { shot: "№0–№00", mm: "4,25–4,5 мм", load: "36–38 г", note: "На току под песню, выстрел 25–35 м." },
      early: { shot: "№3–№1", mm: "3,5–4,0 мм", load: "34–36 г", note: "Выводки с лайкой или легавой." },
      autumn: { shot: "№1–№0", mm: "4,0–4,25 мм", load: "36 г", note: "На галечниках и с лайкой; с лайкой по сидячему — 5,6 мм кольцевого." },
    },
  },
  {
    key: "ryabchik",
    title: "Рябчик",
    group: "birds",
    match: /рябчик/i,
    rule: `${RULE_BIRD_RIFLE} Можно пневматикой (п. 62.22).`,
    seasons: {
      early: { shot: "№8–№7", mm: "2,25–2,5 мм", load: "28–30 г", note: "На манок, выстрел 15–25 м." },
      autumn: { shot: "№7–№6", mm: "2,5–2,75 мм", load: "28–32 г", note: "На манок и с лайкой." },
      winter: { shot: "№7–№6", mm: "2,5–2,75 мм", load: "28–32 г", note: "С подхода и с лайкой." },
    },
  },
  {
    key: "kuropatka",
    title: "Куропатки (серая, белая, тундряная)",
    group: "birds",
    match: /куропат/i,
    rule: `${RULE_BIRD} По белой и тундряной — нарезное 5,6 мм кольцевого (п. 62.19).`,
    seasons: {
      early: { shot: "№8–№7", mm: "2,25–2,5 мм", load: "28–30 г", note: "Серая куропатка выводками, с легавой." },
      autumn: { shot: "№7–№6", mm: "2,5–2,75 мм", load: "30–32 г", note: "Серая — стаями, взлёт дальний." },
      winter: { shot: "№5–№4", mm: "3,0–3,25 мм", load: "32–34 г", note: "Белая и тундряная в зимнем пере, с подхода." },
    },
  },
  {
    key: "perepel",
    title: "Перепел",
    group: "birds",
    match: /перепел/i,
    rule: RULE_BIRD,
    seasons: {
      early: { shot: "№10–№9", mm: "1,75–2,0 мм", load: "24–28 г", note: "С легавой по жнивью, выстрел 15–25 м." },
    },
  },
  {
    key: "fazan",
    title: "Фазан",
    group: "birds",
    match: /фазан/i,
    rule: RULE_BIRD,
    seasons: both({ shot: "№6–№4", mm: "2,75–3,25 мм", load: "32–34 г", note: "С легавой или спаниелем в зарослях." }),
  },
  {
    key: "keklik",
    title: "Кеклик и улары",
    group: "birds",
    match: /кеклик|улар/i,
    rule: `${RULE_BIRD} Улары — в Красной книге.`,
    seasons: {
      early: { shot: "№7–№5", mm: "2,5–3,0 мм", load: "30–32 г", note: "Горы, выводки, выстрелы на взлёте." },
      autumn: { shot: "№5–№4", mm: "3,0–3,25 мм", load: "32 г", note: "Стаи в горах, взлёт дальний." },
    },
  },
  {
    key: "valdshnep",
    title: "Вальдшнеп",
    group: "birds",
    match: /вальдшнеп|тяг[аеиу]/i,
    popular: true,
    rule: RULE_BIRD,
    seasons: {
      spring: { shot: "№9–№8", mm: "2,0–2,25 мм", load: "28–32 г", note: "Тяга, выстрел 15–25 м в сумерках." },
      early: { shot: "№8–№7", mm: "2,25–2,5 мм", load: "30–32 г", note: "С легавой в мелколесье." },
      autumn: { shot: "№7–№6", mm: "2,5–2,75 мм", load: "30–32 г", note: "Высыпки, птица жирная и крепче на рану." },
    },
  },
  {
    key: "bekas",
    title: "Бекас, дупель, гаршнеп",
    group: "birds",
    match: /бекас|дупел|гаршнеп/i,
    popular: true,
    rule: RULE_BIRD,
    seasons: {
      early: { shot: "№10–№9", mm: "1,75–2,0 мм", load: "28 г", note: "Бекас с легавой, выстрел близкий и быстрый." },
      autumn: { shot: "№9–№8", mm: "2,0–2,25 мм", load: "28–30 г", note: "Дупель — №8–№7." },
    },
  },
  {
    key: "korostel",
    title: "Коростель, пастушок, погоныш",
    group: "birds",
    match: /коростел|пастушок|погоныш/i,
    rule: RULE_BIRD,
    seasons: {
      early: { shot: "№9–№8", mm: "2,0–2,25 мм", load: "28 г", note: "С легавой или спаниелем по лугам и болотам." },
    },
  },
  {
    key: "kuliki",
    title: "Кулики: турухтан, травник, улиты, мородунка, чибис, тулес, хрустан, камнешарка",
    group: "birds",
    match: /кулик|турухтан|травник|улит|мородунк|чибис|тулес|хрустан|камнешарк/i,
    rule: RULE_BIRD,
    seasons: {
      spring: { shot: "№9–№8", mm: "2,0–2,25 мм", load: "28 г", note: "Где открыта весенняя охота — на чучела у воды." },
      early: { shot: "№9–№7", mm: "2,0–2,5 мм", load: "28–30 г", note: "На пролёте, на отмелях и с чучелами." },
    },
  },
  {
    key: "kronshnep",
    title: "Кроншнепы и веретенники",
    group: "birds",
    match: /кроншнеп|веретенник/i,
    rule: `${RULE_BIRD} Ряд кроншнепов — в Красной книге.`,
    seasons: {
      early: { shot: "№5–№3", mm: "3,0–3,5 мм", load: "32–34 г", note: "Крупный осторожный кулик — подход сложный, выстрелы дальние." },
    },
  },
  {
    key: "golub",
    title: "Голуби (вяхирь, клинтух, сизый)",
    group: "birds",
    match: /голуб|вяхир|клинтух/i,
    rule: RULE_BIRD,
    seasons: {
      early: { shot: "№6–№5", mm: "2,75–3,0 мм", load: "30–32 г", note: "На полях с чучелами; вяхирь крупный — №5–№4." },
      autumn: { shot: "№5–№4", mm: "3,0–3,25 мм", load: "32 г", note: "Пролётный вяхирь, выстрелы дальние." },
    },
  },
  {
    key: "gorlica",
    title: "Горлицы",
    group: "birds",
    match: /горлиц/i,
    rule: `${RULE_BIRD} Можно пневматикой (п. 62.22).`,
    seasons: {
      early: { shot: "№8–№7", mm: "2,25–2,5 мм", load: "28 г", note: "На кормёжке и водопое, быстрый лёт." },
    },
  },
  {
    key: "sadzha",
    title: "Саджа",
    group: "birds",
    match: /саджа|саджу/i,
    rule: RULE_BIRD,
    seasons: {
      early: { shot: "№7–№5", mm: "2,5–3,0 мм", load: "30–32 г", note: "Степь, на водопое, выстрелы на пролёте." },
      autumn: { shot: "№7–№5", mm: "2,5–3,0 мм", load: "30–32 г", note: "Степь, на водопое." },
    },
  },
];

export const AMMO_GENERAL: string[] = [
  "Навеска указана для 12 калибра. Для 16 и 20 калибра — меньше навеска и, по привычке многих, номер на единицу мельче, чтобы осыпь оставалась плотной.",
  "Стальная дробь легче свинцовой — бери на 1–2 номера крупнее.",
  "Перед сезоном отстреляй ружьё на 35 м: какой номер даёт лучшую осыпь, тот и бери.",
  "Это общие рекомендации охотников, а не требования закона. Обязательные ограничения — в строке «Правила охоты».",
  "Перечень видов — ст. 11 закона № 209-ФЗ. Регион может добавить виды; гагары, бакланы, чайки, крачки, поморники и чистиковые — только для коренных малочисленных народов Севера.",
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

export function findAmmoSpecies(text: string): AmmoSpecies | undefined {
  const value = text.trim().toLowerCase();
  if (!value) {
    return undefined;
  }
  return AMMO_TABLE.find((item) => item.key === value) ?? AMMO_TABLE.find((item) => item.match.test(value));
}

export function findAmmoGroup(text: string): AmmoGroup | undefined {
  return AMMO_GROUPS.find((group) => group.words.test(text))?.id;
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
