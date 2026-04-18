export const HISTORY_CACHE_MAX_DAYS = 30;
export const HISTORY_CACHE_MAX_ITEMS = 400;

type HistoryAlertLevel = "normal" | "critical" | "evacuation" | "spilling";

type HistoryRecordLike = {
  id: string;
  recordedAt: string;
  readingDate: string | null;
  readingTime: string | null;
  waterLevel: number;
  alertLevel: HistoryAlertLevel;
  statusLabel: string;
  rangeLabel: string;
  description: string;
};

type DashboardLoadSource = "live" | "cache" | "none";

type CacheAwareLoadResultLike = {
  source: DashboardLoadSource;
  cachedAt: number | null;
};

const HISTORY_LEVELS: Record<
  HistoryAlertLevel,
  {
    statusLabel: string;
    rangeLabel: string;
    description: string;
  }
> = {
  normal: {
    statusLabel: "Normal",
    rangeLabel: "1.5 - 2.49m",
    description: "Water level is normal. Conditions are stable and no immediate threat is expected.",
  },
  critical: {
    statusLabel: "Critical",
    rangeLabel: "2.5 - 2.9m",
    description: "Water level is high. Stay alert, prepare essentials, and monitor updates.",
  },
  evacuation: {
    statusLabel: "Evacuation",
    rangeLabel: "3.0 - 3.9m",
    description: "Water level is dangerous. Move immediately to higher and safer ground.",
  },
  spilling: {
    statusLabel: "Spilling",
    rangeLabel: "4.0m onwards",
    description: "Water is overflowing and conditions are extremely dangerous. Prioritize safety.",
  },
};

export function inferHistoryAlertLevel(statusText: string | null, waterLevel: number | null): HistoryAlertLevel {
  const status = (statusText ?? "").toLowerCase();

  if (status.includes("spill")) return "spilling";
  if (status.includes("evac")) return "evacuation";
  if (status.includes("critical") || status.includes("alert level 2") || status.includes("alert 2")) {
    return "critical";
  }

  if (waterLevel !== null) {
    if (waterLevel >= 4) return "spilling";
    if (waterLevel >= 3) return "evacuation";
    if (waterLevel >= 2.5) return "critical";
  }

  return "normal";
}

export function formatHistoryTimeOnly(record: HistoryRecordLike): string {
  const source =
    record.readingDate && record.readingTime
      ? new Date(`${record.readingDate}T${record.readingTime}`)
      : new Date(record.recordedAt);

  if (Number.isNaN(source.getTime())) {
    return "--:--";
  }

  return source
    .toLocaleTimeString("en-PH", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(" AM", "AM")
    .replace(" PM", "PM");
}

export function getHistoryDateKey(record: Pick<HistoryRecordLike, "recordedAt" | "readingDate">): string {
  if (record.readingDate) {
    return record.readingDate;
  }

  return new Date(record.recordedAt).toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  });
}

export function formatHistoryGroupDateLabel(dateKey: string): string {
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateKey;
  }

  return parsed.toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export function mapHistoryRowToRecord(row: Record<string, unknown>): HistoryRecordLike | null {
  const recordedAt = String(row.created_at ?? "").trim();
  if (!recordedAt) {
    return null;
  }

  const waterLevel = Number(row.water_level ?? Number.NaN);
  if (Number.isNaN(waterLevel)) {
    return null;
  }

  const alertLevel = inferHistoryAlertLevel((row.status as string | null) ?? null, waterLevel);
  const config = HISTORY_LEVELS[alertLevel];

  return {
    id: String(row.id ?? recordedAt),
    recordedAt,
    readingDate: (row.reading_date as string | null) ?? null,
    readingTime: (row.reading_time as string | null) ?? null,
    waterLevel,
    alertLevel,
    statusLabel: config.statusLabel,
    rangeLabel: config.rangeLabel,
    description: config.description,
  };
}

export function getHistorySourceTimestamp(record: Pick<HistoryRecordLike, "recordedAt" | "readingDate" | "readingTime">): number {
  const candidate =
    record.readingDate && record.readingTime
      ? new Date(`${record.readingDate}T${record.readingTime}`)
      : new Date(record.recordedAt);

  const time = candidate.getTime();
  if (Number.isNaN(time)) {
    return 0;
  }

  return time;
}

export function trimHistoryForCache<T extends Pick<HistoryRecordLike, "recordedAt" | "readingDate" | "readingTime">>(
  records: T[],
): T[] {
  const cutoff = Date.now() - HISTORY_CACHE_MAX_DAYS * 24 * 60 * 60 * 1000;
  return records
    .filter((record) => getHistorySourceTimestamp(record) >= cutoff)
    .slice(0, HISTORY_CACHE_MAX_ITEMS);
}

export function formatCachedTimestamp(updatedAt: number | null): string {
  if (!updatedAt) {
    return "";
  }

  return new Date(updatedAt).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function getSectionSyncLabel(result: CacheAwareLoadResultLike, online: boolean): string | null {
  if (result.source === "live") {
    return null;
  }

  if (result.source === "cache") {
    return result.cachedAt ? `Cached copy • ${formatCachedTimestamp(result.cachedAt)}` : "Cached copy";
  }

  return online ? "Waiting for live sync" : "Offline • no cached copy";
}

export function getSectionSyncVariant(
  result: CacheAwareLoadResultLike,
  online: boolean,
): "live" | "cache" | "offline" | "neutral" {
  if (result.source === "cache") {
    return "cache";
  }

  if (result.source === "none" && !online) {
    return "offline";
  }

  return "neutral";
}

export function resolveLoadBanner(
  result: CacheAwareLoadResultLike[],
): { showCached: boolean; message: string } {
  const hasLive = result.some((entry) => entry.source === "live");
  if (hasLive) {
    return {
      showCached: false,
      message: "",
    };
  }

  const newestCachedAt = result.reduce<number | null>((current, entry) => {
    if (entry.source !== "cache" || !entry.cachedAt) {
      return current;
    }

    if (!current || entry.cachedAt > current) {
      return entry.cachedAt;
    }

    return current;
  }, null);

  if (!newestCachedAt) {
    return {
      showCached: false,
      message: "",
    };
  }

  return {
    showCached: true,
    message: `Offline mode: showing cached data (last synced ${formatCachedTimestamp(newestCachedAt)}).`,
  };
}
