import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { buildWaterTrendFromRows } from "../../../../lib/sensor-trend";

function resolveDeviceStatusLabel(status: unknown): string {
  return String(status ?? "inactive").toLowerCase() === "active" ? "Active" : "Inactive";
}

type StatusCheckRow = {
  device_id: string;
  status: string;
  last_seen: string;
};

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data: latestRows, error: rowsError } = await (admin as any)
      .from("sensor_readings")
      .select("water_level, status, created_at")
      .order("created_at", { ascending: false })
      .limit(2);

    const { data: statusData } = await admin
      .from("status_check")
      .select("device_id, status, last_seen")
      .order("last_seen", { ascending: false })
      .limit(1)
      .maybeSingle<StatusCheckRow>();

    if (rowsError && !statusData) {
      return NextResponse.json({ error: rowsError.message }, { status: 500 });
    }

    const latest = latestRows?.[0] ?? null;
    const trend = buildWaterTrendFromRows(latestRows ?? []);

    const payload = {
      current: {
        waterLevel: latest?.water_level === null || latest?.water_level === undefined ? null : Number(latest.water_level),
        statusLabel: latest?.status ?? "Unknown",
        updatedAt: latest?.created_at ?? null,
        deviceStatusLabel: resolveDeviceStatusLabel(statusData?.status),
        deviceId: statusData?.device_id ?? null,
        deviceLastSeen: statusData?.last_seen ?? null,
        trendDirection: trend.direction,
        trendMessage: trend.message,
        nextThreshold: trend.nextThreshold,
      },
    };

    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
