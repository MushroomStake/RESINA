"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { CurrentSensorStatus } from "./components/current-sensor-status";
import { WeatherUpdateSection } from "./components/weather-update-section";
import { TideMonitorSection } from "./components/tide-monitor-section";
import StatusFeedbackModal from "../components/status-feedback-modal";
import { AdminPageSkeleton } from "../components/admin-skeleton";

type AlertLevelKey = "normal" | "critical" | "evacuation" | "spilling";

type SensorSnapshot = {
  waterLevel: number | null;
  statusText: string | null;
  updatedAt: string | null;
  sourceTable: string | null;
};

type WeatherState = {
  id: string | null;
  dateLabel: string;
  temperature: number;
  humidity: number | null;
  heatIndex: number | null;
  owmMain: string;
  owmDescription: string;
  intensityDescription: string;
  signalNo: string;
  manualDescription: string;
  broadcastDate: string | null;
  broadcastTime: string | null;
  recordedAt: string | null;
  iconPath: string;
};

type TideExtreme = {
  type: "high" | "low";
  height: number;
  time: string;
};

type TideHourlyPoint = {
  hour: number;
  estimatedHeight: number;
  confidence: "high" | "medium" | "low";
};

type TidePredictionRow = {
  prediction_date: string;
  tide_data: TideExtreme[] | null;
};

type TideHourlyRow = {
  hour_of_day: number;
  estimated_height: number;
  confidence: "high" | "medium" | "low" | null;
};

const SUNRISE_SUNSET_WINDOW_MS = 30 * 60 * 1000;

type WetSeverity = "none" | "light" | "moderate" | "heavy" | "torrential";
type HeatSeverity = "normal" | "caution" | "extreme-caution" | "danger" | "extreme-danger";

const DRY_NORMAL_ICON_PATH = "/weather/dry-season/sun Normal.png";
const DRY_SUNRISE_ICON_PATH = "/weather/dry-season/sunrise.png";
const DRY_SUNSET_ICON_PATH = "/weather/dry-season/sunset.png";

const WEATHER_ICON_MAP: Record<string, string> = {
  Normal: DRY_NORMAL_ICON_PATH,
  Caution: "/weather/dry-season/sun Caution.png",
  "Extreme Caution": "/weather/dry-season/sun Extreme Caution.png",
  Danger: "/weather/dry-season/sun Danger.png",
  "Extreme Danger": "/weather/dry-season/sun Danger.png",
  "Light Rain": "/weather/wet-season/Light Rain.png",
  "Moderate Rain": "/weather/wet-season/Moderate Rain.png",
  "Heavy Rain": "/weather/wet-season/Heavy Rain.png",
  "Torrential Rain": "/weather/wet-season/Torrential Rain.png",
};

const ALERT_LEVELS: Record<
  AlertLevelKey,
  {
    title: string;
    badge: string;
    rangeLabel: string;
    leftPanelClass: string;
    sensorGradientClass: string;
    noticeClass: string;
    description: string;
  }
> = {
  normal: {
    title: "Normal Level",
    badge: "Alert Level 1",
    rangeLabel: "1.5 - 2.49m",
    leftPanelClass: "bg-[#4CAF50]",
    sensorGradientClass: "bg-[linear-gradient(135deg,#4CAF50_0%,#3f9d57_45%,#2f8a5f_100%)]",
    noticeClass: "border-[#c9e7cd] bg-[#edf8ef] text-[#355f3a]",
    description: "Normal ang antas ng tubig. Ligtas ang sitwasyon at walang inaasahang banta sa ngayon.",
  },
  critical: {
    title: "Critical Level",
    badge: "Alert Level 2",
    rangeLabel: "2.5 - 2.9m",
    leftPanelClass: "bg-[#F7C520]",
    sensorGradientClass: "bg-[linear-gradient(135deg,#F7C520_0%,#e3b31d_48%,#c79a12_100%)]",
    noticeClass: "border-[#efdfad] bg-[#fdf9ea] text-[#6a5c28]",
    description: "Mataas ang tubig. Maging alerto, ihanda ang mga gamit, at patuloy na magmonitor sa mga balita.",
  },
  evacuation: {
    title: "Evacuation Level",
    badge: "Alert Level 3",
    rangeLabel: "3.0 - 3.9m",
    leftPanelClass: "bg-[#FF7E1C]",
    sensorGradientClass: "bg-[linear-gradient(135deg,#FF7E1C_0%,#e96d1b_50%,#c9581b_100%)]",
    noticeClass: "border-[#efcec1] bg-[#fef5f1] text-[#70402a]",
    description: "Mapanganib ang antas ng tubig. Lumikas na agad patungo sa mas mataas na lugar o evacuation center.",
  },
  spilling: {
    title: "Spilling Level",
    badge: "Alert Level 4",
    rangeLabel: "4.0+m",
    leftPanelClass: "bg-[#A82A2A]",
    sensorGradientClass: "bg-[linear-gradient(135deg,#A82A2A_0%,#8f2323_48%,#6f1f1f_100%)]",
    noticeClass: "border-[#efc4c6] bg-[#fff0f1] text-[#6a2830]",
    description: "Umaapaw na ang tubig. Delikado na ang sitwasyon; unahin ang kaligtasan ng buhay at sumunod sa mga rescuer.",
  },
};

function inferAlertLevel(snapshot: SensorSnapshot): AlertLevelKey {
  const status = (snapshot.statusText ?? "").toLowerCase();

  if (status.includes("spill")) {
    return "spilling";
  }
  if (status.includes("evac")) {
    return "evacuation";
  }
  if (status.includes("critical") || status.includes("alert level 2") || status.includes("alert 2")) {
    return "critical";
  }
  if (status.includes("normal") || status.includes("alert level 1") || status.includes("alert 1")) {
    return "normal";
  }

  if (snapshot.waterLevel !== null) {
    if (snapshot.waterLevel >= 4) {
      return "spilling";
    }
    if (snapshot.waterLevel >= 3) {
      return "evacuation";
    }
    if (snapshot.waterLevel >= 2.5) {
      return "critical";
    }
  }

  return "normal";
}

function resolveRangeLabel(level: number | null, fallback: string): string {
  if (level === null || Number.isNaN(level)) {
    return fallback;
  }

  if (level >= 4) {
    return "4.0+m";
  }

  const upper = level >= 3 ? 3.9 : level >= 2.5 ? 2.9 : 2.49;
  return `${level.toFixed(1)} - ${upper.toFixed(2)}m`;
}

function formatLastUpdate(updatedAt: string | null): string {
  if (!updatedAt) {
    return "No recent update";
  }

  const timestamp = new Date(updatedAt);
  if (Number.isNaN(timestamp.getTime())) {
    return "No recent update";
  }

  return `Last update: ${timestamp.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })}`;
}

function formatWeatherDateForCard(date: Date): string {
  return date
    .toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
      month: "short",
      day: "2-digit",
      year: "numeric",
    })
    .toUpperCase();
}

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
    return new Date().toISOString().split("T")[0];
  }

  return `${year}-${month}-${day}`;
}

function inferWetSeverity(main: string, description: string): WetSeverity {
  const lowerMain = main.toLowerCase();
  const lowerDescription = description.toLowerCase();

  if (
    lowerMain.includes("thunder") ||
    lowerDescription.includes("thunder") ||
    lowerMain.includes("squall") ||
    lowerMain.includes("tornado")
  ) {
    return "torrential";
  }

  if (lowerMain.includes("rain")) {
    if (
      lowerDescription.includes("very heavy") ||
      lowerDescription.includes("extreme") ||
      lowerDescription.includes("violent")
    ) {
      return "torrential";
    }
    if (lowerDescription.includes("heavy")) {
      return "heavy";
    }
    if (lowerDescription.includes("moderate")) {
      return "moderate";
    }
    if (lowerDescription.includes("light") || lowerDescription.includes("shower")) {
      return "light";
    }
    return "moderate";
  }

  if (lowerMain.includes("drizzle")) {
    return "light";
  }

  return "none";
}

function computeHeatIndexC(temperatureC: number, humidity: number): number {
  const tF = temperatureC * (9 / 5) + 32;

  // For cooler/drier conditions, ambient temperature is a better approximation.
  if (tF < 80 || humidity < 40) {
    return Math.round(temperatureC * 10) / 10;
  }

  const hiF =
    -42.379 +
    2.04901523 * tF +
    10.14333127 * humidity -
    0.22475541 * tF * humidity -
    0.00683783 * tF * tF -
    0.05481717 * humidity * humidity +
    0.00122874 * tF * tF * humidity +
    0.00085282 * tF * humidity * humidity -
    0.00000199 * tF * tF * humidity * humidity;

  const hiC = (hiF - 32) * (5 / 9);
  return Math.round(hiC * 10) / 10;
}

function resolveHeatSeverity(heatIndexC: number): HeatSeverity {
  if (heatIndexC >= 52) {
    return "extreme-danger";
  }
  if (heatIndexC >= 42) {
    return "danger";
  }
  if (heatIndexC >= 33) {
    return "extreme-caution";
  }
  if (heatIndexC >= 27) {
    return "caution";
  }

  return "normal";
}

function resolveIntensityLabel(wet: WetSeverity, heat: HeatSeverity): string {
  if (wet === "torrential") {
    return "Torrential Rain";
  }
  if (wet === "heavy") {
    return "Heavy Rain";
  }
  if (wet === "moderate") {
    return "Moderate Rain";
  }
  if (wet === "light") {
    return "Light Rain";
  }

  if (heat === "extreme-danger") {
    return "Extreme Danger";
  }
  if (heat === "danger") {
    return "Danger";
  }
  if (heat === "extreme-caution") {
    return "Extreme Caution";
  }
  if (heat === "caution") {
    return "Caution";
  }

  return "Normal";
}

function resolveDrySeasonNightIcon(main: string, description: string): string {
  const lowerMain = main.toLowerCase();
  const lowerDescription = description.toLowerCase();

  if (lowerMain.includes("clear")) {
    return "/weather/dry-season/clear sky moon.png";
  }

  if (lowerMain.includes("cloud") || lowerDescription.includes("cloud")) {
    return "/weather/dry-season/few clouds moon.png";
  }

  if (
    lowerMain.includes("mist") ||
    lowerMain.includes("fog") ||
    lowerMain.includes("haze") ||
    lowerDescription.includes("mist") ||
    lowerDescription.includes("fog") ||
    lowerDescription.includes("haze")
  ) {
    return "/weather/dry-season/mist moon.png";
  }

  return "/weather/dry-season/few clouds moon.png";
}

function resolveDrySeasonPhaseIcon(
  main: string,
  description: string,
  iconCode: string,
  sunriseUnixSeconds?: number,
  sunsetUnixSeconds?: number,
): string {
  if (typeof sunriseUnixSeconds !== "number" || typeof sunsetUnixSeconds !== "number") {
    return iconCode.endsWith("n")
      ? resolveDrySeasonNightIcon(main, description)
      : DRY_NORMAL_ICON_PATH;
  }

  const now = Date.now();
  const sunriseMs = sunriseUnixSeconds * 1000;
  const sunsetMs = sunsetUnixSeconds * 1000;

  if (Math.abs(now - sunriseMs) <= SUNRISE_SUNSET_WINDOW_MS) {
    return DRY_SUNRISE_ICON_PATH;
  }

  if (Math.abs(now - sunsetMs) <= SUNRISE_SUNSET_WINDOW_MS) {
    return DRY_SUNSET_ICON_PATH;
  }

  if (now < sunriseMs || now > sunsetMs) {
    return resolveDrySeasonNightIcon(main, description);
  }

  return DRY_NORMAL_ICON_PATH;
}

function analyzeOpenWeather(
  main: string,
  description: string,
  temperatureC: number,
  humidity: number,
  iconCode: string,
  sunriseUnixSeconds?: number,
  sunsetUnixSeconds?: number,
) {
  const wetSeverity = inferWetSeverity(main, description);
  const heatIndex = computeHeatIndexC(temperatureC, humidity);
  const heatSeverity = resolveHeatSeverity(heatIndex);
  const intensityDescription = resolveIntensityLabel(wetSeverity, heatSeverity);

  const iconPath =
    wetSeverity === "none"
      ? resolveDrySeasonPhaseIcon(main, description, iconCode, sunriseUnixSeconds, sunsetUnixSeconds)
      : WEATHER_ICON_MAP[intensityDescription] ?? DRY_NORMAL_ICON_PATH;

  return {
    intensityDescription,
    iconPath,
    heatIndex,
  };
}

function isRainyIntensity(intensity: string): boolean {
  return (
    intensity === "Light Rain" ||
    intensity === "Moderate Rain" ||
    intensity === "Heavy Rain" ||
    intensity === "Torrential Rain"
  );
}

function resolveWeatherCardClass(intensity: string, heatIndex: number | null): string {
  if (isRainyIntensity(intensity)) {
    return "bg-[#B3B7C0]";
  }

  const thermalMetric = heatIndex ?? 0;

  if (thermalMetric < 27) {
    return "bg-[#ECE8D2]";
  }
  if (thermalMetric <= 32) {
    return "bg-[#F4E68E]";
  }
  if (thermalMetric <= 41) {
    return "bg-[#FDDC00]";
  }
  if (thermalMetric <= 51) {
    return "bg-[#FF7E1C]";
  }

  return "bg-[#E74C4C]";
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statusVisible, setStatusVisible] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusVariant, setStatusVariant] = useState<"success" | "error" | "info">("info");
  const [isTideLoading, setIsTideLoading] = useState(true);
  const [tideError, setTideError] = useState<string | null>(null);
  const [tidePredictionDate, setTidePredictionDate] = useState<string | null>(null);
  const [tideHourly, setTideHourly] = useState<TideHourlyPoint[]>([]);
  const [tideExtremes, setTideExtremes] = useState<TideExtreme[]>([]);
  const [lastTideExtreme, setLastTideExtreme] = useState<TideExtreme | null>(null);
  const [nextTideExtreme, setNextTideExtreme] = useState<TideExtreme | null>(null);
  const [currentTideHeight, setCurrentTideHeight] = useState<number | null>(null);
  const [tideTrend, setTideTrend] = useState<"rising" | "falling" | null>(null);

  const [weatherState, setWeatherState] = useState<WeatherState>({
    id: null,
    dateLabel: formatWeatherDateForCard(new Date()),
    temperature: 19,
    humidity: 60,
    heatIndex: 19,
    owmMain: "Clear",
    owmDescription: "clear sky",
    intensityDescription: "Normal",
    signalNo: "No Signal",
    manualDescription: "",
    broadcastDate: null,
    broadcastTime: null,
    recordedAt: null,
    iconPath: DRY_NORMAL_ICON_PATH,
  });
  const [snapshot, setSnapshot] = useState<SensorSnapshot>({
    waterLevel: null,
    statusText: null,
    updatedAt: null,
    sourceTable: null,
  });

  const alertLevel = inferAlertLevel(snapshot);
  const alertConfig = ALERT_LEVELS[alertLevel];
  const rangeLabel = resolveRangeLabel(snapshot.waterLevel, alertConfig.rangeLabel);
  const lastUpdateLabel = formatLastUpdate(snapshot.updatedAt);
  const weatherCardClass = resolveWeatherCardClass(
    weatherState.intensityDescription,
    weatherState.heatIndex,
  );

  const showStatus = (variant: "success" | "error" | "info", message: string) => {
    setStatusVariant(variant);
    setStatusMessage(message);
    setStatusVisible(true);
  };

  const loadWeatherFromSupabase = async (): Promise<boolean> => {
    const supabase = createClient();
    const { data } = await supabase
      .from("weather_logs")
      .select(
        "id, recorded_at, temperature, humidity, heat_index, weather_main, weather_description, intensity, signal_no, manual_description, icon_path, broadcast_date, broadcast_time",
      )
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return false;

    const row = data as {
      id: string;
      recorded_at: string;
      temperature: number;
      humidity: number | null;
      heat_index: number | null;
      weather_main: string | null;
      weather_description: string | null;
      intensity: string;
      signal_no: string | null;
      manual_description: string | null;
      broadcast_date: string | null;
      broadcast_time: string | null;
      icon_path: string | null;
    };

    const resolvedIconPath = row.icon_path ?? WEATHER_ICON_MAP[row.intensity] ?? DRY_NORMAL_ICON_PATH;

    const loadedState: WeatherState = {
      id: row.id,
      dateLabel: formatWeatherDateForCard(new Date(row.recorded_at)),
      temperature: row.temperature,
      humidity: row.humidity,
      heatIndex: row.heat_index ?? row.temperature,
      owmMain: row.weather_main ?? "-",
      owmDescription: row.weather_description ?? "-",
      intensityDescription: row.intensity,
      signalNo: row.signal_no ?? "No Signal",
      manualDescription: row.manual_description ?? "",
      broadcastDate: row.broadcast_date,
      broadcastTime: row.broadcast_time,
      recordedAt: row.recorded_at,
      iconPath: resolvedIconPath,
    };

    setWeatherState(loadedState);
    return true;
  };

  const loadTideFromSupabase = async (silent = false): Promise<void> => {
    if (!silent) {
      setIsTideLoading(true);
    }

    const supabase = createClient();

    try {
      const today = getManilaDate();
      const { data: predictionData, error: predictionError } = await supabase
        .from("tide_predictions")
        .select("prediction_date, tide_data")
        .lte("prediction_date", today)
        .order("prediction_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (predictionError) {
        throw new Error(predictionError.message);
      }

      if (!predictionData) {
        setTidePredictionDate(null);
        setTideHourly([]);
        setTideExtremes([]);
        setLastTideExtreme(null);
        setNextTideExtreme(null);
        setCurrentTideHeight(null);
        setTideTrend(null);
        setTideError("No tide prediction records found yet.");
        return;
      }

      const prediction = predictionData as TidePredictionRow;
      const tideData: TideExtreme[] = Array.isArray(prediction.tide_data)
        ? prediction.tide_data
            .map((entry): TideExtreme => ({
              type: entry?.type === "high" ? "high" : "low",
              time: typeof entry?.time === "string" ? entry.time : "",
              height: Number(entry?.height),
            }))
            .filter((entry) => entry.time && Number.isFinite(entry.height))
            .sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime())
        : [];

      const { data: hourlyRows, error: hourlyError } = await supabase
        .from("tide_hourly")
        .select("hour_of_day, estimated_height, confidence")
        .eq("prediction_date", prediction.prediction_date)
        .order("hour_of_day", { ascending: true });

      if (hourlyError) {
        throw new Error(hourlyError.message);
      }

      const hourly = ((hourlyRows ?? []) as TideHourlyRow[]).map((row) => ({
        hour: row.hour_of_day,
        estimatedHeight: Number(row.estimated_height),
        confidence: row.confidence ?? "medium",
      }));

      const nowMs = Date.now();
      const lastExtreme = [...tideData].reverse().find((entry) => new Date(entry.time).getTime() <= nowMs) ?? tideData[tideData.length - 1] ?? null;
      const nextExtreme = tideData.find((entry) => new Date(entry.time).getTime() > nowMs) ?? tideData[0] ?? null;
      const manilaNowRaw = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Manila",
        hour: "2-digit",
        hour12: false,
      }).format(new Date());
      const currentHourManila = Number.parseInt(manilaNowRaw, 10);
      const currentHourPoint = hourly.find((entry) => entry.hour === currentHourManila) ?? null;
      const prevHour = (currentHourManila + 23) % 24;
      const prevHourPoint = hourly.find((entry) => entry.hour === prevHour) ?? null;

      setTidePredictionDate(prediction.prediction_date);
      setTideHourly(hourly);
      setTideExtremes(tideData);
      setLastTideExtreme(lastExtreme);
      setNextTideExtreme(nextExtreme);
      setCurrentTideHeight(currentHourPoint?.estimatedHeight ?? null);
      setTideTrend(
        currentHourPoint && prevHourPoint
          ? currentHourPoint.estimatedHeight >= prevHourPoint.estimatedHeight
            ? "rising"
            : "falling"
          : null,
      );
      setTideError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load tide monitor data.";
      setTideError(message);
    } finally {
      if (!silent) {
        setIsTideLoading(false);
      }
    }
  };


  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;
    let liveChannel: ReturnType<typeof supabase.channel> | null = null;

    const loadLatestSensorData = async () => {
      const sources = [
        { table: "sensor_readings", orderBy: "created_at" },
        { table: "sensor_status", orderBy: "created_at" },
        { table: "water_levels", orderBy: "created_at" },
        { table: "sensor_logs", orderBy: "timestamp" },
      ];

      if (isMounted) {
        setIsLoadingData(true);
        setFetchError(null);
      }

      let found = false;
      for (const source of sources) {
        const { data: rows, error } = await supabase
          .from(source.table)
          .select("*")
          .order(source.orderBy, { ascending: false })
          .limit(1);

        if (error || !rows || rows.length === 0) {
          continue;
        }

        const row = rows[0] as Record<string, unknown>;
        const waterLevel = Number(
          row.water_level ?? row.level ?? row.sensor_level ?? row.reading ?? row.value ?? Number.NaN,
        );

        if (isMounted) {
          setSnapshot({
            waterLevel: Number.isNaN(waterLevel) ? null : waterLevel,
            statusText: (row.status ?? row.level_status ?? row.alert_status ?? row.alert_level ?? null) as string | null,
            updatedAt: (row.created_at ?? row.timestamp ?? row.recorded_at ?? null) as string | null,
            sourceTable: source.table,
          });
        }

        found = true;
        break;
      }

      if (!found && isMounted) {
        setFetchError("No sensor rows found yet. Waiting for Twilio to write records into Supabase.");
      }

      if (isMounted) {
        setIsLoadingData(false);
      }
    };

    const initialize = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/admin");
        return;
      }

      if (isMounted) {
        setIsChecking(false);
      }

      await loadLatestSensorData();

      liveChannel = supabase
        .channel("resina-dashboard-live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "sensor_readings" },
          () => void loadLatestSensorData(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "sensor_status" },
          () => void loadLatestSensorData(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "water_levels" },
          () => void loadLatestSensorData(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "sensor_logs" },
          () => void loadLatestSensorData(),
        )
        .subscribe();
    };

    void initialize();

    return () => {
      isMounted = false;
      if (liveChannel) {
        void supabase.removeChannel(liveChannel);
      }
    };
  }, [router]);

  useEffect(() => {
    let isMounted = true;
    let refreshTimer: ReturnType<typeof setInterval> | null = null;

    const initialize = async () => {
      await loadWeatherFromSupabase();
      if (!isMounted) return;

      refreshTimer = setInterval(() => {
        if (isMounted) {
          void loadWeatherFromSupabase();
        }
      }, 60_000);
    };

    void initialize();

    return () => {
      isMounted = false;
      if (refreshTimer !== null) clearInterval(refreshTimer);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const initialize = async () => {
      if (!mounted) return;
      await loadTideFromSupabase();
      if (!mounted) return;

      intervalId = setInterval(() => {
        if (mounted) {
          void loadTideFromSupabase(true);
        }
      }, 5 * 60 * 1000);
    };

    void initialize();

    return () => {
      mounted = false;
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }, []);

  if (isChecking) {
    return <AdminPageSkeleton title="Loading admin session..." blockCount={3} />;
  }

  return (
    <>
      <section className="px-5 py-6 md:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <CurrentSensorStatus
            alertConfig={alertConfig}
            rangeLabel={rangeLabel}
            waterLevel={snapshot.waterLevel}
            lastUpdateLabel={lastUpdateLabel}
            isLoadingData={isLoadingData}
            sourceTable={snapshot.sourceTable}
            fetchError={fetchError}
          />

          <WeatherUpdateSection
            weatherState={weatherState}
            weatherCardClass={weatherCardClass}
          />

          <TideMonitorSection
            isLoading={isTideLoading}
            error={tideError}
            predictionDate={tidePredictionDate}
            currentHeight={currentTideHeight}
            trend={tideTrend}
            extremes={tideExtremes}
            lastExtreme={lastTideExtreme}
            nextExtreme={nextTideExtreme}
            hourly={tideHourly}
          />
        </div>
      </section>

      <StatusFeedbackModal
        visible={statusVisible}
        message={statusMessage}
        variant={statusVariant}
        onClose={() => {
          setStatusVisible(false);
          setStatusMessage("");
        }}
      />
    </>
  );
}
