/**
 * Weather utility functions shared across API and Web
 */

export type WetSeverity = "none" | "light" | "moderate" | "heavy" | "torrential";
export type HeatSeverity = "normal" | "caution" | "extreme-caution" | "danger" | "extreme-danger";

export const DRY_NORMAL_ICON_PATH = "/weather/dry-season/sun Normal.png";
export const DRY_SUNRISE_ICON_PATH = "/weather/dry-season/sunrise.png";
export const DRY_SUNSET_ICON_PATH = "/weather/dry-season/sunset.png";
export const SUNRISE_SUNSET_WINDOW_MS = 30 * 60 * 1000;

export const WEATHER_ICON_MAP: Record<string, string> = {
  Normal: DRY_NORMAL_ICON_PATH,
  Caution: "/weather/dry-season/sun Caution.png",
  "Extreme Caution": "/weather/dry-season/sun Extreme Caution.png",
  Danger: "/weather/dry-season/sun Danger.png",
  "Extreme Danger": "/weather/dry-season/sun Danger.png",
  "Light Rain": "/weather/wet-season/Light Rain.png",
  "Moderate Rain": "/weather/wet-season/Moderate Rain.png",
  "Heavy Rain": "/weather/wet-season/Heavy Rain.png",
  "Torrential Rain": "/weather/wet-season/Torrential Rain.png",
};

/**
 * Infer wet severity from OpenWeather API main and description fields
 */
export function inferWetSeverity(main: string, description: string): WetSeverity {
  const lowerMain = main.toLowerCase();
  const lowerDescription = description.toLowerCase();

  if (
    lowerMain.includes("thunder") ||
    lowerDescription.includes("thunder") ||
    lowerMain.includes("squall") ||
    lowerMain.includes("tornado")
  ) {
    return "torrential";
  }

  if (lowerMain.includes("rain")) {
    if (
      lowerDescription.includes("very heavy") ||
      lowerDescription.includes("extreme") ||
      lowerDescription.includes("violent")
    ) {
      return "torrential";
    }
    if (lowerDescription.includes("heavy")) return "heavy";
    if (lowerDescription.includes("moderate")) return "moderate";
    if (lowerDescription.includes("light") || lowerDescription.includes("shower")) return "light";
    return "moderate";
  }

  if (lowerMain.includes("drizzle")) return "light";
  return "none";
}

/**
 * Compute heat index from temperature and humidity
 */
export function computeHeatIndexC(temperatureC: number, humidity: number): number {
  const tF = temperatureC * (9 / 5) + 32;

  if (tF < 80 || humidity < 40) {
    return Math.round(temperatureC * 10) / 10;
  }

  const hiF =
    -42.379 +
    2.04901523 * tF +
    10.14333127 * humidity -
    0.22475541 * tF * humidity -
    0.00683783 * tF * tF -
    0.05481717 * humidity * humidity +
    0.00122874 * tF * tF * humidity +
    0.00085282 * tF * humidity * humidity -
    0.00000199 * tF * tF * humidity * humidity;

  const hiC = (hiF - 32) * (5 / 9);
  return Math.round(hiC * 10) / 10;
}

/**
 * Resolve heat severity from heat index
 */
export function resolveHeatSeverity(heatIndexC: number): HeatSeverity {
  if (heatIndexC >= 52) return "extreme-danger";
  if (heatIndexC >= 42) return "danger";
  if (heatIndexC >= 33) return "extreme-caution";
  if (heatIndexC >= 27) return "caution";
  return "normal";
}

/**
 * Resolve weather intensity label for display
 */
export function resolveIntensityLabel(wet: WetSeverity, heat: HeatSeverity): string {
  if (wet === "torrential") return "Torrential Rain";
  if (wet === "heavy") return "Heavy Rain";
  if (wet === "moderate") return "Moderate Rain";
  if (wet === "light") return "Light Rain";
  if (heat === "extreme-danger") return "Extreme Danger";
  if (heat === "danger") return "Danger";
  if (heat === "extreme-caution") return "Extreme Caution";
  if (heat === "caution") return "Caution";
  return "Normal";
}

/**
 * Determine if it's nighttime based on icon code or sunrise/sunset times
 */
export function resolveIsNight(iconCode: string, sunriseUnixSeconds?: number, sunsetUnixSeconds?: number): boolean {
  if (typeof sunriseUnixSeconds === "number" && typeof sunsetUnixSeconds === "number") {
    const now = Date.now();
    return now < sunriseUnixSeconds * 1000 || now > sunsetUnixSeconds * 1000;
  }

  return iconCode.endsWith("n");
}

/**
 * Resolve night icon for dry season
 */
export function resolveDrySeasonNightIcon(main: string, description: string): string {
  const lowerMain = main.toLowerCase();
  const lowerDescription = description.toLowerCase();

  if (lowerMain.includes("clear")) {
    return "/weather/dry-season/clear sky moon.png";
  }

  if (lowerMain.includes("cloud") || lowerDescription.includes("cloud")) {
    return "/weather/dry-season/few clouds moon.png";
  }

  if (
    lowerMain.includes("mist") ||
    lowerMain.includes("fog") ||
    lowerMain.includes("haze") ||
    lowerDescription.includes("mist") ||
    lowerDescription.includes("fog") ||
    lowerDescription.includes("haze")
  ) {
    return "/weather/dry-season/mist moon.png";
  }

  return "/weather/dry-season/few clouds moon.png";
}

/**
 * Resolve phase-appropriate icon (sunrise/sunset/day/night) for dry season
 */
export function resolveDrySeasonPhaseIcon(
  main: string,
  description: string,
  iconCode: string,
  sunriseUnixSeconds?: number,
  sunsetUnixSeconds?: number,
): string {
  if (typeof sunriseUnixSeconds !== "number" || typeof sunsetUnixSeconds !== "number") {
    return iconCode.endsWith("n") ? resolveDrySeasonNightIcon(main, description) : DRY_NORMAL_ICON_PATH;
  }

  const now = Date.now();
  const sunriseMs = sunriseUnixSeconds * 1000;
  const sunsetMs = sunsetUnixSeconds * 1000;

  if (Math.abs(now - sunriseMs) <= SUNRISE_SUNSET_WINDOW_MS) {
    return DRY_SUNRISE_ICON_PATH;
  }

  if (Math.abs(now - sunsetMs) <= SUNRISE_SUNSET_WINDOW_MS) {
    return DRY_SUNSET_ICON_PATH;
  }

  if (now < sunriseMs || now > sunsetMs) {
    return resolveDrySeasonNightIcon(main, description);
  }

  return DRY_NORMAL_ICON_PATH;
}

/**
 * Build auto-generated weather advisory description
 */
export function buildAutoDescription(intensity: string, description: string, isNight: boolean, wet: WetSeverity): string {
  const base = description ? description.charAt(0).toUpperCase() + description.slice(1) : intensity;

  if (isNight) {
    if (wet === "none") {
      return `${base}. Nighttime conditions are generally calm. Stay aware of any late-night weather updates.`;
    }

    const wetNightAdvisories: Record<Exclude<WetSeverity, "none">, string> = {
      light: "Light rain tonight. Roads may be slippery and visibility may be reduced.",
      moderate: "Moderate rain tonight. Be extra careful in low-lying and flood-prone areas.",
      heavy: "Heavy rain tonight. Avoid unnecessary travel and monitor local flood advisories.",
      torrential: "Torrential rain tonight. Stay indoors and keep emergency channels open for updates.",
    };

    return wetNightAdvisories[wet as Exclude<WetSeverity, "none">] ?? `${base}. Stay updated with official barangay advisories.`;
  }

  const advisories: Record<string, string> = {
    "Torrential Rain": "Torrential rain is occurring. Stay indoors, avoid flooded areas, and monitor barangay advisories.",
    "Heavy Rain": "Heavy rainfall is expected. Prepare for possible flooding and stay alert for barangay updates.",
    "Moderate Rain": "Moderate rain is present. Exercise caution especially near low-lying areas.",
    "Light Rain": "Light rain is falling. Carry an umbrella and drive carefully.",
    "Extreme Danger": "Extreme heat. Avoid outdoor activities. Risk of heat stroke is very high.",
    Danger: "Dangerous heat levels detected. Limit outdoor exposure and stay hydrated.",
    "Extreme Caution": "Extreme caution advised due to high heat index. Stay cool and hydrated.",
    Caution: "Warm weather. Stay hydrated and avoid prolonged sun exposure.",
    Normal: `${base}. No active weather advisory at this time.`,
  };

  return advisories[intensity] ?? `${base}. Stay updated with official barangay advisories.`;
}
