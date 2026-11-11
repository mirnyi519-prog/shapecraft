import { Card } from "@/components/ui";

type Tone = "ok" | "warn" | "no" | "closed";

type Tag = { label: string; tone: Tone };

type FilamentRow = {
  name: string;
  note: string;
  nozzle: [number, number];
  bed: [number, number];
  plate: string;
  door: Tag;
  ams: Tag[];
  dryRequired: boolean;
  dry: string;
};

const NOZZLE_SCALE: [number, number] = [180, 300];
const BED_SCALE: [number, number] = [20, 100];

const OPEN_45: Tag = { label: "Стол > 45° — открыть", tone: "warn" };
const OPEN_70: Tag = { label: "Стол > 70° — открыть", tone: "warn" };
const CLOSED: Tag = { label: "Закрыто", tone: "closed" };
const AMS_YES: Tag = { label: "Да", tone: "ok" };
const AMS_SPLIT: Tag[] = [
  { label: "AMS — да", tone: "ok" },
  { label: "AMS lite — нет", tone: "no" },
];

/** Bambu Lab Wiki, Filament Guide — только то, что идёт на стоковом P1S. */
const ROWS: FilamentRow[] = [
  {
    name: "PLA",
    note: "Basic, Matte, Silk, Metal, Tough",
    nozzle: [190, 240],
    bed: [35, 65],
    plate: "Cool / PEI",
    door: OPEN_45,
    ams: [AMS_YES],
    dryRequired: false,
    dry: "55 °C · 8 ч",
  },
  {
    name: "PLA Wood",
    note: "с древесным наполнителем",
    nozzle: [190, 240],
    bed: [35, 65],
    plate: "Cool / PEI",
    door: OPEN_45,
    ams: AMS_SPLIT,
    dryRequired: false,
    dry: "55 °C · 8 ч",
  },
  {
    name: "PVA / BVOH",
    note: "растворимая поддержка",
    nozzle: [190, 240],
    bed: [35, 65],
    plate: "Cool / PEI",
    door: OPEN_45,
    ams: [{ label: "Только сухой", tone: "warn" }],
    dryRequired: true,
    dry: "55 °C · 8 ч",
  },
  {
    name: "TPU 95A HF",
    note: "гибкий",
    nozzle: [200, 250],
    bed: [30, 45],
    plate: "PEI / Eng.",
    door: OPEN_45,
    ams: [{ label: "Нет · внешняя катушка", tone: "no" }],
    dryRequired: true,
    dry: "70 °C · 8 ч",
  },
  {
    name: "PETG HF",
    note: "быстрая печать, прочный",
    nozzle: [230, 260],
    bed: [60, 80],
    plate: "PEI · не Cool",
    door: OPEN_70,
    ams: [AMS_YES],
    dryRequired: true,
    dry: "65 °C · 8 ч",
  },
  {
    name: "PETG",
    note: "обычный",
    nozzle: [240, 270],
    bed: [60, 80],
    plate: "PEI · не Cool",
    door: OPEN_70,
    ams: [AMS_YES],
    dryRequired: false,
    dry: "70 °C · 8 ч",
  },
  {
    name: "ABS",
    note: "термостойкий",
    nozzle: [240, 280],
    bed: [90, 100],
    plate: "PEI / Eng.",
    door: CLOSED,
    ams: AMS_SPLIT,
    dryRequired: false,
    dry: "80 °C · 8 ч",
  },
  {
    name: "ASA",
    note: "для улицы, стойкий к УФ",
    nozzle: [240, 280],
    bed: [90, 100],
    plate: "PEI / Eng.",
    door: CLOSED,
    ams: [AMS_YES],
    dryRequired: false,
    dry: "80 °C · 8 ч",
  },
];

const TAG_STYLES: Record<Tone, string> = {
  ok: "bg-green-50 text-green-800",
  warn: "bg-[var(--brand-soft)] text-[var(--brand-dark)]",
  no: "bg-red-50 text-red-700",
  closed: "bg-slate-100 text-[var(--text)]",
};

function TagPill({ tag }: { tag: Tag }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${TAG_STYLES[tag.tone]}`}
    >
      {tag.label}
    </span>
  );
}

function RangeBar({
  range,
  scale,
  kind,
}: {
  range: [number, number];
  scale: [number, number];
  kind: "nozzle" | "bed";
}) {
  const span = scale[1] - scale[0];
  const left = ((range[0] - scale[0]) / span) * 100;
  const width = ((range[1] - range[0]) / span) * 100;
  const fill =
    kind === "nozzle"
      ? "bg-gradient-to-r from-[#f6a04d] to-[var(--brand)]"
      : "bg-gradient-to-r from-[#8cc3d8] to-[#3b82a0]";
  return (
    <div className="relative h-2 rounded-full bg-slate-100">
      <div
        className={`absolute inset-y-0 rounded-full ${fill}`}
        style={{ left: `${left}%`, width: `${width}%` }}
      />
    </div>
  );
}

function Temp({
  range,
  scale,
  kind,
  hint,
}: {
  range: [number, number];
  scale: [number, number];
  kind: "nozzle" | "bed";
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-bold tabular-nums">
          {range[0]}–{range[1]} °C
        </span>
        {hint ? <span className="text-xs text-[var(--muted)]">{hint}</span> : null}
      </div>
      <RangeBar range={range} scale={scale} kind={kind} />
    </div>
  );
}

function Dry({ row }: { row: FilamentRow }) {
  return (
    <span className="text-sm leading-tight">
      <span
        className={
          row.dryRequired ? "block font-semibold text-red-700" : "block text-[var(--muted)]"
        }
      >
        {row.dryRequired ? "Обязательно" : "Желательно"}
      </span>
      <span className="text-[var(--muted)]">{row.dry}</span>
    </span>
  );
}

const LIMITS = [
  ["Сопло до", "300 °C"],
  ["Стол до", "100 °C"],
  ["Сопло", "нерж. 0.4 мм"],
  ["Камера", "без подогрева"],
] as const;

export function FilamentGuideP1S() {
  return (
    <Card>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--brand)]">
            Шпаргалка
          </p>
          <h2 className="mt-1 text-xl font-bold">Филамент для Bambu Lab P1S</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            От меньшей температуры сопла к большей. Только то, что идёт на стоковом принтере.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {LIMITS.map(([label, value]) => (
            <span
              key={label}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs text-[var(--muted)]"
            >
              {label} <b className="text-[var(--text)]">{value}</b>
            </span>
          ))}
        </div>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wider text-[var(--muted)]">
            <tr>
              <th className="py-3 pr-3 font-semibold">#</th>
              <th className="py-3 pr-4 font-semibold">Филамент</th>
              <th className="w-56 py-3 pr-6 font-semibold">Сопло · 180–300 °C</th>
              <th className="w-56 py-3 pr-6 font-semibold">Стол · 20–100 °C</th>
              <th className="py-3 pr-4 font-semibold">Дверца / крышка</th>
              <th className="py-3 pr-4 font-semibold">AMS</th>
              <th className="py-3 font-semibold">Сушка</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, index) => (
              <tr key={row.name} className="border-b border-[var(--border)] last:border-b-0">
                <td className="py-4 pr-3 font-bold text-[var(--muted)] tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </td>
                <td className="py-4 pr-4">
                  <span className="block text-base font-bold">{row.name}</span>
                  <span className="text-xs text-[var(--muted)]">{row.note}</span>
                </td>
                <td className="py-4 pr-6">
                  <Temp range={row.nozzle} scale={NOZZLE_SCALE} kind="nozzle" />
                </td>
                <td className="py-4 pr-6">
                  <Temp range={row.bed} scale={BED_SCALE} kind="bed" hint={row.plate} />
                </td>
                <td className="py-4 pr-4">
                  <TagPill tag={row.door} />
                </td>
                <td className="py-4 pr-4">
                  <div className="flex flex-col items-start gap-1">
                    {row.ams.map((tag) => (
                      <TagPill key={tag.label} tag={tag} />
                    ))}
                  </div>
                </td>
                <td className="py-4">
                  <Dry row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 lg:hidden">
        {ROWS.map((row, index) => (
          <li key={row.name} className="rounded-xl border border-[var(--border)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-[var(--muted)] tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="block text-base font-bold">{row.name}</span>
                <span className="text-xs text-[var(--muted)]">{row.note}</span>
              </div>
              <Dry row={row} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <p className="mb-1 text-xs text-[var(--muted)]">Сопло</p>
                <Temp range={row.nozzle} scale={NOZZLE_SCALE} kind="nozzle" />
              </div>
              <div>
                <p className="mb-1 text-xs text-[var(--muted)]">Стол · {row.plate}</p>
                <Temp range={row.bed} scale={BED_SCALE} kind="bed" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <TagPill tag={row.door} />
              {row.ams.map((tag) => (
                <TagPill key={tag.label} tag={tag} />
              ))}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 text-sm">
          <p className="mb-2 font-bold uppercase tracking-wide">Не для стокового P1S</p>
          <ul className="list-disc space-y-1 pl-5 text-[var(--muted)]">
            <li>
              <b className="text-[var(--text)]">PC, PA (нейлон)</b> — нужен стол 100–120 °C, а у
              P1S максимум 100 °C.
            </li>
            <li>
              <b className="text-[var(--text)]">CF, GF, Marble, Sparkle, Glow</b> — изнашивают
              сопло; сначала закалённый хотэнд и шестерёнки.
            </li>
          </ul>
        </div>
        <div className="rounded-xl bg-[var(--text)] p-4 text-sm text-slate-200">
          <p className="mb-2 font-bold uppercase tracking-wide text-[var(--brand)]">
            Для сувениров
          </p>
          <p>
            PLA — детали, цвет, шёлк и металлик. PETG HF — когда нужна прочность. ABS и ASA — для
            улицы и машины.
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs text-[var(--muted)]">
        Источник:{" "}
        <a
          href="https://wiki.bambulab.com/en/general/filament-guide-material-table"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--brand)] hover:underline"
        >
          Bambu Lab Wiki — Filament Guide
        </a>
        . У сторонних брендов температура может отличаться на ±10 °C — сверяйтесь с этикеткой
        катушки.
      </p>
    </Card>
  );
}
