import { NextResponse } from "next/server";
import { refreshWeather } from "../../../../lib/weather-refresh";

export async function POST() {
  try {
    return NextResponse.json(await refreshWeather());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Weather refresh failed." }, { status: 500 });
  }
}