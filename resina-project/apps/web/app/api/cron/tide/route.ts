import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { getManilaDate } from "../../../../lib/date";
import { generateHourlyTideEstimates } from "../../../../../api/src/services/tide-interpolation";
import { fetchTideForPredictionDate } from "../../../../../api/src/services/stormglass.service";

type TideExtreme = {
  type: "high" | "low";
  height: number;
  time: string;
};


async function upsertHourlyRows(adminSupabase: ReturnType<typeof createAdminClient>, predictionDate: string, tideData: TideExtreme[]): Promise<number> {
  const adminSupabaseDynamic = adminSupabase as any;
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

  const { error } = await adminSupabaseDynamic
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

  try {
    const predictionDate = getManilaDate();
    const adminSupabase = createAdminClient();
    const adminSupabaseDynamic = adminSupabase as any;

    const { data: existing } = await adminSupabaseDynamic
      .from("tide_predictions")
      .select("prediction_date, tide_data")
      .eq("prediction_date", predictionDate)
      .maybeSingle();

    if (existing) {
      const { count: existingHourlyCount } = await adminSupabaseDynamic
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

    const tideData = (await fetchTideForPredictionDate(predictionDate)) ?? [];

    if (!tideData.length) {
      return NextResponse.json(
        { error: "StormGlass returned no valid tide events." },
        { status: 502 },
      );
    }

    const { error: upsertError } = await adminSupabaseDynamic.from("tide_predictions").upsert(
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
