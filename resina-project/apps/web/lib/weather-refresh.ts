import { createAdminClient } from "./supabase/admin";
import {
  inferWetSeverity,
  computeHeatIndexC,
  resolveHeatSeverity,
  resolveIntensityLabel,
  resolveIsNight,
  buildAutoDescription,
  resolveThunderFlag,
  resolveDrySeasonPhaseIcon,
  resolveWetSeasonIconPath,
} from "./weather";

const WEATHER_REFRESH_MINUTES = 10;

export async function refreshWeather(): Promise<Record<string, unknown>> {
  const adminSupabase = createAdminClient();
  const adminSupabaseDynamic = adminSupabase as any;
  const { data: latest, error: latestError } = await adminSupabaseDynamic
    .from("weather_logs")
    .select("recorded_at")
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) throw new Error(latestError.message);

  if (latest?.recorded_at && Date.now() - new Date(latest.recorded_at).getTime() < WEATHER_REFRESH_MINUTES * 60 * 1000) {
    return { ok: true, refreshed: false, recordedAt: latest.recorded_at };
  }

  const openWeatherApiKey = process.env.OPENWEATHER_API_KEY;
  if (!openWeatherApiKey) throw new Error("OpenWeather API key is not configured.");

  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=Olongapo,PH&units=metric&appid=${encodeURIComponent(openWeatherApiKey)}`;
  const owmResponse = await fetch(weatherUrl, { cache: "no-store" });
  if (!owmResponse.ok) throw new Error(`OpenWeatherMap request failed: ${owmResponse.statusText}`);

  const owmData = (await owmResponse.json()) as {
    main?: { temp?: number; humidity?: number };
    weather?: Array<{ main?: string; description?: string; icon?: string }>;
    sys?: { sunrise?: number; sunset?: number };
    wind?: { speed?: number };
    rain?: { [key: string]: number };
  };

  const temperature = Math.round(owmData.main?.temp ?? 25);
  const humidity = Math.round(owmData.main?.humidity ?? 60);
  const windSpeedKmh = Math.round(Number(owmData.wind?.speed ?? 0) * 3.6);
  const weatherMain = owmData.weather?.[0]?.main ?? "Clear";
  const weatherDescription = owmData.weather?.[0]?.description ?? "";
  const weatherIconCode = owmData.weather?.[0]?.icon ?? "01d";
  const rain1hMm = typeof owmData.rain?.["1h"] === "number" ? owmData.rain["1h"] : null;
  const rain3hMm = typeof owmData.rain?.["3h"] === "number" ? owmData.rain["3h"] : null;
  const thunder = resolveThunderFlag(weatherMain, weatherDescription);
  const wetSeverity = inferWetSeverity(weatherMain, weatherDescription, rain1hMm ?? undefined, rain3hMm ?? undefined);
  const isNight = resolveIsNight(weatherIconCode, owmData.sys?.sunrise, owmData.sys?.sunset);
  const heatIndex = computeHeatIndexC(temperature, humidity);
  const heatSeverity = isNight ? "normal" : resolveHeatSeverity(heatIndex);
  const intensity = resolveIntensityLabel(wetSeverity, heatSeverity);
  const iconPath = wetSeverity === "none"
    ? resolveDrySeasonPhaseIcon(weatherMain, weatherDescription, weatherIconCode, owmData.sys?.sunrise, owmData.sys?.sunset)
    : resolveWetSeasonIconPath(weatherMain, weatherDescription, rain1hMm ?? undefined, rain3hMm ?? undefined);
  const manualDescription = buildAutoDescription(intensity, weatherDescription, isNight, wetSeverity);

  const { data: inserted, error: insertError } = await adminSupabaseDynamic
    .from("weather_logs")
    .insert({
      temperature,
      humidity,
      heat_index: Math.round(heatIndex),
      wind_speed: windSpeedKmh,
      weather_main: weatherMain,
      weather_description: weatherDescription,
      rain_1h_mm: rain1hMm,
      rain_3h_mm: rain3hMm,
      thunder,
      intensity,
      manual_description: manualDescription,
      icon_path: iconPath,
    })
    .select("recorded_at")
    .single();

  if (insertError) throw new Error(insertError.message);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  await adminSupabaseDynamic.from("weather_logs").delete().lt("recorded_at", cutoff.toISOString());

  return {
    ok: true,
    refreshed: true,
    recordedAt: inserted?.recorded_at ?? new Date().toISOString(),
    intensity,
    temperature,
    humidity,
    heatIndex: Math.round(heatIndex),
    windSpeed: windSpeedKmh,
    rain1hMm,
    rain3hMm,
    thunder,
  };
}