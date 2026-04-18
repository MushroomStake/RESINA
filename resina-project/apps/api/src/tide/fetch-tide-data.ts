#!/usr/bin/env node
/**
 * Standalone script to fetch tide data for today
 * Run once daily via cron or scheduler
 * Usage: npm run tide:fetch
 */

import "dotenv/config";
import { smartFetchTideData } from "../services/tide.service.js";
import { getManilaDate } from "../utils/date.js";

async function main() {
  const today = getManilaDate();

  console.log(`\n📊 RESINA Tide Fetch Script`);
  console.log(`📅 Prediction Date: ${today}`);
  console.log(`⏰ Run Time: ${new Date().toISOString()}\n`);

  try {
    const result = await smartFetchTideData(today);

    if (result.apiUsed) {
      console.log(`\n✅ SUCCESS: API was called and data fetched`);
      console.log(`📡 API Credit Used: 1 (Free tier limit: 10/day)`);
    } else {
      console.log(`\n✅ SUCCESS: Data served from cache (no API call)`);
      console.log(`💾 API Credit Used: 0 (Cache hit)`);
    }

    console.log(`\n✨ Tide data is ready for today's operations\n`);
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

main();
