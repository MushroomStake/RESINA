export type SensorSnapshotLike = {
  waterLevel: number | null;
  statusText: string | null;
};

export type AlertLevelKey = "normal" | "critical" | "evacuation" | "spilling";

export type WaterTrendDirection = "rising" | "falling" | "stable";

export type WaterTrendSummary = {
  direction: WaterTrendDirection;
  currentLevel: number | null;
  previousLevel: number | null;
  nextThreshold: number | null;
  ratePerMinute: number | null;
  minutesToThreshold: number | null;
  message: string;
};

function parseWaterLevel(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function buildWaterTrendSummary(rows: Array<{ water_level?: number | string | null; created_at?: string | null }>): WaterTrendSummary {
  const STALE_READING_MS = 30 * 60 * 1000;
  const MAX_PAIR_GAP_MINUTES = 120;
  const MAX_PREDICTION_MINUTES = 180;
  const STEP_SIZE = 0.5;

  const validRows = rows
    .map((row) => ({
      waterLevel: parseWaterLevel(row.water_level),
      timeMs: row.created_at ? new Date(row.created_at).getTime() : Number.NaN,
    }))
    .filter((row) => row.waterLevel !== null && Number.isFinite(row.timeMs))
    .sort((a, b) => b.timeMs - a.timeMs);

  const latest = validRows[0];
  if (latest && Date.now() - latest.timeMs > STALE_READING_MS) {
    return {
      direction: "stable",
      currentLevel: latest.waterLevel,
      previousLevel: null,
      nextThreshold: null,
      ratePerMinute: null,
      minutesToThreshold: null,
      message: "No recent sensor reading. System is safely idle.",
    };
  }

  if (validRows.length < 2) {
    return {
      direction: "stable",
      currentLevel: validRows[0]?.waterLevel ?? null,
      previousLevel: null,
      nextThreshold: null,
      ratePerMinute: null,
      minutesToThreshold: null,
      message: "Checking water level...",
    };
  }

  const current = validRows[0];
  const previous = validRows[1];
  const currentLevel = current.waterLevel as number;
  const previousLevel = previous.waterLevel as number;
  const deltaMinutes = (current.timeMs - previous.timeMs) / 60000;

  if (!Number.isFinite(deltaMinutes) || deltaMinutes <= 0) {
    return {
      direction: "stable",
      currentLevel,
      previousLevel,
      nextThreshold: null,
      ratePerMinute: null,
      minutesToThreshold: null,
      message: `Water level is steady at ${currentLevel.toFixed(2)}m.`,
    };
  }

  if (deltaMinutes > MAX_PAIR_GAP_MINUTES) {
    return {
      direction: "stable",
      currentLevel,
      previousLevel,
      nextThreshold: null,
      ratePerMinute: null,
      minutesToThreshold: null,
      message: "Waiting for newer readings to estimate trend.",
    };
  }

  const deltaDistance = currentLevel - previousLevel;

  if (deltaDistance === 0) {
    return {
      direction: "stable",
      currentLevel,
      previousLevel,
      nextThreshold: null,
      ratePerMinute: 0,
      minutesToThreshold: null,
      message: `Water level is steady at ${currentLevel.toFixed(2)}m.`,
    };
  }

  const stepsSkipped = Math.max(Math.abs(deltaDistance) / STEP_SIZE, 1);
  const normalizedMinutesPerStep = deltaMinutes / stepsSkipped;
  const ratePerMinute = (STEP_SIZE / normalizedMinutesPerStep) * Math.sign(deltaDistance);

  if (!Number.isFinite(ratePerMinute)) {
    return {
      direction: "stable",
      currentLevel,
      previousLevel,
      nextThreshold: null,
      ratePerMinute: null,
      minutesToThreshold: null,
      message: `Water level is steady at ${currentLevel.toFixed(2)}m.`,
    };
  }

  if (deltaDistance > 0) {
    if (currentLevel >= 4.0) {
      return {
        direction: "rising",
        currentLevel,
        previousLevel,
        nextThreshold: 4.0,
        ratePerMinute,
        minutesToThreshold: null,
        message: "Water level has reached the highest reading on this sensor (4.00m).",
      };
    }

    const target = currentLevel + STEP_SIZE;
    const minutesToThreshold = Math.abs(STEP_SIZE / ratePerMinute);
    const roundedMinutes = Math.round(minutesToThreshold);
    const trendMessage =
      Number.isFinite(minutesToThreshold) && minutesToThreshold <= MAX_PREDICTION_MINUTES
        ? `Water level is rising. It may reach ${target.toFixed(2)}m in about ${roundedMinutes} minutes.`
        : "Water level is rising. Collecting more readings for a better time estimate.";

    return {
      direction: "rising",
      currentLevel,
      previousLevel,
      nextThreshold: target,
      ratePerMinute,
      minutesToThreshold: Number.isFinite(minutesToThreshold) ? Math.max(0, minutesToThreshold) : null,
      message: trendMessage,
    };
  }

  if (currentLevel <= 0) {
    return {
      direction: "stable",
      currentLevel,
      previousLevel,
      nextThreshold: null,
      ratePerMinute,
      minutesToThreshold: null,
      message: "No current sensor reading available.",
    };
  }

  if (currentLevel <= 1.5) {
    return {
      direction: "falling",
      currentLevel,
      previousLevel,
      nextThreshold: 1.5,
      ratePerMinute,
      minutesToThreshold: null,
      message: "Water level has returned to its normal level (1.50m).",
    };
  }

  const target = currentLevel - STEP_SIZE;
  const minutesToThreshold = Math.abs(STEP_SIZE / ratePerMinute);
  const roundedMinutes = Math.round(minutesToThreshold);
  const trendMessage =
    Number.isFinite(minutesToThreshold) && minutesToThreshold <= MAX_PREDICTION_MINUTES
      ? `Water level is falling. It may reach ${target.toFixed(2)}m in about ${roundedMinutes} minutes.`
      : "Water level is falling. Collecting more readings for a better time estimate.";

  return {
    direction: "falling",
    currentLevel,
    previousLevel,
    nextThreshold: target,
    ratePerMinute,
    minutesToThreshold: Number.isFinite(minutesToThreshold) ? Math.max(0, minutesToThreshold) : null,
    message: trendMessage,
  };
}

export function inferAlertLevel(snapshot: SensorSnapshotLike): AlertLevelKey {
  const status = (snapshot.statusText ?? "").toLowerCase();

  if (status.includes("spill")) return "spilling";
  if (status.includes("evac")) return "evacuation";
  if (status.includes("critical") || status.includes("alert level 2") || status.includes("alert 2")) {
    return "critical";
  }
  if (status.includes("normal") || status.includes("alert level 1") || status.includes("alert 1")) {
    return "normal";
  }
  if (snapshot.waterLevel !== null) {
    if (snapshot.waterLevel >= 4) return "spilling";
    if (snapshot.waterLevel >= 3) return "evacuation";
    if (snapshot.waterLevel >= 2.5) return "critical";
  }

  return "normal";
}

export function formatRangeLabel(level: number | null, fallback: string): string {
  if (level === null || Number.isNaN(level)) return fallback;

  if (level >= 4) return "4.0m";
  if (level >= 3) return "3.0 - 3.9m";
  if (level >= 2.5) return "2.5 - 2.9m";
  if (level >= 1.5) return "1.5 - 2.49m";

  return fallback;
}

export function formatSensorUpdatedAt(updatedAt: string | null): string {
  if (!updatedAt) return "UPDATED: NO RECENT DATA";

  const timestamp = new Date(updatedAt);
  if (Number.isNaN(timestamp.getTime())) {
    return "UPDATED: NO RECENT DATA";
  }

  return `UPDATED: ${timestamp
    .toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toUpperCase()}`;
}
