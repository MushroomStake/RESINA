/**
 * Express API Server for RESINA flood monitoring
 * Serves tide, weather, and sensor data endpoints
 */

import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import type { CorsOptions } from "cors";
import rateLimit from "express-rate-limit";
import { getManilaDate } from "./utils/date.js";
import { getTidePredictionFromDB, supabase } from "./services/tide.service.js";
import { estimateTideHeight, getTideStatus, generateHourlyTideEstimates, InterpolationMethod } from "./services/tide-interpolation.js";

const VALID_INTERPOLATION_METHODS: InterpolationMethod[] = ["rule-of-twelfths", "sine-wave"];

function resolveInterpolationMethod(methodParam: unknown): InterpolationMethod {
  if (typeof methodParam !== "string") {
    return "rule-of-twelfths";
  }

  return VALID_INTERPOLATION_METHODS.includes(methodParam as InterpolationMethod)
    ? (methodParam as InterpolationMethod)
    : "rule-of-twelfths";
}

function isValidIsoDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const [yearRaw, monthRaw, dayRaw] = date.split("-");
  const year = Number.parseInt(yearRaw ?? "", 10);
  const month = Number.parseInt(monthRaw ?? "", 10);
  const day = Number.parseInt(dayRaw ?? "", 10);

  if ([year, month, day].some((value) => Number.isNaN(value))) {
    return false;
  }

  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function resolveDateQuery(dateParam: unknown): { date: string | null; error: string | null } {
  if (dateParam === undefined) {
    return { date: getManilaDate(), error: null };
  }

  if (typeof dateParam !== "string") {
    return { date: null, error: "Invalid date parameter. Expected format: YYYY-MM-DD." };
  }

  const normalized = dateParam.trim();
  if (!isValidIsoDate(normalized)) {
    return { date: null, error: "Invalid date parameter. Expected format: YYYY-MM-DD." };
  }

  return { date: normalized, error: null };
}

const app = express();
const PORT = process.env.PORT || 3001;

// CORS Configuration
// Allow requests from specified origins
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:3001").split(",").map(origin => origin.trim());
const corsOptions: CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "HEAD", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 3600,
};

app.use(cors(corsOptions));

// Rate Limiting Configuration
// General API rate limiter: 100 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health check
    return req.path === "/health";
  },
});

// Strict rate limiter for tide estimation: 30 requests per 15 minutes per IP
const tideEstimateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  message: "Too many tide estimates requested, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json());
app.use(apiLimiter);

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
    const { date, error: dateError } = resolveDateQuery(req.query.date);
    if (dateError || !date) {
      return res.status(400).json({ error: dateError });
    }

    const method = resolveInterpolationMethod(req.query.method);

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
app.get("/api/tide/estimate", tideEstimateLimiter, async (req: Request, res: Response) => {
  try {
    let queryTime: Date;
    const method = resolveInterpolationMethod(req.query.method);

    if (req.query.time) {
      // Use explicit time parameter
      queryTime = new Date(req.query.time as string);
    } else {
      // Use date and hour parameters
      const { date, error: dateError } = resolveDateQuery(req.query.date);
      if (dateError || !date) {
        return res.status(400).json({ error: dateError });
      }

      const requestedHour = Number.parseInt((req.query.hour as string) ?? "", 10);
      const hour = Number.isInteger(requestedHour) && requestedHour >= 0 && requestedHour <= 23
        ? requestedHour
        : new Date().getUTCHours();
      queryTime = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00Z`);
    }

    if (isNaN(queryTime.getTime())) {
      return res.status(400).json({ error: "Invalid time parameter" });
    }

    const queryDate = queryTime.toISOString().split("T")[0];
    const tideData = await getTidePredictionFromDB(queryDate);

    if (!tideData) {
      return res.status(404).json({
        error: "No tide data for specified date",
        date: queryDate,
      });
    }

    const height = estimateTideHeight(tideData, queryTime, method);
    res.json({
      queryTime: queryTime.toISOString(),
      estimatedHeight: height ? Math.round(height * 100) / 100 : null,
      unit: "meters",
      method,
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
    const { date, error: dateError } = resolveDateQuery(req.query.date);
    if (dateError || !date) {
      return res.status(400).json({ error: dateError });
    }

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

/**
 * GET /api/sensor/current
 * Returns a small public-safe summary of the latest sensor reading
 */
app.get("/api/sensor/current", async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("sensor_readings")
      .select("id, water_level, status, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return res.status(500).json({ error: error.message ?? String(error) });
    }

    if (!data) {
      return res.status(404).json({ error: "No sensor readings available" });
    }

    const safe = {
      current: {
        waterLevel: data.water_level === null ? null : Number(data.water_level),
        statusLabel: data.status ?? null,
        updatedAt: data.created_at ?? null,
      },
      timestamp: new Date().toISOString(),
    };

    res.json(safe);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

/**
 * GET /api/weather/current
 * Returns a small public-safe summary of latest weather log
 */
app.get("/api/weather/current", async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("weather_logs")
      .select(
        "id, recorded_at, temperature, humidity, heat_index, wind_speed, weather_main, weather_description, intensity, manual_description, icon_path"
      )
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message ?? String(error) });
    }

    if (!data) {
      return res.status(404).json({ error: "No weather logs available" });
    }

    const safe = {
      current: {
        temperature: data.temperature ?? null,
        humidity: data.humidity ?? null,
        heatIndex: data.heat_index ?? null,
        windSpeed: data.wind_speed ?? null,
        owmMain: data.weather_main ?? null,
        owmDescription: data.weather_description ?? null,
        intensityDescription: data.intensity ?? "-",
        manualDescription: data.manual_description ?? null,
        iconPath: data.icon_path ?? null,
        updatedAt: data.recorded_at ?? null,
      },
      timestamp: new Date().toISOString(),
    };

    res.json(safe);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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
