import { prisma } from "@/lib/db";
import {
  DEFAULT_STORE_HOURS_CONFIG,
  DEFAULT_SUMMER_HOURS,
  DEFAULT_WINTER_HOURS,
  isHoursMode,
  parseHoursWeekJson,
  serializeHoursWeek,
  type HoursMode,
  type PickupHoursWeek,
  type StoreHoursConfig,
} from "@/lib/pickup-hours";

export type StoreSettingsView = StoreHoursConfig & {
  updatedAt: string | null;
};

function mapRow(row: {
  hoursMode: string;
  winterStartMonth: number;
  winterStartDay: number;
  winterEndMonth: number;
  winterEndDay: number;
  summerHoursJson: string;
  winterHoursJson: string;
  updatedAt: Date;
}): StoreSettingsView {
  return {
    hoursMode: isHoursMode(row.hoursMode) ? row.hoursMode : "auto",
    winterStartMonth: row.winterStartMonth,
    winterStartDay: row.winterStartDay,
    winterEndMonth: row.winterEndMonth,
    winterEndDay: row.winterEndDay,
    summerHours: parseHoursWeekJson(row.summerHoursJson, DEFAULT_SUMMER_HOURS),
    winterHours: parseHoursWeekJson(row.winterHoursJson, DEFAULT_WINTER_HOURS),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function ensureStoreSettings(): Promise<StoreSettingsView> {
  const existing = await prisma.storeSettings.findUnique({
    where: { id: "default" },
  });
  if (existing) {
    return mapRow(existing);
  }

  const created = await prisma.storeSettings.create({
    data: {
      id: "default",
      hoursMode: DEFAULT_STORE_HOURS_CONFIG.hoursMode,
      winterStartMonth: DEFAULT_STORE_HOURS_CONFIG.winterStartMonth,
      winterStartDay: DEFAULT_STORE_HOURS_CONFIG.winterStartDay,
      winterEndMonth: DEFAULT_STORE_HOURS_CONFIG.winterEndMonth,
      winterEndDay: DEFAULT_STORE_HOURS_CONFIG.winterEndDay,
      summerHoursJson: serializeHoursWeek(DEFAULT_SUMMER_HOURS),
      winterHoursJson: serializeHoursWeek(DEFAULT_WINTER_HOURS),
    },
  });
  return mapRow(created);
}

export async function getStoreHoursConfig(): Promise<StoreHoursConfig> {
  const settings = await ensureStoreSettings();
  return {
    hoursMode: settings.hoursMode,
    winterStartMonth: settings.winterStartMonth,
    winterStartDay: settings.winterStartDay,
    winterEndMonth: settings.winterEndMonth,
    winterEndDay: settings.winterEndDay,
    summerHours: settings.summerHours,
    winterHours: settings.winterHours,
  };
}

export type UpdateStoreHoursInput = {
  hoursMode: HoursMode;
  winterStartMonth: number;
  winterStartDay: number;
  winterEndMonth: number;
  winterEndDay: number;
  summerHours: PickupHoursWeek;
  winterHours: PickupHoursWeek;
};

export async function updateStoreHours(
  input: UpdateStoreHoursInput,
): Promise<StoreSettingsView> {
  await ensureStoreSettings();
  const updated = await prisma.storeSettings.update({
    where: { id: "default" },
    data: {
      hoursMode: input.hoursMode,
      winterStartMonth: input.winterStartMonth,
      winterStartDay: input.winterStartDay,
      winterEndMonth: input.winterEndMonth,
      winterEndDay: input.winterEndDay,
      summerHoursJson: serializeHoursWeek(input.summerHours),
      winterHoursJson: serializeHoursWeek(input.winterHours),
    },
  });
  return mapRow(updated);
}
