import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Import server helpers from the web app so we reuse dispatch logic
import { createAdminClient } from "../../web/lib/supabase/admin";
import { dispatchSensorAlertFromSnapshot } from "../../web/lib/sensor-alert-dispatch";
import type { SensorSnapshot } from "../../web/lib/sensor-alerts";

// Resolve __dirname in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from apps/web/.env.local if present so you don't need to duplicate env files.
const webEnvPath = path.resolve(__dirname, "..", "..", "web", ".env.local");
if (fs.existsSync(webEnvPath)) {
  const parsed = dotenv.parse(fs.readFileSync(webEnvPath));
  for (const k of Object.keys(parsed)) {
    if (!process.env[k]) process.env[k] = parsed[k];
  }
} else {
  // fallback to .env if present in working directory
  dotenv.config();
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  realtime: { params: { eventsPerSecond: 25 } },
});

// small helper to sleep
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function handleRowEvent(payload: any) {
  try {
    const row = payload.new ?? payload.record ?? null;
    if (!row) return;

    const adminSupabase = createAdminClient();

    const snapshot: SensorSnapshot = {
      waterLevel: Number(row.water_level ?? row.level ?? row.reading ?? row.value ?? null),
      statusText: (row.status ?? null) as string | null,
      updatedAt: (row.created_at ?? row.recorded_at ?? new Date().toISOString()) as string,
      sourceTable: "sensor_readings",
      recordId: String(row.id ?? row.created_at ?? Date.now()),
    };

    // small delay to avoid racing with other writers (e.g., the ingest endpoint)
    await sleep(1500);

    const result = await dispatchSensorAlertFromSnapshot(adminSupabase, snapshot);
    console.log(new Date().toISOString(), "dispatch result for", snapshot.recordId, result);
  } catch (err) {
    console.error("realtime-listener error:", err instanceof Error ? err.stack ?? err.message : err);
  }
}

async function main() {
  console.log("Starting Supabase realtime listener for sensor_readings...");

  // subscribe to INSERT and UPDATE events on sensor_readings
  const channel = supabase
    .channel("resina-sensor-readings")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "sensor_readings" },
      (payload) => handleRowEvent(payload),
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "sensor_readings" },
      (payload) => handleRowEvent(payload),
    );

  const sub = await channel.subscribe((status) => {
    console.log("realtime subscription status:", status);
  });

  process.on("SIGINT", async () => {
    console.log("Shutting down listener...");
    try {
      await channel.unsubscribe();
    } catch (e) {
      // ignore
    }
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
