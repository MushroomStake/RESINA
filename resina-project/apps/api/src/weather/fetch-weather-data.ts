#!/usr/bin/env node
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  WEATHER_ICON_MAP,
  DRY_NORMAL_ICON_PATH,
  inferWetSeverity,
  computeHeatIndexC,
  resolveHeatSeverity,
  resolveIntensityLabel,
  resolveIsNight,
  resolveDrySeasonPhaseIcon,
  buildAutoDescription,
} from "../utils/weather.js";

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
    weather?: Array<{ main?: string; description?: string; icon?: string }>;
    sys?: { sunrise?: number; sunset?: number };
  };

  const temperature = Math.round(owmData.main?.temp ?? 25);
  const humidity = Math.round(owmData.main?.humidity ?? 60);
  const weatherMain = owmData.weather?.[0]?.main ?? "Clear";
  const weatherDescription = owmData.weather?.[0]?.description ?? "";
  const weatherIconCode = owmData.weather?.[0]?.icon ?? "01d";

  const wetSeverity = inferWetSeverity(weatherMain, weatherDescription);
  const isNight = resolveIsNight(weatherIconCode, owmData.sys?.sunrise, owmData.sys?.sunset);
  const heatIndex = computeHeatIndexC(temperature, humidity);
  const heatSeverity = isNight ? "normal" : resolveHeatSeverity(heatIndex);
  const intensity = resolveIntensityLabel(wetSeverity, heatSeverity);
  const signalNo = "No Signal";
  const iconPath =
    wetSeverity === "none"
      ? resolveDrySeasonPhaseIcon(
          weatherMain,
          weatherDescription,
          weatherIconCode,
          owmData.sys?.sunrise,
          owmData.sys?.sunset,
        )
      : WEATHER_ICON_MAP[intensity] ?? DRY_NORMAL_ICON_PATH;
  const manualDescription = buildAutoDescription(intensity, weatherDescription, isNight, wetSeverity);

  const { error } = await supabase.from("weather_logs").insert({
    temperature,
    humidity,
    heat_index: Math.round(heatIndex),
    weather_main: weatherMain,
    weather_description: weatherDescription,
    intensity,
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
