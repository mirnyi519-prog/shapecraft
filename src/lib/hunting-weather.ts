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

const RULES_NOTE = [
  "<i>Тёмное время (п. 13 Правил охоты) — час до заката и час после восхода: на копытных, медведя, волка, шакала, лису — сигнальная одежда.",
  "Свет и тепловизоры — только по копытным, медведю, волку, шакалу, лисице, енотовидной собаке, барсуку, бобру (п. 62.9).</i>",
];

export function buildWeatherHtml(days: WeatherDay[], title = "Погода для охоты — Шатура"): string {
  const lines = [`🌤 <b>${escapeHtml(title)}</b>`];
  for (const day of days) {
    lines.push("", ...weatherDayLines(day));
  }
  lines.push("", ...RULES_NOTE, "", "Прогноз: Open-Meteo");
  return lines.join("\n");
}
