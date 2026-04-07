import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

type TideExtreme = {
  type: "high" | "low";
  height: number;
  time: string;
};

function getManilaDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to resolve Manila date");
  }

  return `${year}-${month}-${day}`;
}

function toStormGlassWindow(predictionDate: string): { startIso: string; endIso: string } {
  const [yearRaw, monthRaw, dayRaw] = predictionDate.split("-");
  const year = Number.parseInt(yearRaw ?? "", 10);
  const month = Number.parseInt(monthRaw ?? "", 10);
  const day = Number.parseInt(dayRaw ?? "", 10);

  if ([year, month, day].some((value) => Number.isNaN(value))) {
    throw new Error(`Invalid prediction date: ${predictionDate}`);
  }

  const manilaOffsetHours = 8;
  const startUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0) - manilaOffsetHours * 60 * 60 * 1000;
  const endUtcMs = startUtcMs + (24 * 60 * 60 * 1000 - 1000);

  // Add buffer on both ends so events around midnight are not missed.
  const bufferMs = 12 * 60 * 60 * 1000;

  return {
    startIso: new Date(startUtcMs - bufferMs).toISOString(),
    endIso: new Date(endUtcMs + bufferMs).toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const stormGlassApiKey = process.env.STORMGLASS_API_KEY;
  if (!stormGlassApiKey) {
    return NextResponse.json({ error: "STORMGLASS_API_KEY is not configured." }, { status: 500 });
  }

  try {
    const predictionDate = getManilaDate();
    const adminSupabase = createAdminClient();

    const { data: existing } = await adminSupabase
      .from("tide_predictions")
      .select("prediction_date")
      .eq("prediction_date", predictionDate)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        ok: true,
        predictionDate,
        source: "cache",
      });
    }

    const { startIso, endIso } = toStormGlassWindow(predictionDate);
    const params = new URLSearchParams({
      lat: "14.356",
      lng: "120.283",
      start: startIso,
      end: endIso,
    });

    const stormResponse = await fetch(`https://api.stormglass.io/v2/tide/extremes/point?${params}`, {
      headers: { Authorization: stormGlassApiKey },
      cache: "no-store",
    });

    if (!stormResponse.ok) {
      const details = await stormResponse.text();
      return NextResponse.json(
        { error: `StormGlass request failed (${stormResponse.status}): ${details}` },
        { status: 502 },
      );
    }

    const stormData = (await stormResponse.json()) as { data?: Array<Partial<TideExtreme>> };
    const tideData: TideExtreme[] = Array.isArray(stormData.data)
      ? stormData.data
          .map((event) => ({
            type: event.type === "high" ? "high" : "low",
            height: Number(event.height),
            time: typeof event.time === "string" ? event.time : "",
          }))
          .filter((event) => event.time && Number.isFinite(event.height))
      : [];

    if (!tideData.length) {
      return NextResponse.json(
        { error: "StormGlass returned no valid tide events." },
        { status: 502 },
      );
    }

    const { error: upsertError } = await adminSupabase.from("tide_predictions").upsert(
      {
        prediction_date: predictionDate,
        tide_data: tideData,
        fetched_at: new Date().toISOString(),
        api_credit_used: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "prediction_date" },
    );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      predictionDate,
      source: "stormglass",
      events: tideData.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown tide cron error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
