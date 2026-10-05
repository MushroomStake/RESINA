export type SensorTrendDirection = "rising" | "falling" | "stable";
export type SensorTrendState = "stable" | "baseline" | "slow-rise" | "rapid-surge" | "receding" | "unavailable";

export type SensorTrendSummary = {
  direction: SensorTrendDirection;
  state: SensorTrendState;
  currentLevel: number | null;
  previousLevel: number | null;
  ratePerMinute: number | null;
  estimatedMinutesToOverflow: number | null;
  message: string;
};

const SENSOR_THRESHOLDS = [1.5, 2, 2.5, 3, 3.5, 4] as const;
const STALE_INTERVAL_MINUTES = 30;

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
  const chronologicalRows = [...validRows].reverse();
  if (!latest || Date.now() - latest.timeMs > STALE_INTERVAL_MINUTES * 60 * 1000) {
    return {
      direction: "stable",
      state: "unavailable",
      currentLevel: latest?.waterLevel ?? null,
      previousLevel: null,
      ratePerMinute: null,
      estimatedMinutesToOverflow: null,
      message: "No recent sensor reading. System is safely idle.",
    };
  }

  if (validRows.length < 2) {
    return {
      direction: "stable",
      state: "baseline",
      currentLevel: validRows[0]?.waterLevel ?? null,
      previousLevel: null,
      ratePerMinute: null,
      estimatedMinutesToOverflow: null,
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
      state: "stable",
      currentLevel,
      previousLevel,
      ratePerMinute: 0,
      estimatedMinutesToOverflow: null,
      message: `The water level is steady at ${currentLevel.toFixed(2)}m. No rise or fall has been detected.`,
    };
  }

  const deltaDistance = currentLevel - previousLevel;

  if (deltaDistance === 0) {
    return {
      direction: "stable",
      state: "stable",
      currentLevel,
      previousLevel,
      ratePerMinute: 0,
      estimatedMinutesToOverflow: null,
      message: `The water level is steady at ${currentLevel.toFixed(2)}m. No rise or fall has been detected.`,
    };
  }

  if (currentLevel < 1.5) {
    return {
      direction: "stable",
      state: "stable",
      currentLevel,
      previousLevel,
      ratePerMinute: 0,
      estimatedMinutesToOverflow: null,
      message: "No current sensor reading available.",
    };
  }

  if (currentLevel <= 0) {
    return {
      direction: "stable",
      state: "stable",
      currentLevel,
      previousLevel,
      ratePerMinute: 0,
      estimatedMinutesToOverflow: null,
      message: "No current sensor reading available.",
    };
  }

  const direction: SensorTrendDirection = deltaDistance > 0 ? "rising" : "falling";
  if (currentLevel === 1.5 && direction === "rising") {
    return {
      direction: "stable",
      state: "stable",
      currentLevel,
      previousLevel,
      ratePerMinute: 0,
      estimatedMinutesToOverflow: null,
      message: "Stable - 0.00 m/min. Rise baseline set at 1.50m.",
    };
  }

  if (currentLevel < 1.5 && direction === "rising") {
    return {
      direction: "stable",
      state: "stable",
      currentLevel,
      previousLevel,
      ratePerMinute: 0,
      estimatedMinutesToOverflow: null,
      message: "The water level is below the 1.50m rise-detection point. Monitoring will begin when it reaches that level.",
    };
  }

  if (direction === "rising") {
    const risingCrossings = new Map<number, number>();
    for (let index = 1; index < chronologicalRows.length; index += 1) {
      const before = chronologicalRows[index - 1];
      const row = chronologicalRows[index];
      if (row.waterLevel! < before.waterLevel!) {
        for (const threshold of SENSOR_THRESHOLDS) {
          if (threshold > row.waterLevel!) risingCrossings.delete(threshold);
        }
      }
      for (const threshold of SENSOR_THRESHOLDS) {
        if (before.waterLevel! < threshold && row.waterLevel! >= threshold) {
          risingCrossings.set(threshold, row.timeMs);
        }
      }
    }

    const reached = SENSOR_THRESHOLDS.filter((threshold) => threshold <= currentLevel);
    if (reached.length < 2) {
      return {
        direction,
        state: "baseline",
        currentLevel,
        previousLevel,
        ratePerMinute: null,
        estimatedMinutesToOverflow: null,
        message: "Rise detection has started at 1.50m. The rate will be available after the next 0.50m increase.",
      };
    }

    const currentThreshold = reached[reached.length - 1];
    const previousThreshold = reached[reached.length - 2];
    const currentTimestamp = risingCrossings.get(currentThreshold);
    const previousTimestamp = risingCrossings.get(previousThreshold);
    const intervalMinutes = currentTimestamp && previousTimestamp ? (currentTimestamp - previousTimestamp) / 60000 : Number.NaN;
    const ratePerMinute = Number.isFinite(intervalMinutes) && intervalMinutes > 0 && intervalMinutes <= STALE_INTERVAL_MINUTES ? 0.5 / intervalMinutes : null;

    if (ratePerMinute === null) {
      return {
        direction,
        state: "baseline",
        currentLevel,
        previousLevel,
        ratePerMinute: null,
        estimatedMinutesToOverflow: null,
        message: "The rise reading expired after 30 minutes without a new trigger. A new baseline has been set; the rate will recalculate on the next trigger.",
      };
    }

    const state: SensorTrendState = ratePerMinute >= 0.1 ? "rapid-surge" : "slow-rise";
    const estimatedMinutesToOverflow = currentLevel >= 4 ? 0 : (4 - currentLevel) / ratePerMinute;
    const eta = currentLevel >= 4 ? "The 4.00m overflow threshold has been reached." : `At this rate, the water may reach the 4.00m overflow level in about ${Math.max(1, Math.round(estimatedMinutesToOverflow))} minutes.`;
    return {
      direction,
      state,
      currentLevel,
      previousLevel,
      ratePerMinute,
      estimatedMinutesToOverflow,
      message: `The water level is rising ${state === "rapid-surge" ? "quickly" : "slowly"} at +${ratePerMinute.toFixed(2)} m/min. ${eta}`,
    };
  }

  const fallingCrossings = new Map<number, number>();
  for (let index = 1; index < chronologicalRows.length; index += 1) {
    const before = chronologicalRows[index - 1];
    const row = chronologicalRows[index];
    if (row.waterLevel! > before.waterLevel!) {
      for (const threshold of SENSOR_THRESHOLDS) {
        if (threshold < row.waterLevel!) fallingCrossings.delete(threshold);
      }
    }
    for (const threshold of SENSOR_THRESHOLDS) {
      if (before.waterLevel! > threshold && row.waterLevel! <= threshold) fallingCrossings.set(threshold, row.timeMs);
    }
  }
  const fallingReached = SENSOR_THRESHOLDS.filter((threshold) => threshold >= currentLevel).sort((a, b) => b - a);
  if (fallingReached.length < 2) {
    return {
      direction,
      state: "baseline",
      currentLevel,
      previousLevel,
      ratePerMinute: null,
      estimatedMinutesToOverflow: null,
      message: "Fall detection has started. The rate will be available after the next 0.50m decrease.",
    };
  }

  const currentThreshold = fallingReached[fallingReached.length - 1];
  const previousThreshold = fallingReached[fallingReached.length - 2];
  const currentTimestamp = fallingCrossings.get(currentThreshold);
  const previousTimestamp = fallingCrossings.get(previousThreshold);
  const intervalMinutes = currentTimestamp && previousTimestamp ? (currentTimestamp - previousTimestamp) / 60000 : Number.NaN;
  const ratePerMinute = Number.isFinite(intervalMinutes) && intervalMinutes > 0 && intervalMinutes <= STALE_INTERVAL_MINUTES ? -0.5 / intervalMinutes : null;

  if (ratePerMinute === null) {
    return {
      direction,
      state: "baseline",
      currentLevel,
      previousLevel,
      ratePerMinute: null,
      estimatedMinutesToOverflow: null,
      message: "The fall reading expired after 30 minutes without a new trigger. A new baseline has been set; the rate will recalculate on the next trigger.",
    };
  }

  return {
    direction,
    state: "receding",
    currentLevel,
    previousLevel,
    ratePerMinute,
    estimatedMinutesToOverflow: null,
    message: `The water level is going down at ${Math.abs(ratePerMinute).toFixed(2)} m/min. The area is receding from the previous level.`,
  };
}
