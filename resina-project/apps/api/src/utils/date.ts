/**
 * Date utilities for Manila timezone
 */

/**
 * Get current date in Manila timezone as YYYY-MM-DD string
 * @param offsetDays Optional number of days to offset (e.g., -1 for yesterday, 1 for tomorrow)
 * @returns Date string in YYYY-MM-DD format
 */
export function getManilaDate(offsetDays: number = 0): string {
  const manilaDate = new Date();

  // Get Manila time
  const manilaFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = manilaFormatter.formatToParts(manilaDate);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to resolve Manila date");
  }

  const yearNum = Number.parseInt(year, 10);
  const monthNum = Number.parseInt(month, 10);
  const dayNum = Number.parseInt(day, 10);

  if ([yearNum, monthNum, dayNum].some((value) => Number.isNaN(value))) {
    throw new Error("Failed to parse Manila date parts");
  }

  // Apply offset using UTC date arithmetic to avoid server-local timezone effects.
  const utcMs = Date.UTC(yearNum, monthNum - 1, dayNum) + offsetDays * 24 * 60 * 60 * 1000;
  const normalized = new Date(utcMs);

  const outYear = normalized.getUTCFullYear();
  const outMonth = String(normalized.getUTCMonth() + 1).padStart(2, "0");
  const outDay = String(normalized.getUTCDate()).padStart(2, "0");

  return `${outYear}-${outMonth}-${outDay}`;
}
