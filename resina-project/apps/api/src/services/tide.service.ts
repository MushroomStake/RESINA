// Supabase client for server-side operations
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || "";

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export type TideExtreme = {
  type: "high" | "low";
  height: number;
  time: string; // ISO 8601
};

export type TideData = TideExtreme[];

/**
 * Fetch tide data from Supabase for a given date
 */
export async function getTidePredictionFromDB(predictionDate: string): Promise< TideData | null> {
  try {
    const { data, error } = await supabase
      .from("tide_predictions")
      .select("tide_data, fetched_at")
      .eq("prediction_date", predictionDate)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows returned
        return null;
      }
      throw error;
    }

    return data?.tide_data as TideData;
  } catch (error) {
    console.error("Error fetching tide data from DB:", error);
    return null;
  }
}

/**
 * Store tide data in Supabase
 */
export async function saveTidePredictionToDB(
  predictionDate: string,
  tideData: TideData,
  apiCreditUsed: boolean = true
): Promise<boolean> {
  try {
    const { error } = await supabase.from("tide_predictions").upsert(
      {
        prediction_date: predictionDate,
        tide_data: tideData,
        api_credit_used: apiCreditUsed,
        fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "prediction_date",
      }
    );

    if (error) throw error;
    console.log(`✓ Saved tide data for ${predictionDate}`);
    return true;
  } catch (error) {
    console.error("Error saving tide data to DB:", error);
    return false;
  }
}

/**
 * Fetch tide predictions from StormGlass API
 * Coordinates: Sta. Rita Bridge, Olongapo (14.356, 120.283)
 */
export async function fetchTideFromStormGlass(
  startDate: string,
  endDate: string
): Promise<TideData | null> {
  const stormGlassApiKey = process.env.STORMGLASS_API_KEY;
  if (!stormGlassApiKey) {
    throw new Error("Missing STORMGLASS_API_KEY environment variable");
  }

  const lat = 14.356;
  const lng = 120.283;

  // ISO 8601 format required by StormGlass
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    start: startDate,
    end: endDate,
  });

  const url = `https://api.stormglass.io/v2/tide/extremes/point?${params}`;

  const headers = {
    Authorization: stormGlassApiKey,
  };

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`StormGlass API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json() as { data: TideExtreme[] };

    // Normalize response format
    const tideEvents: TideData = data.data.map((event) => ({
      type: event.type as "high" | "low",
      height: event.height,
      time: event.time,
    }));

    console.log(`✓ Fetched ${tideEvents.length} tide events from StormGlass`);
    return tideEvents;
  } catch (error) {
    console.error("Error fetching from StormGlass:", error);
    throw error;
  }
}

/**
 * Smart daily fetch: check cache first, fetch only if needed
 * @returns true if API was called, false if served from cache
 */
export async function smartFetchTideData(predictionDate: string): Promise<{ success: boolean; apiUsed: boolean }> {
  // Step 1: Check if we already have data for today
  const cached = await getTidePredictionFromDB(predictionDate);
  if (cached && cached.length > 0) {
    console.log(`✓ Using cached tide data for ${predictionDate}`);
    return { success: true, apiUsed: false };
  }

  // Step 2: If no cache, fetch from StormGlass
  const startIso = `${predictionDate}T00:00:00Z`;
  const endIso = `${predictionDate}T23:59:59Z`;

  const tideData = await fetchTideFromStormGlass(startIso, endIso);
  if (!tideData) {
    throw new Error("Failed to fetch tide data from StormGlass");
  }

  // Step 3: Store in DB
  const saved = await saveTidePredictionToDB(predictionDate, tideData, true);
  if (!saved) {
    throw new Error("Failed to save tide data to database");
  }

  return { success: true, apiUsed: true };
}
