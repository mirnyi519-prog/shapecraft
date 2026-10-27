import { prisma } from "@/lib/db";
import { fetchHtml } from "@/lib/hunting";
import { escapeHtml } from "@/lib/hunting-format";
import { type TelegramUser, userName } from "@/lib/hunting-gathering";
import { htmlToText } from "@/lib/hunting-shared";
import { callTelegramApi, getTelegramChannelConfig, huntingExtraChatIds } from "@/lib/telegram";
import { formatMoscow } from "@/lib/timezone";

type Source =
  | { id: string; label: string; kind: "tg"; channel: string; regional?: boolean }
  | { id: string; label: string; kind: "regions"; regional?: boolean };

/**
 * Источники по Шатурскому округу и соседнему Егорьевскому (охотимся у границы, под Рязановским);
 * regional — областные, из них берём только новости с местом в этих округах.
 */
const SOURCES: Source[] = [
  { id: "tg:shatoora_news", label: "Шатура без цензуры", kind: "tg", channel: "shatoora_news" },
  { id: "tg:vshature", label: "Типичная Шатура", kind: "tg", channel: "vshature" },
  { id: "tg:shatura18", label: "Подслушано Шатура 18+", kind: "tg", channel: "shatura18" },
  { id: "tg:oshatura", label: "Подслушано Шатура", kind: "tg", channel: "oshatura" },
  { id: "tg:ferralii", label: "Подслушано у водителей Шатура", kind: "tg", channel: "ferralii" },
  { id: "tg:inshatura", label: "Ленинская Шатура", kind: "tg", channel: "inshatura" },
  { id: "tg:roshaldaily", label: "Рошаль. Город-призрак", kind: "tg", channel: "roshaldaily" },
  { id: "tg:misheronsky", label: "Подслушано Мишеронский", kind: "tg", channel: "misheronsky" },
  { id: "tg:HuYegoryevsk", label: "ЧП Егорьевск", kind: "tg", channel: "HuYegoryevsk" },
  { id: "tg:gazeta_zt", label: "Знамя труда · Егорьевск", kind: "tg", channel: "gazeta_zt" },
  { id: "tg:egrsk", label: "Подсмотрено в Егорьевске", kind: "tg", channel: "egrsk" },
  { id: "regions", label: "REGIONS · Шатура", kind: "regions" },
  { id: "tg:budet_poisk", label: "ЛизаАлерт · Будет поиск", kind: "tg", channel: "budet_poisk", regional: true },
  { id: "tg:gku_mo_mosoblpojspas", label: "Мособлпожспас", kind: "tg", channel: "gku_mo_mosoblpojspas", regional: true },
  { id: "tg:mosoblles", label: "Мособллес", kind: "tg", channel: "mosoblles", regional: true },
  { id: "tg:mchs_mo", label: "МЧС Московской области", kind: "tg", channel: "mchs_mo", regional: true },
];

export const INCIDENT_SOURCE_LABELS = SOURCES.map((source) => ({ label: source.label, regional: source.regional === true }));

/** Населённые пункты и урочища Шатурского округа и Егорьевского у границы — для областных каналов. */
const DISTRICT_RE =
  /(?<![а-яё])(?:шатур|рошал|черуст|мишерон|кривандин|туголес|дмитровск[а-яё]*\s+погост|середников|пышлиц|бакшеев|керв|северн[а-яё]*\s+грив|ярмол|осанов|харлампеев|радовиц|лузгар|пиявочн|курилов|егорьевск|рязановск|архиповск)/i;

/** Где: лес, вода, охота. Начало слова — чтобы «колесо» не считалось лесом. */
const PLACE_RE =
  /(?<![а-яё])(?:лес(?:а|у|ом|е|ной|ном|ных|ные|ная|ную|ов|ам|ах)?(?![а-яё])|лесн|болот|торфя|озер|озёр|рек[аеиу](?![а-яё])|речк|водо[её]м|пруд(?:а|у|ом|е|ы|ов|ам|ах)?(?![а-яё])|карьер(?!а|у|ой|н|ист)|охот(?!но(?![а-яё]))|рыба[кл]|рыбол|грибн|тих[ао][йя]\s+охот|егер|угодь|просек)/i;
/** Что случилось — тоже с начала слова: иначе «направленного» даёт «ранен», «спасибо» — «спас». */
const EVENT_RE =
  /(?<![а-яё])(?:спас(?!иб|ательн)|заблуд|пропал|ищут|поиск|утонул|утоп|тонул|провалил|под\s+л[её]д|пожар(?!н|оопасн)|возгоран|горит|браконьер|выстрел|застрел|ранен|ранил|погиб|труп|тело(?![а-яё])|напал|нападени|укус|бешен|шип(?!овн)|прокол|пробил|колёс|колес|украл|краж|обокрал|вскрыл|разбил|застрял|увяз|эвакуир|сбил[аи]?\s+(?:лос|кабан)|медвед|медвеж)/i;
/** Отчёты, итоги, праздники и познавательное — в них те же слова, но это не происшествие. */
const NOISE_RE =
  /(?<![а-яё])(?:подвел[аи]?\s+итог|подведены\s+итог|итоги\s+(?:деятельност|работ|года|квартал|сезон)|совещани|инвентаризац|концерт|лауреат|конкурс|фестивал|выставк|юбиле|поздравля|знаете\s+ли\s+вы|зарыблен|мальк|день\s+города|студент|будущим\s+специалист|экскурси|лекци|высад|лесовосстановлен|неликвид|санитарно-оздоровительн|противопожарн[а-яё]*\s+обустройств|минерализованн)/i;

const WORD_END = "(?![а-яё])";
/**
 * Дикие звери и птицы Подмосковья — новость о них интересна и без происшествия (вышли к дачам, сбили лося, АЧС).
 * Окончания перечислены там, где корень иначе цепляет чужие слова: «лосьон», «лист», «утка» в «сутки», «Гусь-Хрустальный».
 */
const WILDLIFE_RE = new RegExp(
  `(?<![а-яё])(?:${[
    `лос(?:ь|я|и|ю|ем|ей|ям|ями|ях|иха|ихи|ята|ёнок|енок|ёнка|енка)${WORD_END}`,
    "лосин(?!ый\\s+остров)",
    "кабан(?!чик)",
    "косул",
    `олен(?:ь|я|и|ю|ем|ей|ям|ях|ёнок|енок)${WORD_END}`,
    "медвед",
    "медвеж",
    `волк(?:а|и|у|ом|ов|ам|ами|ах)?${WORD_END}`,
    "волчиц",
    "волчат",
    "волчь",
    `лис(?:а|ы|у|ой|е|ица|ицы|ицу|ицей|иц|ят|ята|ёнок|енок)${WORD_END}`,
    "енот",
    "барсук",
    `рыс(?:ь|и|ью|ей|ята|ёнок|енок)${WORD_END}`,
    "куниц",
    `хор(?:ь|я|ю|ем|ей|ьк)${WORD_END}`,
    "выдр",
    `бобр(?:ы|а|у|ом|ов|ам|ами|ах|ёнок|енок|ята)?${WORD_END}`,
    "бобров(?:ая|ой|ую|ые|ых)",
    "ондатр",
    "горноста",
    "шакал",
    `за(?:яц|йц(?:а|у|ем|ы|ев|ам|ами|ах))${WORD_END}`,
    "зайчих",
    "глухар",
    "тетер",
    "рябчик",
    "куропат",
    "перепел",
    "вальдшнеп",
    "бекас",
    "коростел",
    "кряк",
    `утк(?:а|и|у|ой|е)${WORD_END}`,
    `уток${WORD_END}`,
    "утят",
    `гус(?:ь|я|и|ей|ям|ями|ях|ю|ем|ят|ята)${WORD_END}(?!-?хрустал)`,
    `лебед(?:ь|я|и|ей|ям|ями|ях|ю|ем)${WORD_END}`,
    "журавл",
    "цапл",
    "аист",
    "филин",
    `сов(?:а|ы|у|ой|е|ят|ята|ёнок|енок)${WORD_END}`,
    "неясыт",
    "ястреб",
    "коршун",
    "канюк",
    "орлан",
    "дик(?:ий|ого|ому|им|ом|ая|ой|ую|ие|их|ими)\\s+(?:живот|звер|птиц|кабан|утк|гус)",
    "птичь[а-яё]*\\s+грип",
    "африканск[а-яё]*\\s+чум",
    `ачс${WORD_END}`,
    "бешенств",
  ].join("|")})`,
  "gi",
);
/** Звери в декоре, кухне и культуре: «фигура медведя — символ посёлка», «утка по-пекински». */
const WILDLIFE_NOISE_RE =
  /(?<![а-яё])(?:фигур|скульптур|символ|зоопарк|рецепт|мульт|игрушк|поделк|спектакл|сказк|театр|ресторан|меню(?![а-яё])|чучел|поголов|домашн[а-яё]*\s+птиц|индее)/i;
/** Грибы и тихая охота: что пошло, где собирают, отравления. «Грибок» — болезнь, не гриб. */
const MUSHROOM_RE = new RegExp(
  `(?<![а-яё])(?:${[
    "гриб(?!ок|к[аеиу]|ков)",
    "тих[а-яё]*\\s+охот",
    "лисичк",
    `опят(?:а|ам|ами|ах)?${WORD_END}`,
    "опёнк",
    "опенк",
    "подберёз",
    "подберез",
    "подосинов",
    "боровик",
    "белы[йех]\\s+гриб",
    `рыжик`,
    "грузд",
    "маслят",
    "маслёнок",
    "масленок",
    "волнушк",
    "сыроежк",
    "мухомор",
    "поганк",
    "сморч",
    "моховик",
  ].join("|")})`,
  "gi",
);
const MUSHROOM_NOISE_RE =
  /(?<![а-яё])(?:рецепт|ресторан|меню(?![а-яё])|пицц|жульен|мульт|игрушк|поделк|спектакл|сказк|театр|грибков|плесен)/i;
/** «Барсуков», «Перепелицын», «Волкова» — фамилии, а не звери. */
const SURNAME_RE = /^[А-ЯЁ][а-яё]*(?:ов|ев|ёв|ин|ын)(?:а|у|ым|ой|е|ых|ыми)?$/;

/** Зверь, птица или гриб нарицательным словом: имя собственное в середине фразы («СОК "Рысь"») не в счёт. */
function mentions(text: string, re: RegExp, noise: RegExp): boolean {
  if (noise.test(text)) {
    return false;
  }
  for (const match of text.matchAll(re)) {
    const word = /^[а-яёА-ЯЁ]+/.exec(text.slice(match.index))?.[0] ?? match[0];
    const titleCase = /^[А-ЯЁ]/.test(word) && /[а-яё]/.test(word);
    if (!titleCase) {
      return true;
    }
    if (SURNAME_RE.test(word)) {
      continue;
    }
    const before = text.slice(0, match.index).replace(/[ \t]+$/, "");
    if (before === "" || /[.!?…\n]$/.test(before) || /\p{Extended_Pictographic}$/u.test(before)) {
      return true;
    }
  }
  return false;
}

const MAX_AGE_DAYS = 3;
const DUPLICATE_DAYS = 7;
const TEXT_IN_MESSAGE = 900;
/** Подпись к фото в Telegram — до 1024 символов вместе с шапкой и ссылкой. */
const TEXT_IN_CAPTION = 750;

/** Ручная проверка за период листает канал назад — не дальше этого числа страниц (~20 постов каждая). */
const BACKFILL_MAX_PAGES = 40;

type Found = { source: Source; url: string; text: string; publishedAt: Date; photoUrl?: string };

/** Лёд на водоёмах: и происшествия, и предупреждения. */
const ICE_RE =
  /(?<![а-яё])(?:выход[а-яё]*\s+на\s+л[её]д|на\s+льду|толщин[а-яё]*\s+льда|тонк[а-яё]*\s+л[её]д|л[её]д\s+(?:тонк|опас|непрочн|ещё|еще)|ледостав|ледоход|подл[её]дн|под\s+л[её]д)/i;
/** Предупреждение про лёд по всей области — интересно и без места в округе. */
const ICE_WARNING_RE =
  /(?<![а-яё])(?:выход[а-яё]*\s+на\s+л[её]д|толщин[а-яё]*\s+льда|тонк[а-яё]*\s+л[её]д|л[её]д\s+(?:тонк|опас|непрочн|ещё|еще)|ледостав|ледоход)/i;
const ICE_NOISE_RE = /(?<![а-яё])(?:хокке|каток|катк[аеиу]|фигурн|ледов[а-яё]*\s+(?:арен|дворц|шоу)|кёрлинг|керлинг)/i;

function mentionsIce(text: string): boolean {
  return ICE_RE.test(text) && !ICE_NOISE_RE.test(text);
}

/** Слова, которые модератор добавил в шум, — первые 6 букв. */
function hasNoiseStem(text: string, noiseStems: readonly string[]): boolean {
  if (noiseStems.length === 0) {
    return false;
  }
  const stems = new Set((text.toLowerCase().replace(/ё/g, "е").match(/[а-я]{5,}/g) ?? []).map((word) => word.slice(0, 6)));
  return noiseStems.some((stem) => stems.has(stem));
}

/** regional — пост из областного канала: нужно ещё и место в Шатурском округе (кроме предупреждений про лёд). */
export function isIncident(text: string, regional = false, noiseStems: readonly string[] = []): boolean {
  const relevant =
    (PLACE_RE.test(text) && EVENT_RE.test(text)) ||
    mentions(text, WILDLIFE_RE, WILDLIFE_NOISE_RE) ||
    mentions(text, MUSHROOM_RE, MUSHROOM_NOISE_RE) ||
    mentionsIce(text);
  if (!relevant || NOISE_RE.test(text) || hasNoiseStem(text, noiseStems)) {
    return false;
  }
  return !regional || DISTRICT_RE.test(text) || (ICE_WARNING_RE.test(text) && !ICE_NOISE_RE.test(text));
}

function matches(source: Source, text: string, noiseStems: readonly string[]): boolean {
  return isIncident(text, source.regional, noiseStems);
}

async function loadNoiseStems(): Promise<string[]> {
  const rows = await prisma.huntingNoiseWord.findMany({ where: { action: "add" }, select: { stem: true } });
  return rows.map((row) => row.stem);
}

export const RUBRICS = [
  { id: "search", emoji: "🆘", label: "Поиск и спасение" },
  { id: "fire", emoji: "🔥", label: "Пожары" },
  { id: "road", emoji: "🚗", label: "ДТП с животными" },
  { id: "danger", emoji: "⚠️", label: "Браконьеры, шипы, кражи" },
  { id: "water", emoji: "🧊", label: "Вода и лёд" },
  { id: "wildlife", emoji: "🐾", label: "Звери и птицы" },
  { id: "mushroom", emoji: "🍄", label: "Грибы" },
  { id: "other", emoji: "📰", label: "Прочее" },
] as const;

export type RubricId = (typeof RUBRICS)[number]["id"];

const SEARCH_RE = /(?<![а-яё])(?:заблуд|пропал|ищут|поиск|спасател|спасли|вывели\s+из\s+лес|лизаалерт|потерял[а-яё]*\s+в\s+лесу)/i;
const FIRE_RE = /(?<![а-яё])(?:пожар(?!н|оопасн)|возгоран|горит|загорел|задымлен|пал\s+травы|палы)/i;
const ROAD_RE = /(?<![а-яё])(?:дтп|сбил|сбит|столкнул|наезд|под\s+колёс|под\s+колес|на\s+дорогу\s+выбежал|выскочил[а-яё]*\s+на\s+дорог)/i;
const DANGER_RE = /(?<![а-яё])(?:браконьер|шип(?!овн)|прокол|пробил|украл|краж|обокрал|вскрыл|разбил|выстрел|застрел|ранен|ранил|напал|нападени|укус)/i;
const WATER_RE = /(?<![а-яё])(?:утонул|утоп|тонул|тонет|провалил)/i;

/** Рубрики новости по тексту — в порядке важности; без рубрики — «Прочее». */
export function rubricsOf(text: string): RubricId[] {
  const wildlife = mentions(text, WILDLIFE_RE, WILDLIFE_NOISE_RE);
  const found: RubricId[] = [];
  if (SEARCH_RE.test(text)) found.push("search");
  if (FIRE_RE.test(text)) found.push("fire");
  if (wildlife && ROAD_RE.test(text)) found.push("road");
  if (DANGER_RE.test(text)) found.push("danger");
  if (WATER_RE.test(text) || mentionsIce(text)) found.push("water");
  if (wildlife) found.push("wildlife");
  if (mentions(text, MUSHROOM_RE, MUSHROOM_NOISE_RE)) found.push("mushroom");
  return found.length > 0 ? found : ["other"];
}

function rubricList(value: string): RubricId[] {
  return value.split(",").filter((id): id is RubricId => RUBRICS.some((rubric) => rubric.id === id));
}

function rubricTitle(value: string): string {
  const ids = rubricList(value);
  const first = RUBRICS.find((rubric) => rubric.id === ids[0]) ?? RUBRICS[RUBRICS.length - 1];
  const emojis = ids.map((id) => RUBRICS.find((rubric) => rubric.id === id)!.emoji).join("");
  return `${emojis || first.emoji} ${first.label}`;
}

const PLACE_KINDS: [RegExp, string][] = [
  [/^(?:д\.|дер\.|деревн)/, "д."],
  [/^(?:с\.|сел)/, "с."],
  [/^(?:п\.|пос\.|пос[её]л|рп)/, "п."],
  [/^урочищ/, "ур."],
  [/^озер/, "оз."],
  [/^снт/i, "СНТ"],
];
const PLACE_RE_NAMED =
  /(?<![а-яё])(д\.|дер\.|деревн[а-яё]*|с\.|сел[аоеу]м?|п\.|пос\.|пос[её]л(?:ок|ка|ке|ком)|рп\.?|урочищ[а-яё]*|озер[оаеу]м?|СНТ|снт)\s*«?([А-ЯЁ][а-яё]+(?:(?:\s|-)(?![А-ЯЁ][а-яё]*(?:ского|скому|ском|ский|ской)(?![а-яё]))[А-ЯЁ][а-яё]+)?)/g;
/** Место рядом с названием нашего округа — в областных сводках, где перечислены деревни по всей области. */
const NEAR_DISTRICT_CHARS = 120;
/** Известные места округа — если в тексте нет «д. …», «п. …». */
const KNOWN_PLACES: [RegExp, string][] = [
  [/северн[а-яё]*\s+грив/i, "Северная Грива"],
  [/дмитровск[а-яё]*\s+погост/i, "Дмитровский Погост"],
  [/туголес/i, "Туголесский Бор"],
  [/шатурторф/i, "Шатурторф"],
  [/кривандин/i, "Кривандино"],
  [/мишерон/i, "Мишеронский"],
  [/черуст/i, "Черусти"],
  [/пышлиц/i, "Пышлицы"],
  [/середников/i, "Середниково"],
  [/бакшеев/i, "Бакшеево"],
  [/(?<![а-яё])керв/i, "Керва"],
  [/ярмол/i, "Ярмолы"],
  [/осанов/i, "Осаново"],
  [/курилов/i, "Курилово"],
  [/пиявочн/i, "Пиявочное"],
  [/радовиц/i, "Радовицкий"],
  [/лузгар/i, "Лузгарино"],
  [/харлампеев/i, "Харлампеево"],
  [/рязановск/i, "Рязановский"],
  [/архиповск/i, "Архиповское"],
  [/рошал/i, "Рошаль"],
  [/егорьевск/i, "Егорьевск"],
];

/**
 * Где случилось: «д. Бордуки», «оз. Святое» — если в тексте есть наш округ, то деревня рядом с ним;
 * иначе — известное место округа, названное первым.
 */
export function placeOf(text: string): string {
  const named = [...text.matchAll(PLACE_RE_NAMED)];
  const ours = DISTRICT_RE.test(text);
  const pick = ours
    ? named.find((match) =>
        DISTRICT_RE.test(text.slice(Math.max(0, match.index - NEAR_DISTRICT_CHARS), match.index + NEAR_DISTRICT_CHARS)),
      )
    : named[0];
  if (pick) {
    const kind = PLACE_KINDS.find(([re]) => re.test(pick[1].toLowerCase()))?.[1] ?? "";
    return `${kind} ${pick[2]}`.trim();
  }
  let best: { index: number; name: string } | null = null;
  for (const [re, name] of KNOWN_PLACES) {
    const index = text.search(re);
    if (index >= 0 && (!best || index < best.index)) {
      best = { index, name };
    }
  }
  const first = named[0];
  const firstName = first ? `${PLACE_KINDS.find(([re]) => re.test(first[1].toLowerCase()))?.[1] ?? ""} ${first[2]}`.trim() : "";
  return best?.name ?? firstName;
}

const ROAD_STOP_STEMS = new Set(["шатур", "рошал", "егорь", "подмо", "моско", "росси", "мособ", "будьт", "сотру"]);

/** Названия у места ДТП: «Слобода», «Петровской» — первые 5 букв, без слов в начале фразы. */
function roadStems(text: string): Set<string> {
  const stems = new Set<string>();
  for (const match of text.matchAll(/[А-ЯЁ][а-яё]{3,}/g)) {
    const before = text.slice(0, match.index);
    const abbreviation = /(?:^|[\s(])[а-яё]{1,4}\.\s*$/.test(before);
    const sentenceStart =
      before.trim() === "" || /[.!?…]\s+$/.test(before) || /\n\s*$/.test(before) || /\p{Extended_Pictographic}\s*$/u.test(before);
    if (sentenceStart && !abbreviation) {
      continue;
    }
    const stem = match[0].toLowerCase().slice(0, 5);
    if (!ROAD_STOP_STEMS.has(stem)) {
      stems.add(stem);
    }
  }
  return stems;
}

/** Даты прошлых ДТП с животными на том же участке за год. */
async function roadHistory(incident: { id: string; text: string; rubrics: string; publishedAt: Date }): Promise<string[]> {
  if (!rubricList(incident.rubrics).includes("road")) {
    return [];
  }
  const stems = roadStems(incident.text);
  if (stems.size === 0) {
    return [];
  }
  const rows = await prisma.huntingIncident.findMany({
    where: {
      id: { not: incident.id },
      duplicateOf: null,
      rubrics: { contains: "road" },
      publishedAt: { gte: new Date(incident.publishedAt.getTime() - 365 * 86_400_000), lt: incident.publishedAt },
    },
    orderBy: { publishedAt: "asc" },
    select: { text: true, publishedAt: true },
  });
  return rows
    .filter((row) => [...roadStems(row.text)].some((stem) => stems.has(stem)))
    .map((row) => formatMoscow(row.publishedAt, { day: "2-digit", month: "2-digit" }));
}

/** Повторы новости из других каналов — «Также писали». */
async function alsoWrote(id: string): Promise<{ sourceLabel: string; url: string }[]> {
  return prisma.huntingIncident.findMany({
    where: { duplicateOf: id },
    orderBy: { publishedAt: "asc" },
    select: { sourceLabel: true, url: true },
  });
}

function alsoLine(rows: { sourceLabel: string; url: string }[]): string[] {
  return rows.length > 0
    ? [`Также писали: ${rows.map((row) => `<a href="${escapeHtml(row.url)}">${escapeHtml(row.sourceLabel)}</a>`).join(", ")}`]
    : [];
}

/** Рубрики и место для новостей, сохранённых до появления рубрик. */
async function fillRubrics(): Promise<void> {
  const rows = await prisma.huntingIncident.findMany({ where: { rubrics: "" }, select: { id: true, text: true }, take: 500 });
  for (const row of rows) {
    await prisma.huntingIncident.update({
      where: { id: row.id },
      data: { rubrics: rubricsOf(row.text).join(","), place: placeOf(row.text) },
    });
  }
}

function fingerprint(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/ё/g, "е")
    .match(/[а-я]{5,}/g);
  return [...new Set((words ?? []).map((word) => word.slice(0, 6)))].slice(0, 60).join(" ");
}

function similar(a: string, b: string): boolean {
  const left = new Set(a.split(" ").filter(Boolean));
  const right = new Set(b.split(" ").filter(Boolean));
  if (left.size < 4 || right.size < 4) {
    return false;
  }
  let common = 0;
  for (const word of left) {
    if (right.has(word)) common += 1;
  }
  return common / Math.min(left.size, right.size) >= 0.5;
}

type TelegramPage = { found: Found[]; oldestId: number | null; oldestAt: Date | null };

/** Одна страница веб-версии канала; before — листать к постам старше этого номера. */
async function readTelegramPage(source: Extract<Source, { kind: "tg" }>, before?: number): Promise<TelegramPage> {
  const html = await fetchHtml(`https://t.me/s/${source.channel}${before ? `?before=${before}` : ""}`);
  const page: TelegramPage = { found: [], oldestId: null, oldestAt: null };
  for (const chunk of html.split('data-post="').slice(1)) {
    const post = chunk.slice(0, chunk.indexOf('"'));
    const id = Number(post.split("/")[1]);
    const time = /<time[^>]*datetime="([^"]+)"/.exec(chunk)?.[1];
    if (Number.isFinite(id) && (page.oldestId === null || id < page.oldestId)) {
      page.oldestId = id;
      page.oldestAt = time ? new Date(time) : page.oldestAt;
    }
    const body = /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(chunk)?.[1];
    if (!body || !time) {
      continue;
    }
    page.found.push({
      source,
      url: `https://t.me/${post}`,
      text: htmlToText(body.replace(/<br\s*\/?>/gi, "\n")).trim(),
      publishedAt: new Date(time),
      photoUrl: /tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/.exec(chunk)?.[1],
    });
  }
  return page;
}

async function readTelegram(source: Extract<Source, { kind: "tg" }>): Promise<Found[]> {
  const page = await readTelegramPage(source);
  if (page.oldestId === null) {
    throw new Error(`t.me/${source.channel}: посты не найдены`);
  }
  return page.found;
}

async function readTelegramSince(source: Extract<Source, { kind: "tg" }>, since: Date): Promise<Found[]> {
  const found: Found[] = [];
  let before: number | undefined;
  for (let index = 0; index < BACKFILL_MAX_PAGES; index++) {
    const page = await readTelegramPage(source, before);
    if (page.oldestId === null) {
      if (index === 0) throw new Error(`t.me/${source.channel}: посты не найдены`);
      break;
    }
    found.push(...page.found);
    if (!page.oldestAt || page.oldestAt < since || page.oldestId <= 1) {
      break;
    }
    before = page.oldestId;
  }
  return found.filter((item) => item.publishedAt >= since);
}

async function readRegions(source: Extract<Source, { kind: "regions" }>): Promise<Found[]> {
  const html = await fetchHtml("https://regions.ru/shatura");
  const items = [
    ...html.matchAll(
      /<a href="(\/shatura\/[^"]+)"><div class="gfxtdi1">[\s\S]*?<h2 class="gfxtdi6">([^<]+)<\/h2>[\s\S]*?dateTime="([^"]+)"/g,
    ),
  ];
  if (items.length === 0) {
    throw new Error("regions.ru: лента Шатуры не разобрана");
  }
  return items.map(([, href, title, time]) => ({
    source,
    url: `https://regions.ru${href}`,
    text: htmlToText(title).trim(),
    publishedAt: new Date(time.replace(/([+-]\d{2})(\d{2})$/, "$1:$2")),
  }));
}

/** В ленте regions.ru картинок нет — берём og:image со страницы статьи. */
async function readArticlePhoto(url: string): Promise<string | undefined> {
  try {
    const html = await fetchHtml(url);
    return /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/.exec(html)?.[1];
  } catch {
    return undefined;
  }
}

export function huntingAdminId(): string {
  return (process.env.TELEGRAM_HUNTING_ADMIN_ID ?? "").trim().replace(/^"|"$/g, "");
}

export type IncidentsCollectResult = { checked: number; queued: number; errors: string[] };

/** Обходит местные каналы, подозрительное — модератору в личку с кнопками. Первый проход источника только запоминает. */
export async function collectIncidents(now = new Date()): Promise<IncidentsCollectResult> {
  const errors: string[] = [];
  let checked = 0;
  let queued = 0;
  await fillRubrics();
  const noiseStems = await loadNoiseStems();

  for (const source of SOURCES) {
    let found: Found[];
    try {
      found = source.kind === "tg" ? await readTelegram(source) : await readRegions(source);
    } catch (error) {
      errors.push(`${source.label}: ${error instanceof Error ? error.message : "ошибка"}`);
      continue;
    }
    checked += found.length;

    const initKey = `incidents-init:${source.id}`;
    const isFirstRun = !(await prisma.huntingNotice.findUnique({ where: { key: initKey } }));
    for (const item of found) {
      if (now.getTime() - item.publishedAt.getTime() > MAX_AGE_DAYS * 86_400_000 || !matches(source, item.text, noiseStems)) {
        continue;
      }
      if (await prisma.huntingIncident.findUnique({ where: { url: item.url }, select: { id: true } })) {
        continue;
      }
      const print = fingerprint(item.text);
      const original = await findSimilar(print, item.publishedAt);
      const status = isFirstRun ? "seen" : original ? "skipped" : "pending";
      const photoUrl = status === "pending" ? await photoOf(item) : item.photoUrl;
      const incident = await prisma.huntingIncident.create({
        data: {
          ...incidentData(item, print),
          status,
          photoUrl,
          duplicateOf: original?.id ?? null,
        },
      });
      if (incident.status === "pending" && (await askModerator(incident))) {
        queued += 1;
      }
      if (original?.status === "pending") {
        await refreshModerator(original.id);
      }
    }
    if (isFirstRun) {
      await prisma.huntingNotice.create({ data: { key: initKey } });
    }
  }
  return { checked, queued, errors };
}

/**
 * Первая похожая новость в пределах DUPLICATE_DAYS от этой (если сама повтор — её оригинал);
 * onlyShown — только показанные модератору.
 */
async function findSimilar(
  print: string,
  publishedAt: Date,
  onlyShown = false,
  exceptUrl?: string,
): Promise<{ id: string; status: string } | null> {
  const window = DUPLICATE_DAYS * 86_400_000;
  const rows = await prisma.huntingIncident.findMany({
    where: {
      source: { not: "hunter" },
      publishedAt: { gte: new Date(publishedAt.getTime() - window), lte: new Date(publishedAt.getTime() + window) },
      ...(onlyShown ? { status: { in: ["pending", "published"] } } : {}),
      ...(exceptUrl ? { url: { not: exceptUrl } } : {}),
    },
    orderBy: { publishedAt: "asc" },
    select: { id: true, fingerprint: true, duplicateOf: true },
  });
  const match = rows.find((row) => similar(row.fingerprint, print));
  if (!match) {
    return null;
  }
  const rootId = match.duplicateOf ?? match.id;
  const root = await prisma.huntingIncident.findUnique({ where: { id: rootId }, select: { id: true, status: true } });
  return root ?? { id: match.id, status: "skipped" };
}

function incidentData(item: Found, print: string) {
  return {
    url: item.url,
    source: item.source.id,
    sourceLabel: item.source.label,
    text: item.text.slice(0, 4000),
    publishedAt: item.publishedAt,
    fingerprint: print,
    rubrics: rubricsOf(item.text).join(","),
    place: placeOf(item.text),
  };
}

async function photoOf(item: Found): Promise<string | undefined> {
  return item.photoUrl ?? (item.source.kind === "regions" ? await readArticlePhoto(item.url) : undefined);
}

export type IncidentsBackfillResult = {
  checked: number;
  matched: number;
  sent: number;
  duplicates: number;
  alreadyDecided: number;
  errors: string[];
};

/**
 * Ручная проверка за days дней: листает каналы назад (regions.ru — сколько есть в ленте), всё подходящее и ещё
 * не решённое — модератору. Новости, которые ждут решения, приходят заново, уже с фото.
 */
export async function backfillIncidents(days: number, now = new Date()): Promise<IncidentsBackfillResult> {
  const since = new Date(now.getTime() - days * 86_400_000);
  const result: IncidentsBackfillResult = { checked: 0, matched: 0, sent: 0, duplicates: 0, alreadyDecided: 0, errors: [] };
  const matched: Found[] = [];
  await fillRubrics();
  const noiseStems = await loadNoiseStems();
  for (const source of SOURCES) {
    try {
      const found =
        source.kind === "tg"
          ? await readTelegramSince(source, since)
          : (await readRegions(source)).filter((item) => item.publishedAt >= since);
      result.checked += found.length;
      matched.push(...found.filter((item) => matches(source, item.text, noiseStems)));
    } catch (error) {
      result.errors.push(`${source.label}: ${error instanceof Error ? error.message : "ошибка"}`);
    }
  }
  matched.sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());
  result.matched = matched.length;

  for (const item of matched) {
    const existing = await prisma.huntingIncident.findUnique({ where: { url: item.url } });
    if (existing && existing.status !== "pending" && existing.status !== "seen") {
      result.alreadyDecided += 1;
      continue;
    }
    const print = fingerprint(item.text);
    const original = existing?.status === "pending" ? null : await findSimilar(print, item.publishedAt, true, item.url);
    if (original) {
      result.duplicates += 1;
      if (!existing) {
        await prisma.huntingIncident.create({
          data: { ...incidentData(item, print), status: "skipped", photoUrl: item.photoUrl, duplicateOf: original.id },
        });
      } else {
        await prisma.huntingIncident.update({
          where: { id: existing.id },
          data: { status: "skipped", duplicateOf: original.id },
        });
      }
      if (original.status === "pending") {
        await refreshModerator(original.id);
      }
      continue;
    }
    const photoUrl = (await photoOf(item)) ?? existing?.photoUrl ?? undefined;
    const incident = existing
      ? await prisma.huntingIncident.update({
          where: { id: existing.id },
          data: { ...incidentData(item, print), status: "pending", photoUrl, duplicateOf: null },
        })
      : await prisma.huntingIncident.create({
          data: { ...incidentData(item, print), status: "pending", photoUrl },
        });
    if (await askModerator(incident)) {
      result.sent += 1;
    }
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }
  return result;
}

function clip(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
}

type SentMessage = { message_id: number; photo?: { file_id: string }[] };

const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Фото по ссылке; если Telegram сам не скачал (CDN каналов он часто не берёт) — качаем сами и грузим файлом.
 */
async function sendPhoto(
  payload: Record<string, unknown>,
  photoUrl: string,
): Promise<{ ok: boolean; result?: SentMessage; error?: string }> {
  const byUrl = await callTelegramApi<SentMessage>("hunting", "sendPhoto", { ...payload, photo: photoUrl });
  if (byUrl.ok) {
    return byUrl;
  }
  console.error("hunting incident photo by url", byUrl.error);
  const { token } = getTelegramChannelConfig("hunting");
  try {
    const image = await fetch(photoUrl, { signal: AbortSignal.timeout(15000) });
    const bytes = await image.arrayBuffer();
    if (!image.ok || bytes.byteLength === 0 || bytes.byteLength > PHOTO_MAX_BYTES) {
      return { ok: false, error: `фото не скачалось: HTTP ${image.status}, ${bytes.byteLength} B` };
    }
    const form = new FormData();
    for (const [key, value] of Object.entries(payload)) {
      form.set(key, typeof value === "string" ? value : JSON.stringify(value));
    }
    form.set("photo", new Blob([bytes], { type: image.headers.get("content-type") ?? "image/jpeg" }), "photo.jpg");
    const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(30000),
    });
    const body = (await response.json().catch(() => null)) as { ok?: boolean; result?: SentMessage; description?: string } | null;
    if (!body?.ok) {
      console.error("hunting incident photo upload", body?.description ?? response.status);
      return { ok: false, error: body?.description ?? `Telegram HTTP ${response.status}` };
    }
    return { ok: true, result: body.result };
  } catch (error) {
    console.error("hunting incident photo upload", error);
    return { ok: false, error: "фото не отправилось" };
  }
}

function shortDate(date: Date): string {
  return formatMoscow(date, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

type IncidentRow = NonNullable<Awaited<ReturnType<typeof prisma.huntingIncident.findUnique>>>;

function placeSuffix(place: string): string {
  return place ? ` · 📍 ${escapeHtml(place)}` : "";
}

/** Сообщение модератору: рубрика, место, источник, текст, повторы из других каналов, история участка дороги. */
async function moderatorHtml(incident: IncidentRow): Promise<(limit: number) => string> {
  const [also, road] = await Promise.all([alsoWrote(incident.id), roadHistory(incident)]);
  return (limit: number) =>
    [
      `🔎 <b>${escapeHtml(rubricTitle(incident.rubrics))}</b>${placeSuffix(incident.place)}`,
      `${escapeHtml(incident.sourceLabel)} · ${shortDate(incident.publishedAt)}`,
      "",
      escapeHtml(clip(incident.text, limit)),
      "",
      ...(road.length > 0 ? [`⚠️ Здесь животных сбивали и раньше: ${road.join(", ")}`] : []),
      ...alsoLine(also),
      `<a href="${escapeHtml(incident.url)}">Оригинал</a>`,
    ].join("\n");
}

function moderatorKeyboard(id: string) {
  return {
    inline_keyboard: [
      [
        { text: "📢 В чаты", callback_data: `inc:${id}:pub` },
        { text: "⏭ Пропустить", callback_data: `inc:${id}:skip` },
      ],
    ],
  };
}

/** Пришёл повтор новости, которая ждёт решения, — дописываем «Также писали» в сообщение модератору. */
async function refreshModerator(id: string): Promise<void> {
  const incident = await prisma.huntingIncident.findUnique({ where: { id } });
  const adminId = huntingAdminId();
  if (!incident?.adminMessageId || incident.status !== "pending" || !adminId) {
    return;
  }
  const html = await moderatorHtml(incident);
  const common = { chat_id: adminId, message_id: incident.adminMessageId, parse_mode: "HTML", reply_markup: moderatorKeyboard(id) };
  const result = incident.photoFileId
    ? await callTelegramApi("hunting", "editMessageCaption", { ...common, caption: html(TEXT_IN_CAPTION) })
    : await callTelegramApi("hunting", "editMessageText", {
        ...common,
        text: html(TEXT_IN_MESSAGE),
        disable_web_page_preview: true,
      });
  if (!result.ok) {
    console.error("hunting incident refresh", result.error);
  }
}

async function askModerator(incident: IncidentRow): Promise<boolean> {
  const adminId = huntingAdminId();
  if (!adminId) {
    return false;
  }
  const html = await moderatorHtml(incident);
  const reply_markup = moderatorKeyboard(incident.id);
  let sent = incident.photoUrl
    ? await sendPhoto({ chat_id: adminId, caption: html(TEXT_IN_CAPTION), parse_mode: "HTML", reply_markup }, incident.photoUrl)
    : null;
  if (!sent?.ok) {
    sent = await callTelegramApi<SentMessage>("hunting", "sendMessage", {
      chat_id: adminId,
      text: html(TEXT_IN_MESSAGE),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup,
    });
  }
  if (sent.ok && sent.result) {
    const fileId = sent.result.photo?.at(-1)?.file_id;
    await prisma.huntingIncident.update({
      where: { id: incident.id },
      data: { adminMessageId: sent.result.message_id, photoFileId: fileId ?? null },
    });
    if (incident.adminMessageId) {
      await callTelegramApi("hunting", "deleteMessage", { chat_id: adminId, message_id: incident.adminMessageId });
    }
  }
  return sent.ok;
}

/** Все охотничьи чаты: основной (с топиком) и дополнительные. */
function huntingTargets(): { chatId: string; threadId: number | null }[] {
  const config = getTelegramChannelConfig("hunting");
  const targets = config.chatId ? [{ chatId: config.chatId, threadId: config.threadId }] : [];
  for (const chatId of huntingExtraChatIds()) {
    if (!targets.some((target) => target.chatId === chatId)) {
      targets.push({ chatId, threadId: null });
    }
  }
  return targets;
}

/**
 * Текст (или фото с подписью) во все охотничьи чаты. Возвращает, в сколько чатов дошло.
 * captionHtml — короткий вариант текста под фото; если фото не ушло, шлётся полный html.
 */
async function broadcast(html: string, photo?: { fileId: string; captionHtml: string }): Promise<number> {
  let delivered = 0;
  for (const target of huntingTargets()) {
    const thread = target.threadId != null ? { message_thread_id: target.threadId } : {};
    let result = photo
      ? await callTelegramApi("hunting", "sendPhoto", {
          chat_id: target.chatId,
          photo: photo.fileId,
          caption: photo.captionHtml,
          parse_mode: "HTML",
          ...thread,
        })
      : null;
    if (!result?.ok) {
      result = await callTelegramApi("hunting", "sendMessage", {
        chat_id: target.chatId,
        text: html.slice(0, 4000),
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...thread,
      });
    }
    if (result.ok) {
      delivered += 1;
    } else {
      console.error("hunting broadcast", target.chatId, result.error);
    }
  }
  return delivered;
}

export type ModerateResult = { ok: boolean; message: string };

/**
 * Решение по новости — из лички бота или из админки. «В чаты» можно и для пропущенной раньше (в т.ч. дубля),
 * «Пропустить» — только для ждущей решения.
 */
export async function moderateIncident(id: string, publish: boolean): Promise<ModerateResult> {
  const claimed = await prisma.huntingIncident.updateMany({
    where: { id, source: { not: "hunter" }, status: { in: publish ? ["pending", "skipped", "seen"] : ["pending"] } },
    data: { status: publish ? "published" : "skipped" },
  });
  const incident = await prisma.huntingIncident.findUnique({ where: { id } });
  if (!incident || claimed.count === 0) {
    return { ok: false, message: "Уже обработано" };
  }
  let delivered = 0;
  let subscribers = 0;
  if (publish) {
    const [also, road] = await Promise.all([alsoWrote(incident.id), roadHistory(incident)]);
    const html = (limit: number) =>
      [
        `<b>${escapeHtml(rubricTitle(incident.rubrics))}</b>${placeSuffix(incident.place)}`,
        "",
        escapeHtml(clip(incident.text, limit)),
        "",
        ...(road.length > 0
          ? [`⚠️ Опасный участок: здесь уже сбивали животных (${road.join(", ")}) — сбавьте скорость.`]
          : []),
        `Источник: <a href="${escapeHtml(incident.url)}">${escapeHtml(incident.sourceLabel)}</a>`,
        ...alsoLine(also),
      ].join("\n");
    const photo = incident.photoFileId ?? incident.photoUrl;
    const content = photo ? { fileId: photo, captionHtml: html(TEXT_IN_CAPTION) } : undefined;
    delivered = await broadcast(html(TEXT_IN_MESSAGE), content);
    subscribers = await sendToSubscribers(rubricList(incident.rubrics), html(TEXT_IN_MESSAGE), content);
  }
  if (incident.adminMessageId) {
    await callTelegramApi("hunting", "editMessageReplyMarkup", {
      chat_id: huntingAdminId(),
      message_id: incident.adminMessageId,
      reply_markup: {
        inline_keyboard: [
          [{ text: publish ? `✅ В чатах (${delivered})` : "⏭ Пропущено", callback_data: "inc:done" }],
        ],
      },
    });
  }
  return {
    ok: true,
    message: publish ? `Отправлено в чаты: ${delivered}${subscribers ? `, подписчикам: ${subscribers}` : ""}` : "Пропущено",
  };
}

const BLOCKED_RE = /blocked|deactivated|chat not found|user is deactivated|bot can't initiate/i;

/** Опубликованная новость — в личку тем, кто подписан на её рубрики (/podpiska). */
async function sendToSubscribers(
  rubrics: RubricId[],
  html: string,
  photo?: { fileId: string; captionHtml: string },
): Promise<number> {
  const rows = await prisma.huntingSubscription.findMany({
    where: { rubric: { in: rubrics }, active: true },
    select: { userId: true },
  });
  let delivered = 0;
  for (const userId of new Set(rows.map((row) => row.userId))) {
    let result = photo
      ? await callTelegramApi("hunting", "sendPhoto", {
          chat_id: userId,
          photo: photo.fileId,
          caption: photo.captionHtml,
          parse_mode: "HTML",
        })
      : null;
    if (!result?.ok && !BLOCKED_RE.test(result?.error ?? "")) {
      result = await callTelegramApi("hunting", "sendMessage", {
        chat_id: userId,
        text: html.slice(0, 4000),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
    }
    if (result?.ok) {
      delivered += 1;
    } else if (BLOCKED_RE.test(result?.error ?? "")) {
      await prisma.huntingSubscription.updateMany({ where: { userId }, data: { active: false } });
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return delivered;
}

/** Подписки пользователя на рубрики и клавиатура для /podpiska. */
export async function subscriptionKeyboard(userId: string) {
  const rows = await prisma.huntingSubscription.findMany({ where: { userId, active: true }, select: { rubric: true } });
  const on = new Set(rows.map((row) => row.rubric));
  return {
    inline_keyboard: RUBRICS.filter((rubric) => rubric.id !== "other").map((rubric) => [
      { text: `${on.has(rubric.id) ? "✅" : "▫️"} ${rubric.emoji} ${rubric.label}`, callback_data: `sub:${rubric.id}` },
    ]),
  };
}

export const SUBSCRIPTION_TEXT = [
  "🔔 Новости в личку",
  "",
  "Отметьте, что присылать: как только модератор отправит такую новость в охотничьи чаты, она придёт и сюда.",
  "Нажмите ещё раз, чтобы отписаться.",
].join("\n");

/** Кнопка рубрики в /podpiska: подписать или отписать. */
export async function handleSubscriptionCallback(query: {
  id: string;
  data?: string;
  from: TelegramUser;
  message?: { message_id?: number; chat?: { id: number } };
}): Promise<void> {
  const rubric = RUBRICS.find((item) => `sub:${item.id}` === query.data);
  const userId = String(query.from.id);
  if (!rubric) {
    await callTelegramApi("hunting", "answerCallbackQuery", { callback_query_id: query.id });
    return;
  }
  const key = { userId_rubric: { userId, rubric: rubric.id } };
  const existing = await prisma.huntingSubscription.findUnique({ where: key });
  const subscribe = !existing?.active;
  if (subscribe) {
    await prisma.huntingSubscription.upsert({
      where: key,
      create: { userId, rubric: rubric.id, name: userName(query.from) },
      update: { active: true, name: userName(query.from) },
    });
    await prisma.huntingSubscription.updateMany({ where: { userId }, data: { active: true } });
  } else {
    await prisma.huntingSubscription.delete({ where: key });
  }
  await callTelegramApi("hunting", "answerCallbackQuery", {
    callback_query_id: query.id,
    text: subscribe ? `Подписка: ${rubric.label}` : `Отписка: ${rubric.label}`,
  });
  if (query.message?.chat && query.message.message_id) {
    await callTelegramApi("hunting", "editMessageReplyMarkup", {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      reply_markup: await subscriptionKeyboard(userId),
    });
  }
}

/** Кнопки модератора «В чаты / Пропустить» в личке бота. */
export async function handleIncidentCallback(query: { id: string; data?: string; from: TelegramUser }): Promise<void> {
  const match = /^inc:([^:]+):(pub|skip)$/.exec(query.data ?? "");
  const answer = (text: string) =>
    callTelegramApi("hunting", "answerCallbackQuery", { callback_query_id: query.id, text });
  if (!match || String(query.from.id) !== huntingAdminId()) {
    await answer("Решает модератор");
    return;
  }
  const incident = await prisma.huntingIncident.findUnique({ where: { id: match[1] }, select: { status: true } });
  if (incident?.status !== "pending") {
    await answer("Уже обработано");
    return;
  }
  const result = await moderateIncident(match[1], match[2] === "pub");
  await answer(result.message);
}

export const INCIDENT_FILTERS = [
  { id: "pending", label: "Ждут решения" },
  { id: "published", label: "В чатах" },
  { id: "skipped", label: "Пропущены" },
  { id: "hunter", label: "От охотников" },
  { id: "all", label: "Все" },
] as const;

export type IncidentFilter = (typeof INCIDENT_FILTERS)[number]["id"];

export async function listIncidents(filter: IncidentFilter, rubric: RubricId | null = null, take = 100) {
  await fillRubrics();
  const base =
    filter === "all"
      ? {}
      : filter === "hunter"
        ? { source: "hunter" }
        : { status: filter, source: { not: "hunter" } };
  const where = rubric ? { ...base, rubrics: { contains: rubric } } : base;
  const [rows, counts] = await Promise.all([
    prisma.huntingIncident.findMany({ where, orderBy: { publishedAt: "desc" }, take }),
    prisma.huntingIncident.groupBy({
      by: ["status"],
      where: { source: { not: "hunter" } },
      _count: { _all: true },
    }),
  ]);
  const hunter = await prisma.huntingIncident.count({ where: { source: "hunter" } });
  const count = (status: string) => counts.find((row) => row.status === status)?._count._all ?? 0;
  const [duplicates, inFilter] = await Promise.all([
    prisma.huntingIncident.findMany({
      where: { duplicateOf: { in: rows.map((row) => row.id) } },
      orderBy: { publishedAt: "asc" },
      select: { duplicateOf: true, sourceLabel: true, url: true },
    }),
    prisma.huntingIncident.findMany({ where: base, select: { rubrics: true } }),
  ]);
  const items = rows.map((row) => ({
    ...row,
    rubricIds: rubricList(row.rubrics),
    also: duplicates.filter((item) => item.duplicateOf === row.id),
  }));
  const rubricCounts = Object.fromEntries(
    RUBRICS.map((item) => [item.id, inFilter.filter((row) => rubricList(row.rubrics).includes(item.id)).length]),
  ) as Record<RubricId, number>;
  return {
    items,
    rubricCounts,
    counts: {
      pending: count("pending"),
      published: count("published"),
      skipped: count("skipped"),
      hunter,
      all: counts.reduce((sum, row) => sum + row._count._all, 0) + hunter,
    } satisfies Record<IncidentFilter, number>,
  };
}

export type SourceStat = {
  label: string;
  regional: boolean;
  shown: number;
  published: number;
  skipped: number;
  duplicates: number;
  lastAt: Date | null;
};

/** Сколько каждый канал дал новостей модератору и сколько из них ушло в чаты — чтобы видеть, кто только шумит. */
export async function sourceStats(days = 90): Promise<SourceStat[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await prisma.huntingIncident.findMany({
    where: { source: { not: "hunter" }, status: { not: "seen" }, publishedAt: { gte: since } },
    select: { source: true, status: true, duplicateOf: true, publishedAt: true },
  });
  return SOURCES.map((source) => {
    const own = rows.filter((row) => row.source === source.id);
    const duplicates = own.filter((row) => row.duplicateOf).length;
    const originals = own.filter((row) => !row.duplicateOf);
    return {
      label: source.label,
      regional: source.regional === true,
      shown: originals.length,
      published: originals.filter((row) => row.status === "published").length,
      skipped: originals.filter((row) => row.status === "skipped").length,
      duplicates,
      lastAt: own.reduce<Date | null>((last, row) => (!last || row.publishedAt > last ? row.publishedAt : last), null),
    };
  }).sort((a, b) => b.shown + b.duplicates - (a.shown + a.duplicates));
}

export async function listNoiseWords() {
  return prisma.huntingNoiseWord.findMany({ orderBy: { createdAt: "desc" } });
}

const NOISE_LOOKBACK_DAYS = 90;
const NOISE_MIN_SKIPPED = 3;
const NOISE_SUGGESTIONS = 8;

/**
 * Слова, которые часто встречаются в пропущенных модератором новостях и ни разу — в отправленных в чаты.
 * Слова самого фильтра (лес, пожар, лось…) не предлагаются.
 */
export async function noiseCandidates(now = new Date()) {
  const rows = await prisma.huntingIncident.findMany({
    where: {
      source: { not: "hunter" },
      duplicateOf: null,
      status: { in: ["published", "skipped"] },
      publishedAt: { gte: new Date(now.getTime() - NOISE_LOOKBACK_DAYS * 86_400_000) },
    },
    select: { text: true, status: true },
  });
  const known = new Set((await prisma.huntingNoiseWord.findMany({ select: { stem: true } })).map((row) => row.stem));
  const stats = new Map<string, { skipped: number; published: number; sample: string }>();
  for (const row of rows) {
    const words = new Map<string, string>();
    for (const word of row.text.toLowerCase().replace(/ё/g, "е").match(/[а-я]{5,}/g) ?? []) {
      if (!words.has(word.slice(0, 6))) words.set(word.slice(0, 6), word);
    }
    for (const [stem, word] of words) {
      const stat = stats.get(stem) ?? { skipped: 0, published: 0, sample: word };
      if (row.status === "published") stat.published += 1;
      else stat.skipped += 1;
      stats.set(stem, stat);
    }
  }
  return [...stats.entries()]
    .filter(([stem, stat]) => stat.published === 0 && stat.skipped >= NOISE_MIN_SKIPPED && !known.has(stem))
    .filter(([, stat]) => !isRelevantWord(stat.sample))
    .sort((a, b) => b[1].skipped - a[1].skipped)
    .slice(0, NOISE_SUGGESTIONS)
    .map(([stem, stat]) => ({ stem, sample: stat.sample, skipped: stat.skipped }));
}

function isRelevantWord(word: string): boolean {
  return (
    PLACE_RE.test(word) ||
    EVENT_RE.test(word) ||
    DISTRICT_RE.test(word) ||
    mentions(word, WILDLIFE_RE, /$^/) ||
    mentions(word, MUSHROOM_RE, /$^/) ||
    ICE_RE.test(word) ||
    rubricsOf(word)[0] !== "other"
  );
}

/** Раз в месяц — модератору в личку: какие слова добавить в шум. Кнопки: «в шум» / «не предлагать». */
export async function sendNoiseSuggestions(now = new Date()): Promise<boolean> {
  const adminId = huntingAdminId();
  const candidates = adminId ? await noiseCandidates(now) : [];
  if (candidates.length === 0) {
    return false;
  }
  const result = await callTelegramApi("hunting", "sendMessage", {
    chat_id: adminId,
    text: [
      "🧹 <b>Чему научиться у пропусков</b>",
      "",
      `Эти слова за ${NOISE_LOOKBACK_DAYS} дней были только в новостях, которые вы пропустили, и ни разу — в отправленных в чаты.`,
      "«В шум» — посты с таким словом бот больше не пришлёт. «Не предлагать» — оставить как есть.",
      "",
      ...candidates.map((item) => `• ${escapeHtml(item.sample)} — пропущено ${item.skipped}`),
    ].join("\n"),
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: candidates.map((item) => [
        { text: `➕ «${item.sample}» в шум`, callback_data: `noise:add:${item.stem}` },
        { text: "🚫 Не предлагать", callback_data: `noise:ignore:${item.stem}` },
      ]),
    },
  });
  return result.ok;
}

/** Кнопки «в шум / не предлагать» из ежемесячной подборки. */
export async function handleNoiseCallback(query: { id: string; data?: string; from: TelegramUser }): Promise<void> {
  const match = /^noise:(add|ignore):([а-я]{5,6})$/.exec(query.data ?? "");
  const answer = (text: string) =>
    callTelegramApi("hunting", "answerCallbackQuery", { callback_query_id: query.id, text });
  if (!match || String(query.from.id) !== huntingAdminId()) {
    await answer("Решает модератор");
    return;
  }
  const [, action, stem] = match;
  const sample = (await noiseCandidates()).find((item) => item.stem === stem)?.sample ?? stem;
  await prisma.huntingNoiseWord.upsert({
    where: { stem },
    create: { stem, action, sample },
    update: { action },
  });
  await answer(action === "add" ? `«${sample}» — теперь шум` : `«${sample}» больше не предлагаю`);
}

/** Удалить слово из шума (из админки). */
export async function removeNoiseWord(stem: string): Promise<void> {
  await prisma.huntingNoiseWord.deleteMany({ where: { stem } });
}

/** Новости за неделю для воскресных итогов: отправленные в чаты и предупреждения охотников, по рубрикам. */
export async function weeklyNewsLines(now = new Date()): Promise<string[]> {
  const rows = await prisma.huntingIncident.findMany({
    where: { status: "published", publishedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } },
    orderBy: { publishedAt: "asc" },
  });
  if (rows.length === 0) {
    return ["За неделю в лесу спокойно — новостей в чаты не было."];
  }
  const lines: string[] = [];
  const hunters = rows.filter((row) => row.source === "hunter");
  const news = rows.filter((row) => row.source !== "hunter");
  for (const rubric of RUBRICS) {
    const items = news.filter((row) => rubricList(row.rubrics || rubricsOf(row.text).join(","))[0] === rubric.id);
    if (items.length === 0) continue;
    lines.push("", `${rubric.emoji} <b>${rubric.label}</b> (${items.length})`);
    for (const item of items) {
      const firstLine = item.text.split(/(?<=[.!?])\s|\n/)[0] ?? item.text;
      lines.push(
        `• ${formatMoscow(item.publishedAt, { day: "2-digit", month: "2-digit" })}${item.place ? ` · ${escapeHtml(item.place)}` : ""} — <a href="${escapeHtml(item.url)}">${escapeHtml(clip(firstLine, 90))}</a>`,
      );
    }
  }
  if (hunters.length > 0) {
    lines.push("", `⚠️ <b>Предупреждения охотников</b> (${hunters.length})`);
    for (const item of hunters) {
      lines.push(`• ${formatMoscow(item.publishedAt, { day: "2-digit", month: "2-digit" })} — ${escapeHtml(clip(item.text, 90))}`);
    }
  }
  return lines.slice(lines[0] === "" ? 1 : 0);
}

/** Сколько за неделю было новостей про грибы (любых, не только отправленных) — для прогноза грибов. */
export async function weeklyMushroomPosts(now = new Date()): Promise<number> {
  await fillRubrics();
  return prisma.huntingIncident.count({
    where: {
      duplicateOf: null,
      rubrics: { contains: "mushroom" },
      publishedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) },
    },
  });
}

export const WARNING_USAGE = [
  "⚠️ Предупредить все охотничьи чаты:",
  "/vnimanie шипы на площадке у Кервы, проверяйте колёса",
  "",
  "Можно фото: отправьте снимок с подписью, начинающейся с /vnimanie.",
].join("\n");

const WARNINGS_PER_DAY = 3;
const MEMBER_STATUSES = new Set(["creator", "administrator", "member", "restricted"]);

async function isHuntingMember(userId: number): Promise<boolean> {
  for (const target of huntingTargets()) {
    const member = await callTelegramApi<{ status: string }>("hunting", "getChatMember", {
      chat_id: target.chatId,
      user_id: userId,
    });
    if (member.ok && member.result && MEMBER_STATUSES.has(member.result.status)) {
      return true;
    }
  }
  return false;
}

/** /vnimanie: предупреждение от охотника во все чаты. Возвращает ответ отправителю. */
export async function sendHunterWarning(input: {
  from: TelegramUser;
  chatId: number;
  isHuntingChat: boolean;
  text: string;
  photoFileId?: string;
  messageId?: number;
}): Promise<string> {
  const text = input.text.trim();
  if (text.length < 5) {
    return WARNING_USAGE;
  }
  if (!input.isHuntingChat && !(await isHuntingMember(input.from.id))) {
    return "Предупреждения рассылают только участники охотничьих чатов.";
  }
  const since = new Date(Date.now() - 86_400_000);
  const today = await prisma.huntingIncident.count({
    where: { source: "hunter", url: { startsWith: `hunter:${input.from.id}:` }, createdAt: { gte: since } },
  });
  if (today >= WARNINGS_PER_DAY) {
    return `Не больше ${WARNINGS_PER_DAY} предупреждений в сутки — если срочно, напишите в чат напрямую.`;
  }

  const now = new Date();
  const name = userName(input.from);
  const html = (limit: number) =>
    [
      "⚠️ <b>Внимание, охотники!</b>",
      "",
      escapeHtml(clip(text, limit)),
      "",
      `— ${escapeHtml(name)}, ${formatMoscow(now, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`,
    ].join("\n");
  const delivered = await broadcast(
    html(3000),
    input.photoFileId ? { fileId: input.photoFileId, captionHtml: html(TEXT_IN_CAPTION) } : undefined,
  );
  await prisma.huntingIncident.create({
    data: {
      url: `hunter:${input.from.id}:${input.chatId}:${input.messageId ?? now.getTime()}`,
      source: "hunter",
      sourceLabel: name,
      text: text.slice(0, 4000),
      publishedAt: now,
      status: "published",
      fingerprint: fingerprint(text),
      rubrics: rubricsOf(text).join(","),
      place: placeOf(text),
      photoFileId: input.photoFileId,
    },
  });
  return delivered > 0 ? `Разослал в охотничьи чаты: ${delivered}.` : "Не удалось разослать — попробуйте позже.";
}
