import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data, error } = await (admin as any)
      .from("sensor_readings")
      .select("water_level, status, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "No sensor readings found" }, { status: 404 });
    }

    const payload = {
      current: {
        waterLevel: data.water_level === null ? null : Number(data.water_level),
        statusLabel: data.status ?? "Unknown",
        updatedAt: data.created_at ?? null,
      },
    };

    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
