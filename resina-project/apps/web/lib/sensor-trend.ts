export type SensorTrendDirection = "rising" | "falling" | "stable";

export type SensorTrendSummary = {
  direction: SensorTrendDirection;
  currentLevel: number | null;
  previousLevel: number | null;
  nextThreshold: number | null;
  ratePerMinute: number | null;
  minutesToThreshold: number | null;
  message: string;
};

function parseLevel(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function buildWaterTrendFromRows(
  rows: Array<{ water_level?: number | string | null; created_at?: string | null }>,
): SensorTrendSummary {
  const STALE_READING_MS = 30 * 60 * 1000;
  const STEP_SIZE = 0.5;

  const validRows = rows
    .map((row) => {
      const waterLevel = parseLevel(row.water_level);
      const timeMs = row.created_at ? new Date(row.created_at).getTime() : Number.NaN;

      return {
        waterLevel,
        timeMs,
      };
    })
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

    return {
      direction: "rising",
      currentLevel,
      previousLevel,
      nextThreshold: target,
      ratePerMinute,
      minutesToThreshold: Number.isFinite(minutesToThreshold) ? Math.max(0, minutesToThreshold) : null,
      message: `Water level is rising. It may reach ${target.toFixed(2)}m in about ${Math.round(minutesToThreshold)} minutes.`,
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

  return {
    direction: "falling",
    currentLevel,
    previousLevel,
    nextThreshold: target,
    ratePerMinute,
    minutesToThreshold: Number.isFinite(minutesToThreshold) ? Math.max(0, minutesToThreshold) : null,
    message: `Water level is falling. It may reach ${target.toFixed(2)}m in about ${Math.round(minutesToThreshold)} minutes.`,
  };
}
