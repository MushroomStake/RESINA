# RESINA Tide Monitoring System Setup Guide

## Overview

The RESINA tide monitoring system integrates real-time tide predictions from StormGlass API with smart caching for efficient API usage (1 credit/day free tier). It provides hourly tide estimates using the Rule of Twelfths interpolation method.

**Location:** Sta. Rita Bridge, Olongapo (14.356°N, 120.283°E)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Mobile App (React Native)                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ TideCard Component                                       │   │
│  │  - Current water level & trend                          │   │
│  │  - Next high/low tide          - hourly estimates       │   │
│  │  - Hourly tide chart                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                         ↑ (HTTP REST)                            │
│                                                                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                    ┌───────▼────────┐
                    │  API Server    │  (Port 3001)
                    │  (Node.js/Exp) │
                    │ /api/tide/*    │
                    └───────┬────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
        ┌──────────────┐        ┌─────────────────┐
        │  Supabase    │        │ StormGlass API  │
        │  - Cache DB  │        │ /tide/extremes  │
        │  - tide_pred │        │ (1 req/day)     │
        │  - tide_hour │        └─────────────────┘
        └──────────────┘
```

---

## Step 1: Supabase Setup

### 1.1 Run SQL Migration

Execute the tide schema script in Supabase SQL Editor:

```bash
# Copy the contents of this file to Supabase SQL Editor:
# apps/web/sql/tide_predictions_schema.sql
```

This creates:
- `tide_predictions` table: stores daily tide extremes (high/low)
- `tide_hourly` table: stores hourly interpolated estimates
- RLS policies for secure read/write

### 1.2 Verify Tables

In Supabase Dashboard > SQL Editor, run:

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'tide%';
```

Should return:
- `tide_predictions`
- `tide_hourly`

---

## Step 2: API Server Setup

### 2.1 Install Dependencies

```bash
cd apps/api
npm install
```

### 2.2 Environment Configuration

Create `.env` file in `apps/api/`:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...  (copy from Settings > API Keys > Service Role)

# StormGlass
STORMGLASS_API_KEY=edf68678-2e4b-11f1-a882-0242ac120004-edf686e6-2e4b-11f1-a882-0242ac120004

# Server
PORT=3001
NODE_ENV=development
```

### 2.3 Start the API Server

```bash
npm run dev
```

Expected output:
```
🌊 RESINA API Server running on http://localhost:3001
📋 Endpoints:
   GET  /health
   GET  /api/tide/current
   GET  /api/tide/hourly
   GET  /api/tide/estimate
   GET  /api/tide/extremes
```

---

## Step 3: Fetch Tide Data

### 3.1 Run Initial Fetch Script

```bash
cd apps/api
npm run tide:fetch
```

Expected output:
```
📊 RESINA Tide Fetch Script
📅 Prediction Date: 2026-04-02
⏰ Run Time: 2026-04-02T10:30:00.000Z

✓ Fetched 8 tide events from StormGlass

✅ SUCCESS: API was called and data fetched
📡 API Credit Used: 1 (Free tier limit: 10/day)

✨ Tide data is ready for today's operations
```

### 3.2 Generate Hourly Interpolations

```bash
npm run tide:interpolate
```

Expected output:
```
🌊 RESINA Tide Interpolation Script
📅 Date: 2026-04-02
⏰ Run Time: 2026-04-02T10:35:00.000Z

✓ Loaded 8 tide extremes
✓ Generated 24 hourly estimates using Rule of Twelfths

✅ Hourly tide estimates stored in tide_hourly table

📊 Sample predictions for 2026-04-02:
   00:00 - 1.45m (high)
   06:00 - 0.82m (medium)
   12:00 - 2.34m (medium)
   18:00 - 0.91m (medium)
```

---

## Step 4: Mobile App Integration

### 4.1 Configure API Endpoint

In your mobile `.env` file (or Expo config), add:

```env
EXPO_PUBLIC_API_URL=http://localhost:3001
```

**For production:** set to your deployed API domain:
```env
EXPO_PUBLIC_API_URL=https://resina-api.example.com
```

### 4.2 Build and Test

```bash
cd apps/mobile
npm install
npm start
```

The TideCard will appear on the dashboard below the WeatherUpdateCard showing:
- Current tide level
- Rising/Falling trend
- Next high/low tide countdown
- Hourly tide chart visualization

---

## Step 5: Automation & Scheduling

### Option A: Cron Job (Linux/Mac)

Edit crontab:
```bash
crontab -e
```

Add to run at 12:01 AM UTC daily:
```bash
1 0 * * * cd /path/to/resina-project/apps/api && npm run tide:fetch && npm run tide:interpolate
```

### Option B: Supabase Edge Functions (Serverless)

Create a scheduled function to call the fetch endpoint daily at midnight UTC.

### Option C: Vercel Cron (if deployed)

Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/tide/fetch",
    "schedule": "0 0 * * *"
  }]
}
```

---

## API Endpoints Reference

### Current Tide Status

```
GET /api/tide/current
```

**Response:**
```json
{
  "date": "2026-04-02",
  "current": {
    "currentHeight": 1.45,
    "nextExtreme": {
      "type": "low",
      "height": 0.82,
      "time": "2026-04-02T06:30:00Z"
    },
    "state": "rising"
  },
  "extremes": [
    { "type": "high", "height": 2.34, "time": "2026-04-02T00:15:00Z" },
    { "type": "low", "height": 0.82, "time": "2026-04-02T06:30:00Z" },
    { "type": "high", "height": 2.45, "time": "2026-04-02T12:45:00Z" },
    { "type": "low", "height": 0.91, "time": "2026-04-02T19:00:00Z" }
  ],
  "timestamp": "2026-04-02T10:35:00.000Z"
}
```

### Hourly Estimates

```
GET /api/tide/hourly?date=2026-04-02&method=rule-of-twelfths
```

**Response:**
```json
{
  "date": "2026-04-02",
  "source": "cached",
  "hours": [
    { "hour": 0, "estimatedHeight": 2.34, "confidence": "high" },
    { "hour": 1, "estimatedHeight": 2.18, "confidence": "medium" },
    { "hour": 2, "estimatedHeight": 2.01, "confidence": "medium" },
    ...24 hours total
  ],
  "timestamp": "2026-04-02T10:35:00.000Z"
}
```

### Estimate at Specific Time

```
GET /api/tide/estimate?date=2026-04-02&hour=14
```

**Response:**
```json
{
  "queryTime": "2026-04-02T14:00:00Z",
  "estimatedHeight": 2.12,
  "unit": "meters",
  "method": "rule-of-twelfths",
  "timestamp": "2026-04-02T10:35:00.000Z"
}
```

### Raw Extremes

```
GET /api/tide/extremes?date=2026-04-02
```

---

## Interpolation Methods

### Rule of Twelfths (Default)

Divides each 6-hour tidal cycle into 12ths following the pattern:
```
1/12, 2/12, 3/12, 3/12, 2/12, 1/12
```

**Pros:** Simple, efficient, accurate for ±2 hours from extremes  
**Cons:** Less smooth curve

### Sine Wave (Alternative)

Uses sinusoidal curve for smooth height variation:
```
height = midpoint + amplitude × sin(π × position)
```

**Pros:** Smooth, continuous curve  
**Cons:** Slightly less accurate near extremes

Switch method with:
```
GET /api/tide/estimate?...&method=sine-wave
```

---

## Monitoring & Maintenance

### Check Cache Hit Rate

Query Supabase:
```sql
SELECT 
  DATE(fetched_at) as date,
  COUNT(*) as total_fetches,
  COUNT(CASE WHEN api_credit_used THEN 1 END) as api_calls,
  COUNT(CASE WHEN NOT api_credit_used THEN 1 END) as cache_hits
FROM tide_predictions
GROUP BY DATE(fetched_at)
ORDER BY date DESC
LIMIT 30;
```

### View Hourly Predictions

```sql
SELECT * FROM tide_hourly
WHERE prediction_date = CURRENT_DATE
ORDER BY hour_of_day ASC;
```

### Clear Old Data

Keep only last 90 days:
```sql
DELETE FROM tide_predictions
WHERE prediction_date < CURRENT_DATE - INTERVAL '90 days';

DELETE FROM tide_hourly
WHERE prediction_date < CURRENT_DATE - INTERVAL '90 days';
```

---

## Troubleshooting

### "Invalid Refresh Token" on Mobile

**Solution:** Clear app data and re-login, or increase `autoRefreshToken` retry delay.

### API Returns 404

**Check:**
1. API server is running: `curl http://localhost:3001/health`
2. `EXPO_PUBLIC_API_URL` env var is set correctly
3. Supabase tables exist and have data

### "No tide data available"

**Cause:** Fetch script hasn't run yet or DB is empty.  
**Solution:** Run `npm run tide:fetch` manually

### Hourly estimates seem incorrect

**Possible causes:**
- Extremes are missing or out of order
- Timezone mismatch (UTC assumed)
- Interpolation window boundary

**Debug:** Check `/api/tide/extremes` response for accurate high/low times

---

## Performance Notes

| Metric | Value |
|--------|-------|
| API Credit Usage | 1/day (caching enabled) |
| Cache TTL | 1 hour (hourly, adjustable) |
| Interpolation Time | <1ms per estimate |
| Mobile UI Refresh | 5 min (with cache) |
| DB Query Time | < 50ms |
| Network Latency Addition | ~100-200ms |

---

## Future Enhancements

- [ ] Automated daily fetch on app startup
- [ ] Tide alerts (e.g., low tide < 0.5m)
- [ ] Surge/storm tide warnings integration
- [ ] GraphQL API for efficient queries
- [ ] Synchronized tide data for multiple locations
- [ ] Tide forecast predictions (3-7 days ahead)

---

## Support & References

- **StormGlass API Docs:** https://www.stormglass.io/
- **Marine Tide Calculation:** https://en.wikipedia.org/wiki/Tidal_constituents
- **Rule of Twelfths:** https://www.bosunsmate.org/tides/ruleof12ths.php
