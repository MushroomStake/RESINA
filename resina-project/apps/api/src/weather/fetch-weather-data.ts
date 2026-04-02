#!/usr/bin/env node
import "dotenv/config";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import PagasaParserPDFSource from "@pagasa-parser/source-pdf";
import type { Area, Bulletin, TCWSLevel } from "pagasa-parser";

type WetSeverity = "none" | "light" | "moderate" | "heavy" | "torrential";
type HeatSeverity = "normal" | "caution" | "extreme-caution" | "danger" | "extreme-danger";
type ColorWarning = "No Warning" | "Yellow Warning" | "Orange Warning" | "Red Warning";

const DRY_NORMAL_ICON_PATH = "/weather/dry-season/sun Normal.png";
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

const PAGASA_BULLETIN_PAGES = [
  "https://bagong.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin",
  "https://bagong.pagasa.dost.gov.ph/tropical-cyclone-bulletin",
];

const SIGNAL_MATCH_KEYWORDS = ["olongapo", "sta rita", "sta. rita", "zambales"];

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

function buildAutoDescription(intensity: string, description: string): string {
  const base = description ? description.charAt(0).toUpperCase() + description.slice(1) : intensity;

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

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAreaNames(area: Area): string[] {
  const names: string[] = [area.name];

  if ("includes" in area && area.includes && "objects" in area.includes && Array.isArray(area.includes.objects)) {
    names.push(...area.includes.objects);
  }

  if ("islands" in area && Array.isArray(area.islands)) {
    names.push(...area.islands.map((island) => island.name));
  }

  return names;
}

function levelHasTargetArea(level: TCWSLevel | null): boolean {
  if (!level) return false;

  const allAreas = Object.values(level.areas).flat();
  const normalizedAreaNames = allAreas.flatMap((area) => extractAreaNames(area).map(normalizeText));

  return normalizedAreaNames.some((name) => SIGNAL_MATCH_KEYWORDS.some((keyword) => name.includes(keyword)));
}

function resolveSignalNoFromBulletin(bulletin: Bulletin): string {
  for (const level of [5, 4, 3, 2, 1] as const) {
    if (levelHasTargetArea(bulletin.signals[level])) {
      return `Signal #${level}`;
    }
  }

  return "No Signal";
}

function toAbsoluteUrl(baseUrl: string, href: string): string {
  return new URL(href, baseUrl).toString();
}

async function discoverLatestPagasaPdfUrl(): Promise<string | null> {
  for (const pageUrl of PAGASA_BULLETIN_PAGES) {
    try {
      const pageResponse = await fetch(pageUrl);
      if (!pageResponse.ok) {
        continue;
      }

      const html = await pageResponse.text();
      const hrefMatches = [...html.matchAll(/href=["']([^"']+\.pdf(?:\?[^"']*)?)["']/gi)];
      if (!hrefMatches.length) {
        continue;
      }

      const prioritized = hrefMatches
        .map((match) => match[1])
        .filter(Boolean)
        .sort((left, right) => {
          const leftScore = /(tropical|cyclone|bulletin|tcb)/i.test(left) ? 1 : 0;
          const rightScore = /(tropical|cyclone|bulletin|tcb)/i.test(right) ? 1 : 0;
          return rightScore - leftScore;
        });

      if (prioritized.length) {
        return toAbsoluteUrl(pageUrl, prioritized[0]);
      }
    } catch {
      // try next PAGASA bulletin page
    }
  }

  return null;
}

async function resolveSignalNoFromPagasa(): Promise<string> {
  const manualPdfUrl = process.env.PAGASA_TCB_PDF_URL?.trim();
  const pdfUrl = manualPdfUrl || (await discoverLatestPagasaPdfUrl());

  if (!pdfUrl) {
    return "No Signal";
  }

  const tmpPdfPath = join(tmpdir(), `pagasa-tcb-${Date.now()}.pdf`);

  try {
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      return "No Signal";
    }

    const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
    await writeFile(tmpPdfPath, pdfBuffer);

    const source = new PagasaParserPDFSource(tmpPdfPath);
    const bulletin = await source.parse();

    return resolveSignalNoFromBulletin(bulletin);
  } catch {
    // Keep weather pipeline resilient if PAGASA PDF parsing fails.
    return "No Signal";
  } finally {
    try {
      await unlink(tmpPdfPath);
    } catch {
      // ignore temp file cleanup errors
    }
  }
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  const openWeatherApiKey = process.env.OPENWEATHER_API_KEY ?? process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  }

  if (!openWeatherApiKey) {
    throw new Error("Missing OPENWEATHER_API_KEY (or NEXT_PUBLIC_OPENWEATHER_API_KEY)");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const response = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?q=Olongapo,PH&units=metric&appid=${openWeatherApiKey}`,
    {},
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenWeather request failed (${response.status}): ${text}`);
  }

  const owmData = (await response.json()) as {
    main?: { temp?: number; humidity?: number };
    weather?: Array<{ main?: string; description?: string }>;
  };

  const temperature = Math.round(owmData.main?.temp ?? 25);
  const humidity = Math.round(owmData.main?.humidity ?? 60);
  const weatherMain = owmData.weather?.[0]?.main ?? "Clear";
  const weatherDescription = owmData.weather?.[0]?.description ?? "";

  const wetSeverity = inferWetSeverity(weatherMain, weatherDescription);
  const heatIndex = computeHeatIndexC(temperature, humidity);
  const heatSeverity = resolveHeatSeverity(heatIndex);
  const intensity = resolveIntensityLabel(wetSeverity, heatSeverity);
  const colorCodedWarning = resolveColorCodedWarning(wetSeverity, heatSeverity);
  const iconPath = WEATHER_ICON_MAP[intensity] ?? DRY_NORMAL_ICON_PATH;
  const manualDescription = buildAutoDescription(intensity, weatherDescription);
  const signalNo = await resolveSignalNoFromPagasa();

  const { error } = await supabase.from("weather_logs").insert({
    temperature,
    humidity,
    heat_index: Math.round(heatIndex),
    weather_main: weatherMain,
    weather_description: weatherDescription,
    intensity,
    color_coded_warning: colorCodedWarning,
    signal_no: signalNo,
    manual_description: manualDescription,
    icon_path: iconPath,
  });

  if (error) {
    throw new Error(error.message);
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  await supabase.from("weather_logs").delete().lt("recorded_at", cutoff.toISOString());

  console.log(
    JSON.stringify(
      {
        ok: true,
        intensity,
        temperature,
        humidity,
        heatIndex: Math.round(heatIndex),
        colorCodedWarning,
        signalNo,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
