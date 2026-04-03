"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { ActivityLogSection } from "./components/activity-log-section";
import { CurrentSensorStatus } from "./components/current-sensor-status";
import { WeatherUpdateSection } from "./components/weather-update-section";
import { TideMonitorSection } from "./components/tide-monitor-section";
import StatusFeedbackModal from "../components/status-feedback-modal";

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
  colorCodedWarning: string;
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

const WARNING_OPTIONS = ["No Warning", "Yellow Warning", "Orange Warning", "Red Warning"] as const;
const SIGNAL_OPTIONS = ["No Signal", "Signal #1", "Signal #2", "Signal #3", "Signal #4", "Signal #5"] as const;
const OPENWEATHER_REFRESH_MS = 3_600_000;
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
    noticeClass: string;
    description: string;
  }
> = {
  normal: {
    title: "Normal Level",
    badge: "Alert Level 1",
    rangeLabel: "1.5 - 2.49m",
    leftPanelClass: "bg-[#4CAF50]",
    noticeClass: "border-[#c9e7cd] bg-[#edf8ef] text-[#355f3a]",
    description: "Normal ang antas ng tubig. Ligtas ang sitwasyon at walang inaasahang banta sa ngayon.",
  },
  critical: {
    title: "Critical Level",
    badge: "Alert Level 2",
    rangeLabel: "2.5 - 2.9m",
    leftPanelClass: "bg-[#F7C520]",
    noticeClass: "border-[#efdfad] bg-[#fdf9ea] text-[#6a5c28]",
    description: "Mataas ang tubig. Maging alerto, ihanda ang mga gamit, at patuloy na magmonitor sa mga balita.",
  },
  evacuation: {
    title: "Evacuation Level",
    badge: "Alert Level 3",
    rangeLabel: "3.0 - 3.9m",
    leftPanelClass: "bg-[#FF7E1C]",
    noticeClass: "border-[#efcec1] bg-[#fef5f1] text-[#70402a]",
    description: "Mapanganib ang antas ng tubig. Lumikas na agad patungo sa mas mataas na lugar o evacuation center.",
  },
  spilling: {
    title: "Spilling Level",
    badge: "Alert Level 4",
    rangeLabel: "4.0+m",
    leftPanelClass: "bg-[#A82A2A]",
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

function resolveWeatherCardClass(intensity: string, warning: string, heatIndex: number | null): string {
  const normalizedWarning = warning.toLowerCase();

  // Warning color takes precedence over temperature/intensity colors.
  if (normalizedWarning.includes("red")) {
    return "bg-[#E74C4C]";
  }
  if (normalizedWarning.includes("orange")) {
    return "bg-[#FF7E1C]";
  }
  if (normalizedWarning.includes("yellow")) {
    return "bg-[#F7D400]";
  }

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
  const openWeatherApiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
  const [isChecking, setIsChecking] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isWeatherModalOpen, setIsWeatherModalOpen] = useState(false);
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [isSavingWeather, setIsSavingWeather] = useState(false);
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
    colorCodedWarning: "No Warning",
    signalNo: "No Signal",
    manualDescription: "",
    broadcastDate: null,
    broadcastTime: null,
    recordedAt: null,
    iconPath: DRY_NORMAL_ICON_PATH,
  });
  const [weatherDraft, setWeatherDraft] = useState<WeatherState>({
    id: null,
    dateLabel: formatWeatherDateForCard(new Date()),
    temperature: 19,
    humidity: 60,
    heatIndex: 19,
    owmMain: "Clear",
    owmDescription: "clear sky",
    intensityDescription: "Normal",
    colorCodedWarning: "No Warning",
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
    weatherState.colorCodedWarning,
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
        "id, recorded_at, temperature, humidity, heat_index, weather_main, weather_description, intensity, color_coded_warning, signal_no, manual_description, icon_path, broadcast_date, broadcast_time",
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
      color_coded_warning: string;
      signal_no: string;
      manual_description: string | null;
      broadcast_date: string | null;
      broadcast_time: string | null;
      icon_path: string | null;
    };

    const loadedState: WeatherState = {
      id: row.id,
      dateLabel: formatWeatherDateForCard(new Date(row.recorded_at)),
      temperature: row.temperature,
      humidity: row.humidity,
      heatIndex: row.heat_index ?? row.temperature,
      owmMain: row.weather_main ?? "-",
      owmDescription: row.weather_description ?? "-",
      intensityDescription: row.intensity,
      colorCodedWarning: row.color_coded_warning,
      signalNo: row.signal_no,
      manualDescription: row.manual_description ?? "",
      broadcastDate: row.broadcast_date,
      broadcastTime: row.broadcast_time,
      recordedAt: row.recorded_at,
      iconPath: row.icon_path ?? WEATHER_ICON_MAP[row.intensity] ?? DRY_NORMAL_ICON_PATH,
    };

    setWeatherState(loadedState);
    setWeatherDraft(loadedState);

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
      const tideData = Array.isArray(prediction.tide_data)
        ? prediction.tide_data
            .map((entry) => ({
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

  const persistWeatherRecord = async (nextState: WeatherState) => {
    const supabase = createClient();
    const { data: insertedRow, error: insertError } = await supabase
      .from("weather_logs")
      .insert({
        temperature: nextState.temperature,
        humidity: nextState.humidity,
        heat_index: nextState.heatIndex,
        weather_main: nextState.owmMain,
        weather_description: nextState.owmDescription,
        intensity: nextState.intensityDescription,
        color_coded_warning: nextState.colorCodedWarning,
        signal_no: nextState.signalNo,
        manual_description: nextState.manualDescription,
        icon_path: nextState.iconPath,
      })
      .select("id, recorded_at, broadcast_date, broadcast_time")
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    await supabase.from("weather_logs").delete().lt("recorded_at", cutoff.toISOString());

    return {
      ...nextState,
      id: insertedRow?.id ?? null,
      recordedAt: insertedRow?.recorded_at ?? null,
      broadcastDate: insertedRow?.broadcast_date ?? null,
      broadcastTime: insertedRow?.broadcast_time ?? null,
      dateLabel: formatWeatherDateForCard(new Date(insertedRow?.recorded_at ?? new Date())),
    };
  };

  const fetchLatestWeather = async (applyToPublishedCard: boolean, notifyError = false) => {
    if (!openWeatherApiKey) {
      setWeatherError("Weather API key is missing in the web environment.");
      if (notifyError) {
        showStatus("error", "Weather API key is missing in the web environment.");
      }
      return;
    }

    setIsFetchingWeather(true);
    setWeatherError(null);

    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=Olongapo,PH&units=metric&appid=${openWeatherApiKey}`,
      );

      if (!response.ok) {
        throw new Error("Weather data request failed.");
      }

      const data = (await response.json()) as {
        main?: { temp?: number; humidity?: number };
        weather?: Array<{ main?: string; description?: string; icon?: string }>;
        sys?: { sunrise?: number; sunset?: number };
      };

      const temperature = Math.round(data.main?.temp ?? 25);
      const humidity = Math.round(data.main?.humidity ?? 60);
      const weatherMain = data.weather?.[0]?.main ?? "Clear";
      const weatherDescription = data.weather?.[0]?.description ?? "";
      const weatherIconCode = data.weather?.[0]?.icon ?? "01d";
      const analyzed = analyzeOpenWeather(
        weatherMain,
        weatherDescription,
        temperature,
        humidity,
        weatherIconCode,
        data.sys?.sunrise,
        data.sys?.sunset,
      );
      const selectedWarning = applyToPublishedCard
        ? weatherState.colorCodedWarning
        : weatherDraft.colorCodedWarning;
      const selectedSignal = applyToPublishedCard ? weatherState.signalNo : weatherDraft.signalNo;
      const carriedDescription = weatherDraft.manualDescription.trim()
        ? weatherDraft.manualDescription
        : weatherState.manualDescription;

      const mapped: WeatherState = {
        id: null,
        dateLabel: formatWeatherDateForCard(new Date()),
        temperature,
        humidity,
        heatIndex: analyzed.heatIndex,
        owmMain: weatherMain,
        owmDescription: weatherDescription,
        intensityDescription: analyzed.intensityDescription,
        colorCodedWarning: selectedWarning,
        signalNo: selectedSignal,
        manualDescription: carriedDescription,
        broadcastDate: null,
        broadcastTime: null,
        recordedAt: null,
        iconPath: analyzed.iconPath,
      };

      // Keep admin-authored manual description when refreshing auto weather metrics.
      setWeatherDraft((current) => ({
        ...mapped,
        manualDescription: current.manualDescription.trim() ? current.manualDescription : carriedDescription,
      }));
      if (applyToPublishedCard) {
        const saved = await persistWeatherRecord(mapped);
        setWeatherState(saved);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load weather data.";
      setWeatherError(message);
      if (notifyError) {
        showStatus("error", message);
      }
    } finally {
      setIsFetchingWeather(false);
    }
  };

  const openWeatherUpdateModal = async () => {
    setWeatherError(null);
    setIsWeatherModalOpen(true);
    await fetchLatestWeather(false, true);
  };

  const handlePublishWeather = async () => {
    const normalized: WeatherState = {
      ...weatherDraft,
      iconPath: weatherDraft.iconPath || WEATHER_ICON_MAP[weatherDraft.intensityDescription] || DRY_NORMAL_ICON_PATH,
      dateLabel: formatWeatherDateForCard(new Date()),
    };

    setIsSavingWeather(true);
    setWeatherError(null);

    try {
      const saved = await persistWeatherRecord(normalized);
      setWeatherState(saved);
      setWeatherDraft(saved);
      setIsWeatherModalOpen(false);
      showStatus("success", "Weather update published.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save weather.";
      setWeatherError(message);
      showStatus("error", message);
    } finally {
      setIsSavingWeather(false);
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
    let alignedTimer: ReturnType<typeof setTimeout> | null = null;
    let recurringTimer: ReturnType<typeof setInterval> | null = null;

    const doFetch = () => {
      if (isMounted) void fetchLatestWeather(true);
    };

    const scheduleHourlyFetch = () => {
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setMinutes(0, 0, 0);
      nextHour.setHours(nextHour.getHours() + 1);
      const delayMs = Math.max(1000, nextHour.getTime() - now.getTime());

      alignedTimer = setTimeout(() => {
        doFetch();
        if (isMounted) {
          recurringTimer = setInterval(doFetch, OPENWEATHER_REFRESH_MS);
        }
      }, delayMs);
    };

    const initialize = async () => {
      // Show last saved state immediately; fall back to live API fetch if nothing stored
      const hasData = await loadWeatherFromSupabase();
      if (!hasData && isMounted) {
        doFetch();
      }

      // Always refresh once on load so day/night icon and weather state are current.
      if (isMounted) {
        doFetch();
      }

      // Align recurring refresh to exact top-of-hour timestamps.
      if (isMounted) scheduleHourlyFetch();
    };

    void initialize();

    return () => {
      isMounted = false;
      if (alignedTimer !== null) clearTimeout(alignedTimer);
      if (recurringTimer !== null) clearInterval(recurringTimer);
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
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#f3f5f5]">
        <p className="text-[#4b5563]">Loading admin session...</p>
      </main>
    );
  }

  return (
    <>
      <section className="px-5 py-6 md:px-8">
          <CurrentSensorStatus
            alertConfig={alertConfig}
            rangeLabel={rangeLabel}
            lastUpdateLabel={lastUpdateLabel}
            isLoadingData={isLoadingData}
            sourceTable={snapshot.sourceTable}
            fetchError={fetchError}
          />

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <button
              type="button"
              className="group rounded-xl border border-[#e5e7eb] bg-white p-4 text-left shadow-sm transition hover:border-[#cde8d5] hover:bg-[#f9fdf9]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-[#4CAF50] p-2 text-white">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7l8-4 8 4-8 4-8-4zm0 10l8 4 8-4M4 12l8 4 8-4" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-base font-semibold">Create Announcement</p>
                    <p className="mt-1 text-xs text-[#6b7280]">Broadcast to all residents</p>
                  </div>
                </div>
                <span className="self-center text-[#9ca3af] transition group-hover:translate-x-0.5">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => router.push("/admin/history")}
              className="group rounded-xl border border-[#e5e7eb] bg-white p-4 text-left shadow-sm transition hover:border-[#cde8d5] hover:bg-[#f9fdf9]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-[#4CAF50] p-2 text-white">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-base font-semibold">Detailed History</p>
                    <p className="mt-1 text-xs text-[#6b7280]">Full sensor logs and reports</p>
                  </div>
                </div>
                <span className="self-center text-[#9ca3af] transition group-hover:translate-x-0.5">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => router.push("/admin/profile")}
              className="group rounded-xl border border-[#e5e7eb] bg-white p-4 text-left shadow-sm transition hover:border-[#cde8d5] hover:bg-[#f9fdf9]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-[#4CAF50] p-2 text-white">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A7.5 7.5 0 1118.88 17.8M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-base font-semibold">Administrative Details</p>
                    <p className="mt-1 text-xs text-[#6b7280]">Admin profile and list of roles</p>
                  </div>
                </div>
                <span className="self-center text-[#9ca3af] transition group-hover:translate-x-0.5">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </button>
          </div>

          <WeatherUpdateSection
            weatherState={weatherState}
            weatherDraft={weatherDraft}
            weatherCardClass={weatherCardClass}
            isWeatherModalOpen={isWeatherModalOpen}
            isFetchingWeather={isFetchingWeather}
            isSavingWeather={isSavingWeather}
            warningOptions={WARNING_OPTIONS}
            signalOptions={SIGNAL_OPTIONS}
            onOpenWeatherUpdateModal={() => void openWeatherUpdateModal()}
            onCloseWeatherModal={() => setIsWeatherModalOpen(false)}
            onRefreshWeather={() => void fetchLatestWeather(false, true)}
            onPublishWeather={() => void handlePublishWeather()}
            onWarningChange={(value) => setWeatherDraft((current) => ({ ...current, colorCodedWarning: value }))}
            onSignalChange={(value) => setWeatherDraft((current) => ({ ...current, signalNo: value }))}
            onManualDescriptionChange={(value) =>
              setWeatherDraft((current) => ({ ...current, manualDescription: value }))
            }
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

          <ActivityLogSection />
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
