import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { getManilaDate } from "../../../../../api/src/utils/date";

export async function GET() {
  try {
    const admin = createAdminClient();

    const today = getManilaDate();
    const { data: predictionRow, error: predictionError } = await (admin as any)
      .from("tide_predictions")
      .select("prediction_date, tide_data")
      .lte("prediction_date", today)
      .order("prediction_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (predictionError) return NextResponse.json({ error: predictionError.message }, { status: 500 });
    if (!predictionRow) return NextResponse.json({ error: "No tide predictions found" }, { status: 404 });

    const predictionDate = predictionRow.prediction_date;

    const { data: hourlyRows, error: hourlyError } = await (admin as any)
      .from("tide_hourly")
      .select("hour_of_day, estimated_height, confidence")
      .eq("prediction_date", predictionDate)
      .order("hour_of_day", { ascending: true });

    if (hourlyError) return NextResponse.json({ error: hourlyError.message }, { status: 500 });

    // Estimate current hour in Manila
    const manilaNow = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });
    const manilaHour = new Date(manilaNow).getHours();

    const currentHourly = Array.isArray(hourlyRows) ? hourlyRows.find((r: any) => Number(r.hour_of_day) === manilaHour) : null;

    const payload = {
      date: predictionDate,
      current: {
        currentHeight: currentHourly ? Number(currentHourly.estimated_height) : null,
        state: null,
      },
      extremes: Array.isArray(predictionRow.tide_data)
        ? predictionRow.tide_data.map((e: any) => ({ type: e.type, time: e.time, height: Number(e.height) }))
        : [],
    };

    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
