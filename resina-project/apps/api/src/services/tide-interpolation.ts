/**
 * Tide Interpolation: Rule of Twelfths and Sine Wave Methods
 * Estimates hourly water heights from high/low tide extremes
 */

import type { TideData, TideExtreme } from "./tide.service";

/**
 * Rule of Twelfths: approximates tidal flow for a single tidal cycle
 * Uses 1/12, 2/12, 3/12, 3/12, 2/12, 1/12 rule for rise/fall
 *
 * @param lowPoint Start tide extreme (low)
 * @param highPoint End tide extreme (high)
 * @param hoursIntoExtremes Hours elapsed since low (0 to ~6 hours for rising)
 * @returns Estimated water height
 */
function ruleOfTwelfths(lowPoint: number, highPoint: number, hoursIntoExtremes: number): number {
  const range = highPoint - lowPoint;
  const cycleHours = 6; // Approximate hours for half a tidal cycle

  // Clamp to cycle
  const h = Math.min(Math.max(hoursIntoExtremes, 0), cycleHours);

  // Rule of twelfths ratios per hour: [1/12, 2/12, 3/12, 3/12, 2/12, 1/12]
  const ratios = [1/12, 2/12, 3/12, 3/12, 2/12, 1/12];
  let accumulated = 0;

  for (let i = 0; i < Math.floor(h); i++) {
    if (i < ratios.length) {
      accumulated += ratios[i];
    }
  }

  // Add fractional hour
  const fraction = h - Math.floor(h);
  if (Math.floor(h) < ratios.length) {
    accumulated += ratios[Math.floor(h)] * fraction;
  }

  return lowPoint + range * accumulated;
}

/**
 * Sinusoidal approximation: smoother curve for tide variation
 *
 * @param lowPoint Minimum tide height
 * @param highPoint Maximum tide height
 * @param cycleStartTime ISO string of low tide
 * @param queryTime ISO string of query time
 * @returns Estimated water height
 */
function sineWaveInterpolation(
  lowPoint: number,
  highPoint: number,
  cycleStartTime: string,
  queryTime: string
): number {
  const start = new Date(cycleStartTime).getTime();
  const query = new Date(queryTime).getTime();
  const duration = query - start;

  // Half tidal cycle is approximately 6 hours = 21600000 ms
  const halfCycleDurationMs = 6 * 60 * 60 * 1000;

  // Normalized position in cycle (0 to 1)
  const position = (duration % (2 * halfCycleDurationMs)) / (2 * halfCycleDurationMs);

  // Sine curve: starts at low (0), peaks at high (0.5), back to low (1)
  const midpoint = (lowPoint + highPoint) / 2;
  const amplitude = (highPoint - lowPoint) / 2;

  return midpoint + amplitude * Math.sin(Math.PI * position);
}

/**
 * Find the nearest low and high tides surrounding a given time
 */
function findSurroundingExtremes(
  tideData: TideData,
  queryTime: Date
): { low: TideExtreme; high: TideExtreme } | null {
  const queryMs = queryTime.getTime();

  // Sort by time
  const sorted = [...tideData].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  let preceding = sorted[0];
  let following = sorted[0];

  for (const extreme of sorted) {
    const extremeMs = new Date(extreme.time).getTime();
    if (extremeMs <= queryMs) {
      preceding = extreme;
    }
    if (extremeMs >= queryMs && following.time === sorted[0].time) {
      following = extreme;
    }
  }

  // Ensure we have a low and high in sequence
  if (preceding.type === "high" && following.type === "low") {
    // Swap so preceding is low
    [preceding, following] = [following, preceding];
  }

  if (preceding.type === "low" && following.type === "high") {
    return {
      low: preceding,
      high: following,
    };
  }

  if (preceding.type === "high" && following.type === "low") {
    return {
      low: following,
      high: preceding,
    };
  }

  // If both same type or insufficient data
  return null;
}

export type InterpolationMethod = "rule-of-twelfths" | "sine-wave";

/**
 * Estimate tide height for a specific time
 * @param tideData Array of high/low extremes
 * @param queryTime ISO string or Date of query time
 * @param method Interpolation method (default: "rule-of-twelfths")
 * @returns Estimated height in meters
 */
export function estimateTideHeight(
  tideData: TideData,
  queryTime: string | Date,
  method: InterpolationMethod = "rule-of-twelfths"
): number | null {
  if (!tideData || tideData.length < 2) {
    return null;
  }

  const query = typeof queryTime === "string" ? new Date(queryTime) : queryTime;
  const surrounding = findSurroundingExtremes(tideData, query);

  if (!surrounding) {
    return null;
  }

  const { low, high } = surrounding;

  if (method === "sine-wave") {
    return sineWaveInterpolation(low.height, high.height, low.time, query.toISOString());
  }

  // Default: Rule of Twelfths
  const hoursInto = (query.getTime() - new Date(low.time).getTime()) / (60 * 60 * 1000);
  return ruleOfTwelfths(low.height, high.height, hoursInto);
}

/**
 * Generate hourly tide estimates for a full day
 * @param tideData Tide extremes for the day
 * @param predictionDate ISO date string (YYYY-MM-DD)
 * @param method Interpolation method
 * @returns Array of { hour, estimatedHeight, confidence }
 */
export function generateHourlyTideEstimates(
  tideData: TideData,
  predictionDate: string,
  method: InterpolationMethod = "rule-of-twelfths"
): Array<{ hour: number; estimatedHeight: number; confidence: "high" | "medium" | "low" }> {
  const estimates: Array<{ hour: number; estimatedHeight: number; confidence: "high" | "medium" | "low" }> = [];

  const [yearRaw, monthRaw, dayRaw] = predictionDate.split("-");
  const year = Number.parseInt(yearRaw ?? "", 10);
  const month = Number.parseInt(monthRaw ?? "", 10);
  const day = Number.parseInt(dayRaw ?? "", 10);

  if ([year, month, day].some((value) => Number.isNaN(value))) {
    return estimates;
  }

  const manilaOffsetHours = 8;

  for (let hour = 0; hour < 24; hour++) {
    // Construct query time for Manila local hour and convert to UTC instant.
    const queryTimeUtcMs = Date.UTC(year, month - 1, day, hour, 0, 0) - manilaOffsetHours * 60 * 60 * 1000;
    const queryTime = new Date(queryTimeUtcMs);
    const height = estimateTideHeight(tideData, queryTime, method);

    if (height !== null) {
      // Confidence decreases as we move away from the extremes
      let confidence: "high" | "medium" | "low" = "medium";
      const distToNearest = Math.min(
        ...tideData.map((e) => Math.abs(queryTime.getTime() - new Date(e.time).getTime()))
      ) / (60 * 60 * 1000); // hours

      if (distToNearest < 1) confidence = "high";
      if (distToNearest > 3) confidence = "low";

      estimates.push({
        hour,
        estimatedHeight: Math.round(height * 100) / 100,
        confidence,
      });
    }
  }

  return estimates;
}

/**
 * Get current tide status and next extremes
 */
export function getTideStatus(tideData: TideData, now: Date = new Date()) {
  const surrounding = findSurroundingExtremes(tideData, now);
  if (!surrounding) return null;

  const { low, high } = surrounding;
  const currentHeight = estimateTideHeight(tideData, now);

  return {
    currentHeight: currentHeight ? Math.round(currentHeight * 100) / 100 : null,
    nextExtreme: {
      type: high.time > low.time ? "high" : "low",
      height: high.time > low.time ? high.height : low.height,
      time: high.time > low.time ? high.time : low.time,
    },
    state: currentHeight && currentHeight > (low.height + high.height) / 2 ? "rising" : "falling",
  };
}
