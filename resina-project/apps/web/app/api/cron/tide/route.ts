import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

type TideExtreme = {
  type: "high" | "low";
  height: number;
  time: string;
};

type TideHourlyEstimate = {
  hour: number;
  estimatedHeight: number;
  confidence: "high" | "medium" | "low";
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

function ruleOfTwelfths(lowPoint: number, highPoint: number, hoursIntoExtremes: number): number {
  const range = highPoint - lowPoint;
  const cycleHours = 6;
  const h = Math.min(Math.max(hoursIntoExtremes, 0), cycleHours);
  const ratios = [1 / 12, 2 / 12, 3 / 12, 3 / 12, 2 / 12, 1 / 12];

  let accumulated = 0;
  for (let i = 0; i < Math.floor(h); i += 1) {
    if (i < ratios.length) {
      accumulated += ratios[i];
    }
  }

  const fraction = h - Math.floor(h);
  if (Math.floor(h) < ratios.length) {
    accumulated += ratios[Math.floor(h)] * fraction;
  }

  return lowPoint + range * accumulated;
}

function findSurroundingExtremes(tideData: TideExtreme[], queryTime: Date): { low: TideExtreme; high: TideExtreme } | null {
  if (!tideData.length) {
    return null;
  }

  const sorted = [...tideData].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const queryMs = queryTime.getTime();

  let preceding = sorted[0];
  let following = sorted.find((entry) => new Date(entry.time).getTime() >= queryMs) ?? sorted[sorted.length - 1];

  for (const entry of sorted) {
    const entryMs = new Date(entry.time).getTime();
    if (entryMs <= queryMs) {
      preceding = entry;
    }
  }

  if (preceding.type === "low" && following.type === "high") {
    return { low: preceding, high: following };
  }

  if (preceding.type === "high" && following.type === "low") {
    return { low: following, high: preceding };
  }

  const low = sorted.filter((entry) => entry.type === "low")[0] ?? null;
  const high = sorted.filter((entry) => entry.type === "high")[0] ?? null;
  return low && high ? { low, high } : null;
}

function estimateTideHeight(tideData: TideExtreme[], queryTime: Date): number | null {
  const surrounding = findSurroundingExtremes(tideData, queryTime);
  if (!surrounding) {
    return null;
  }

  const { low, high } = surrounding;
  const hoursInto = (queryTime.getTime() - new Date(low.time).getTime()) / (60 * 60 * 1000);
  return ruleOfTwelfths(low.height, high.height, hoursInto);
}

function generateHourlyTideEstimates(tideData: TideExtreme[], predictionDate: string): TideHourlyEstimate[] {
  const estimates: TideHourlyEstimate[] = [];
  const [yearRaw, monthRaw, dayRaw] = predictionDate.split("-");
  const year = Number.parseInt(yearRaw ?? "", 10);
  const month = Number.parseInt(monthRaw ?? "", 10);
  const day = Number.parseInt(dayRaw ?? "", 10);

  if ([year, month, day].some((value) => Number.isNaN(value))) {
    return estimates;
  }

  const manilaOffsetHours = 8;
  for (let hour = 0; hour < 24; hour += 1) {
    const queryTimeUtcMs = Date.UTC(year, month - 1, day, hour, 0, 0) - manilaOffsetHours * 60 * 60 * 1000;
    const queryTime = new Date(queryTimeUtcMs);
    const height = estimateTideHeight(tideData, queryTime);

    if (height === null) {
      continue;
    }

    const distToNearest = Math.min(...tideData.map((e) => Math.abs(queryTime.getTime() - new Date(e.time).getTime()))) / (60 * 60 * 1000);
    let confidence: "high" | "medium" | "low" = "medium";
    if (distToNearest < 1) confidence = "high";
    if (distToNearest > 3) confidence = "low";

    estimates.push({
      hour,
      estimatedHeight: Math.round(height * 100) / 100,
      confidence,
    });
  }

  return estimates;
}

async function upsertHourlyRows(adminSupabase: ReturnType<typeof createAdminClient>, predictionDate: string, tideData: TideExtreme[]): Promise<number> {
  const hourly = generateHourlyTideEstimates(tideData, predictionDate);
  if (!hourly.length) {
    return 0;
  }

  const payload = hourly.map((entry) => ({
    prediction_date: predictionDate,
    hour_of_day: entry.hour,
    estimated_height: entry.estimatedHeight,
    confidence: entry.confidence,
  }));

  const { error } = await adminSupabase
    .from("tide_hourly")
    .upsert(payload, { onConflict: "prediction_date,hour_of_day" });

  if (error) {
    throw new Error(`Failed to upsert tide_hourly: ${error.message}`);
  }

  return payload.length;
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
      .select("prediction_date, tide_data")
      .eq("prediction_date", predictionDate)
      .maybeSingle();

    if (existing) {
      const { count: existingHourlyCount } = await adminSupabase
        .from("tide_hourly")
        .select("hour_of_day", { count: "exact", head: true })
        .eq("prediction_date", predictionDate);

      let hourlyUpserted = 0;
      if ((existingHourlyCount ?? 0) < 24) {
        const existingTideData = Array.isArray(existing.tide_data)
          ? (existing.tide_data as TideExtreme[])
              .filter((event) => typeof event?.time === "string" && Number.isFinite(Number(event?.height)))
              .map((event): TideExtreme => ({
                type: event.type === "high" ? "high" : "low",
                height: Number(event.height),
                time: event.time,
              }))
          : [];

        if (existingTideData.length) {
          hourlyUpserted = await upsertHourlyRows(adminSupabase, predictionDate, existingTideData);
        }
      }

      return NextResponse.json({
        ok: true,
        predictionDate,
        source: "cache",
        hourlyUpserted,
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
          .map((event): TideExtreme => ({
            type: event.type === "high" ? "high" : "low",
            height: Number(event.height),
            time: typeof event.time === "string" ? event.time : "",
          }))
          .filter((event): event is TideExtreme => Boolean(event.time) && Number.isFinite(event.height))
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

    const hourlyUpserted = await upsertHourlyRows(adminSupabase, predictionDate, tideData);

    return NextResponse.json({
      ok: true,
      predictionDate,
      source: "stormglass",
      events: tideData.length,
      hourlyUpserted,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown tide cron error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
