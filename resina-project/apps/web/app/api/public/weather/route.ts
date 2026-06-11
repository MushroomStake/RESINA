import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data, error } = await (admin as any)
      .from("weather_logs")
      .select(
        "recorded_at, temperature, humidity, heat_index, wind_speed, intensity, manual_description, weather_main, weather_description, icon_path",
      )
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "No weather logs found" }, { status: 404 });

    const payload = {
      current: {
        temperature: Number(data.temperature ?? null),
        humidity: Number(data.humidity ?? null),
        heatIndex: Number(data.heat_index ?? null),
        windSpeed: Number(data.wind_speed ?? null),
        intensityDescription: data.intensity ?? null,
        manualDescription: data.manual_description ?? null,
        owmMain: data.weather_main ?? null,
        owmDescription: data.weather_description ?? null,
        iconPath: data.icon_path ?? null,
        updatedAt: data.recorded_at ?? null,
      },
    };

    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
