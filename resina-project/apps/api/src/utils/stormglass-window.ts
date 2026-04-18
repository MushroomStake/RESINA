/**
 * Build a StormGlass query window for a Manila prediction date.
 * Adds a 12-hour buffer on both sides to keep boundary extremes.
 */
export function toStormGlassWindow(predictionDate: string): { startIso: string; endIso: string } {
  const [yearRaw, monthRaw, dayRaw] = predictionDate.split("-");
  const year = Number.parseInt(yearRaw ?? "", 10);
  const month = Number.parseInt(monthRaw ?? "", 10);
  const day = Number.parseInt(dayRaw ?? "", 10);

  if ([year, month, day].some((value) => Number.isNaN(value))) {
    throw new Error(`Invalid predictionDate format: ${predictionDate}`);
  }

  const manilaOffsetHours = 8;
  const startUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0) - manilaOffsetHours * 60 * 60 * 1000;
  const endUtcMs = startUtcMs + (24 * 60 * 60 * 1000 - 1000);
  const bufferMs = 12 * 60 * 60 * 1000;

  return {
    startIso: new Date(startUtcMs - bufferMs).toISOString(),
    endIso: new Date(endUtcMs + bufferMs).toISOString(),
  };
}
