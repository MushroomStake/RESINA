import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import { dispatchSensorAlertFromSnapshot } from "../../../lib/sensor-alert-dispatch";
import type { SensorSnapshot } from "../../../lib/sensor-alerts";

type SensorReadingRequestBody = {
  waterLevel?: number | string;
  water_level?: number | string;
  status?: string;
  readingDate?: string;
  reading_date?: string;
  readingTime?: string;
  reading_time?: string;
  createdAt?: string;
  created_at?: string;
  deviceId?: string;
  device_id?: string;
  deviceTs?: number | string;
  device_ts?: number | string;
  sourceDeviceId?: string;
  source_device_id?: string;
  metadata?: Record<string, unknown>;
};

type SensorReadingRow = {
  id: string | number;
  water_level: number | string | null;
  status: string | null;
  reading_date: string | null;
  reading_time: string | null;
  created_at: string | null;
};

function resolveIngestSecretStatus(request: NextRequest): NextResponse | null {
  const ingestSecret = process.env.SENSOR_INGEST_SECRET;
  if (!ingestSecret) {
    return NextResponse.json({ error: "SENSOR_INGEST_SECRET is not configured." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${ingestSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return null;
}

function resolveDatePart(dateValue: string | undefined): string {
  if (dateValue && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function resolveTimePart(timeValue: string | undefined): string {
  if (timeValue && /^\d{2}:\d{2}(:\d{2})?$/.test(timeValue)) {
    return timeValue;
  }

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

function parseWaterLevel(value: number | string | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDeviceTimestamp(value: number | string | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeReadingText(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeHardwareStatus(value: string | undefined): string | null {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }

  const normalized = text.toLowerCase();

  if (normalized.includes("no water")) {
    return "No Water";
  }

  if (normalized.includes("spilling")) {
    return "Spilling Level";
  }

  if (normalized.includes("evac")) {
    return "Evacuation Level";
  }

  if (normalized.includes("critical") || normalized.includes("alert level 2") || normalized.includes("alert 2")) {
    return "Critical Level";
  }

  if (normalized.includes("normal") || normalized.includes("alert level 1") || normalized.includes("alert 1")) {
    return "Normal Level";
  }

  return text;
}

function isDuplicateReading(
  latestRow: SensorReadingRow | null,
  waterLevel: number,
  status: string,
  readingDate: string,
  readingTime: string,
  deviceTimestamp: number | null,
): boolean {
  if (!latestRow) {
    return false;
  }

  const latestWaterLevel = parseWaterLevel(latestRow.water_level ?? undefined);
  if (latestWaterLevel === null || Math.abs(latestWaterLevel - waterLevel) > 0.001) {
    return false;
  }

  if (normalizeReadingText(latestRow.status) !== normalizeReadingText(status)) {
    return false;
  }

  const latestReadingDate = String(latestRow.reading_date ?? "").trim();
  const latestReadingTime = String(latestRow.reading_time ?? "").trim();
  if (latestReadingDate !== readingDate || latestReadingTime !== readingTime) {
    return false;
  }

  const latestCreatedAt = latestRow.created_at ? new Date(latestRow.created_at).getTime() : Number.NaN;
  if (Number.isFinite(latestCreatedAt) && Math.abs(Date.now() - latestCreatedAt) <= 15_000) {
    return true;
  }

  if (deviceTimestamp !== null && Number.isFinite(deviceTimestamp) && Number.isFinite(latestCreatedAt)) {
    const deviceLag = Math.abs(Date.now() - deviceTimestamp);
    const createdAtLag = Math.abs(Date.now() - latestCreatedAt);

    return deviceLag <= 30_000 && createdAtLag <= 30_000;
  }

  return false;
}

function normalizeStatus(value: string | undefined, waterLevel: number | null): string {
  const hardwareStatus = normalizeHardwareStatus(value);
  if (hardwareStatus) {
    return hardwareStatus;
  }

  if (waterLevel === null) {
    return "Unknown";
  }

  if (waterLevel <= 0.001) {
    return "No Water";
  }

  if (waterLevel >= 4) {
    return "Spilling Level";
  }

  if (waterLevel >= 3) {
    return "Evacuation Level";
  }

  if (waterLevel >= 2.5) {
    return "Critical Level";
  }

  return "Normal Level";
}

function resolveReadingTimestamp(body: SensorReadingRequestBody, fallbackTimestamp: string): string {
  const providedTimestamp = body.createdAt ?? body.created_at;
  if (providedTimestamp && !Number.isNaN(new Date(providedTimestamp).getTime())) {
    return providedTimestamp;
  }

  const readingDate = resolveDatePart(body.readingDate ?? body.reading_date);
  const readingTime = resolveTimePart(body.readingTime ?? body.reading_time);
  const combinedTimestamp = new Date(`${readingDate}T${readingTime}+08:00`);

  if (!Number.isNaN(combinedTimestamp.getTime())) {
    return combinedTimestamp.toISOString();
  }

  return fallbackTimestamp;
}

export async function POST(request: NextRequest) {
  const authErrorResponse = resolveIngestSecretStatus(request);
  if (authErrorResponse) {
    return authErrorResponse;
  }

  try {
    const body = (await request.json()) as SensorReadingRequestBody;
    const waterLevel = parseWaterLevel(body.waterLevel ?? body.water_level);
    const deviceTimestamp = parseDeviceTimestamp(body.deviceTs ?? body.device_ts);

    if (waterLevel === null) {
      return NextResponse.json({ error: "waterLevel is required and must be numeric." }, { status: 400 });
    }

    const status = normalizeStatus(body.status, waterLevel);
    const readingDate = resolveDatePart(body.readingDate ?? body.reading_date);
    const readingTime = resolveTimePart(body.readingTime ?? body.reading_time);

    const adminSupabase = createAdminClient();
    const adminSupabaseDynamic = adminSupabase as any;

    const { data: latestRow, error: latestRowError } = await adminSupabaseDynamic
      .from("sensor_readings")
      .select("id, water_level, status, reading_date, reading_time, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestRowError) {
      return NextResponse.json(
        { error: latestRowError.message ?? "Failed to check for duplicate sensor readings." },
        { status: 500 },
      );
    }

    if (isDuplicateReading(latestRow as SensorReadingRow | null, waterLevel, status, readingDate, readingTime, deviceTimestamp)) {
      return NextResponse.json(
        {
          ok: true,
          skipped: true,
          reason: "Duplicate reading already recorded.",
          reading: latestRow,
          sourceDeviceId: body.deviceId ?? body.device_id ?? body.sourceDeviceId ?? body.source_device_id ?? null,
          deviceTs: deviceTimestamp,
          metadata: body.metadata ?? null,
        },
        { status: 200 },
      );
    }

    const insertPayload = {
      water_level: waterLevel,
      status,
      reading_date: readingDate,
      reading_time: readingTime,
    };

    const { data: insertedRow, error: insertError } = await adminSupabaseDynamic
      .from("sensor_readings")
      .insert(insertPayload)
      .select("id, water_level, status, reading_date, reading_time, created_at")
      .single();

    if (insertError || !insertedRow) {
      return NextResponse.json(
        { error: insertError?.message ?? "Failed to save sensor reading." },
        { status: 500 },
      );
    }

    const sensorSnapshot: SensorSnapshot = {
      waterLevel: Number(insertedRow.water_level),
      statusText: insertedRow.status,
      updatedAt: resolveReadingTimestamp(body, insertedRow.created_at),
      sourceTable: "sensor_readings",
      recordId: String(insertedRow.id),
    };

    // Prevent dispatch for zero readings reported as Normal to avoid noisy SMS.
    const wl = typeof sensorSnapshot.waterLevel === "number" ? sensorSnapshot.waterLevel : Number(sensorSnapshot.waterLevel ?? NaN);
    if (!Number.isNaN(wl) && Math.abs(wl) < 0.001 && String(sensorSnapshot.statusText ?? "").toLowerCase().includes("normal")) {
      const skippedResult = {
        ok: true,
        alertLevel: "normal",
        alertLevelName: "Normal Level",
        alertLevelBadge: "Alert Level 1",
        sent: 0,
        failed: 0,
        skipped: true,
        reason: "Reading is 0.00m and status is Normal; skipping SMS.",
        sourceTable: sensorSnapshot.sourceTable,
        recordId: sensorSnapshot.recordId,
      };

      return NextResponse.json(
        {
          ok: true,
          reading: insertedRow,
          alert: skippedResult,
          sourceDeviceId: body.sourceDeviceId ?? body.source_device_id ?? null,
          metadata: body.metadata ?? null,
        },
        { status: 201 },
      );
    }

    const alertResult = await dispatchSensorAlertFromSnapshot(adminSupabase, sensorSnapshot);

    return NextResponse.json(
      {
        ok: true,
        reading: insertedRow,
        alert: alertResult,
        sourceDeviceId: body.sourceDeviceId ?? body.source_device_id ?? null,
        metadata: body.metadata ?? null,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sensor ingest error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}