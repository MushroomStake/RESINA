import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

// ─── Weather analysis helpers (mirrors dashboard logic) ────────────────────────

type WetSeverity = "none" | "light" | "moderate" | "heavy" | "torrential";
type HeatSeverity = "normal" | "caution" | "extreme-caution" | "danger" | "extreme-danger";
type ColorWarning = "No Warning" | "Yellow Warning" | "Orange Warning" | "Red Warning";

const SUNRISE_SUNSET_WINDOW_MS = 30 * 60 * 1000;
const DRY_NORMAL_ICON_PATH = "/weather/dry-season/sun Normal.png";
const DRY_SUNRISE_ICON_PATH = "/weather/dry-season/sunrise.png";
const DRY_SUNSET_ICON_PATH = "/weather/dry-season/sunset.png";

const WEATHER_ICON_MAP: Record<string, string> = {
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

function inferWetSeverity(main: string, description: string): WetSeverity {
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

function computeHeatIndexC(temperatureC: number, humidity: number): number {
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

function resolveHeatSeverity(heatIndexC: number): HeatSeverity {
  if (heatIndexC >= 52) return "extreme-danger";
  if (heatIndexC >= 42) return "danger";
  if (heatIndexC >= 33) return "extreme-caution";
  if (heatIndexC >= 27) return "caution";
  return "normal";
}

function resolveIntensityLabel(wet: WetSeverity, heat: HeatSeverity): string {
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

function warningRank(warning: ColorWarning): number {
  if (warning === "Yellow Warning") return 1;
  if (warning === "Orange Warning") return 2;
  if (warning === "Red Warning") return 3;
  return 0;
}

function resolveRainWarning(wet: WetSeverity): ColorWarning {
  if (wet === "torrential") return "Red Warning";
  if (wet === "heavy") return "Orange Warning";
  if (wet === "moderate" || wet === "light") return "Yellow Warning";
  return "No Warning";
}

function resolveHeatWarning(heat: HeatSeverity): ColorWarning {
  if (heat === "extreme-danger") return "Red Warning";
  if (heat === "danger") return "Orange Warning";
  if (heat === "extreme-caution") return "Yellow Warning";
  return "No Warning";
}

function resolveColorCodedWarning(wet: WetSeverity, heat: HeatSeverity): ColorWarning {
  const rain = resolveRainWarning(wet);
  const thermal = resolveHeatWarning(heat);
  return warningRank(thermal) > warningRank(rain) ? thermal : rain;
}

function resolveDrySeasonNightIcon(main: string, description: string): string {
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

function resolveDrySeasonPhaseIcon(
  main: string,
  description: string,
  iconCode: string,
  sunriseUnixSeconds?: number,
  sunsetUnixSeconds?: number,
): string {
  if (typeof sunriseUnixSeconds !== "number" || typeof sunsetUnixSeconds !== "number") {
    return iconCode.endsWith("n")
      ? resolveDrySeasonNightIcon(main, description)
      : DRY_NORMAL_ICON_PATH;
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

function buildAutoDescription(intensity: string, description: string): string {
  const base = description
    ? description.charAt(0).toUpperCase() + description.slice(1)
    : intensity;

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

// ─── Cron handler ───────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Vercel automatically attaches `Authorization: Bearer <CRON_SECRET>` to cron requests.
  // Manual callers must provide the same header to trigger a refresh.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const openWeatherApiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
  if (!openWeatherApiKey) {
    return NextResponse.json({ error: "OpenWeather API key is not configured." }, { status: 500 });
  }

  // 1. Fetch current weather from OpenWeatherMap.
  const owmResponse = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?q=Olongapo,PH&units=metric&appid=${openWeatherApiKey}`,
    { cache: "no-store" },
  );

  if (!owmResponse.ok) {
    return NextResponse.json(
      { error: `OpenWeatherMap request failed: ${owmResponse.statusText}` },
      { status: 502 },
    );
  }

  const owmData = (await owmResponse.json()) as {
    main?: { temp?: number; humidity?: number };
    weather?: Array<{ main?: string; description?: string; icon?: string }>;
    sys?: { sunrise?: number; sunset?: number };
  };

  const temperature = Math.round(owmData.main?.temp ?? 25);
  const humidity = Math.round(owmData.main?.humidity ?? 60);
  const weatherMain = owmData.weather?.[0]?.main ?? "Clear";
  const weatherDescription = owmData.weather?.[0]?.description ?? "";
  const weatherIconCode = owmData.weather?.[0]?.icon ?? "01d";

  const wetSeverity = inferWetSeverity(weatherMain, weatherDescription);
  const heatIndex = computeHeatIndexC(temperature, humidity);
  const heatSeverity = resolveHeatSeverity(heatIndex);
  const intensity = resolveIntensityLabel(wetSeverity, heatSeverity);
  const colorCodedWarning = resolveColorCodedWarning(wetSeverity, heatSeverity);
  const iconPath = wetSeverity === "none"
    ? resolveDrySeasonPhaseIcon(
        weatherMain,
        weatherDescription,
        weatherIconCode,
        owmData.sys?.sunrise,
        owmData.sys?.sunset,
      )
    : WEATHER_ICON_MAP[intensity] ?? DRY_NORMAL_ICON_PATH;
  const manualDescription = buildAutoDescription(intensity, weatherDescription);

  // 2. Save a new row to weather_logs using the service-role key (bypasses RLS).
  const adminSupabase = createAdminClient();

  const { error: insertError } = await adminSupabase.from("weather_logs").insert({
    temperature,
    humidity,
    heat_index: Math.round(heatIndex),
    weather_main: weatherMain,
    weather_description: weatherDescription,
    intensity,
    color_coded_warning: colorCodedWarning,
    signal_no: "No Signal",
    manual_description: manualDescription,
    icon_path: iconPath,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // 3. Prune records older than 60 days to keep the table lean.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  await adminSupabase.from("weather_logs").delete().lt("recorded_at", cutoff.toISOString());

  return NextResponse.json({
    ok: true,
    intensity,
    temperature,
    humidity,
    heatIndex: Math.round(heatIndex),
    colorCodedWarning,
  });
}
