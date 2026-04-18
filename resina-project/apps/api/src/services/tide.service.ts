// Supabase client for server-side operations
import { createClient } from "@supabase/supabase-js";
import { fetchTideForPredictionDate, fetchTideFromStormGlass as fetchFromStormGlassShared } from "./stormglass.service";

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

export async function fetchTideFromStormGlass(
  startDate: string,
  endDate: string
): Promise<TideData | null> {
  return fetchFromStormGlassShared(startDate, endDate);
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

  // Step 2: If no cache, fetch from StormGlass using shared Manila-day window utility.
  const tideData = await fetchTideForPredictionDate(predictionDate);
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
