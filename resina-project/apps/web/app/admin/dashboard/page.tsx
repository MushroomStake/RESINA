"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

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
  intensityDescription: string;
  colorCodedWarning: string;
  signalNo: string;
  manualDescription: string;
  broadcastDate: string | null;
  broadcastTime: string | null;
  recordedAt: string | null;
  iconPath: string;
};

const WARNING_OPTIONS = ["No Warning", "Yellow Warning", "Orange Warning", "Red Warning"] as const;
const SIGNAL_OPTIONS = ["No Signal", "Signal #1", "Signal #2", "Signal #3"] as const;

const WEATHER_ICON_MAP: Record<string, string> = {
  Normal: "/weather/dry-season/Sun - Normal.png",
  Caution: "/weather/dry-season/sun - Caution.png",
  "Extreme Caution": "/weather/dry-season/sun - Extreme Caution.png",
  Danger: "/weather/dry-season/sun - Danger.png",
  "Extreme Danger": "/weather/dry-season/sun - Danger.png",
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

  const now = Date.now();
  const timestamp = new Date(updatedAt).getTime();
  const minutes = Math.max(0, Math.round((now - timestamp) / 60000));

  if (minutes < 1) {
    return "Last update: just now";
  }
  if (minutes === 1) {
    return "Last update: 1 min ago";
  }

  return `Last update: ${minutes} mins ago`;
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

function inferIntensity(main: string, description: string, temperature: number): string {
  const lowerMain = main.toLowerCase();
  const lowerDescription = description.toLowerCase();

  if (lowerMain.includes("thunder") || lowerDescription.includes("thunder")) {
    return "Torrential Rain";
  }

  if (lowerMain.includes("rain")) {
    if (lowerDescription.includes("heavy")) {
      return "Heavy Rain";
    }
    if (lowerDescription.includes("light") || lowerMain.includes("drizzle")) {
      return "Light Rain";
    }
    return "Moderate Rain";
  }

  if (lowerMain.includes("drizzle")) {
    return "Light Rain";
  }

  if (temperature >= 52) {
    return "Extreme Danger";
  }
  if (temperature >= 42) {
    return "Danger";
  }
  if (temperature >= 33) {
    return "Extreme Caution";
  }
  if (temperature >= 27) {
    return "Caution";
  }

  return "Normal";
}

function inferWarning(intensity: string): string {
  if (intensity === "Torrential Rain") {
    return "Red Warning";
  }
  if (intensity === "Heavy Rain") {
    return "Orange Warning";
  }
  if (intensity === "Moderate Rain") {
    return "Yellow Warning";
  }

  return "No Warning";
}

function inferSignal(intensity: string): string {
  if (intensity === "Torrential Rain") {
    return "Signal #3";
  }
  if (intensity === "Heavy Rain") {
    return "Signal #2";
  }
  if (intensity === "Moderate Rain") {
    return "Signal #1";
  }

  return "No Signal";
}

function isRainyIntensity(intensity: string): boolean {
  return (
    intensity === "Light Rain" ||
    intensity === "Moderate Rain" ||
    intensity === "Heavy Rain" ||
    intensity === "Torrential Rain"
  );
}

function resolveWeatherCardClass(intensity: string, warning: string, temperature: number): string {
  if (isRainyIntensity(intensity)) {
    const normalizedWarning = warning.toLowerCase();

    if (normalizedWarning.includes("red")) {
      return "bg-[#E74C4C]";
    }
    if (normalizedWarning.includes("orange")) {
      return "bg-[#FF7E1C]";
    }
    if (normalizedWarning.includes("yellow")) {
      return "bg-[#F7D400]";
    }

    return "bg-[#B3B7C0]";
  }

  if (temperature < 27) {
    return "bg-[#ECE8D2]";
  }
  if (temperature <= 32) {
    return "bg-[#F4E68E]";
  }
  if (temperature <= 41) {
    return "bg-[#FDDC00]";
  }
  if (temperature <= 51) {
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
  const [phNow, setPhNow] = useState(() => new Date());
  const [isWeatherModalOpen, setIsWeatherModalOpen] = useState(false);
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [isSavingWeather, setIsSavingWeather] = useState(false);
  const [weatherSaveMessage, setWeatherSaveMessage] = useState<string | null>(null);

  const [weatherState, setWeatherState] = useState<WeatherState>({
    id: null,
    dateLabel: formatWeatherDateForCard(new Date()),
    temperature: 19,
    intensityDescription: "Heavy Rain",
    colorCodedWarning: "Orange Warning",
    signalNo: "Signal #2",
    manualDescription: "",
    broadcastDate: null,
    broadcastTime: null,
    recordedAt: null,
    iconPath: "/weather/wet-season/Heavy Rain.png",
  });
  const [weatherDraft, setWeatherDraft] = useState<WeatherState>({
    id: null,
    dateLabel: formatWeatherDateForCard(new Date()),
    temperature: 19,
    intensityDescription: "Heavy Rain",
    colorCodedWarning: "Orange Warning",
    signalNo: "Signal #2",
    manualDescription: "",
    broadcastDate: null,
    broadcastTime: null,
    recordedAt: null,
    iconPath: "/weather/wet-season/Heavy Rain.png",
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
  const weatherCardClass = resolveWeatherCardClass(
    weatherState.intensityDescription,
    weatherState.colorCodedWarning,
    weatherState.temperature,
  );

  const loadWeatherFromSupabase = async (): Promise<boolean> => {
    const supabase = createClient();
    const { data } = await supabase
      .from("weather_logs")
      .select("id, recorded_at, temperature, intensity, color_coded_warning, signal_no, manual_description, icon_path, broadcast_date, broadcast_time")
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return false;

    const row = data as {
      id: string;
      recorded_at: string;
      temperature: number;
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
      intensityDescription: row.intensity,
      colorCodedWarning: row.color_coded_warning,
      signalNo: row.signal_no,
      manualDescription: row.manual_description ?? "",
      broadcastDate: row.broadcast_date,
      broadcastTime: row.broadcast_time,
      recordedAt: row.recorded_at,
      iconPath: row.icon_path ?? WEATHER_ICON_MAP[row.intensity] ?? "/weather/wet-season/Heavy Rain.png",
    };

    setWeatherState(loadedState);
    setWeatherDraft(loadedState);

    return true;
  };

  const persistWeatherRecord = async (nextState: WeatherState) => {
    const supabase = createClient();
    const { data: insertedRow, error: insertError } = await supabase
      .from("weather_logs")
      .insert({
        temperature: nextState.temperature,
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

  const fetchLatestWeather = async (applyToPublishedCard: boolean) => {
    if (!openWeatherApiKey) {
      setWeatherError("Missing NEXT_PUBLIC_OPENWEATHER_API_KEY in web environment.");
      return;
    }

    setIsFetchingWeather(true);
    setWeatherError(null);

    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=Olongapo,PH&units=metric&appid=${openWeatherApiKey}`,
      );

      if (!response.ok) {
        throw new Error("OpenWeatherMap request failed.");
      }

      const data = (await response.json()) as {
        main?: { temp?: number };
        weather?: Array<{ main?: string; description?: string }>;
      };

      const temperature = Math.round(data.main?.temp ?? 25);
      const weatherMain = data.weather?.[0]?.main ?? "Clear";
      const weatherDescription = data.weather?.[0]?.description ?? "";

      const intensityDescription = inferIntensity(weatherMain, weatherDescription, temperature);
      const colorCodedWarning = inferWarning(intensityDescription);
      const signalNo = inferSignal(intensityDescription);
      const iconPath = WEATHER_ICON_MAP[intensityDescription] ?? "/weather/wet-season/Heavy Rain.png";
      const carriedDescription = weatherDraft.manualDescription.trim()
        ? weatherDraft.manualDescription
        : weatherState.manualDescription;

      const mapped: WeatherState = {
        id: null,
        dateLabel: formatWeatherDateForCard(new Date()),
        temperature,
        intensityDescription,
        colorCodedWarning,
        signalNo,
        manualDescription: carriedDescription,
        broadcastDate: null,
        broadcastTime: null,
        recordedAt: null,
        iconPath,
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
    } finally {
      setIsFetchingWeather(false);
    }
  };

  const openWeatherUpdateModal = async () => {
    setWeatherError(null);
    setIsWeatherModalOpen(true);
    await fetchLatestWeather(false);
  };

  const handlePublishWeather = async () => {
    const normalized: WeatherState = {
      ...weatherDraft,
      iconPath: WEATHER_ICON_MAP[weatherDraft.intensityDescription] ?? weatherDraft.iconPath,
      dateLabel: formatWeatherDateForCard(new Date()),
    };

    setIsSavingWeather(true);
    setWeatherSaveMessage(null);
    setWeatherError(null);

    try {
      const saved = await persistWeatherRecord(normalized);
      setWeatherState(saved);
      setWeatherDraft(saved);
      setIsWeatherModalOpen(false);
      setWeatherSaveMessage("Saved.");
      setTimeout(() => setWeatherSaveMessage(null), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save weather.";
      setWeatherError(message);
    } finally {
      setIsSavingWeather(false);
    }
  };

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;
    let refreshTimer: ReturnType<typeof setInterval> | null = null;
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

      refreshTimer = setInterval(() => {
        void loadLatestSensorData();
      }, 10000);
    };

    void initialize();

    return () => {
      isMounted = false;
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
      if (liveChannel) {
        void supabase.removeChannel(liveChannel);
      }
    };
  }, [router]);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhNow(new Date());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let recurringTimer: ReturnType<typeof setInterval> | null = null;
    let initialTimer: ReturnType<typeof setTimeout> | null = null;

    const doFetch = () => {
      if (isMounted) void fetchLatestWeather(true);
    };

    const initialize = async () => {
      // Show last saved state immediately; fall back to live API fetch if nothing stored
      const hasData = await loadWeatherFromSupabase();
      if (!hasData && isMounted) {
        doFetch();
      }

      // Fire at exact top of next hour, then every hour.
      if (isMounted) {
        const now = new Date();
        const msUntilNextHour =
          (60 - now.getMinutes()) * 60_000 -
          now.getSeconds() * 1_000 -
          now.getMilliseconds();

        initialTimer = setTimeout(() => {
          doFetch();
          recurringTimer = setInterval(doFetch, 3_600_000);
        }, msUntilNextHour);
      }
    };

    void initialize();

    return () => {
      isMounted = false;
      if (initialTimer !== null) clearTimeout(initialTimer);
      if (recurringTimer !== null) clearInterval(recurringTimer);
    };
  }, []);

  const phTime = phNow
    .toLocaleTimeString("en-PH", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .replace(" ", "")
    .toUpperCase();

  const phDate = phNow
    .toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
      month: "short",
      day: "2-digit",
      year: "numeric",
    })
    .toUpperCase();

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
          <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e7eb] pb-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-[#6b7280]">Dashboard</p>
              <h1 className="text-xl font-bold text-[#111827]">Real-time Monitoring</h1>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-[#d9dde1] bg-[#f3f4f6] px-3 py-1.5 text-xs text-[#4b5563] shadow-sm">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
              </svg>
              <span className="font-semibold tracking-wide text-[#374151]">{phTime}</span>
              <span className="text-[#9ca3af]">|</span>
              <span className="tracking-wide text-[#6b7280]">{phDate}</span>
            </div>
          </header>

          <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white lg:grid-cols-[280px_1fr]">
            <div className={`flex flex-col items-center justify-center px-6 py-8 text-white ${alertConfig.leftPanelClass}`}>
              <div className="mb-4 rounded-full bg-white/15 p-4">
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 5-3.5 8.5-7 9-3.5-.5-7-4-7-9V7l7-4z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 3h.01" />
                </svg>
              </div>
              <h2 className="whitespace-nowrap text-center text-[40px] font-extrabold leading-none tracking-tight">
                {alertConfig.title}
              </h2>
              <span className="mt-3 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#334155]">
                {alertConfig.badge}
              </span>
            </div>

            <div className="px-6 py-7">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold uppercase tracking-wide text-[#6b7280]">Current Sensor Status</p>
                <p className="text-xs italic text-[#9ca3af]">{formatLastUpdate(snapshot.updatedAt)}</p>
              </div>

              <p className="mt-2 text-5xl font-extrabold text-[#111827]">{rangeLabel}</p>

              <div className={`mt-4 rounded-xl border px-4 py-3 text-sm leading-7 ${alertConfig.noticeClass}`}>
                {alertConfig.description}
              </div>

              {isLoadingData ? <p className="mt-3 text-xs text-[#6b7280]">Loading latest sensor row...</p> : null}
              {snapshot.sourceTable ? (
                <p className="mt-2 text-xs text-[#9ca3af]">Data source: {snapshot.sourceTable}</p>
              ) : null}
              {fetchError ? <p className="mt-2 text-xs text-[#b91c1c]">{fetchError}</p> : null}
            </div>
          </div>

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
              onClick={() => router.push("/admin/profile")}
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

          <section className="mt-6 rounded-2xl border border-[#e5e7eb] bg-white p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-[#4b5563]">Weather Update</h3>
              <button
                type="button"
                onClick={() => void openWeatherUpdateModal()}
                className="rounded-lg bg-[#4CAF50] px-3 py-1.5 text-xs font-semibold text-white"
              >
                Weather Update
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
              <div
                className={`relative min-h-[195px] overflow-hidden rounded-2xl px-7 py-7 text-[#2f3850] ${weatherCardClass}`}
              >
                <div className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-wide">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                  </svg>
                  <span>{weatherState.dateLabel}</span>
                </div>

                <p className="absolute left-7 top-1/2 z-10 -translate-y-1/2 text-8xl font-extrabold leading-none">
                  {weatherState.temperature}°C
                </p>

                <Image
                  src={weatherState.iconPath}
                  alt={weatherState.intensityDescription}
                  width={170}
                  height={170}
                  className="absolute -right-3 top-1/2 h-[154px] w-[154px] -translate-y-1/2 object-contain"
                />
              </div>

              <div className="grid gap-2 rounded-xl border border-[#e5e7eb] p-4 text-sm text-[#4b5563]">
                <p>
                  <span className="font-semibold">Weather Intensity:</span> {weatherState.intensityDescription}
                </p>
                <p>
                  <span className="font-semibold">Color Coded Warning:</span> {weatherState.colorCodedWarning}
                </p>
                <p>
                  <span className="font-semibold">Signal Level:</span> {weatherState.signalNo}
                </p>
                <p className="min-w-0 text-xs text-[#6b7280]">
                  <span className="font-semibold text-[#4b5563]">Description:</span>{" "}
                  <span
                    className="inline-block max-w-full truncate align-bottom"
                    title={weatherState.manualDescription || "-"}
                  >
                    {weatherState.manualDescription || "-"}
                  </span>
                </p>
                {weatherSaveMessage ? <p className="text-xs text-[#15803d]">{weatherSaveMessage}</p> : null}
                {weatherError ? <p className="text-xs text-[#b91c1c]">{weatherError}</p> : null}
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-[#e5e7eb] bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-[#111827]">Activity Log</h3>
              <span className="text-xs text-[#6b7280]">Standby mode</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[#6b7280]">
                  <tr>
                    <th className="pb-2 font-medium">Date & Time</th>
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody className="text-[#374151]">
                  <tr className="border-t border-[#f0f2f4]">
                    <td className="py-3">Standby</td>
                    <td className="py-3">System</td>
                    <td className="py-3">Activity log module is ready for live events.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
      </section>

      {isWeatherModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[820px] overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-5">
              <h2 className="text-2xl font-bold uppercase text-[#1f2937]">Weather Update</h2>
              <button
                type="button"
                onClick={() => setIsWeatherModalOpen(false)}
                className="rounded-md p-1 text-[#6b7280] hover:bg-[#f3f4f6]"
                aria-label="Close modal"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="weather-temperature" className="mb-1 block text-sm font-medium text-[#374151]">
                    Current Temperature (°C)
                  </label>
                  <input
                    id="weather-temperature"
                    title="Current temperature in Celsius"
                    type="number"
                    value={weatherDraft.temperature}
                    readOnly
                    disabled
                    className="w-full rounded-lg border border-[#d1d5db] bg-[#f3f4f6] px-3 py-2 text-sm text-[#6b7280]"
                  />
                </div>

                <div>
                  <label htmlFor="weather-intensity" className="mb-1 block text-sm font-medium text-[#374151]">
                    Intensity Description
                  </label>
                  <input
                    id="weather-intensity"
                    title="Weather intensity description"
                    value={weatherDraft.intensityDescription}
                    readOnly
                    disabled
                    className="w-full rounded-lg border border-[#d1d5db] bg-[#f3f4f6] px-3 py-2 text-sm text-[#6b7280]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="weather-warning" className="mb-1 block text-sm font-medium text-[#374151]">
                    Color Coded Warning
                  </label>
                  <select
                    id="weather-warning"
                    title="Color coded warning"
                    value={weatherDraft.colorCodedWarning}
                    onChange={(event) =>
                      setWeatherDraft((current) => ({ ...current, colorCodedWarning: event.target.value }))
                    }
                    className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm focus:border-[#4CAF50] focus:outline-none"
                  >
                    {WARNING_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="weather-signal" className="mb-1 block text-sm font-medium text-[#374151]">
                    Signal No.
                  </label>
                  <select
                    id="weather-signal"
                    title="Weather signal number"
                    value={weatherDraft.signalNo}
                    onChange={(event) => setWeatherDraft((current) => ({ ...current, signalNo: event.target.value }))}
                    className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm focus:border-[#4CAF50] focus:outline-none"
                  >
                    {SIGNAL_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="weather-manual-description" className="mb-1 block text-sm font-medium text-[#374151]">
                  Description (Manual)
                </label>
                <textarea
                  id="weather-manual-description"
                  title="Weather manual description"
                  placeholder="Enter any description format for broadcast"
                  value={weatherDraft.manualDescription}
                  onChange={(event) => setWeatherDraft((current) => ({ ...current, manualDescription: event.target.value }))}
                  rows={5}
                  className="w-full resize-none rounded-lg border border-[#d1d5db] px-3 py-2 text-sm focus:border-[#4CAF50] focus:outline-none"
                />
              </div>

              {weatherError ? <p className="text-sm text-[#b91c1c]">{weatherError}</p> : null}
            </div>

            <div className="flex items-center justify-between border-t border-[#e5e7eb] px-6 py-4">
              <button
                type="button"
                onClick={() => setIsWeatherModalOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-[#374151] hover:bg-[#f3f4f6]"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void fetchLatestWeather(false)}
                  disabled={isFetchingWeather}
                  className="rounded-lg border border-[#d1d5db] px-3 py-2 text-sm text-[#374151] hover:bg-[#f9fafb] disabled:opacity-60"
                >
                  {isFetchingWeather ? "Refreshing..." : "Refresh from OpenWeather"}
                </button>
                <button
                  type="button"
                  onClick={() => void handlePublishWeather()}
                  disabled={isSavingWeather}
                  className="rounded-lg bg-[#4CAF50] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3d9a40] disabled:opacity-60"
                >
                  {isSavingWeather ? "Publishing..." : "Publish Now"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
