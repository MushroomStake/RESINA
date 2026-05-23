import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
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
} from "../../../../lib/weather";

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

  const openWeatherApiKey = process.env.OPENWEATHER_API_KEY;
  if (!openWeatherApiKey) {
    return NextResponse.json({ error: "OpenWeather API key is not configured." }, { status: 500 });
  }

  // 1. Fetch current weather from OpenWeatherMap.
  const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=Olongapo,PH&units=metric&appid=${encodeURIComponent(openWeatherApiKey)}`;
  const owmResponse = await fetch(weatherUrl, {
    cache: "no-store",
  });

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
    wind?: { speed?: number };
    rain?: { [key: string]: number };
    snow?: { [key: string]: number };
  };

  const temperature = Math.round(owmData.main?.temp ?? 25);
  const humidity = Math.round(owmData.main?.humidity ?? 60);
  const windSpeedMs = Number(owmData.wind?.speed ?? 0);
  const windSpeedKmh = Math.round(windSpeedMs * 3.6);
  const weatherMain = owmData.weather?.[0]?.main ?? "Clear";
  const weatherDescription = owmData.weather?.[0]?.description ?? "";
  const weatherIconCode = owmData.weather?.[0]?.icon ?? "01d";
  const rain1hMm = typeof owmData.rain?.["1h"] === "number" ? owmData.rain?.["1h"] : null;
  const rain3hMm = typeof owmData.rain?.["3h"] === "number" ? owmData.rain?.["3h"] : null;
  const thunder = resolveThunderFlag(weatherMain, weatherDescription);

  const wetSeverity = inferWetSeverity(weatherMain, weatherDescription, rain1hMm ?? undefined, rain3hMm ?? undefined);
  const isNight = resolveIsNight(weatherIconCode, owmData.sys?.sunrise, owmData.sys?.sunset);
  const heatIndex = computeHeatIndexC(temperature, humidity);
  const heatSeverity = isNight ? "normal" : resolveHeatSeverity(heatIndex);
  const intensity = resolveIntensityLabel(wetSeverity, heatSeverity);
  const iconPath =
    wetSeverity === "none"
      ? resolveDrySeasonPhaseIcon(
          weatherMain,
          weatherDescription,
          weatherIconCode,
          owmData.sys?.sunrise,
          owmData.sys?.sunset,
        )
      : resolveWetSeasonIconPath(weatherMain, weatherDescription, rain1hMm ?? undefined, rain3hMm ?? undefined);
  const manualDescription = buildAutoDescription(intensity, weatherDescription, isNight, wetSeverity);

  // 2. Save a new row to weather_logs using the service-role key (bypasses RLS).
  const adminSupabase = createAdminClient();
  const adminSupabaseDynamic = adminSupabase as any;

  const { error: insertError } = await adminSupabaseDynamic.from("weather_logs").insert({
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
  }, { returning: 'minimal' });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // 3. Prune records older than 60 days to keep the table lean.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  await adminSupabaseDynamic.from("weather_logs").delete().lt("recorded_at", cutoff.toISOString());

  return NextResponse.json({
    ok: true,
    intensity,
    temperature,
    humidity,
    heatIndex: Math.round(heatIndex),
    windSpeed: windSpeedKmh,
    rain1hMm,
    rain3hMm,
    thunder,
  });
}
