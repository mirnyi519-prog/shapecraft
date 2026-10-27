import { escapeHtml, shortDate } from "@/lib/hunting-format";

/** Шатура. */
const LAT = 55.578;
const LON = 39.544;
const HPA_TO_MMHG = 0.750062;
/** Правила охоты, п. 13: «тёмное время суток» — за час до заката и до часа после восхода. */
const DARK_MARGIN_MIN = 60;

export type WeatherDay = {
  date: string;
  code: number;
  tMin: number;
  tMax: number;
  precip: number;
  precipChance: number | null;
  wind: number;
  gusts: number;
  windDir: number;
  sunrise: string;
  sunset: string;
  /** Среднее за день, мм рт. ст. */
  pressure: number | null;
  /** Изменение к предыдущему дню: от 3 мм рт. ст. */
  trend: "up" | "down" | "";
};

type OpenMeteo = {
  daily?: {
    time: string[];
    sunrise: string[];
    sunset: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    precipitation_probability_max: (number | null)[];
    wind_speed_10m_max: number[];
    wind_gusts_10m_max: number[];
    wind_direction_10m_dominant: number[];
    weather_code: number[];
  };
  hourly?: { time: string[]; pressure_msl: (number | null)[] };
};

export async function fetchHuntingWeather(days = 4): Promise<WeatherDay[]> {
  const params = new URLSearchParams({
    latitude: String(LAT),
    longitude: String(LON),
    daily: [
      "sunrise",
      "sunset",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
      "wind_speed_10m_max",
      "wind_gusts_10m_max",
      "wind_direction_10m_dominant",
      "weather_code",
    ].join(","),
    hourly: "pressure_msl",
    timezone: "Europe/Moscow",
    forecast_days: String(days),
    past_days: "1",
    wind_speed_unit: "ms",
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Open-Meteo HTTP ${response.status}`);
    }
    const data = (await response.json()) as OpenMeteo;
    const daily = data.daily;
    if (!daily?.time.length) {
      throw new Error("Open-Meteo: пустой прогноз");
    }
    const all: WeatherDay[] = daily.time.map((date, index) => {
      const pressures = (data.hourly?.pressure_msl ?? []).filter(
        (value, hour): value is number => value != null && data.hourly!.time[hour].startsWith(date),
      );
      return {
        date,
        code: daily.weather_code[index],
        tMin: daily.temperature_2m_min[index],
        tMax: daily.temperature_2m_max[index],
        precip: daily.precipitation_sum[index],
        precipChance: daily.precipitation_probability_max[index] ?? null,
        wind: daily.wind_speed_10m_max[index],
        gusts: daily.wind_gusts_10m_max[index],
        windDir: daily.wind_direction_10m_dominant[index],
        sunrise: daily.sunrise[index].slice(11, 16),
        sunset: daily.sunset[index].slice(11, 16),
        pressure: pressures.length
          ? Math.round((pressures.reduce((sum, value) => sum + value, 0) / pressures.length) * HPA_TO_MMHG)
          : null,
        trend: "",
      };
    });
    for (let index = 1; index < all.length; index += 1) {
      const [now, before] = [all[index].pressure, all[index - 1].pressure];
      if (now != null && before != null) {
        all[index].trend = now - before >= 3 ? "up" : before - now >= 3 ? "down" : "";
      }
    }
    return all.slice(1);
  } finally {
    clearTimeout(timer);
  }
}

const WEATHER_CODES: [number[], string][] = [
  [[0], "☀️ ясно"],
  [[1, 2], "🌤 переменная облачность"],
  [[3], "☁️ пасмурно"],
  [[45, 48], "🌫 туман"],
  [[51, 53, 55, 56, 57], "🌦 морось"],
  [[61, 63, 65, 66, 67, 80, 81, 82], "🌧 дождь"],
  [[71, 73, 75, 77, 85, 86], "❄️ снег"],
  [[95, 96, 99], "⛈ гроза"],
];

function weatherText(code: number): string {
  return WEATHER_CODES.find(([codes]) => codes.includes(code))?.[1] ?? "🌥 облачно";
}

const COMPASS = ["С", "СВ", "В", "ЮВ", "Ю", "ЮЗ", "З", "СЗ"];

/** Откуда дует ветер: 104° → «В». */
export function windFrom(degrees: number): string {
  return COMPASS[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

function shiftTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number);
  const total = (hours * 60 + mins + minutes + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const SYNODIC_DAYS = 29.530588853;
/** Новолуние 6 января 2000, 18:14 UTC. */
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

export function moonPhase(date: Date): { name: string; emoji: string; light: number } {
  const age = ((((date.getTime() - KNOWN_NEW_MOON) / 86_400_000) % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS;
  const light = Math.round(((1 - Math.cos((2 * Math.PI * age) / SYNODIC_DAYS)) / 2) * 100);
  const phases: [number, string, string][] = [
    [1.85, "новолуние", "🌑"],
    [5.54, "растущий серп", "🌒"],
    [9.23, "первая четверть", "🌓"],
    [12.92, "растущая луна", "🌔"],
    [16.61, "полнолуние", "🌕"],
    [20.3, "убывающая луна", "🌖"],
    [23.99, "последняя четверть", "🌗"],
    [27.68, "убывающий серп", "🌘"],
    [SYNODIC_DAYS, "новолуние", "🌑"],
  ];
  const [, name, emoji] = phases.find(([until]) => age < until)!;
  return { name, emoji, light };
}

function formatTemp(value: number): string {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

function dayTitle(date: string): string {
  const weekday = new Date(`${date}T12:00:00+03:00`).toLocaleDateString("ru-RU", {
    weekday: "short",
    timeZone: "Europe/Moscow",
  });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${shortDate(date)}`;
}

/** Блок одного дня (HTML). */
export function weatherDayLines(day: WeatherDay): string[] {
  const precip =
    day.precip > 0 || (day.precipChance ?? 0) >= 30
      ? ` · 💧 ${day.precip.toFixed(1).replace(".", ",")} мм${day.precipChance != null ? ` (${day.precipChance}%)` : ""}`
      : "";
  const trend = day.trend === "up" ? " ↑ растёт" : day.trend === "down" ? " ↓ падает" : "";
  const moon = moonPhase(new Date(`${day.date}T22:00:00+03:00`));
  return [
    `<b>${escapeHtml(dayTitle(day.date))}</b> ${weatherText(day.code)}`,
    `🌡 ${formatTemp(day.tMin)}…${formatTemp(day.tMax)} °C${precip}`,
    `💨 ${windFrom(day.windDir)} ${Math.round(day.wind)} м/с, порывы до ${Math.round(day.gusts)}${
      day.pressure != null ? ` · ${day.pressure} мм рт. ст.${trend}` : ""
    }`,
    `🌅 ${day.sunrise} – ${day.sunset} · тёмное время: до ${shiftTime(day.sunrise, DARK_MARGIN_MIN)} и с ${shiftTime(
      day.sunset,
      -DARK_MARGIN_MIN,
    )}`,
    `${moon.emoji} ${moon.name}, ${moon.light}%`,
  ];
}

/** Сколько дней истории берём для пожароопасности: индекс копится с последнего дождя. */
const SIGNAL_PAST_DAYS = 60;

type SignalsResponse = {
  daily?: {
    time: string[];
    precipitation_sum: (number | null)[];
    temperature_2m_min: (number | null)[];
    temperature_2m_max: (number | null)[];
    snowfall_sum: (number | null)[];
    wind_gusts_10m_max: (number | null)[];
    weather_code: (number | null)[];
  };
  hourly?: {
    time: string[];
    temperature_2m: (number | null)[];
    dew_point_2m: (number | null)[];
    soil_temperature_6cm: (number | null)[];
    snow_depth: (number | null)[];
  };
};

export type SeasonSignals = {
  today: string;
  days: { date: string; precip: number; tMin: number; tMax: number; snowfall: number; gusts: number; code: number }[];
  /** Температура и точка росы в 13:00, почва (среднее за сутки), снег на земле в 13:00 — по дням. */
  noon: Map<string, { t: number | null; dew: number | null; snow: number | null }>;
  soil: Map<string, number>;
};

/** История за 60 дней и прогноз на 2 дня — для грибов, пожароопасности и штормовых. */
export async function fetchSeasonSignals(): Promise<SeasonSignals> {
  const params = new URLSearchParams({
    latitude: String(LAT),
    longitude: String(LON),
    daily: ["precipitation_sum", "temperature_2m_min", "temperature_2m_max", "snowfall_sum", "wind_gusts_10m_max", "weather_code"].join(","),
    hourly: ["temperature_2m", "dew_point_2m", "soil_temperature_6cm", "snow_depth"].join(","),
    timezone: "Europe/Moscow",
    past_days: String(SIGNAL_PAST_DAYS),
    forecast_days: "3",
    wind_speed_unit: "ms",
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Open-Meteo HTTP ${response.status}`);
  }
  const data = (await response.json()) as SignalsResponse;
  const daily = data.daily;
  const hourly = data.hourly;
  if (!daily?.time.length || !hourly?.time.length) {
    throw new Error("Open-Meteo: пустой ответ");
  }
  const noon = new Map<string, { t: number | null; dew: number | null; snow: number | null }>();
  const soilSum = new Map<string, { sum: number; count: number }>();
  hourly.time.forEach((time, index) => {
    const date = time.slice(0, 10);
    if (time.endsWith("T13:00")) {
      noon.set(date, { t: hourly.temperature_2m[index], dew: hourly.dew_point_2m[index], snow: hourly.snow_depth[index] });
    }
    const soil = hourly.soil_temperature_6cm[index];
    if (soil != null) {
      const day = soilSum.get(date) ?? { sum: 0, count: 0 };
      soilSum.set(date, { sum: day.sum + soil, count: day.count + 1 });
    }
  });
  return {
    today: daily.time[SIGNAL_PAST_DAYS],
    days: daily.time.map((date, index) => ({
      date,
      precip: daily.precipitation_sum[index] ?? 0,
      tMin: daily.temperature_2m_min[index] ?? 0,
      tMax: daily.temperature_2m_max[index] ?? 0,
      snowfall: daily.snowfall_sum[index] ?? 0,
      gusts: daily.wind_gusts_10m_max[index] ?? 0,
      code: daily.weather_code[index] ?? 0,
    })),
    noon,
    soil: new Map([...soilSum].map(([date, day]) => [date, day.sum / day.count])),
  };
}

function round1(value: number): string {
  return value.toFixed(1).replace(".", ",").replace(",0", "");
}

/**
 * Грибы: после тёплого дождя грибы выходят через 5–14 дней при почве примерно +8…+22 °C.
 * Это ориентир по погоде, а не гарантия.
 */
export function mushroomOutlook(signals: SeasonSignals, postsThisWeek = 0): string | null {
  const month = Number(signals.today.slice(5, 7));
  if (month < 5 || month > 11) {
    return null;
  }
  const past = signals.days.filter((day) => day.date <= signals.today);
  const at = (offset: number) => past[past.length - 1 - offset];
  const rainDays = Array.from({ length: 10 }, (_, index) => at(index + 5)).filter(Boolean);
  const rain = rainDays.reduce((sum, day) => sum + day.precip, 0);
  const soilDays = Array.from({ length: 7 }, (_, index) => signals.soil.get(at(index)?.date ?? "")).filter(
    (value): value is number => value != null,
  );
  const soil = soilDays.length ? soilDays.reduce((sum, value) => sum + value, 0) / soilDays.length : null;
  const frost = Math.min(...Array.from({ length: 5 }, (_, index) => at(index)?.tMin ?? 99));
  const news = postsThisWeek > 0 ? ` В новостях за неделю про грибы — ${postsThisWeek}.` : "";
  const facts = `дождей 5–14 дней назад — ${round1(rain)} мм, почва ${soil != null ? `${soil > 0 ? "+" : ""}${round1(soil)} °C` : "—"}`;

  if (soil != null && (soil < 3 || (frost <= -4 && soil < 5))) {
    return `🍄 Грибы: сезон, скорее всего, закончился — холодно (${facts}).${news}`;
  }
  if (soil != null && rain >= 20 && soil >= 8 && soil <= 22) {
    return `🍄 Грибы: хорошие шансы (${facts}).${news}`;
  }
  if ((soil != null && rain >= 10 && soil >= 5 && soil <= 24) || postsThisWeek >= 2) {
    const late = soil != null && soil < 8 ? " — осенние: опята, маслята, рядовки" : "";
    return `🍄 Грибы: средние шансы${late} (${facts}).${news}`;
  }
  const why = rain < 10 ? "сухо" : soil != null && soil > 24 ? "жарко" : "почва холодная";
  return `🍄 Грибы: шансов мало — ${why} (${facts}).${news}`;
}

const FIRE_CLASSES = [
  { max: 300, name: "I класс — опасности нет" },
  { max: 1000, name: "II класс — малая" },
  { max: 4000, name: "III класс — средняя" },
  { max: 10000, name: "IV класс — высокая" },
  { max: Infinity, name: "V класс — чрезвычайная" },
];

export type FireDanger = { index: number; level: number; name: string; snow: boolean; offSeason: boolean };

/** Дождь от стольких мм обнуляет показатель Нестерова. */
const FIRE_RESET_RAIN_MM = 3;

/**
 * Пожароопасность по погоде — комплексный показатель Нестерова: сумма t·(t − td) в 13:00 по дням
 * с последнего дождя от 3 мм. Тот же метод, по которому лесничества объявляют классы I–V.
 * Пожароопасный сезон в Подмосковье — апрель–октябрь.
 */
export function fireDanger(signals: SeasonSignals): FireDanger {
  let index = 0;
  let snow = false;
  for (const day of signals.days.filter((item) => item.date <= signals.today)) {
    const noon = signals.noon.get(day.date);
    snow = (noon?.snow ?? 0) > 0.01;
    if (snow || day.precip >= FIRE_RESET_RAIN_MM) {
      index = 0;
      continue;
    }
    if (noon?.t != null && noon.dew != null && noon.t > 0) {
      index += noon.t * (noon.t - noon.dew);
    }
  }
  const month = Number(signals.today.slice(5, 7));
  const level = FIRE_CLASSES.findIndex((item) => index <= item.max) + 1;
  return { index: Math.round(index), level, name: FIRE_CLASSES[level - 1].name, snow, offSeason: month < 4 || month > 10 };
}

export function fireDangerLine(danger: FireDanger): string {
  if (danger.snow) {
    return "🔥 Пожароопасность: лежит снег — опасности нет.";
  }
  if (danger.offSeason && danger.level < 3) {
    return "🔥 Пожароопасность: сезон закончился.";
  }
  return `🔥 Пожароопасность: ${danger.name} (расчёт по погоде, индекс ${danger.index})`;
}

export type StormWarning = { date: string; kind: string; text: string };

/** Непогода по прогнозу на сегодня и завтра: ветер от 15 м/с, дождь от 15 мм, снег от 6 см, ледяной дождь, гроза. */
export function stormWarnings(signals: SeasonSignals): StormWarning[] {
  const warnings: StormWarning[] = [];
  for (const day of signals.days.filter((item) => item.date >= signals.today).slice(0, 2)) {
    const when = day.date === signals.today ? "Сегодня" : "Завтра";
    if (day.gusts >= 15) {
      warnings.push({ date: day.date, kind: "wind", text: `${when} сильный ветер — порывы до ${Math.round(day.gusts)} м/с` });
    }
    if (day.precip >= 15 && day.snowfall < 6) {
      warnings.push({ date: day.date, kind: "rain", text: `${when} сильный дождь — до ${Math.round(day.precip)} мм` });
    }
    if (day.snowfall >= 6) {
      warnings.push({ date: day.date, kind: "snow", text: `${when} сильный снег — до ${Math.round(day.snowfall)} см` });
    }
    if ([56, 57, 66, 67].includes(day.code)) {
      warnings.push({ date: day.date, kind: "ice", text: `${when} ледяной дождь — гололёд на дорогах и в лесу` });
    }
    if ([95, 96, 99].includes(day.code)) {
      warnings.push({
        date: day.date,
        kind: "storm",
        text: `${when} гроза${day.code === 95 ? "" : " с градом"} — в лесу держитесь подальше от одиноких деревьев`,
      });
    }
  }
  return warnings;
}

export function stormWarningsHtml(warnings: StormWarning[]): string {
  return [
    "⛈ <b>Непогода в Шатуре</b>",
    "",
    ...warnings.map((warning) => `• ${escapeHtml(warning.text)}`),
    "",
    "<i>По прогнозу Open-Meteo, это не официальное предупреждение МЧС.</i>",
  ].join("\n");
}

const RULES_NOTE = [
  "<i>Тёмное время (п. 13 Правил охоты) — час до заката и час после восхода: на копытных, медведя, волка, шакала, лису — сигнальная одежда.",
  "Свет и тепловизоры — только по копытным, медведю, волку, шакалу, лисице, енотовидной собаке, барсуку, бобру (п. 62.9).</i>",
];

/** Грибы, пожароопасность и непогода — строки для /pogoda и итогов недели. */
export function seasonLines(signals: SeasonSignals | null, mushroomPosts = 0): string[] {
  if (!signals) {
    return [];
  }
  const storms = stormWarnings(signals);
  return [
    ...storms.map((warning) => `⛈ ${escapeHtml(warning.text)}`),
    escapeHtml(fireDangerLine(fireDanger(signals))),
    ...[mushroomOutlook(signals, mushroomPosts)].filter((line): line is string => line != null).map(escapeHtml),
  ];
}

export function buildWeatherHtml(days: WeatherDay[], title = "Погода для охоты — Шатура", extra: string[] = []): string {
  const lines = [`🌤 <b>${escapeHtml(title)}</b>`];
  for (const day of days) {
    lines.push("", ...weatherDayLines(day));
  }
  if (extra.length > 0) {
    lines.push("", ...extra);
  }
  lines.push("", ...RULES_NOTE, "", "Прогноз: Open-Meteo");
  return lines.join("\n");
}
