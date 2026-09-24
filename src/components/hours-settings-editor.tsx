"use client";

import { useMemo, useState } from "react";
import { Button, Card, Input } from "@/components/ui";
import {
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  formatClock,
  type HoursMode,
  type PickupDayHours,
  type PickupHoursWeek,
  type PickupWeekday,
} from "@/lib/pickup-hours";
import type { StoreSettingsView } from "@/lib/store-settings";

type DayForm = {
  closed: boolean;
  open: string;
  close: string;
};

type WeekForm = Record<PickupWeekday, DayForm>;

function dayToForm(day: PickupDayHours): DayForm {
  if (day.closed) {
    return { closed: true, open: "10:00", close: "20:00" };
  }
  return {
    closed: false,
    open: formatClock(day.openMinute),
    close: formatClock(day.closeMinute),
  };
}

function weekToForm(week: PickupHoursWeek): WeekForm {
  return {
    0: dayToForm(week[0]),
    1: dayToForm(week[1]),
    2: dayToForm(week[2]),
    3: dayToForm(week[3]),
    4: dayToForm(week[4]),
    5: dayToForm(week[5]),
    6: dayToForm(week[6]),
  };
}

function WeekEditor({
  title,
  value,
  onChange,
}: {
  title: string;
  value: WeekForm;
  onChange: (next: WeekForm) => void;
}) {
  return (
    <Card title={title}>
      <div className="space-y-3">
        {WEEKDAY_ORDER.map((day) => {
          const row = value[day];
          return (
            <div
              key={day}
              className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 sm:grid-cols-[8rem_auto_1fr_1fr]"
            >
              <p className="text-sm font-medium">{WEEKDAY_LABELS[day]}</p>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={row.closed}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      [day]: { ...row, closed: event.target.checked },
                    })
                  }
                />
                Выходной
              </label>
              <Input
                label="Открытие"
                value={row.open}
                disabled={row.closed}
                onChange={(event) =>
                  onChange({
                    ...value,
                    [day]: { ...row, open: event.target.value },
                  })
                }
                placeholder="10:00"
              />
              <Input
                label="Закрытие"
                value={row.close}
                disabled={row.closed}
                onChange={(event) =>
                  onChange({
                    ...value,
                    [day]: { ...row, close: event.target.value },
                  })
                }
                placeholder="20:00"
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function HoursSettingsEditor({ initial }: { initial: StoreSettingsView }) {
  const [hoursMode, setHoursMode] = useState<HoursMode>(initial.hoursMode);
  const [winterStartMonth, setWinterStartMonth] = useState(
    String(initial.winterStartMonth),
  );
  const [winterStartDay, setWinterStartDay] = useState(
    String(initial.winterStartDay),
  );
  const [winterEndMonth, setWinterEndMonth] = useState(
    String(initial.winterEndMonth),
  );
  const [winterEndDay, setWinterEndDay] = useState(String(initial.winterEndDay));
  const [summerHours, setSummerHours] = useState(weekToForm(initial.summerHours));
  const [winterHours, setWinterHours] = useState(weekToForm(initial.winterHours));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const modeOptions = useMemo(
    () =>
      [
        { id: "auto" as const, label: "Авто (по датам зимы)" },
        { id: "summer" as const, label: "Всегда лето" },
        { id: "winter" as const, label: "Всегда зима" },
      ] as const,
    [],
  );

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setOk("");

    const response = await fetch("/api/settings/hours", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hoursMode,
        winterStartMonth: Number(winterStartMonth),
        winterStartDay: Number(winterStartDay),
        winterEndMonth: Number(winterEndMonth),
        winterEndDay: Number(winterEndDay),
        summerHours,
        winterHours,
      }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setError(data.error ?? "Ошибка сохранения");
      setBusy(false);
      return;
    }

    setOk("Сохранено — на витрине уже новый график");
    setBusy(false);
  }

  return (
    <form onSubmit={(event) => void handleSave(event)} className="space-y-4">
      <Card title="Режим графика">
        <div className="flex flex-wrap gap-2">
          {modeOptions.map((item) => {
            const active = hoursMode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setHoursMode(item.id)}
                className={`min-h-11 rounded-xl px-3 text-sm font-medium transition ${
                  active
                    ? "bg-[var(--brand)] text-white"
                    : "border border-[var(--border)] bg-white hover:bg-[var(--bg)]"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Зима по умолчанию: закрытие на час раньше. Период можно поменять ниже.
        </p>
      </Card>

      <Card title="Период зимы (даты)">
        <div className="grid gap-3 sm:grid-cols-4">
          <Input
            label="Начало, месяц"
            type="number"
            min={1}
            max={12}
            value={winterStartMonth}
            onChange={(event) => setWinterStartMonth(event.target.value)}
          />
          <Input
            label="Начало, день"
            type="number"
            min={1}
            max={31}
            value={winterStartDay}
            onChange={(event) => setWinterStartDay(event.target.value)}
          />
          <Input
            label="Конец, месяц"
            type="number"
            min={1}
            max={12}
            value={winterEndMonth}
            onChange={(event) => setWinterEndMonth(event.target.value)}
          />
          <Input
            label="Конец, день"
            type="number"
            min={1}
            max={31}
            value={winterEndDay}
            onChange={(event) => setWinterEndDay(event.target.value)}
          />
        </div>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Сейчас: с {winterStartDay}.{winterStartMonth} по {winterEndDay}.
          {winterEndMonth} (через Новый год — нормально).
        </p>
      </Card>

      <WeekEditor
        title="Летний график"
        value={summerHours}
        onChange={setSummerHours}
      />
      <WeekEditor
        title="Зимний график (обычно −1 час к закрытию)"
        value={winterHours}
        onChange={setWinterHours}
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {ok ? <p className="text-sm text-green-700">{ok}</p> : null}

      <Button type="submit" className="min-h-11" disabled={busy}>
        {busy ? "Сохранение..." : "Сохранить график"}
      </Button>
    </form>
  );
}
