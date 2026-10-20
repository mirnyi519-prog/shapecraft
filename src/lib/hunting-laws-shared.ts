import { htmlToText } from "@/lib/hunting-shared";

const CONSULTANT = "https://www.consultant.ru/document";

/**
 * overview — «Обзор изменений» КонсультантПлюс: список редакций со ссылками на «что изменилось»;
 * title — у документа нет обзора, следим за «ред. от …» в заголовке;
 * article — статья кодекса: сам кодекс меняется каждую неделю, поэтому следим только за текстом статьи.
 */
export type LawTrack = { kind: "overview"; url: string } | { kind: "title" } | { kind: "article" };

export type LawGroupId = "hunting" | "weapons" | "fines";

export type LawWatch = {
  key: string;
  group: LawGroupId;
  /** Команда бота: латиница, цифры, «_». */
  command: string;
  title: string;
  act: string;
  url: string;
  track: LawTrack;
  points: string[];
};

export const LAW_GROUPS: { id: LawGroupId; title: string; emoji: string }[] = [
  { id: "hunting", title: "Охота", emoji: "🦆" },
  { id: "weapons", title: "Оружие", emoji: "🔫" },
  { id: "fines", title: "Ответственность", emoji: "⚖️" },
];

export const LAW_WATCH: LawWatch[] = [
  {
    key: "209-fz",
    group: "hunting",
    command: "zakon_ohota",
    title: "Закон «Об охоте»",
    act: "Федеральный закон от 24.07.2009 № 209-ФЗ «Об охоте и о сохранении охотничьих ресурсов…»",
    url: `${CONSULTANT}/cons_doc_LAW_89923/`,
    track: { kind: "overview", url: `${CONSULTANT}/cons_doc_LAW_96106/` },
    points: [
      "Охотничий билет — единого федерального образца, бессрочный, действует по всей России; выдаётся с 16 лет (ст. 21).",
      "Билет бывает электронным (на смартфоне) или бумажным — сила одинаковая.",
      "Впервые получающие билет сдают проверку знаний охотминимума в региональном органе (ст. 21.1).",
      "Охота — только по разрешению на добычу; в закреплённых угодьях (как хозяйства МООиР) — ещё и по путёвке.",
    ],
  },
  {
    key: "pravila-477",
    group: "hunting",
    command: "pravila",
    title: "Правила охоты",
    act: "Приказ Минприроды России от 24.07.2020 № 477 (действуют до 01.03.2032)",
    url: `${CONSULTANT}/cons_doc_LAW_361066/`,
    track: { kind: "title" },
    points: [
      "При себе: охотничий билет, разрешение на хранение и ношение оружия (если охота с оружием), разрешение на добычу, в закреплённых угодьях — путёвка (п. 5.2).",
      "По требованию инспектора — разрядить оружие и предъявить документы (п. 5.3–5.4).",
      "Добыл — до разделки и перевозки заполни сведения о добыче в разрешении (п. 5.7).",
      "Нельзя быть в машине или лодке с включённым мотором с расчехлённым или заряженным оружием (п. 62.15).",
      "Пернатая дичь — гладкоствол, дробь не крупнее 5 мм, без пуль (п. 62.21).",
      "По копытным дробь запрещена; картечь — от 5 мм по косуле и от 7,5 мм по кабану (п. 62.5).",
      "Свет, тепловизоры, ПНВ — только по копытным, медведю, волку, лисице, енотовидной собаке, барсуку, бобру (п. 62.9); электронные манки запрещены (п. 62.11).",
      "Кабан загоном, нагоном и с собаками — нельзя с 1 января по конец февраля и при карантине по АЧС (п. 62.16–62.17).",
      "Вне сроков охоты нельзя быть в угодьях с собакой не на привязи, кроме зон нагонки и натаски (п. 59).",
    ],
  },
  {
    key: "150-fz",
    group: "weapons",
    command: "zakon_oruzhie",
    title: "Закон «Об оружии»",
    act: "Федеральный закон от 13.12.1996 № 150-ФЗ «Об оружии»",
    url: `${CONSULTANT}/cons_doc_LAW_12679/`,
    track: { kind: "overview", url: `${CONSULTANT}/cons_doc_LAW_76309/` },
    points: [
      "Разрешение на хранение и ношение охотничьего длинноствольного оружия выдаётся на 5 лет (ст. 13).",
      "Купленное оружие регистрируют в Росгвардии в течение 2 недель.",
      "Медосвидетельствование владельца — не реже раза в 5 лет; медзаключение для лицензии на покупку действует 1 год.",
    ],
  },
  {
    key: "pp-814",
    group: "weapons",
    command: "hranenie",
    title: "Правила оборота оружия",
    act: "Постановление Правительства РФ от 21.07.1998 № 814",
    url: `${CONSULTANT}/cons_doc_LAW_19504/`,
    track: { kind: "title" },
    points: [
      "Дома — в запирающемся сейфе или металлическом шкафу; другие вещи вместе с оружием хранить нельзя.",
      "Перевозка — в чехле или кобуре, в разряженном состоянии, отдельно от патронов.",
    ],
  },
  {
    key: "koap-8.37",
    group: "fines",
    command: "shtrafy",
    title: "КоАП, ст. 8.37 — нарушение правил охоты",
    act: "Кодекс РФ об административных правонарушениях, статья 8.37",
    url: `${CONSULTANT}/cons_doc_LAW_34661/4b14d721c3cbb09fa0afe38ce8280c1a9b3be4a7/`,
    track: { kind: "article" },
    points: [
      "Нарушение правил охоты — штраф 500–4 000 ₽ (с конфискацией орудий охоты или без) или лишение права охоты до 2 лет (ч. 1).",
      "Повторно в течение года — 4 000–5 000 ₽ или лишение права на 1–3 года (ч. 1.1).",
      "Вне сроков, запрещёнными орудиями или способами — лишение права охоты на 1–2 года (ч. 1.2).",
      "Не предъявил билет, разрешение, путёвку или разрешение на оружие — лишение права охоты на 1–2 года (ч. 1.3).",
    ],
  },
  {
    key: "koap-20.8",
    group: "fines",
    command: "shtrafy",
    title: "КоАП, ст. 20.8 — нарушение правил оборота оружия",
    act: "Кодекс РФ об административных правонарушениях, статья 20.8",
    url: `${CONSULTANT}/cons_doc_LAW_34661/a0395ba9181f3e837c5ec60f879a3fe7ffe08b80/`,
    track: { kind: "article" },
    points: [
      "Нарушение правил хранения или ношения — 500–2 000 ₽ или лишение права на оружие на 6–12 месяцев (ч. 4).",
      "Ношение оружия в состоянии опьянения — 2 000–5 000 ₽ или лишение права на 1–2 года (ч. 4.1).",
      "Отказ от медосвидетельствования на опьянение — лишение права на 1–2 года (ч. 4.2).",
    ],
  },
  {
    key: "uk-258",
    group: "fines",
    command: "shtrafy",
    title: "УК, ст. 258 — незаконная охота",
    act: "Уголовный кодекс РФ, статья 258",
    url: `${CONSULTANT}/cons_doc_LAW_10699/5a2796b5ebd3a057ab32b2d16736acb4d28f0694/`,
    track: { kind: "article" },
    points: [
      "Крупный ущерб (от 40 000 ₽), охота с транспорта, на запрещённые виды или на ООПТ — штраф до 500 000 ₽ или до 2 лет лишения свободы.",
      "Группой, по служебному положению или с особо крупным ущербом (от 120 000 ₽) — до 5 лет.",
    ],
  },
];

/** Региональные акты: сроки и нормы для Шатуры бот берёт из распоряжений МООиР, сами акты не отслеживаем. */
export const REGIONAL_NOTES: string[] = [
  "Виды и параметры охоты в Московской области — постановление Губернатора МО (распоряжения МООиР ссылаются на № 94-ПГ от 27.04.2023 и № 95-ПГ от 27.03.2025) — действующую редакцию уточнить.",
  "Нормы добычи — распоряжение Минэкологии МО № 35-РМ от 16.01.2023 — уточнить.",
  "Конкретные сроки по Шатурскому хозяйству — в распоряжениях МООиР (вкладка «Охота · Шатура», команда /sezon).",
];

export type LawEdition = {
  /** ДД.ММ.ГГГГ */
  date: string;
  /** Дата вступления в силу, если редакция «с изм. и доп., вступ. в силу с …». */
  inForce: string | null;
  url: string;
  /** «Федеральным законом от 29.12.2025 N 577-ФЗ» */
  basis: string;
  changes: string[];
};

export type LawAmendment = { date: string; law: string };

export type LawState = {
  key: string;
  edition: string;
  editions: LawEdition[];
  amendments: LawAmendment[];
  changedAt: string | null;
  fetchedAt: string | null;
};

/** ДД.ММ.ГГГГ → ГГГГ-ММ-ДД для сравнения. */
export function ruDateKey(value: string): string {
  const [day, month, year] = value.split(".");
  return `${year}-${month}-${day}`;
}

function contentText(html: string): string {
  const from = html.indexOf("document-page__content");
  const to = html.indexOf("document-page__separator", from);
  return htmlToText(from >= 0 ? html.slice(from, to > from ? to : undefined) : html);
}

/** Список редакций со страницы «Обзор изменений…», от новой к старой. */
export function parseEditionList(html: string, origin = "https://www.consultant.ru"): LawEdition[] {
  const result: LawEdition[] = [];
  const re =
    /<a href="(\/document\/cons_doc_LAW_\d+\/[0-9a-f]+\/)">\s*Редакция от (\d{2}\.\d{2}\.\d{4})(?:\s*\(с изм\. и доп\., вступ\. в силу с (\d{2}\.\d{2}\.\d{4})\))?\s*<\/a>/g;
  for (const match of html.matchAll(re)) {
    result.push({ date: match[2], inForce: match[3] ?? null, url: `${origin}${match[1]}`, basis: "", changes: [] });
  }
  return result;
}

const CHANGES_KEPT = 30;

/** Страница одной редакции: каким законом внесена и какие статьи затронуты. */
export function parseEditionDetail(html: string): { basis: string; changes: string[] } {
  const text = contentText(html).replace(/\s+/g, " ");
  const basis = (/внесенных\s+(.+?(?:N|№)\s*[\d-]+-ФЗ(?:\s*,\s*от\s+\S+\s+(?:N|№)\s*[\d-]+-ФЗ)*)/.exec(text)?.[1] ?? "")
    .replace(/\s+,/g, ",");
  const changes = text
    .split(/\*\s\*\s\*/)[0]
    .split(/─{5,}/)
    .slice(1)
    .map((block) =>
      block
        .split(/\s(?:старая редакция|новая редакция|См\. текст)/)[0]
        .replace(/\.\s*$/, "")
        .trim(),
    )
    .filter((line) => line.length > 3 && line.length < 200 && !line.includes("<"));
  return { basis, changes: [...new Set(changes)].slice(0, CHANGES_KEPT) };
}

/** «(ред. от 25.12.2025)» из заголовка документа. */
export function parseTitleEdition(html: string): string {
  const title = /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "";
  return /ред\.\s*от\s*(\d{2}\.\d{2}\.\d{4})/.exec(title)?.[1] ?? "";
}

/** Текст статьи без шапки кодекса и все поправки «в ред. Федерального закона от …». */
export function parseArticle(html: string): { text: string; amendments: LawAmendment[] } {
  const raw = contentText(html);
  const start = raw.search(/Статья\s+\d/);
  const text = (start >= 0 ? raw.slice(start) : raw).replace(/\s+/g, " ").trim();
  const seen = new Set<string>();
  const amendments: LawAmendment[] = [];
  for (const match of text.matchAll(
    /Федеральн\S*\s+закон\S*\s+от\s+(\d{2}\.\d{2}\.\d{4})\s+(?:N|№)\s*([\d-]+-ФЗ)/g,
  )) {
    const key = `${match[1]}|${match[2]}`;
    if (!seen.has(key)) {
      seen.add(key);
      amendments.push({ date: match[1], law: `№ ${match[2]}` });
    }
  }
  amendments.sort((a, b) => ruDateKey(b.date).localeCompare(ruDateKey(a.date)));
  return { text, amendments };
}
