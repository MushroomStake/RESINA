/**
 * Express API Server for RESINA flood monitoring
 * Serves tide, weather, and sensor data endpoints
 */

import "dotenv/config";
import express, { Request, Response } from "express";
import { getTidePredictionFromDB, supabase } from "./services/tide.service.js";
import { estimateTideHeight, getTideStatus, generateHourlyTideEstimates, InterpolationMethod } from "./services/tide-interpolation.js";

function getManilaDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to resolve Manila date");
  }

  return `${year}-${month}-${day}`;
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * GET /api/tide/current
 * Returns current tide status and estimates for today
 */
app.get("/api/tide/current", async (req: Request, res: Response) => {
  try {
    const today = getManilaDate();
    const tideData = await getTidePredictionFromDB(today);

    if (!tideData) {
      return res.status(404).json({
        error: "No tide data available for today",
        date: today,
      });
    }

    const status = getTideStatus(tideData);
    if (!status) {
      return res.status(500).json({ error: "Failed to compute tide status" });
    }

    res.json({
      date: today,
      current: status,
      extremes: tideData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/tide/hourly
 * Returns hourly tide estimates from cached interpolations or computes on-demand
 */
app.get("/api/tide/hourly", async (req: Request, res: Response) => {
  try {
    const date = (req.query.date as string) || getManilaDate();
    const method = (req.query.method as InterpolationMethod) || "rule-of-twelfths";

    // Try to fetch pre-computed hourly data from tide_hourly table
    const { data: cachedHourly, error: fetchError } = await supabase
      .from("tide_hourly")
      .select("hour_of_day, estimated_height, confidence")
      .eq("prediction_date", date)
      .order("hour_of_day", { ascending: true });

    if (!fetchError && cachedHourly && cachedHourly.length === 24) {
      // All 24 hours cached, return immediately
      return res.json({
        date,
        source: "cached",
        hours: cachedHourly.map((h) => ({
          hour: h.hour_of_day,
          estimatedHeight: h.estimated_height,
          confidence: h.confidence,
        })),
        timestamp: new Date().toISOString(),
      });
    }

    // Fallback: compute on-demand from extremes
    const tideData = await getTidePredictionFromDB(date);
    if (!tideData) {
      return res.status(404).json({
        error: "No tide data available",
        date,
      });
    }

    const hourly = generateHourlyTideEstimates(tideData, date, method);
    res.json({
      date,
      source: "computed",
      method,
      hours: hourly,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/tide/estimate
 * Estimate tide height for a specific time
 * Query params: time (ISO string), date (YYYY-MM-DD), hour (0-23)
 */
app.get("/api/tide/estimate", async (req: Request, res: Response) => {
  try {
    let queryTime: Date;

    if (req.query.time) {
      // Use explicit time parameter
      queryTime = new Date(req.query.time as string);
    } else {
      // Use date and hour parameters
      const date = (req.query.date as string) || getManilaDate();
      const hour = parseInt(req.query.hour as string) || new Date().getUTCHours();
      queryTime = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00Z`);
    }

    if (isNaN(queryTime.getTime())) {
      return res.status(400).json({ error: "Invalid time parameter" });
    }

    const date = queryTime.toISOString().split("T")[0];
    const tideData = await getTidePredictionFromDB(date);

    if (!tideData) {
      return res.status(404).json({
        error: "No tide data for specified date",
        date,
      });
    }

    const height = estimateTideHeight(tideData, queryTime);
    res.json({
      queryTime: queryTime.toISOString(),
      estimatedHeight: height ? Math.round(height * 100) / 100 : null,
      unit: "meters",
      method: "rule-of-twelfths",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/tide/extremes
 * Get raw tide extremes for a date
 */
app.get("/api/tide/extremes", async (req: Request, res: Response) => {
  try {
    const date = (req.query.date as string) || getManilaDate();
    const tideData = await getTidePredictionFromDB(date);

    if (!tideData) {
      return res.status(404).json({
        error: "No tide data available",
        date,
      });
    }

    const sorted = tideData.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    res.json({
      date,
      count: sorted.length,
      extremes: sorted,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: "Endpoint not found",
    path: req.path,
  });
});

app.listen(PORT, () => {
  console.log(`\n🌊 RESINA API Server running on http://localhost:${PORT}`);
  console.log(`📋 Endpoints:`);
  console.log(`   GET  /health                    - Health check`);
  console.log(`   GET  /api/tide/current          - Current tide status`);
  console.log(`   GET  /api/tide/hourly           - Hourly tide estimates`);
  console.log(`   GET  /api/tide/estimate         - Tide height at specific time`);
  console.log(`   GET  /api/tide/extremes         - Raw tide extremes\n`);
});
