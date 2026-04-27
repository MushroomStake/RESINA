import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as any;
    const message = body?.message;

    if (!message || !message.recipient || !message.reference_id) {
      return NextResponse.json({ ok: false, error: "Invalid webhook payload" }, { status: 400 });
    }

    const recipient: string = message.recipient;
    const referenceId: string = message.reference_id;
    const status: string | undefined = message.status ?? (body?.event as string) ?? undefined;
    const failReason: string | null = message.fail_reason ?? null;

    const adminSupabase = createAdminClient();
    const adminSupabaseDynamic = adminSupabase as any;

    // Best-effort find a dispatch that contains this recipient in its payload
    const { data: rows, error: queryError } = await adminSupabaseDynamic
      .from("sms_alert_dispatches")
      .select("id, payload, status")
      .ilike("payload", `%${recipient}%`)
      .order("created_at", { ascending: false })
      .limit(5);

    if (queryError) {
      console.error("unisms webhook query error:", queryError);
      return NextResponse.json({ ok: false, error: queryError.message }, { status: 500 });
    }

    if (!rows || rows.length === 0) {
      console.warn("unisms webhook: no dispatch found for recipient", recipient);
      return NextResponse.json({ ok: true, note: "no_dispatch_found" });
    }

    // Use the most recent matching dispatch
    const row = rows[0] as { id: string; payload: any; status: string };
    const payload = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload ?? {};

    const delivered = Array.isArray(payload.delivered) ? payload.delivered : [];

    let found = false;
    for (const entry of delivered) {
      const phone = entry.phoneNumber ?? entry.recipient ?? entry.phone ?? null;
      if (phone === recipient) {
        entry.referenceId = referenceId;
        entry.status = status ?? "sent";
        entry.fail_reason = failReason;
        found = true;
        break;
      }
    }

    if (!found) {
      delivered.push({ phoneNumber: recipient, referenceId, status: status ?? "sent", fail_reason: failReason });
    }

    payload.delivered = delivered;

    const recipientsCount = Array.isArray(payload.recipients) ? payload.recipients.length : delivered.length;
    const sentCount = delivered.filter((d: any) => (d.status ?? "sent") === "sent").length;
    const failedCount = delivered.filter((d: any) => (d.status ?? "sent") === "failed").length;

    let newStatus = row.status;
    if (recipientsCount > 0 && sentCount === recipientsCount) {
      newStatus = "sent";
    } else if (failedCount > 0) {
      newStatus = "partial";
    }

    const { error: updateError } = await adminSupabaseDynamic
      .from("sms_alert_dispatches")
      .update({ payload, status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", row.id);

    if (updateError) {
      console.error("unisms webhook update error:", updateError);
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("unisms webhook error:", err instanceof Error ? err.stack ?? err.message : err);
    const message = err instanceof Error ? err.message : "Unknown webhook error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
