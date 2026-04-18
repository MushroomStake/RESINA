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
  sourceDeviceId?: string;
  source_device_id?: string;
  metadata?: Record<string, unknown>;
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

function normalizeStatus(value: string | undefined, waterLevel: number | null): string {
  if (value && value.trim()) {
    return value.trim();
  }

  if (waterLevel === null) {
    return "Unknown";
  }

  if (waterLevel >= 4) {
    return "Spilling";
  }

  if (waterLevel >= 3) {
    return "Evacuation";
  }

  if (waterLevel >= 2.5) {
    return "Critical";
  }

  return "Normal";
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

    if (waterLevel === null) {
      return NextResponse.json({ error: "waterLevel is required and must be numeric." }, { status: 400 });
    }

    const status = normalizeStatus(body.status, waterLevel);
    const readingDate = resolveDatePart(body.readingDate ?? body.reading_date);
    const readingTime = resolveTimePart(body.readingTime ?? body.reading_time);

    const adminSupabase = createAdminClient();
    const adminSupabaseDynamic = adminSupabase as any;

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