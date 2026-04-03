#!/usr/bin/env node
/**
 * Refresh tide data window for scheduler resilience.
 * Fetches/extremes + hourly interpolation for Manila yesterday and today.
 * Usage: npm run tide:refresh-window
 */

import "dotenv/config";
import { getTidePredictionFromDB, smartFetchTideData, supabase } from "../services/tide.service.js";
import { generateHourlyTideEstimates } from "../services/tide-interpolation.js";

function getManilaDate(offsetDays: number): string {
  const target = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(target);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to resolve Manila date");
  }

  return `${year}-${month}-${day}`;
}

async function upsertHourlyForDate(predictionDate: string): Promise<number> {
  const tideData = await getTidePredictionFromDB(predictionDate);
  if (!tideData?.length) {
    throw new Error(`No tide data found for ${predictionDate}`);
  }

  const hourly = generateHourlyTideEstimates(tideData, predictionDate, "rule-of-twelfths");

  for (const entry of hourly) {
    const { error } = await supabase.from("tide_hourly").upsert(
      {
        prediction_date: predictionDate,
        hour_of_day: entry.hour,
        estimated_height: entry.estimatedHeight,
        confidence: entry.confidence,
      },
      {
        onConflict: "prediction_date,hour_of_day",
      },
    );

    if (error) {
      throw new Error(`Hourly upsert failed for ${predictionDate} hour ${entry.hour}: ${error.message}`);
    }
  }

  return hourly.length;
}

async function main() {
  const dates = [getManilaDate(-1), getManilaDate(0)];
  const uniqueDates = Array.from(new Set(dates));

  console.log("\n🌊 RESINA Tide Window Refresh");
  console.log(`📅 Dates: ${uniqueDates.join(", ")}`);
  console.log(`⏰ Run Time: ${new Date().toISOString()}\n`);

  let apiCalls = 0;

  for (const date of uniqueDates) {
    console.log(`\n--- Processing ${date} ---`);
    const fetchResult = await smartFetchTideData(date);
    if (fetchResult.apiUsed) {
      apiCalls += 1;
    }

    const hourlyCount = await upsertHourlyForDate(date);
    console.log(`✓ Hourly records upserted: ${hourlyCount}`);
  }

  console.log("\n✅ Tide scheduler refresh completed");
  console.log(`📡 StormGlass API credits used this run: ${apiCalls}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(`\n❌ ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
