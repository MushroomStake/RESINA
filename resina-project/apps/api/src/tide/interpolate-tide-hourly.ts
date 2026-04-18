#!/usr/bin/env node
/**
 * Script to generate and cache hourly tide estimates from daily extremes
 * Run after tide fetch, or on-demand before showing hourly UI
 * Usage: npm run tide:interpolate
 */

import "dotenv/config";
import { getTidePredictionFromDB, saveTidePredictionToDB, supabase } from "../services/tide.service.js";
import { generateHourlyTideEstimates } from "../services/tide-interpolation.js";
import { getManilaDate } from "../utils/date.js";

async function main() {
  const today = getManilaDate();

  console.log(`\n🌊 RESINA Tide Interpolation Script`);
  console.log(`📅 Date: ${today}`);
  console.log(`⏰ Run Time: ${new Date().toISOString()}\n`);

  try {
    // Fetch daily extremes from DB
    const tideData = await getTidePredictionFromDB(today);
    if (!tideData) {
      throw new Error(`No tide data found for ${today}. Run fetch-tide-data first.`);
    }

    console.log(`✓ Loaded ${tideData.length} tide extremes`);

    // Generate hourly estimates
    const hourlyEstimates = generateHourlyTideEstimates(tideData, today, "rule-of-twelfths");
    console.log(`✓ Generated ${hourlyEstimates.length} hourly estimates using Rule of Twelfths\n`);

    // Upsert hourly data into tide_hourly table
    for (const { hour, estimatedHeight, confidence } of hourlyEstimates) {
      const { error } = await supabase.from("tide_hourly").upsert(
        {
          prediction_date: today,
          hour_of_day: hour,
          estimated_height: estimatedHeight,
          confidence,
        },
        {
          onConflict: "prediction_date,hour_of_day",
        }
      );

      if (error) {
        console.warn(`⚠ Error upserting hour ${hour}:`, error.message);
      }
    }

    console.log(`✅ Hourly tide estimates stored in tide_hourly table`);
    console.log(`\n📊 Sample predictions for ${today}:`);

    // Show sample predictions
    const samples = [0, 6, 12, 18].map((h) => hourlyEstimates[h]).filter(Boolean);
    for (const { hour, estimatedHeight, confidence } of samples) {
      console.log(`   ${String(hour).padStart(2, "0")}:00 - ${estimatedHeight.toFixed(2)}m (${confidence})`);
    }

    console.log(`\n✨ Hourly interpolation complete\n`);
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

main();
