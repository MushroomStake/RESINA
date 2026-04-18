import type { TideData, TideExtreme } from "./tide.service";
import { toStormGlassWindow } from "../utils/stormglass-window.js";

/**
 * Fetch tide predictions from StormGlass API
 * Coordinates: Sta. Rita Bridge, Olongapo (14.356, 120.283)
 */
export async function fetchTideFromStormGlass(startIso: string, endIso: string): Promise<TideData | null> {
  const stormGlassApiKey = process.env.STORMGLASS_API_KEY;
  if (!stormGlassApiKey) {
    throw new Error("Missing STORMGLASS_API_KEY environment variable");
  }

  const params = new URLSearchParams({
    lat: "14.356",
    lng: "120.283",
    start: startIso,
    end: endIso,
  });

  const response = await fetch(`https://api.stormglass.io/v2/tide/extremes/point?${params}`, {
    headers: { Authorization: stormGlassApiKey },
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`StormGlass API error: ${response.status} - ${details}`);
  }

  const data = (await response.json()) as { data?: Array<Partial<TideExtreme>> };
  const tideEvents: TideData = Array.isArray(data.data)
    ? data.data
        .map((event): TideExtreme => ({
          type: event.type === "high" ? "high" : "low",
          height: Number(event.height),
          time: typeof event.time === "string" ? event.time : "",
        }))
        .filter((event) => Boolean(event.time) && Number.isFinite(event.height))
    : [];

  return tideEvents;
}

export async function fetchTideForPredictionDate(predictionDate: string): Promise<TideData | null> {
  const { startIso, endIso } = toStormGlassWindow(predictionDate);
  return fetchTideFromStormGlass(startIso, endIso);
}
