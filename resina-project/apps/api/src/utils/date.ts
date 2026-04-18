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

  let dateStr = `${year}-${month}-${day}`;

  // Apply offset if provided
  if (offsetDays !== 0) {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + offsetDays);
    const offsetFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const offsetParts = offsetFormatter.formatToParts(date);
    const offsetYear = offsetParts.find((part) => part.type === "year")?.value;
    const offsetMonth = offsetParts.find((part) => part.type === "month")?.value;
    const offsetDay = offsetParts.find((part) => part.type === "day")?.value;

    if (!offsetYear || !offsetMonth || !offsetDay) {
      throw new Error("Failed to resolve offset Manila date");
    }

    dateStr = `${offsetYear}-${offsetMonth}-${offsetDay}`;
  }

  return dateStr;
}
