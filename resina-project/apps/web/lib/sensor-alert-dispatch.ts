import { createAdminClient } from "./supabase/admin";
import { buildSensorAlertMessage, formatAlertLevelBadge, formatAlertLevelName, inferAlertLevel, isAlertLevelCriticalOrAbove, type SensorSnapshot } from "./sensor-alerts";
import { isUnismsDisabled, sendUnismsBlast } from "./unisms";

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
    .eq("source_table", snapshot.sourceTable ?? "sensor_readings")
    .eq("source_record_id", snapshot.recordId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load SMS dispatch state: ${error.message}`);
  }

  return (data ?? null) as DispatchRecord | null;
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

export type SensorAlertDispatchResult = {
  ok: boolean;
  alertLevel: ReturnType<typeof inferAlertLevel>;
  alertLevelName: string;
  alertLevelBadge: string;
  sent: number;
  failed: number;
  skipped?: boolean;
  disabled?: boolean;
  reason?: string;
  previewMessage?: string;
  sourceTable: string | null;
  recordId: string;
};

export async function dispatchSensorAlertFromSnapshot(
  adminSupabase: ReturnType<typeof createAdminClient>,
  snapshot: SensorSnapshot,
): Promise<SensorAlertDispatchResult> {
  const alertLevel = inferAlertLevel(snapshot);
  const alertLevelName = formatAlertLevelName(alertLevel);
  const alertLevelBadge = formatAlertLevelBadge(alertLevel);

  if (!isAlertLevelCriticalOrAbove(alertLevel)) {
    return {
      ok: true,
      alertLevel,
      alertLevelName,
      alertLevelBadge,
      sent: 0,
      failed: 0,
      reason: "Latest reading is below the SMS threshold.",
      sourceTable: snapshot.sourceTable,
      recordId: snapshot.recordId,
    };
  }

  const existingDispatch = await loadDispatchRecord(adminSupabase, snapshot);
  if (existingDispatch?.status === "sent") {
    return {
      ok: true,
      alertLevel,
      alertLevelName,
      alertLevelBadge,
      sent: 0,
      failed: 0,
      skipped: true,
      reason: "This reading was already sent.",
      sourceTable: snapshot.sourceTable,
      recordId: snapshot.recordId,
    };
  }

  const recipients = await loadRecipients(adminSupabase);
  if (recipients.length === 0) {
    return {
      ok: true,
      alertLevel,
      alertLevelName,
      alertLevelBadge,
      sent: 0,
      failed: 0,
      reason: "No recipient phone numbers were found.",
      sourceTable: snapshot.sourceTable,
      recordId: snapshot.recordId,
    };
  }

  const message = buildSensorAlertMessage(snapshot);

  if (isUnismsDisabled()) {
    return {
      ok: true,
      alertLevel,
      alertLevelName,
      alertLevelBadge,
      sent: 0,
      failed: 0,
      disabled: true,
      previewMessage: message,
      sourceTable: snapshot.sourceTable,
      recordId: snapshot.recordId,
    };
  }

  const phoneNumbers = recipients.map((recipient) => recipient.phoneNumber);
  const delivered: Array<{ phoneNumber: string; messageId: string | null }> = [];
  let blastId: string | null = null;
  let errorMessage: string | null = null;

  try {
    const result = await sendUnismsBlast({
      phoneNumbers,
      message,
    });
    blastId = result.blastId;
    delivered.push(...phoneNumbers.map((phoneNumber) => ({ phoneNumber, messageId: result.blastId })));
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Failed to send SMS.";
  }

  const status = errorMessage ? "failed" : "sent";

  await upsertDispatchRecord(adminSupabase, {
    sourceTable: snapshot.sourceTable ?? "sensor_readings",
    sourceRecordId: snapshot.recordId,
    alertLevel,
    status,
    recipientCount: recipients.length,
    providerMessageId: blastId,
    errorMessage,
    payload: {
      alertLevel,
      alertLevelName,
      alertLevelBadge,
      message,
      recipients: phoneNumbers,
      delivered,
      sourceTable: snapshot.sourceTable ?? "sensor_readings",
      recordId: snapshot.recordId,
      snapshot,
    },
  });

  return {
    ok: true,
    alertLevel,
    alertLevelName,
    alertLevelBadge,
    sent: errorMessage ? 0 : recipients.length,
    failed: errorMessage ? recipients.length : 0,
    reason: errorMessage ?? undefined,
    sourceTable: snapshot.sourceTable,
    recordId: snapshot.recordId,
  };
}