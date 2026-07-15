import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

function resolveDeviceStatusLabel(status: unknown): string {
  return String(status ?? "inactive").toLowerCase() === "active" ? "Active" : "Inactive";
}

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data, error } = await (admin as any)
      .from("sensor_readings")
      .select("water_level, status, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: statusData } = await admin
      .from("status_check")
      .select("device_id, status, last_seen")
      .order("last_seen", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && !statusData) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const payload = {
      current: {
        waterLevel: data?.water_level === null || data?.water_level === undefined ? null : Number(data.water_level),
        statusLabel: data?.status ?? "Unknown",
        updatedAt: data?.created_at ?? null,
        deviceStatusLabel: resolveDeviceStatusLabel(statusData?.status),
        deviceId: statusData?.device_id ?? null,
        deviceLastSeen: statusData?.last_seen ?? null,
      },
    };

    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
