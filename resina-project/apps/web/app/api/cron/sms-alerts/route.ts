import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import {
  buildSensorAlertMessage,
  formatAlertLevelBadge,
  formatAlertLevelName,
  inferAlertLevel,
  isAlertLevelCriticalOrAbove,
  type SensorSnapshot,
} from "../../../../lib/sensor-alerts";
import { isUnismsDisabled, sendUnismsSms } from "../../../../lib/unisms";

type SensorSource = {
  table: string;
  orderBy: string;
};

type RecipientRow = {
  id: string;
  phone_number: string | null;
};

type DispatchRecord = {
  status: string;
  source_table: string;
  source_record_id: string;
  payload: Record<string, unknown> | null;
};

const SENSOR_SOURCES: SensorSource[] = [
  { table: "sensor_readings", orderBy: "created_at" },
  { table: "sensor_status", orderBy: "created_at" },
  { table: "water_levels", orderBy: "created_at" },
  { table: "sensor_logs", orderBy: "timestamp" },
];

function resolveCronSecretStatus(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return null;
}

function normalizePhoneNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const digitsOnly = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+63") && /^\+639\d{9}$/.test(trimmed)) {
    return trimmed;
  }

  if (digitsOnly.startsWith("63") && digitsOnly.length === 12) {
    return `+${digitsOnly}`;
  }

  if (digitsOnly.startsWith("0") && digitsOnly.length === 11) {
    return `+63${digitsOnly.slice(1)}`;
  }

  if (digitsOnly.length === 10) {
    return `+63${digitsOnly}`;
  }

  return null;
}

async function loadLatestSensorSnapshot(adminSupabase: ReturnType<typeof createAdminClient>): Promise<SensorSnapshot | null> {
  const adminSupabaseDynamic = adminSupabase as any;

  for (const source of SENSOR_SOURCES) {
    const { data: rows, error } = await adminSupabaseDynamic
      .from(source.table)
      .select("*")
      .order(source.orderBy, { ascending: false })
      .limit(1);

    if (error || !rows || rows.length === 0) {
      continue;
    }

    const row = rows[0] as Record<string, unknown>;
    const waterLevel = Number(
      row.water_level ?? row.level ?? row.sensor_level ?? row.reading ?? row.value ?? Number.NaN,
    );
    const statusText = (row.status ?? row.level_status ?? row.alert_status ?? row.alert_level ?? null) as string | null;
    const updatedAt = (row.created_at ?? row.timestamp ?? row.recorded_at ?? null) as string | null;

    return {
      waterLevel: Number.isNaN(waterLevel) ? null : waterLevel,
      statusText,
      updatedAt,
      sourceTable: source.table,
      recordId: String(row.id ?? row.created_at ?? row.timestamp ?? row.recorded_at ?? `${source.table}-latest`),
    };
  }

  return null;
}

async function loadRecipients(adminSupabase: ReturnType<typeof createAdminClient>): Promise<Array<{ id: string; phoneNumber: string }>> {
  const adminSupabaseDynamic = adminSupabase as any;
  const { data, error } = await adminSupabaseDynamic
    .from("profiles")
    .select("id, phone_number")
    .not("phone_number", "is", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load recipients: ${error.message}`);
  }

  const rows = (data ?? []) as RecipientRow[];
  const recipients = rows
    .map((row) => {
      const normalizedPhoneNumber = normalizePhoneNumber(String(row.phone_number ?? ""));
      return normalizedPhoneNumber ? { id: row.id, phoneNumber: normalizedPhoneNumber } : null;
    })
    .filter((entry): entry is { id: string; phoneNumber: string } => entry !== null);

  const seen = new Set<string>();
  return recipients.filter((recipient) => {
    if (seen.has(recipient.phoneNumber)) {
      return false;
    }

    seen.add(recipient.phoneNumber);
    return true;
  });
}

async function loadDispatchRecord(
  adminSupabase: ReturnType<typeof createAdminClient>,
  snapshot: SensorSnapshot,
): Promise<DispatchRecord | null> {
  const adminSupabaseDynamic = adminSupabase as any;
  const { data, error } = await adminSupabaseDynamic
    .from("sms_alert_dispatches")
    .select("status, source_table, source_record_id, payload")
    .eq("source_table", snapshot.sourceTable)
    .eq("source_record_id", snapshot.recordId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load SMS dispatch state: ${error.message}`);
  }

  return (data ?? null) as DispatchRecord | null;
}

function extractDeliveredPhoneNumbers(payload: Record<string, unknown> | null): Set<string> {
  const delivered = payload?.delivered;
  if (!Array.isArray(delivered)) {
    return new Set();
  }

  return new Set(
    delivered
      .map((entry) => {
        if (!entry || typeof entry !== "object") {
          return null;
        }

        const candidate = (entry as { phoneNumber?: unknown }).phoneNumber;
        return typeof candidate === "string" ? candidate : null;
      })
      .filter((phoneNumber): phoneNumber is string => phoneNumber !== null),
  );
}

async function upsertDispatchRecord(
  adminSupabase: ReturnType<typeof createAdminClient>,
  payload: {
    sourceTable: string;
    sourceRecordId: string;
    alertLevel: string;
    status: string;
    recipientCount: number;
    providerMessageId: string | null;
    errorMessage: string | null;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  const adminSupabaseDynamic = adminSupabase as any;
  const { error } = await adminSupabaseDynamic
    .from("sms_alert_dispatches")
    .upsert(
      {
        provider: "unisms",
        source_table: payload.sourceTable,
        source_record_id: payload.sourceRecordId,
        alert_level: payload.alertLevel,
        status: payload.status,
        recipient_count: payload.recipientCount,
        provider_message_id: payload.providerMessageId,
        error_message: payload.errorMessage,
        payload: payload.payload,
        sent_at: payload.status === "sent" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "source_table,source_record_id" },
    );

  if (error) {
    throw new Error(`Failed to record SMS dispatch: ${error.message}`);
  }
}

export async function GET(request: NextRequest) {
  const authErrorResponse = resolveCronSecretStatus(request);
  if (authErrorResponse) {
    return authErrorResponse;
  }

  try {
    const adminSupabase = createAdminClient();
    const snapshot = await loadLatestSensorSnapshot(adminSupabase);

    if (!snapshot) {
      return NextResponse.json({ ok: true, sent: 0, reason: "No sensor rows found." });
    }

    const alertLevel = inferAlertLevel(snapshot);
    if (!isAlertLevelCriticalOrAbove(alertLevel)) {
      return NextResponse.json({
        ok: true,
        sent: 0,
        alertLevel,
        alertLevelName: formatAlertLevelName(alertLevel),
        alertLevelBadge: formatAlertLevelBadge(alertLevel),
        reason: "Latest reading is below the SMS threshold.",
      });
    }

    const existingDispatch = await loadDispatchRecord(adminSupabase, snapshot);
    if (existingDispatch?.status === "sent") {
      return NextResponse.json({
        ok: true,
        sent: 0,
        skipped: true,
        reason: "This reading was already sent.",
        alertLevel,
        alertLevelName: formatAlertLevelName(alertLevel),
        alertLevelBadge: formatAlertLevelBadge(alertLevel),
      });
    }

    const alreadyDeliveredNumbers = extractDeliveredPhoneNumbers(existingDispatch?.payload ?? null);

    if (isUnismsDisabled()) {
      return NextResponse.json({
        ok: true,
        sent: 0,
        disabled: true,
        alertLevel,
        alertLevelName: formatAlertLevelName(alertLevel),
        alertLevelBadge: formatAlertLevelBadge(alertLevel),
        previewMessage: buildSensorAlertMessage(snapshot),
      });
    }

    const recipients = await loadRecipients(adminSupabase);
    const pendingRecipients = recipients.filter((recipient) => !alreadyDeliveredNumbers.has(recipient.phoneNumber));

    if (recipients.length === 0) {
      return NextResponse.json({
        ok: true,
        sent: 0,
        reason: "No recipient phone numbers were found.",
        alertLevel,
        alertLevelName: formatAlertLevelName(alertLevel),
        alertLevelBadge: formatAlertLevelBadge(alertLevel),
      });
    }

    if (pendingRecipients.length === 0) {
      if (existingDispatch && existingDispatch.status !== "sent") {
        await upsertDispatchRecord(adminSupabase, {
          sourceTable: snapshot.sourceTable ?? "sensor_readings",
          sourceRecordId: snapshot.recordId,
          alertLevel,
          status: "sent",
          recipientCount: recipients.length,
          providerMessageId: null,
          errorMessage: null,
          payload: existingDispatch.payload ?? {},
        });
      }

      return NextResponse.json({
        ok: true,
        sent: 0,
        skipped: true,
        reason: "All recipients already received this reading.",
        alertLevel,
        alertLevelName: formatAlertLevelName(alertLevel),
        alertLevelBadge: formatAlertLevelBadge(alertLevel),
      });
    }

    const message = buildSensorAlertMessage(snapshot);
    const delivered: Array<{ phoneNumber: string; messageId: string | null }> = [];
    const failed: Array<{ phoneNumber: string; error: string }> = [];

    for (const recipient of pendingRecipients) {
      try {
        const { messageId } = await sendUnismsSms({
          phoneNumber: recipient.phoneNumber,
          message,
        });
        delivered.push({ phoneNumber: recipient.phoneNumber, messageId });
      } catch (error) {
        failed.push({
          phoneNumber: recipient.phoneNumber,
          error: error instanceof Error ? error.message : "Failed to send SMS.",
        });
      }
    }

    await upsertDispatchRecord(adminSupabase, {
      sourceTable: snapshot.sourceTable ?? "sensor_readings",
      sourceRecordId: snapshot.recordId,
      alertLevel,
      status: failed.length === 0 ? "sent" : "partial",
      recipientCount: recipients.length,
      providerMessageId: delivered[0]?.messageId ?? null,
      errorMessage: failed.length > 0 ? failed[0]?.error ?? "One or more SMS messages failed." : null,
      payload: {
        alertLevel,
        message,
        recipients: recipients.map((recipient) => recipient.phoneNumber),
        pendingRecipients: pendingRecipients.map((recipient) => recipient.phoneNumber),
        delivered,
        failed,
      },
    });

    return NextResponse.json({
      ok: true,
      alertLevel,
      alertLevelName: formatAlertLevelName(alertLevel),
      alertLevelBadge: formatAlertLevelBadge(alertLevel),
      sent: delivered.length,
      failed: failed.length,
      sourceTable: snapshot.sourceTable,
      recordId: snapshot.recordId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown SMS alert error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}