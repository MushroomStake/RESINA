import { NextRequest, NextResponse } from "next/server";
import { refreshWeather } from "../../../../lib/weather-refresh";

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

  try {
    return NextResponse.json(await refreshWeather());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Weather refresh failed." }, { status: 500 });
  }
}
