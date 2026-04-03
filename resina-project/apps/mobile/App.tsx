import "./global.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { BlurView } from "expo-blur";
import {
  Animated,
  AppState,
  Easing,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";
import { clearExpiredCaches, readCache, writeCache } from "./lib/cache";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { BottomNav, type DashboardTab } from "./components/bottom-nav";
import { LoadingToast } from "./components/loading-toast";
import { StatusToast } from "./components/status-toast";
import { AnnouncementCommentsModal } from "./components/announcement-comments-modal";
import { HomeHeroSection } from "./components/home-hero-section";
import { WeatherSection } from "./components/weather-section";
import { TideSection } from "./components/tide-section";
import { QuickActionsGrid } from "./components/quick-actions-grid";
import { AnnouncementsSection } from "./components/announcements-section";
import { HistorySection } from "./components/history-section";
import { ProfileSection } from "./components/profile-section";

type AuthMode = "login" | "register";
type AlertLevelKey = "normal" | "critical" | "evacuation" | "spilling";
type ResidentStatus = "resident" | "non_resident";

type LoginForm = {
  email: string;
  password: string;
};

type RegisterForm = {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  residentStatus: ResidentStatus;
  addressPurok: string;
  password: string;
  confirmPassword: string;
};

type SensorSnapshot = {
  waterLevel: number | null;
  statusText: string | null;
  updatedAt: string | null;
};

type WeatherSnapshot = {
  recordedAt: string | null;
  dateLabel: string;
  temperature: number;
  iconPath: string;
  intensityDescription: string;
  conditionDescription: string;
  humidity: number;
  heatIndex: number;
  manualDescription: string;
  colorCodedWarning: string;
  signalNo: string;
};

type WeatherRow = {
  recorded_at?: string | null;
  temperature?: number | string | null;
  icon_path?: string | null;
  humidity?: number | string | null;
  heat_index?: number | string | null;
  weather_description?: string | null;
  intensity?: string | null;
  color_coded_warning?: string | null;
  signal_no?: string | null;
  manual_description?: string | null;
};

type HomeAtmosphereTheme = {
  base: string;
  auraTop: string;
  auraBottom: string;
  veil: string;
  blurTint: "light" | "dark";
  textVariant: "light" | "dark";
  blurIntensity: number;
};

type WeatherVisualMode = "sunny" | "cloudy" | "night" | "rainy-day" | "rainy-night";

type WeatherShowcaseScene = {
  mode: WeatherVisualMode;
  theme: HomeAtmosphereTheme;
};

const DASHBOARD_TAB_ATMOSPHERE: Record<Exclude<DashboardTab, "home">, HomeAtmosphereTheme> = {
  news: {
    base: "#0c1e39",
    auraTop: "rgba(55, 121, 206, 0.24)",
    auraBottom: "rgba(28, 79, 150, 0.18)",
    veil: "rgba(8, 18, 35, 0.22)",
    blurTint: "dark",
    textVariant: "light",
    blurIntensity: 12,
  },
  history: {
    base: "#0d213b",
    auraTop: "rgba(64, 146, 141, 0.22)",
    auraBottom: "rgba(30, 106, 116, 0.16)",
    veil: "rgba(8, 18, 35, 0.22)",
    blurTint: "dark",
    textVariant: "light",
    blurIntensity: 12,
  },
  profile: {
    base: "#10233f",
    auraTop: "rgba(100, 120, 193, 0.2)",
    auraBottom: "rgba(65, 88, 156, 0.15)",
    veil: "rgba(8, 18, 35, 0.22)",
    blurTint: "dark",
    textVariant: "light",
    blurIntensity: 12,
  },
};

const IS_BACKGROUND_SHOWCASE_ENABLED = true;

type HistoryAlertLevel = "normal" | "critical" | "evacuation" | "spilling";

type HistoryRecord = {
  id: string;
  recordedAt: string;
  readingDate: string | null;
  readingTime: string | null;
  waterLevel: number;
  alertLevel: HistoryAlertLevel;
  statusLabel: string;
  rangeLabel: string;
  description: string;
};

type HistoryDayGroup = {
  dateKey: string;
  dateLabel: string;
  entries: HistoryRecord[];
};

type AnnouncementAlertLevel = "normal" | "warning" | "emergency";
type AnnouncementFilterKey = "all" | AnnouncementAlertLevel;

type AnnouncementMedia = {
  id: string;
  file_name: string;
  public_url: string;
  display_order: number;
};

type AnnouncementItem = {
  id: string;
  title: string;
  description: string;
  alert_level: AnnouncementAlertLevel;
  posted_by_name: string;
  created_at: string;
  announcement_media: AnnouncementMedia[];
};

type ProfileAvatarKey = "boy" | "man" | "user" | "woman" | "woman2";

type TideStatus = {
  currentHeight: number | null;
  nextExtreme: {
    type: "high" | "low";
    height: number;
    time: string;
  };
  state: "rising" | "falling";
};

type TideHourly = {
  hour: number;
  estimatedHeight: number;
  confidence: "high" | "medium" | "low";
};

type TideExtreme = {
  type: "high" | "low";
  height: number;
  time: string;
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

type ProfileState = {
  fullName: string;
  email: string;
  phoneNumber: string;
  residentStatus: ResidentStatus;
  addressPurok: string;
  role: string;
  avatarKey: ProfileAvatarKey;
};

type DashboardLoadSource = "live" | "cache" | "none";

type CacheAwareLoadResult = {
  source: DashboardLoadSource;
  cachedAt: number | null;
};

type ProfileCachePayload = {
  role: string;
  profileState: ProfileState;
};

const CACHE_KEYS = {
  sensor: "resina:cache:sensor-snapshot",
  weather: "resina:cache:weather-snapshot",
  announcements: "resina:cache:announcements",
  history: "resina:cache:history-records",
  tide: "resina:cache:tide-status",
  tideHourly: "resina:cache:tide-hourly",
  tideExtremes: "resina:cache:tide-extremes",
  profile: (userId: string) => `resina:cache:profile:${userId}`,
};

const CACHE_TTL_MS = {
  sensor: 5 * 60 * 1000,
  weather: 5 * 60 * 1000,
  announcements: 30 * 60 * 1000,
  history: 60 * 60 * 1000,
  tide: 60 * 60 * 1000, // Update hourly
  tideHourly: 60 * 60 * 1000,
  tideExtremes: 60 * 60 * 1000,
  profile: 24 * 60 * 60 * 1000,
};

const HISTORY_CACHE_MAX_DAYS = 30;
const HISTORY_CACHE_MAX_ITEMS = 400;
const ANNOUNCEMENTS_CACHE_MAX_ITEMS = 20;

const PROFILE_AVATAR_OPTIONS: Array<{ key: ProfileAvatarKey; label: string; source: ReturnType<typeof require> }> = [
  { key: "user", label: "User", source: require("./assets/Profile/user.png") },
  { key: "man", label: "Man", source: require("./assets/Profile/man.png") },
  { key: "boy", label: "Boy", source: require("./assets/Profile/boy.png") },
  { key: "woman", label: "Woman", source: require("./assets/Profile/woman.png") },
  { key: "woman2", label: "Woman 2", source: require("./assets/Profile/woman 2.png") },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const mobileEmailRedirectUrl =
  process.env.EXPO_PUBLIC_MOBILE_EMAIL_REDIRECT_URL ?? "https://resina-two.vercel.app/";
const DASHBOARD_TOP_PADDING = Platform.OS === "android" ? 14 : 16;
const DEFAULT_WEATHER_ADVISORY =
  "No urgent advisory right now. Keep alerts enabled and monitor weather updates from Barangay Sta. Rita.";

const ALERT_LEVELS: Record<
  AlertLevelKey,
  {
    title: string;
    badge: string;
    rangeLabel: string;
    cardColor: string;
    description: string;
  }
> = {
  normal: {
    title: "Normal Level",
    badge: "Alert Level 1",
    rangeLabel: "1.5 - 2.49m",
    cardColor: "#4a9f55",
    description: "Normal ang antas ng tubig. Ligtas ang sitwasyon at walang inaasahang banta sa ngayon.",
  },
  critical: {
    title: "Critical Level",
    badge: "Alert Level 2",
    rangeLabel: "2.5 - 2.9m",
    cardColor: "#c79a12",
    description: "Mataas ang tubig. Maging alerto, ihanda ang mga gamit, at patuloy na magmonitor sa mga balita.",
  },
  evacuation: {
    title: "Evacuation Level",
    badge: "Alert Level 3",
    rangeLabel: "3.0 - 3.9m",
    cardColor: "#d96a1a",
    description: "Mapanganib ang antas ng tubig. Lumikas na agad patungo sa mas mataas na lugar o evacuation center.",
  },
  spilling: {
    title: "Spilling Level",
    badge: "Alert Level 4",
    rangeLabel: "4.0+m",
    cardColor: "#a43737",
    description: "Umaapaw na ang tubig. Delikado na ang sitwasyon; unahin ang kaligtasan ng buhay at sumunod sa mga rescuer.",
  },
};

const HISTORY_LEVELS: Record<
  HistoryAlertLevel,
  {
    statusLabel: string;
    rangeLabel: string;
    description: string;
    cardBackground: string;
    badgeBorder: string;
    badgeText: string;
  }
> = {
  normal: {
    statusLabel: "Normal",
    rangeLabel: "1.5 - 2.49m",
    description: "Normal ang antas ng tubig. Ligtas ang sitwasyon at walang agarang banta sa kasalukuyan.",
    cardBackground: "#dbe2dd",
    badgeBorder: "#67b56e",
    badgeText: "#2d8a39",
  },
  critical: {
    statusLabel: "Kritikal",
    rangeLabel: "2.5 - 2.9m",
    description: "Mataas ang tubig. Maging maingat, manatiling alerto, at patuloy na magmonitor ng sitwasyon.",
    cardBackground: "#ece6c8",
    badgeBorder: "#9f8c28",
    badgeText: "#8b7300",
  },
  evacuation: {
    statusLabel: "Paglikas",
    rangeLabel: "3.0 - 3.9m",
    description: "Mapanganib na ang antas ng tubig. Kumilos agad at lumikas sa mas mataas o mas ligtas na lugar.",
    cardBackground: "#e9e5e5",
    badgeBorder: "#c36d37",
    badgeText: "#b55f2d",
  },
  spilling: {
    statusLabel: "Umaapaw",
    rangeLabel: "4.0+m",
    description: "Umaapaw na ang tubig at lubhang delikado ang sitwasyon. Unahin ang kaligtasan ng lahat.",
    cardBackground: "#ebe1e3",
    badgeBorder: "#f06868",
    badgeText: "#ef4e4e",
  },
};

function inferAlertLevel(snapshot: SensorSnapshot): AlertLevelKey {
  const status = (snapshot.statusText ?? "").toLowerCase();

  if (status.includes("spill")) return "spilling";
  if (status.includes("evac")) return "evacuation";
  if (status.includes("critical") || status.includes("alert level 2") || status.includes("alert 2")) {
    return "critical";
  }
  if (snapshot.waterLevel !== null) {
    if (snapshot.waterLevel >= 4) return "spilling";
    if (snapshot.waterLevel >= 3) return "evacuation";
    if (snapshot.waterLevel >= 2.5) return "critical";
  }

  return "normal";
}

function formatRangeLabel(level: number | null, fallback: string): string {
  if (level === null || Number.isNaN(level)) return fallback;

  if (level >= 4) return "4.0+m";

  const upper = level >= 3 ? 3.9 : level >= 2.5 ? 2.9 : 2.49;
  return `${level.toFixed(1)} - ${upper.toFixed(2)}m`;
}

function formatSensorUpdatedAt(updatedAt: string | null): string {
  if (!updatedAt) return "UPDATED: NO RECENT DATA";

  const timestamp = new Date(updatedAt);
  if (Number.isNaN(timestamp.getTime())) {
    return "UPDATED: NO RECENT DATA";
  }

  return `UPDATED: ${timestamp
    .toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toUpperCase()}`;
}

function formatWeatherDate(dateISO: string | null): string {
  if (!dateISO) return "TODAY";

  return new Date(dateISO)
    .toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
}

function getWeatherBackground(intensity: string, colorCodedWarning: string, heatIndex: number): string {
  const warning = colorCodedWarning.toLowerCase();
  if (warning.includes("red")) return "#E74C4C";
  if (warning.includes("orange")) return "#FF7E1C";
  if (warning.includes("yellow")) return "#F7D400";

  const rainyLabels = ["light rain", "moderate rain", "heavy rain", "torrential rain"];
  if (rainyLabels.includes(intensity.toLowerCase())) return "#B3B7C0";

  if (heatIndex < 27) return "#ECE8D2";
  if (heatIndex <= 32) return "#F4E68E";
  if (heatIndex <= 41) return "#FDDC00";
  if (heatIndex <= 51) return "#FF7E1C";
  return "#E74C4C";
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const value = hex.trim().replace("#", "");
  if (value.length !== 6) {
    return null;
  }

  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return null;
  }

  return { r, g, b };
}

function getAdaptiveTextVariant(baseColor: string): "light" | "dark" {
  const rgb = hexToRgb(baseColor);
  if (!rgb) {
    return "dark";
  }

  const luminance = rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114;
  return luminance < 142 ? "light" : "dark";
}

function shadeHexColor(hex: string, factor: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return hex;
  }

  const apply = (value: number) => Math.max(0, Math.min(255, Math.round(value * factor)));
  const toHex = (value: number) => value.toString(16).padStart(2, "0").toUpperCase();

  return `#${toHex(apply(rgb.r))}${toHex(apply(rgb.g))}${toHex(apply(rgb.b))}`;
}

function getWeatherVisualMode(snapshot: WeatherSnapshot): WeatherVisualMode {
  const context = [
    snapshot.intensityDescription,
    snapshot.conditionDescription,
    snapshot.colorCodedWarning,
    snapshot.manualDescription,
  ]
    .join(" ")
    .toLowerCase();

  const isNight = getManilaHourNow() < 6 || getManilaHourNow() >= 18;
  const isRainy = /(rain|storm|thunder|shower|drizzle|downpour|bagyo|typhoon|cyclone)/.test(context);
  const isCloudy = /(cloud|overcast|fog|mist|haze)/.test(context);

  if (isRainy) {
    return isNight ? "rainy-night" : "rainy-day";
  }

  if (isNight) {
    return "night";
  }

  if (isCloudy) {
    return "cloudy";
  }

  return "sunny";
}

function buildShowcaseThemeFromWeatherColor(baseColor: string): HomeAtmosphereTheme {
  const rgb = hexToRgb(baseColor);
  if (!rgb) {
    return {
      base: "#dfeaf7",
      auraTop: "rgba(122, 168, 220, 0.32)",
      auraBottom: "rgba(85, 128, 180, 0.22)",
      veil: "rgba(255, 255, 255, 0.18)",
      blurTint: "light",
      textVariant: "dark",
      blurIntensity: 14,
    };
  }

  const darken = (value: number, factor: number) => Math.max(0, Math.min(255, Math.round(value * factor)));
  const luminance = rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114;
  const isDark = luminance < 145;

  const auraTop = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${isDark ? "0.42" : "0.3"})`;
  const auraBottom = `rgba(${darken(rgb.r, 0.66)}, ${darken(rgb.g, 0.66)}, ${darken(rgb.b, 0.66)}, ${isDark ? "0.34" : "0.22"})`;

  return {
    base: baseColor,
    auraTop,
    auraBottom,
    veil: isDark ? "rgba(7, 16, 30, 0.24)" : "rgba(255, 255, 255, 0.2)",
    blurTint: isDark ? "dark" : "light",
    textVariant: isDark ? "light" : "dark",
    blurIntensity: 14,
  };
}

function getWeatherShowcaseThemes(): HomeAtmosphereTheme[] {
  const showcaseInputs = [
    { intensity: "Light Rain", warning: "No Warning", heat: 25 },
    { intensity: "Normal", warning: "No Warning", heat: 24 },
    { intensity: "Normal", warning: "No Warning", heat: 30 },
    { intensity: "Normal", warning: "No Warning", heat: 38 },
    { intensity: "Normal", warning: "No Warning", heat: 46 },
    { intensity: "Normal", warning: "No Warning", heat: 55 },
    { intensity: "Normal", warning: "Yellow Warning", heat: 27 },
    { intensity: "Normal", warning: "Orange Warning", heat: 27 },
    { intensity: "Normal", warning: "Red Warning", heat: 27 },
  ];

  const uniqueColors = Array.from(
    new Set(showcaseInputs.map((entry) => getWeatherBackground(entry.intensity, entry.warning, entry.heat).toUpperCase())),
  );

  return uniqueColors.map((color) => buildShowcaseThemeFromWeatherColor(color));
}

function getWeatherShowcaseScenes(): WeatherShowcaseScene[] {
  const buildSnapshot = (
    intensityDescription: string,
    conditionDescription: string,
    heatIndex: number,
    colorCodedWarning = "No Warning",
  ): WeatherSnapshot => ({
    recordedAt: null,
    dateLabel: "TODAY",
    temperature: heatIndex,
    iconPath: "",
    intensityDescription,
    conditionDescription,
    humidity: 0,
    heatIndex,
    manualDescription: "",
    colorCodedWarning,
    signalNo: "No Signal",
  });

  const snapshots = [
    buildSnapshot("Normal", "Sunny", 31),
    buildSnapshot("Normal", "Sunny", 45),
    buildSnapshot("Normal", "Overcast clouds", 27),
    buildSnapshot("Normal", "Clear sky", 26),
    buildSnapshot("Light Rain", "Light rain", 26),
    buildSnapshot("Heavy Rain", "Thunderstorm rain", 26),
    buildSnapshot("Normal", "Sunny", 27, "Yellow Warning"),
    buildSnapshot("Normal", "Sunny", 27, "Orange Warning"),
    buildSnapshot("Normal", "Sunny", 27, "Red Warning"),
  ];

  return snapshots.map((snapshot) => ({
    mode: getWeatherVisualMode(snapshot),
    theme: getHomeAtmosphereTheme(snapshot),
  }));
}

function getHomeAtmosphereTheme(snapshot: WeatherSnapshot): HomeAtmosphereTheme {
  const mode = getWeatherVisualMode(snapshot);
  const weatherCardBase = getWeatherBackground(
    snapshot.intensityDescription,
    snapshot.colorCodedWarning,
    snapshot.heatIndex,
  );

  if (mode === "rainy-night") {
    return {
      base: "#0A162A",
      auraTop: "rgba(46, 89, 148, 0.34)",
      auraBottom: "rgba(16, 48, 92, 0.3)",
      veil: "rgba(4, 10, 20, 0.42)",
      blurTint: "dark",
      textVariant: "light",
      blurIntensity: 18,
    };
  }

  if (mode === "night") {
    return {
      base: "#0D1A33",
      auraTop: "rgba(70, 117, 191, 0.3)",
      auraBottom: "rgba(25, 70, 136, 0.24)",
      veil: "rgba(8, 14, 28, 0.34)",
      blurTint: "dark",
      textVariant: "light",
      blurIntensity: 16,
    };
  }

  if (mode === "cloudy") {
    const base = "#B3B7C0";
    return {
      base,
      auraTop: "rgba(160, 169, 184, 0.38)",
      auraBottom: "rgba(118, 129, 146, 0.24)",
      veil: "rgba(255, 255, 255, 0.2)",
      blurTint: "light",
      textVariant: getAdaptiveTextVariant(base),
      blurIntensity: 14,
    };
  }

  const base = mode === "rainy-day" ? "#B3B7C0" : weatherCardBase;
  return {
    base,
    auraTop: `${shadeHexColor(base, 1.06)}55`,
    auraBottom: `${shadeHexColor(base, 0.72)}44`,
    veil: getAdaptiveTextVariant(base) === "light" ? "rgba(8, 16, 30, 0.24)" : "rgba(255, 255, 255, 0.22)",
    blurTint: getAdaptiveTextVariant(base) === "light" ? "dark" : "light",
    textVariant: getAdaptiveTextVariant(base),
    blurIntensity: 14,
  };
}

function buildFullName(firstName: string, middleName: string, lastName: string): string {
  return [firstName.trim(), middleName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

function formatAnnouncementDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Published recently";
  }

  return `Published ${parsed.toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "2-digit",
    year: "numeric",
  })}`;
}

function inferHistoryAlertLevel(statusText: string | null, waterLevel: number | null): HistoryAlertLevel {
  const status = (statusText ?? "").toLowerCase();

  if (status.includes("spill")) return "spilling";
  if (status.includes("evac")) return "evacuation";
  if (status.includes("critical") || status.includes("alert level 2") || status.includes("alert 2")) {
    return "critical";
  }

  if (waterLevel !== null) {
    if (waterLevel >= 4) return "spilling";
    if (waterLevel >= 3) return "evacuation";
    if (waterLevel >= 2.5) return "critical";
  }

  return "normal";
}

function formatHistoryTimeOnly(record: HistoryRecord): string {
  const source =
    record.readingDate && record.readingTime
      ? new Date(`${record.readingDate}T${record.readingTime}`)
      : new Date(record.recordedAt);

  if (Number.isNaN(source.getTime())) {
    return "--:--";
  }

  return source
    .toLocaleTimeString("en-PH", {
      timeZone: "Asia/Manila",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(" AM", "AM")
    .replace(" PM", "PM");
}

function getHistoryDateKey(record: HistoryRecord): string {
  if (record.readingDate) {
    return record.readingDate;
  }

  return new Date(record.recordedAt).toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  });
}

function formatHistoryGroupDateLabel(dateKey: string): string {
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateKey;
  }

  return parsed.toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function mapHistoryRowToRecord(row: Record<string, unknown>): HistoryRecord | null {
  const recordedAt = String(row.created_at ?? "").trim();
  if (!recordedAt) {
    return null;
  }

  const waterLevel = Number(row.water_level ?? Number.NaN);
  if (Number.isNaN(waterLevel)) {
    return null;
  }

  const alertLevel = inferHistoryAlertLevel((row.status as string | null) ?? null, waterLevel);
  const config = HISTORY_LEVELS[alertLevel];

  return {
    id: String(row.id ?? recordedAt),
    recordedAt,
    readingDate: (row.reading_date as string | null) ?? null,
    readingTime: (row.reading_time as string | null) ?? null,
    waterLevel,
    alertLevel,
    statusLabel: config.statusLabel,
    rangeLabel: config.rangeLabel,
    description: config.description,
  };
}

function getHistorySourceTimestamp(record: HistoryRecord): number {
  const candidate =
    record.readingDate && record.readingTime
      ? new Date(`${record.readingDate}T${record.readingTime}`)
      : new Date(record.recordedAt);

  const time = candidate.getTime();
  if (Number.isNaN(time)) {
    return 0;
  }

  return time;
}

function mapWeatherRowToSnapshot(row: WeatherRow): WeatherSnapshot {
  const temp = Math.round(Number(row.temperature ?? 24));

  return {
    recordedAt: row.recorded_at ?? null,
    dateLabel: formatWeatherDate(row.recorded_at ?? null),
    temperature: Number.isNaN(temp) ? 24 : temp,
    iconPath: String(row.icon_path ?? ""),
    intensityDescription: String(row.intensity ?? "Normal"),
    conditionDescription: String(row.weather_description ?? "").trim(),
    humidity: Math.round(Number(row.humidity ?? 0)),
    heatIndex: Math.round(Number(row.heat_index ?? (Number.isNaN(temp) ? 24 : temp))),
    manualDescription: String(row.manual_description ?? "").trim() || DEFAULT_WEATHER_ADVISORY,
    colorCodedWarning: String(row.color_coded_warning ?? "No Warning"),
    signalNo: String(row.signal_no ?? "No Signal"),
  };
}

function formatCachedTimestamp(updatedAt: number | null): string {
  if (!updatedAt) {
    return "";
  }

  return new Date(updatedAt).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function trimHistoryForCache(records: HistoryRecord[]): HistoryRecord[] {
  const cutoff = Date.now() - HISTORY_CACHE_MAX_DAYS * 24 * 60 * 60 * 1000;
  return records
    .filter((record) => getHistorySourceTimestamp(record) >= cutoff)
    .slice(0, HISTORY_CACHE_MAX_ITEMS);
}

function resolveLoadBanner(result: CacheAwareLoadResult[]): { showCached: boolean; message: string } {
  const hasLive = result.some((entry) => entry.source === "live");
  if (hasLive) {
    return {
      showCached: false,
      message: "",
    };
  }

  const newestCachedAt = result.reduce<number | null>((current, entry) => {
    if (entry.source !== "cache" || !entry.cachedAt) {
      return current;
    }

    if (!current || entry.cachedAt > current) {
      return entry.cachedAt;
    }

    return current;
  }, null);

  if (!newestCachedAt) {
    return {
      showCached: false,
      message: "",
    };
  }

  return {
    showCached: true,
    message: `Offline mode: showing cached data (last synced ${formatCachedTimestamp(newestCachedAt)}).`,
  };
}

function normalizeStatusMessage(message: string, variant: "error" | "success"): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return "";
  }

  const normalized = trimmed.toLowerCase();

  if (variant === "error") {
    if (normalized.includes("invalid login credentials") || normalized.includes("invalid credentials")) {
      return "Wrong email or password. Please try again.";
    }

    if (
      normalized.includes("email not confirmed") ||
      normalized.includes("not confirmed") ||
      normalized.includes("confirm your email") ||
      normalized.includes("email_not_confirmed")
    ) {
      return "Your email is not confirmed yet. Please check your inbox and confirm your account.";
    }

    if (normalized.includes("network request failed") || normalized.includes("failed to fetch")) {
      return "Cannot connect right now. Please check your internet connection and try again.";
    }

    if (
      normalized.includes("unauthorized") ||
      normalized.includes("permission denied") ||
      normalized.includes("forbidden")
    ) {
      return "You have no access privilege in this portal.";
    }
  }

  if (variant === "success") {
    if (normalized === "logged in successfully.") {
      return "Login successful.";
    }

    if (normalized === "account created and logged in.") {
      return "Account created successfully. You are now logged in.";
    }
  }

  return trimmed;
}

function normalizeResidentStatus(value: unknown): ResidentStatus {
  return String(value).toLowerCase() === "non_resident" ? "non_resident" : "resident";
}

function getManilaHourNow(): number {
  const raw = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    hour12: false,
  }).format(new Date());
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? 0 : parsed % 24;
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

function buildTideStatus(tideData: TideExtreme[], hourlyData: TideHourly[]): TideStatus | null {
  if (!tideData.length) {
    return null;
  }

  const sortedExtremes = [...tideData].sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime());
  const now = new Date();
  const currentHourManila = getManilaHourNow();
  const currentHour = (currentHourManila - 8 + 24) % 24;
  const currentHourEntry = hourlyData.find((entry) => entry.hour === currentHour) ?? null;
  const previousHourEntry =
    hourlyData.find((entry) => entry.hour === (currentHour + 23) % 24) ??
    hourlyData.find((entry) => entry.hour < currentHour) ??
    null;
  const currentHeight = currentHourEntry?.estimatedHeight ?? null;

  const nextExtreme = sortedExtremes.find((entry) => new Date(entry.time).getTime() > now.getTime()) ?? sortedExtremes[0];
  const state =
    currentHeight !== null && previousHourEntry?.estimatedHeight !== undefined
      ? currentHeight >= previousHourEntry.estimatedHeight
        ? "rising"
        : "falling"
      : nextExtreme.type === "low"
        ? "falling"
        : "rising";

  return {
    currentHeight,
    nextExtreme,
    state,
  };
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string>("user");
  const [activeTab, setActiveTab] = useState<DashboardTab>("home");
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isConfirmingAccount, setIsConfirmingAccount] = useState(false);

  const [mode, setMode] = useState<AuthMode>("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [isRefreshingDashboard, setIsRefreshingDashboard] = useState(false);
  const [isRefreshToastVisible, setIsRefreshToastVisible] = useState(false);
  const [refreshToastMessage, setRefreshToastMessage] = useState("Refreshing live data...");
  const [cachedDataBanner, setCachedDataBanner] = useState("");
  const [isUsingCachedData, setIsUsingCachedData] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);

  const [sensorSnapshot, setSensorSnapshot] = useState<SensorSnapshot>({
    waterLevel: null,
    statusText: null,
    updatedAt: null,
  });

  const [weatherSnapshot, setWeatherSnapshot] = useState<WeatherSnapshot>({
    recordedAt: null,
    dateLabel: "TODAY",
    temperature: 24,
    iconPath: "",
    intensityDescription: "Normal",
    conditionDescription: "",
    humidity: 0,
    heatIndex: 24,
    manualDescription: DEFAULT_WEATHER_ADVISORY,
    colorCodedWarning: "No Warning",
    signalNo: "No Signal",
  });

  const [tideStatus, setTideStatus] = useState<TideStatus | null>(null);
  const [tideHourly, setTideHourly] = useState<TideHourly[]>([]);
  const [tideExtremes, setTideExtremes] = useState<TideExtreme[]>([]);
  const [isTideLoading, setIsTideLoading] = useState(false);
  const [tideError, setTideError] = useState<string | null>(null);

  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [announcementFilter, setAnnouncementFilter] = useState<AnnouncementFilterKey>("all");
  const [isAnnouncementsLoading, setIsAnnouncementsLoading] = useState(false);
  const [isCommentsModalOpen, setIsCommentsModalOpen] = useState(false);
  const [selectedAnnouncementForComments, setSelectedAnnouncementForComments] = useState<AnnouncementItem | null>(null);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"all" | HistoryAlertLevel>("all");
  const [selectedHistoryDateKey, setSelectedHistoryDateKey] = useState<string | null>(null);
  const [showHistoryDatePicker, setShowHistoryDatePicker] = useState(false);
  const [historyVisibleCount, setHistoryVisibleCount] = useState(5);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [profileState, setProfileState] = useState<ProfileState>({
    fullName: "Resident",
    email: "-",
    phoneNumber: "-",
    residentStatus: "resident",
    addressPurok: "",
    role: "user",
    avatarKey: "user",
  });
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isPasswordEditorOpen, setIsPasswordEditorOpen] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const latestWeatherRecordedAtRef = useRef<string | null>(null);
  const refreshToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollRefreshAtRef = useRef(0);
  const atmosphereFloat = useRef(new Animated.Value(0)).current;
  const atmospherePulse = useRef(new Animated.Value(0)).current;
  const sectionTransition = useRef(new Animated.Value(1)).current;
  const skeletonPulse = useRef(new Animated.Value(0)).current;
  const atmosphereFade = useRef(new Animated.Value(1)).current;
  const [showcaseThemeIndex, setShowcaseThemeIndex] = useState(0);
  const cloudDrift = useRef(new Animated.Value(0)).current;
  const sunPulse = useRef(new Animated.Value(0)).current;
  const starTwinkle = useRef(new Animated.Value(0)).current;
  const rainFall = useRef(new Animated.Value(0)).current;
  const rainFallSoft = useRef(new Animated.Value(0)).current;

  const [loginForm, setLoginForm] = useState<LoginForm>({
    email: "",
    password: "",
  });

  const [registerForm, setRegisterForm] = useState<RegisterForm>({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    residentStatus: "resident",
    addressPurok: "",
    password: "",
    confirmPassword: "",
  });
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);

  const alertLevel = useMemo(() => inferAlertLevel(sensorSnapshot), [sensorSnapshot]);
  const alertConfig = ALERT_LEVELS[alertLevel];
  const waterRange = useMemo(
    () => formatRangeLabel(sensorSnapshot.waterLevel, alertConfig.rangeLabel),
    [sensorSnapshot.waterLevel, alertConfig.rangeLabel],
  );
  const waterUpdatedLabel = useMemo(() => formatSensorUpdatedAt(sensorSnapshot.updatedAt), [sensorSnapshot.updatedAt]);
  const selectedAvatar = useMemo(
    () => PROFILE_AVATAR_OPTIONS.find((item) => item.key === profileState.avatarKey) ?? PROFILE_AVATAR_OPTIONS[0],
    [profileState.avatarKey],
  );

  const filteredAnnouncements = useMemo(() => {
    if (announcementFilter === "all") return announcements;
    return announcements.filter((entry) => entry.alert_level === announcementFilter);
  }, [announcementFilter, announcements]);

  const filteredHistoryRecords = useMemo(() => {
    return historyRecords.filter((entry) => {
      const matchesStatus = historyStatusFilter === "all" || entry.alertLevel === historyStatusFilter;
      const matchesDate = !selectedHistoryDateKey || getHistoryDateKey(entry) === selectedHistoryDateKey;
      return matchesStatus && matchesDate;
    });
  }, [historyRecords, historyStatusFilter, selectedHistoryDateKey]);

  const visibleHistoryRecords = useMemo(
    () => filteredHistoryRecords.slice(0, historyVisibleCount),
    [filteredHistoryRecords, historyVisibleCount],
  );

  const groupedVisibleHistoryRecords = useMemo<HistoryDayGroup[]>(() => {
    const grouped = new Map<string, HistoryRecord[]>();

    visibleHistoryRecords.forEach((entry) => {
      const key = getHistoryDateKey(entry);
      const existing = grouped.get(key);

      if (existing) {
        existing.push(entry);
      } else {
        grouped.set(key, [entry]);
      }
    });

    return Array.from(grouped.entries()).map(([dateKey, entries]) => ({
      dateKey,
      dateLabel: formatHistoryGroupDateLabel(dateKey),
      entries,
    }));
  }, [visibleHistoryRecords]);

  const currentCommenterName = useMemo(() => {
    const name = profileState.fullName.trim();
    if (name) return name;
    return session?.user?.email?.split("@")[0] ?? "Resident";
  }, [profileState.fullName, session]);

  const displayRoleLabel = useMemo(() => {
    const roleLabel = profileState.role.trim().toLowerCase();
    if (!roleLabel || roleLabel === "user") {
      return profileState.residentStatus === "non_resident" ? "NON-RESIDENT" : "RESIDENT";
    }

    return roleLabel.toUpperCase();
  }, [profileState.residentStatus, profileState.role]);

  const residentStatusCaption = useMemo(() => {
    return profileState.residentStatus === "non_resident" ? "Outside Sta. Rita" : "Sta. Rita Resident";
  }, [profileState.residentStatus]);

  const statusVariant = errorMessage ? "error" : "success";
  const statusModalMessage = useMemo(
    () => normalizeStatusMessage(errorMessage || successMessage, statusVariant),
    [errorMessage, successMessage, statusVariant],
  );

  useEffect(() => {
    latestWeatherRecordedAtRef.current = weatherSnapshot.recordedAt;
  }, [weatherSnapshot.recordedAt]);

  useEffect(() => {
    return () => {
      if (refreshToastTimerRef.current) {
        clearTimeout(refreshToastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setErrorMessage("App config is incomplete. Please rebuild with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.");
    }
  }, []);

  const clearAlerts = () => {
    setErrorMessage("");
    setSuccessMessage("");
  };

  const runManualRefresh = async (message: string) => {
    if (!session || isRefreshingDashboard) {
      return;
    }

    if (refreshToastTimerRef.current) {
      clearTimeout(refreshToastTimerRef.current);
      refreshToastTimerRef.current = null;
    }

    setRefreshToastMessage(message);
    setIsRefreshToastVisible(true);
    setIsRefreshingDashboard(true);
    const refreshStart = Date.now();

    try {
      const results = await Promise.all([
        loadSensorSnapshot(),
        loadWeatherSnapshot(),
        loadAnnouncements(),
        loadHistoryRecords(),
      ]);
      const banner = resolveLoadBanner(results);
      setIsUsingCachedData(banner.showCached);
      setCachedDataBanner(banner.message);
    } finally {
      setIsRefreshingDashboard(false);
      const elapsed = Date.now() - refreshStart;
      const minVisibleMs = 900;
      const hideDelay = Math.max(0, minVisibleMs - elapsed);

      refreshToastTimerRef.current = setTimeout(() => {
        setIsRefreshToastVisible(false);
      }, hideDelay);
    }
  };

  const handleDeepLinkAuth = async (url: string) => {
    setIsConfirmingAccount(true);

    try {
      const parsed = new URL(url);
      const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : "";
      const hashParams = new URLSearchParams(hash);
      const queryParams = parsed.searchParams;

      const accessToken = hashParams.get("access_token") ?? queryParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token") ?? queryParams.get("refresh_token");
      const authCode = queryParams.get("code");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        clearAlerts();
        setSuccessMessage("Email confirmed. You are now logged in.");
        return;
      }

      if (authCode) {
        const { error } = await supabase.auth.exchangeCodeForSession(authCode);
        if (error) {
          setErrorMessage(error.message);
          return;
        }

        clearAlerts();
        setSuccessMessage("Email confirmed. You are now logged in.");
      }
    } catch {
      // Ignore unrelated deep links.
    } finally {
      setIsConfirmingAccount(false);
    }
  };

  const loadProfileData = async (authUserId: string, fallbackUser?: Session["user"]) => {
    const profileCacheKey = CACHE_KEYS.profile(authUserId);
    const cachedProfile = await readCache<ProfileCachePayload>(profileCacheKey, CACHE_TTL_MS.profile);

    if (cachedProfile && !cachedProfile.isExpired) {
      setRole(cachedProfile.value.role);
      setProfileState(cachedProfile.value.profileState);
    }

    const { data } = await supabase.from("profiles").select("*").eq("auth_user_id", authUserId).maybeSingle();

    const row = (data ?? {}) as Record<string, unknown>;
    const metadata = ((fallbackUser?.user_metadata as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;

    const firstName = String(row.first_name ?? metadata.first_name ?? "").trim();
    const middleName = String(row.middle_name ?? metadata.middle_name ?? "").trim();
    const lastName = String(row.last_name ?? metadata.last_name ?? "").trim();
    const fallbackName = [firstName, middleName, lastName].filter(Boolean).join(" ").trim();

    const roleValue = String(row.role ?? metadata.role ?? "user");
    const avatarRaw = String(metadata.profile_avatar ?? "user") as ProfileAvatarKey;
    const avatarKey = PROFILE_AVATAR_OPTIONS.some((item) => item.key === avatarRaw) ? avatarRaw : "user";

    const fullName = String((row.full_name ?? metadata.full_name ?? fallbackName) || "Resident").trim();
    const email = String(row.email ?? fallbackUser?.email ?? "-").trim();
    const phoneNumber = String(row.phone_number ?? metadata.phone_number ?? "-").trim();
    const residentStatus = normalizeResidentStatus(row.resident_status ?? metadata.resident_status);
    const rowAddress = String(row.address_purok ?? "").trim();
    const metadataAddress = String(metadata.address_purok ?? "").trim();
    const rowResidentStatus = normalizeResidentStatus(row.resident_status);
    const addressPurok = residentStatus === "resident" ? rowAddress || metadataAddress : "";
    const normalizedRole = roleValue === "admin" || roleValue === "member" || roleValue === "user" ? roleValue : "user";
    const resolvedAddress = residentStatus === "resident" ? metadataAddress || rowAddress : "";
    const shouldSyncProfile =
      rowResidentStatus !== residentStatus || (residentStatus === "resident" ? rowAddress !== resolvedAddress : rowAddress !== "");

    // Keep profile table in sync with auth metadata after registration confirmation.
    if (shouldSyncProfile) {
      const profileEmail = String(row.email ?? fallbackUser?.email ?? "").trim();

      if (profileEmail) {
        await supabase.from("profiles").upsert(
          {
            auth_user_id: authUserId,
            full_name: fullName || "Resident",
            email: profileEmail,
            role: normalizedRole,
            resident_status: residentStatus,
            address_purok: resolvedAddress,
          },
          {
            onConflict: "auth_user_id",
          },
        );
      }
    }

    const nextProfileState: ProfileState = {
      fullName,
      email: email || "-",
      phoneNumber: phoneNumber || "-",
      residentStatus,
      addressPurok,
      role: normalizedRole,
      avatarKey,
    };

    setRole(normalizedRole);
    setProfileState(nextProfileState);

    await writeCache(profileCacheKey, {
      role: normalizedRole,
      profileState: nextProfileState,
    });
  };

  const loadSensorSnapshot = async (): Promise<CacheAwareLoadResult> => {
    const cached = await readCache<SensorSnapshot>(CACHE_KEYS.sensor, CACHE_TTL_MS.sensor);
    if (cached && !cached.isExpired) {
      setSensorSnapshot(cached.value);
    }

    const sources = [
      { table: "sensor_readings", orderBy: "created_at" },
      { table: "sensor_status", orderBy: "created_at" },
      { table: "water_levels", orderBy: "created_at" },
      { table: "sensor_logs", orderBy: "timestamp" },
    ];

    try {
      for (const source of sources) {
        const { data, error } = await supabase
          .from(source.table)
          .select("*")
          .order(source.orderBy, { ascending: false })
          .limit(1);

        if (error || !data || data.length === 0) {
          continue;
        }

        const row = data[0] as Record<string, unknown>;
        const waterLevel = Number(
          row.water_level ?? row.level ?? row.sensor_level ?? row.reading ?? row.value ?? Number.NaN,
        );

        const nextSnapshot: SensorSnapshot = {
          waterLevel: Number.isNaN(waterLevel) ? null : waterLevel,
          statusText: (row.status ?? row.level_status ?? row.alert_status ?? row.alert_level ?? null) as string | null,
          updatedAt: (row.created_at ?? row.timestamp ?? row.recorded_at ?? null) as string | null,
        };

        setSensorSnapshot(nextSnapshot);
        await writeCache(CACHE_KEYS.sensor, nextSnapshot);
        return {
          source: "live",
          cachedAt: null,
        };
      }
    } catch {
      // Fall back to cached data.
    }

    if (cached && !cached.isExpired) {
      return {
        source: "cache",
        cachedAt: cached.updatedAt,
      };
    }

    return {
      source: "none",
      cachedAt: null,
    };
  };

  const loadWeatherSnapshot = async (): Promise<CacheAwareLoadResult> => {
    const cached = await readCache<WeatherSnapshot>(CACHE_KEYS.weather, CACHE_TTL_MS.weather);
    if (cached && !cached.isExpired) {
      setWeatherSnapshot(cached.value);
    }

    try {
      const { data } = await supabase
        .from("weather_logs")
        .select(
          "recorded_at, temperature, icon_path, humidity, heat_index, weather_description, intensity, color_coded_warning, signal_no, manual_description",
        )
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        const nextSnapshot = mapWeatherRowToSnapshot(data as WeatherRow);
        setWeatherSnapshot(nextSnapshot);
        await writeCache(CACHE_KEYS.weather, nextSnapshot);
        return {
          source: "live",
          cachedAt: null,
        };
      }
    } catch {
      // Fall back to cached data.
    }

    if (cached && !cached.isExpired) {
      return {
        source: "cache",
        cachedAt: cached.updatedAt,
      };
    }

    return {
      source: "none",
      cachedAt: null,
    };
  };

  const loadTideStatus = async (): Promise<CacheAwareLoadResult> => {
    setIsTideLoading(true);
    const cached = await readCache<TideStatus>(CACHE_KEYS.tide, CACHE_TTL_MS.tide);
    const cachedExtremes = await readCache<TideExtreme[]>(CACHE_KEYS.tideExtremes, CACHE_TTL_MS.tideExtremes);
    if (cached && !cached.isExpired) {
      setTideStatus(cached.value);
      setTideError(null);
    }
    if (cachedExtremes && !cachedExtremes.isExpired) {
      setTideExtremes(cachedExtremes.value);
    }

    try {
      const today = getManilaDate();
      const { data: predictionRow, error: predictionError } = await supabase
        .from("tide_predictions")
        .select("prediction_date, tide_data")
        .lte("prediction_date", today)
        .order("prediction_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (predictionError) {
        throw predictionError;
      }

      if (!predictionRow) {
        throw new Error("No tide predictions found in the database yet.");
      }

      const prediction = predictionRow as TidePredictionRow;
      const predictionDate = prediction.prediction_date;
      const tideData = Array.isArray(prediction.tide_data)
        ? [...prediction.tide_data].sort((left, right) => new Date(left.time).getTime() - new Date(right.time).getTime())
        : [];

      const { data: hourlyRows, error: hourlyError } = await supabase
        .from("tide_hourly")
        .select("hour_of_day, estimated_height, confidence")
        .eq("prediction_date", predictionDate)
        .order("hour_of_day", { ascending: true });

      if (hourlyError) {
        throw hourlyError;
      }

      const hourlyTides = ((hourlyRows ?? []) as TideHourlyRow[]).map((row) => ({
        hour: row.hour_of_day,
        estimatedHeight: Number(row.estimated_height),
        confidence: row.confidence ?? "medium",
      }));

      const tideStatus = buildTideStatus(tideData, hourlyTides);
      if (!tideStatus) {
        throw new Error("Tide data exists but could not be parsed.");
      }

      setTideStatus(tideStatus);
      setTideHourly(hourlyTides);
      setTideExtremes(tideData);
      setTideError(null);
      await writeCache(CACHE_KEYS.tide, tideStatus);
      await writeCache(CACHE_KEYS.tideHourly, hourlyTides);
      await writeCache(CACHE_KEYS.tideExtremes, tideData);
      setIsTideLoading(false);
      return {
        source: "live",
        cachedAt: null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load tide data from database";
      setTideError(message);
      setIsTideLoading(false);

      if (cached && !cached.isExpired) {
        return {
          source: "cache",
          cachedAt: cached.updatedAt,
        };
      }

      return {
        source: "none",
        cachedAt: null,
      };
    }
  };

  const loadTideHourly = async (): Promise<void> => {
    try {
      const today = getManilaDate();
      const cached = await readCache<TideHourly[]>(CACHE_KEYS.tideHourly, CACHE_TTL_MS.tideHourly);
      if (cached && !cached.isExpired) {
        setTideHourly(cached.value);
      }

      const { data: predictionRow, error: predictionError } = await supabase
        .from("tide_predictions")
        .select("prediction_date")
        .lte("prediction_date", today)
        .order("prediction_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (predictionError || !predictionRow) {
        return;
      }

      const { data: hourlyRows, error: hourlyError } = await supabase
        .from("tide_hourly")
        .select("hour_of_day, estimated_height, confidence")
        .eq("prediction_date", predictionRow.prediction_date)
        .order("hour_of_day", { ascending: true });

      if (hourlyError) {
        return;
      }

      const hourly = ((hourlyRows ?? []) as TideHourlyRow[]).map((row) => ({
        hour: row.hour_of_day,
        estimatedHeight: Number(row.estimated_height),
        confidence: row.confidence ?? "medium",
      }));

      setTideHourly(hourly);
      await writeCache(CACHE_KEYS.tideHourly, hourly);
    } catch {
      // Silently fail for hourly; it's optional
    }
  };

  const loadAnnouncements = async (): Promise<CacheAwareLoadResult> => {
    setIsAnnouncementsLoading(true);
    const cached = await readCache<AnnouncementItem[]>(CACHE_KEYS.announcements, CACHE_TTL_MS.announcements);
    if (cached && !cached.isExpired) {
      setAnnouncements(cached.value);
    }

    try {
      const { data } = await supabase
        .from("announcements")
        .select(
          "id, title, description, alert_level, posted_by_name, created_at, announcement_media(id, file_name, public_url, display_order)",
        )
        .order("created_at", { ascending: false })
        .limit(ANNOUNCEMENTS_CACHE_MAX_ITEMS);

      const rows = ((data ?? []) as AnnouncementItem[]).map((entry) => ({
        ...entry,
        announcement_media: [...(entry.announcement_media ?? [])].sort((a, b) => a.display_order - b.display_order),
      }));

      setAnnouncements(rows);
      await writeCache(CACHE_KEYS.announcements, rows.slice(0, ANNOUNCEMENTS_CACHE_MAX_ITEMS));
      return {
        source: "live",
        cachedAt: null,
      };
    } catch {
      // Fall back to cached data.
    } finally {
      setIsAnnouncementsLoading(false);
    }

    if (cached && !cached.isExpired) {
      return {
        source: "cache",
        cachedAt: cached.updatedAt,
      };
    }

    return {
      source: "none",
      cachedAt: null,
    };
  };

  const loadHistoryRecords = async (): Promise<CacheAwareLoadResult> => {
    setIsHistoryLoading(true);

    const cached = await readCache<HistoryRecord[]>(CACHE_KEYS.history, CACHE_TTL_MS.history);
    if (cached && !cached.isExpired) {
      setHistoryRecords(cached.value);
    }

    try {
      const { data, error } = await supabase
        .from("sensor_readings")
        .select("id, water_level, status, reading_date, reading_time, created_at")
        .order("created_at", { ascending: false })
        .limit(500);

      if (!error) {
        const normalized = (data ?? [])
          .map((row) => mapHistoryRowToRecord(row as Record<string, unknown>))
          .filter((row): row is HistoryRecord => row !== null)
          .sort((left, right) => getHistorySourceTimestamp(right) - getHistorySourceTimestamp(left));

        setHistoryRecords(normalized);
        await writeCache(CACHE_KEYS.history, trimHistoryForCache(normalized));
        return {
          source: "live",
          cachedAt: null,
        };
      }
    } catch {
      // Fall back to cached data.
    } finally {
      setIsHistoryLoading(false);
    }

    if (cached && !cached.isExpired) {
      return {
        source: "cache",
        cachedAt: cached.updatedAt,
      };
    }

    return {
      source: "none",
      cachedAt: null,
    };
  };

  const openCommentsForAnnouncement = (entry: AnnouncementItem) => {
    setSelectedAnnouncementForComments(entry);
    setIsCommentsModalOpen(true);
  };

  const closeCommentsModal = () => {
    setIsCommentsModalOpen(false);
    setSelectedAnnouncementForComments(null);
  };

  const loadDashboard = async () => {
    setIsDashboardLoading(true);
    const results = await Promise.all([loadSensorSnapshot(), loadWeatherSnapshot(), loadTideStatus(), loadAnnouncements(), loadHistoryRecords()]);
    const banner = resolveLoadBanner(results);
    setIsUsingCachedData(banner.showCached);
    setCachedDataBanner(banner.message);
    setIsDashboardLoading(false);
  };

  useEffect(() => {
    let isMounted = true;

    const boot = async () => {
      await clearExpiredCaches([
        { key: CACHE_KEYS.sensor, maxAgeMs: CACHE_TTL_MS.sensor },
        { key: CACHE_KEYS.weather, maxAgeMs: CACHE_TTL_MS.weather },
        { key: CACHE_KEYS.announcements, maxAgeMs: CACHE_TTL_MS.announcements },
        { key: CACHE_KEYS.history, maxAgeMs: CACHE_TTL_MS.history },
      ]);

      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();

      if (!isMounted) return;

      setSession(initialSession);
      if (initialSession?.user?.id) {
        await loadProfileData(initialSession.user.id, initialSession.user);
      }

      setIsBootstrapping(false);
    };

    void boot();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user?.id) {
        void loadProfileData(nextSession.user.id, nextSession.user);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const handleInitialLink = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (!isMounted || !initialUrl) return;
      await handleDeepLinkAuth(initialUrl);
    };

    void handleInitialLink();

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleDeepLinkAuth(url);
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    void loadDashboard();
    let liveChannel: ReturnType<typeof supabase.channel> | null = null;

    liveChannel = supabase
      .channel("resina-mobile-dashboard-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sensor_readings" },
        () => {
          void loadSensorSnapshot();
          void loadHistoryRecords();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sensor_status" },
        () => void loadSensorSnapshot(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "water_levels" },
        () => void loadSensorSnapshot(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sensor_logs" },
        () => void loadSensorSnapshot(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "weather_logs" },
        (payload) => {
          const row = (payload.new ?? null) as WeatherRow | null;

          if (row && Object.keys(row).length > 0) {
            const nextSnapshot = mapWeatherRowToSnapshot(row);
            setWeatherSnapshot(nextSnapshot);
            void writeCache(CACHE_KEYS.weather, nextSnapshot);
            return;
          }

          void loadWeatherSnapshot();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        () => void loadAnnouncements(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcement_media" },
        () => void loadAnnouncements(),
      )
      .subscribe();

    return () => {
      if (liveChannel) {
        void supabase.removeChannel(liveChannel);
      }
    };
  }, [session]);

  useEffect(() => {
    setHistoryVisibleCount(5);
  }, [historyStatusFilter, selectedHistoryDateKey]);

  const selectedHistoryDateValue = useMemo(() => {
    if (!selectedHistoryDateKey) {
      return new Date();
    }

    const parsed = new Date(`${selectedHistoryDateKey}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return new Date();
    }

    return parsed;
  }, [selectedHistoryDateKey]);

  const selectedHistoryDateLabel = useMemo(() => {
    if (!selectedHistoryDateKey) {
      return "All Dates";
    }

    return formatHistoryGroupDateLabel(selectedHistoryDateKey);
  }, [selectedHistoryDateKey]);

  const handleHistoryDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === "dismissed") {
      setShowHistoryDatePicker(false);
      return;
    }

    if (!date) {
      return;
    }

    const nextDateKey = date.toLocaleDateString("en-CA", {
      timeZone: "Asia/Manila",
    });

    setSelectedHistoryDateKey(nextDateKey);

    if (Platform.OS === "android") {
      setShowHistoryDatePicker(false);
    }
  };

  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      void (async () => {
        const { data } = await supabase
          .from("weather_logs")
          .select("recorded_at")
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const latestRecordedAt = (data?.recorded_at as string | null) ?? null;
        if (!latestRecordedAt) return;

        if (latestWeatherRecordedAtRef.current !== latestRecordedAt) {
          await loadWeatherSnapshot();
        }
      })();
    }, 12000);

    return () => {
      clearInterval(interval);
    };
  }, [session]);

  useEffect(() => {
    if (!session) return;

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void (async () => {
          const results = await Promise.all([loadWeatherSnapshot(), loadAnnouncements(), loadHistoryRecords()]);
          const banner = resolveLoadBanner(results);
          setIsUsingCachedData(banner.showCached);
          setCachedDataBanner(banner.message);
        })();
      }
    });

    return () => {
      sub.remove();
    };
  }, [session]);

  const handleLogin = async () => {
    clearAlerts();

    const email = loginForm.email.trim().toLowerCase();
    const password = loginForm.password;

    if (!email || !password) {
      setErrorMessage("Email and password are required.");
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsSubmitting(false);

    if (error) {
      const normalizedError = error.message.toLowerCase();
      const isUnconfirmedByErrorText =
        normalizedError.includes("email not confirmed") ||
        normalizedError.includes("not confirmed") ||
        normalizedError.includes("confirm your email") ||
        normalizedError.includes("email_not_confirmed");
      const looksLikeInvalidCreds =
        normalizedError.includes("invalid login credentials") || normalizedError.includes("invalid credentials");
      const isFreshUnconfirmedAttempt = Boolean(
        pendingConfirmationEmail && pendingConfirmationEmail === email && looksLikeInvalidCreds,
      );

      if (isUnconfirmedByErrorText || isFreshUnconfirmedAttempt) {
        setErrorMessage("Your email is not confirmed yet. Please check your email and confirm your account.");
        return;
      }

      setErrorMessage(error.message);
      return;
    }

    setPendingConfirmationEmail(null);
    setSuccessMessage("Logged in successfully.");
  };

  const handleRegister = async () => {
    clearAlerts();

    const firstName = registerForm.firstName.trim();
    const middleName = registerForm.middleName.trim();
    const lastName = registerForm.lastName.trim();
    const fullName = buildFullName(firstName, middleName, lastName);
    const email = registerForm.email.trim().toLowerCase();
    const phoneNumber = registerForm.phoneNumber.trim();
    const residentStatus = registerForm.residentStatus;
    const addressPurok = registerForm.addressPurok.trim();
    const password = registerForm.password;
    const confirmPassword = registerForm.confirmPassword;

    if (!firstName || !lastName || !email || !phoneNumber || !password || !confirmPassword) {
      setErrorMessage("Please complete all registration fields.");
      return;
    }

    if (residentStatus === "resident" && !addressPurok) {
      setErrorMessage("Address / Purok is required for Sta. Rita residents.");
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Password and confirm password do not match.");
      return;
    }

    setIsSubmitting(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: mobileEmailRedirectUrl,
        data: {
          full_name: fullName,
          first_name: firstName,
          middle_name: middleName,
          last_name: lastName,
          phone_number: phoneNumber,
          resident_status: residentStatus,
          address_purok: residentStatus === "resident" ? addressPurok : "",
          role: "user",
        },
      },
    });

    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (!data.session) {
      setPendingConfirmationEmail(email);
      setSuccessMessage("Account created. Check your email and tap the confirmation link to return to the app.");
      setMode("login");
      return;
    }

    setPendingConfirmationEmail(null);
    setSuccessMessage("Account created and logged in.");
  };

  const handleSelectProfileAvatar = async (avatarKey: ProfileAvatarKey) => {
    if (!session || isSavingAvatar) {
      return;
    }

    setIsSavingAvatar(true);

    const { data, error } = await supabase.auth.updateUser({
      data: {
        ...(session.user.user_metadata ?? {}),
        profile_avatar: avatarKey,
      },
    });

    const { error: profileAvatarError } = await supabase.from("profiles").upsert(
      {
        auth_user_id: session.user.id,
        full_name: profileState.fullName,
        email: profileState.email,
        role,
        resident_status: profileState.residentStatus,
        profile_avatar: avatarKey,
      },
      {
        onConflict: "auth_user_id",
      },
    );

    setIsSavingAvatar(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (profileAvatarError) {
      setErrorMessage(profileAvatarError.message);
      return;
    }

    clearAlerts();
    setSuccessMessage("Profile avatar updated.");
    setIsAvatarPickerOpen(false);
    await loadProfileData(session.user.id, data.user ?? session.user);
  };

  const handleSaveAddressPurok = async () => {
    if (!session || isSavingAddress) {
      return;
    }

    if (profileState.residentStatus !== "resident") {
      return;
    }

    const normalizedAddress = profileState.addressPurok.trim();

    setIsSavingAddress(true);

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        auth_user_id: session.user.id,
        resident_status: profileState.residentStatus,
        address_purok: normalizedAddress,
      },
      {
        onConflict: "auth_user_id",
      },
    );

    if (profileError) {
      setIsSavingAddress(false);
      setErrorMessage(profileError.message);
      return;
    }

    const { data, error } = await supabase.auth.updateUser({
      data: {
        ...(session.user.user_metadata ?? {}),
        resident_status: profileState.residentStatus,
        address_purok: normalizedAddress,
      },
    });

    setIsSavingAddress(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    clearAlerts();
    setSuccessMessage("Address updated.");
    await loadProfileData(session.user.id, data.user ?? session.user);
  };

  const handleChangePassword = async () => {
    if (!session || isChangingPassword) {
      return;
    }

    clearAlerts();

    const currentPassword = passwordForm.currentPassword;
    const newPassword = passwordForm.newPassword;
    const confirmPassword = passwordForm.confirmPassword;
    const email = profileState.email.trim().toLowerCase();

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMessage("Please complete all password fields.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage("New password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("New password and confirm password do not match.");
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      setErrorMessage("Cannot verify account email for password update.");
      return;
    }

    setIsChangingPassword(true);

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (verifyError) {
      setIsChangingPassword(false);
      setErrorMessage("Current password is incorrect.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setIsChangingPassword(false);

    if (updateError) {
      setErrorMessage(updateError.message);
      return;
    }

    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setIsPasswordEditorOpen(false);
    setSuccessMessage("Password updated successfully.");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setActiveTab("home");
    clearAlerts();
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    clearAlerts();
  };

  const renderHomeTab = () => {
    const weatherCardBackground = getWeatherBackground(
      weatherSnapshot.intensityDescription,
      weatherSnapshot.colorCodedWarning,
      weatherSnapshot.heatIndex,
    );

    const quickActions = [
      {
        id: "history",
        title: "Water Level History",
        subtitle: "View historical water level trends and logs",
        icon: "time-outline" as const,
        tone: "primary" as const,
        onPress: () => setActiveTab("history"),
      },
      {
        id: "announcements",
        title: "Announcements",
        subtitle: "Official updates from Barangay Sta. Rita",
        icon: "megaphone-outline" as const,
        tone: "secondary" as const,
        onPress: () => setActiveTab("news"),
      },
      {
        id: "profile",
        title: "Profile",
        subtitle: "Edit your account and alert settings",
        icon: "person-outline" as const,
        tone: "muted" as const,
        onPress: () => setActiveTab("profile"),
      },
      {
        id: "map",
        title: "Map Location",
        subtitle: "Open Sta. Rita Bridge on the map",
        icon: "location-outline" as const,
        tone: "primary" as const,
        onPress: () => {
          void Linking.openURL("https://maps.google.com/?q=Sta.+Rita+Bridge+Olongapo");
        },
      },
    ];

    return (
      <>
        <HomeHeroSection
          title="BRIDGE WATER LEVEL AT STA. RITA, OLONGAPO CITY."
          subtitle="Current water level and alert status for Sta. Rita Bridge."
          stationLabel="Sta. Rita Bridge"
          updatedLabel={waterUpdatedLabel}
          rangeLabel={waterRange}
          alertTitle={alertConfig.title}
          alertBadge={alertConfig.badge}
          alertDescription={alertConfig.description}
          backgroundColor={alertConfig.cardColor}
          waterLevel={sensorSnapshot.waterLevel}
          textVariant={homeTextVariant}
        />

        <WeatherSection
          intensityLabel={weatherSnapshot.intensityDescription}
          iconPath={weatherSnapshot.iconPath}
          conditionDescription={weatherSnapshot.conditionDescription}
          dateLabel={weatherSnapshot.dateLabel}
          temperature={weatherSnapshot.temperature}
          humidity={weatherSnapshot.humidity}
          heatIndex={weatherSnapshot.heatIndex}
          advisoryText={weatherSnapshot.manualDescription}
          backgroundColor={weatherCardBackground}
          colorCodedWarning={weatherSnapshot.colorCodedWarning}
          signalNo={weatherSnapshot.signalNo}
        />

        <TideSection
          tideStatus={tideStatus}
          hourlyTides={tideHourly}
          tideExtremes={tideExtremes}
          isLoading={isTideLoading}
          error={tideError}
        />

        <QuickActionsGrid actions={quickActions} textVariant={homeTextVariant} />
      </>
    );
  };

  const renderDashboardBody = () => {
    if (activeTab === "home") {
      return renderHomeTab();
    }

    if (activeTab === "news") {
      return (
        <AnnouncementsSection
          announcements={filteredAnnouncements}
          isLoading={isAnnouncementsLoading}
          filter={announcementFilter}
          textVariant={dashboardAtmosphere.textVariant}
          onChangeFilter={setAnnouncementFilter}
          onOpenComments={openCommentsForAnnouncement}
        />
      );
    }

    if (activeTab === "history") {
      return (
        <HistorySection
          groups={groupedVisibleHistoryRecords}
          isLoading={isHistoryLoading}
          canLoadMore={visibleHistoryRecords.length < filteredHistoryRecords.length}
          textVariant={dashboardAtmosphere.textVariant}
          selectedDateLabel={selectedHistoryDateLabel}
          selectedDateValue={selectedHistoryDateValue}
          showDatePicker={showHistoryDatePicker}
          onToggleDatePicker={() => setShowHistoryDatePicker((prev) => !prev)}
          onDateChange={handleHistoryDateChange}
          onClearDate={() => setSelectedHistoryDateKey(null)}
          onLoadMore={() => setHistoryVisibleCount((count) => count + 5)}
          statusFilter={historyStatusFilter}
          onChangeStatusFilter={setHistoryStatusFilter}
        />
      );
    }

    return (
      <ProfileSection
        profileState={profileState}
        textVariant={dashboardAtmosphere.textVariant}
        displayRoleLabel={displayRoleLabel}
        residentStatusCaption={residentStatusCaption}
        selectedAvatar={selectedAvatar}
        avatarOptions={PROFILE_AVATAR_OPTIONS}
        isAvatarPickerOpen={isAvatarPickerOpen}
        onToggleAvatarPicker={() => setIsAvatarPickerOpen((prev) => !prev)}
        onSelectAvatar={(avatarKey) => void handleSelectProfileAvatar(avatarKey)}
        isSavingAvatar={isSavingAvatar}
        isPasswordEditorOpen={isPasswordEditorOpen}
        onTogglePasswordEditor={() => setIsPasswordEditorOpen((prev) => !prev)}
        passwordForm={passwordForm}
        onPasswordFormChange={(nextForm) => setPasswordForm(nextForm)}
        onSavePassword={() => void handleChangePassword()}
        showNewPassword={showNewPassword}
        onToggleShowNewPassword={() => setShowNewPassword((prev) => !prev)}
        showConfirmPassword={showConfirmPassword}
        onToggleShowConfirmPassword={() => setShowConfirmPassword((prev) => !prev)}
        onChangeAddress={(value) =>
          setProfileState((prev) => ({
            ...prev,
            addressPurok: value,
          }))
        }
        onSaveAddressPurok={() => void handleSaveAddressPurok()}
        isSavingAddress={isSavingAddress}
        onLogout={handleLogout}
      />
    );
  };

  const homeAtmosphere = getHomeAtmosphereTheme(weatherSnapshot);
  const weatherShowcaseScenes = useMemo(() => getWeatherShowcaseScenes(), []);
  const activeShowcaseScene = weatherShowcaseScenes[showcaseThemeIndex % weatherShowcaseScenes.length];
  const isHomeTabActive = activeTab === "home";
  const realHomeVisualMode = useMemo(() => getWeatherVisualMode(weatherSnapshot), [weatherSnapshot]);
  const homeVisualMode: WeatherVisualMode = IS_BACKGROUND_SHOWCASE_ENABLED ? activeShowcaseScene.mode : realHomeVisualMode;
  const defaultDashboardAtmosphere: HomeAtmosphereTheme =
    activeTab === "home"
      ? homeAtmosphere
      : DASHBOARD_TAB_ATMOSPHERE[activeTab];
  const dashboardAtmosphere = IS_BACKGROUND_SHOWCASE_ENABLED
    ? activeShowcaseScene.theme
    : defaultDashboardAtmosphere;
  const homeTextVariant = IS_BACKGROUND_SHOWCASE_ENABLED ? dashboardAtmosphere.textVariant : homeAtmosphere.textVariant;

  const shouldAnimateAtmosphere = isHomeTabActive || IS_BACKGROUND_SHOWCASE_ENABLED;

  useEffect(() => {
    if (!shouldAnimateAtmosphere) {
      atmosphereFloat.stopAnimation();
      atmospherePulse.stopAnimation();
      atmosphereFloat.setValue(0);
      atmospherePulse.setValue(0);
      return;
    }

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(atmosphereFloat, {
          toValue: 1,
          duration: 7000,
          useNativeDriver: false,
        }),
        Animated.timing(atmosphereFloat, {
          toValue: 0,
          duration: 7000,
          useNativeDriver: false,
        }),
      ]),
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(atmospherePulse, {
          toValue: 1,
          duration: 5200,
          useNativeDriver: false,
        }),
        Animated.timing(atmospherePulse, {
          toValue: 0,
          duration: 5200,
          useNativeDriver: false,
        }),
      ]),
    );

    floatLoop.start();
    pulseLoop.start();

    return () => {
      floatLoop.stop();
      pulseLoop.stop();
    };
  }, [atmosphereFloat, atmospherePulse, shouldAnimateAtmosphere]);

  useEffect(() => {
    if (!IS_BACKGROUND_SHOWCASE_ENABLED) {
      return;
    }

    const showcaseTimer = setInterval(() => {
      Animated.timing(atmosphereFade, {
        toValue: 0,
        duration: 420,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: false,
      }).start(() => {
        setShowcaseThemeIndex((prev) => (prev + 1) % weatherShowcaseScenes.length);
        Animated.timing(atmosphereFade, {
          toValue: 1,
          duration: 420,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }).start();
      });
    }, 10000);

    return () => clearInterval(showcaseTimer);
  }, [atmosphereFade, weatherShowcaseScenes.length]);

  useEffect(() => {
    const cloudLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(cloudDrift, { toValue: 1, duration: 12000, useNativeDriver: false }),
        Animated.timing(cloudDrift, { toValue: 0, duration: 12000, useNativeDriver: false }),
      ]),
    );
    cloudLoop.start();
    return () => cloudLoop.stop();
  }, [cloudDrift]);

  useEffect(() => {
    const sunLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sunPulse, { toValue: 1, duration: 1700, useNativeDriver: false }),
        Animated.timing(sunPulse, { toValue: 0, duration: 1700, useNativeDriver: false }),
      ]),
    );
    sunLoop.start();
    return () => sunLoop.stop();
  }, [sunPulse]);

  useEffect(() => {
    const starLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(starTwinkle, { toValue: 1, duration: 1450, useNativeDriver: false }),
        Animated.timing(starTwinkle, { toValue: 0, duration: 1450, useNativeDriver: false }),
      ]),
    );
    starLoop.start();
    return () => starLoop.stop();
  }, [starTwinkle]);

  useEffect(() => {
    rainFall.setValue(0);
    const rainLoop = Animated.loop(
      Animated.timing(rainFall, {
        toValue: 1,
        duration: 1400,
        useNativeDriver: false,
      }),
    );
    rainLoop.start();
    return () => rainLoop.stop();
  }, [rainFall]);

  useEffect(() => {
    rainFallSoft.setValue(0.28);
    const rainSoftLoop = Animated.loop(
      Animated.timing(rainFallSoft, {
        toValue: 1,
        duration: 2100,
        useNativeDriver: false,
      }),
    );
    rainSoftLoop.start();
    return () => rainSoftLoop.stop();
  }, [rainFallSoft]);

  const topAuraAnimatedStyle = {
    opacity: atmospherePulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.8, 1],
    }),
    transform: [
      {
        translateX: atmosphereFloat.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -10],
        }),
      },
      {
        translateY: atmosphereFloat.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 8],
        }),
      },
      {
        scale: atmospherePulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.06],
        }),
      },
    ],
  };

  const bottomAuraAnimatedStyle = {
    opacity: atmospherePulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.86, 1],
    }),
    transform: [
      {
        translateX: atmosphereFloat.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 9],
        }),
      },
      {
        translateY: atmosphereFloat.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -7],
        }),
      },
      {
        scale: atmospherePulse.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.04],
        }),
      },
    ],
  };

  useEffect(() => {
    sectionTransition.setValue(0);
    Animated.timing(sectionTransition, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [activeTab, sectionTransition]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonPulse, {
          toValue: 1,
          duration: 720,
          useNativeDriver: false,
        }),
        Animated.timing(skeletonPulse, {
          toValue: 0,
          duration: 720,
          useNativeDriver: false,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [skeletonPulse]);

  const sectionAnimatedStyle = {
    opacity: sectionTransition,
    transform: [
      {
        translateY: sectionTransition.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
    ],
  };

  const skeletonPulseStyle = {
    opacity: skeletonPulse.interpolate({
      inputRange: [0, 1],
      outputRange: [0.48, 0.94],
    }),
  };

  const renderDashboardSkeleton = () => {
    if (activeTab === "home") {
      return (
        <View style={styles.skeletonStack}>
          <Animated.View style={[styles.skeletonCardHero, skeletonPulseStyle]} />
          <Animated.View style={[styles.skeletonCardWeather, skeletonPulseStyle]} />
          <Animated.View style={[styles.skeletonCardTide, skeletonPulseStyle]} />
          <View style={styles.skeletonGridRow}>
            <Animated.View style={[styles.skeletonQuickAction, skeletonPulseStyle]} />
            <Animated.View style={[styles.skeletonQuickAction, skeletonPulseStyle]} />
          </View>
        </View>
      );
    }

    if (activeTab === "news") {
      return (
        <View style={styles.skeletonStack}>
          <Animated.View style={[styles.skeletonSectionHeader, skeletonPulseStyle]} />
          <Animated.View style={[styles.skeletonFilterRow, skeletonPulseStyle]} />
          <Animated.View style={[styles.skeletonCardNews, skeletonPulseStyle]} />
          <Animated.View style={[styles.skeletonCardNews, skeletonPulseStyle]} />
        </View>
      );
    }

    if (activeTab === "history") {
      return (
        <View style={styles.skeletonStack}>
          <Animated.View style={[styles.skeletonSectionHeader, skeletonPulseStyle]} />
          <Animated.View style={[styles.skeletonFilterRow, skeletonPulseStyle]} />
          <Animated.View style={[styles.skeletonCardHistory, skeletonPulseStyle]} />
          <Animated.View style={[styles.skeletonCardHistory, skeletonPulseStyle]} />
        </View>
      );
    }

    return (
      <View style={styles.skeletonStack}>
        <Animated.View style={[styles.skeletonSectionHeader, skeletonPulseStyle]} />
        <Animated.View style={[styles.skeletonCardProfileTop, skeletonPulseStyle]} />
        <Animated.View style={[styles.skeletonCardProfileInfo, skeletonPulseStyle]} />
        <Animated.View style={[styles.skeletonCardProfileInfo, skeletonPulseStyle]} />
      </View>
    );
  };

  if (isBootstrapping) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe}>
          <StatusBar barStyle="dark-content" backgroundColor="#f3f5f5" />
          <View style={styles.centeredLoader}>
            <Text style={styles.loaderText}>Loading...</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (isConfirmingAccount) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe}>
          <StatusBar barStyle="dark-content" backgroundColor="#f3f5f5" />
          <View style={styles.centeredLoader}>
            <Text style={styles.confirmTitle}>Confirming your account...</Text>
            <Text style={styles.confirmSubtitle}>Please wait while we sign you in.</Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (session) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[styles.safe, { backgroundColor: dashboardAtmosphere.base }]}> 
          <StatusBar
            barStyle={dashboardAtmosphere.textVariant === "light" ? "light-content" : "dark-content"}
            backgroundColor={dashboardAtmosphere.base}
          />
          <View style={styles.dashboardWrapper}>
            <Animated.View style={[styles.homeAtmosphereLayer, { opacity: atmosphereFade }]}> 
                <View style={[styles.homeAtmosphereBase, { backgroundColor: dashboardAtmosphere.base }]} />
                {activeTab === "home" && (homeVisualMode === "sunny" ? (
                  <Animated.View
                    style={[
                      styles.weatherSunCore,
                      {
                        opacity: sunPulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }),
                        transform: [{ scale: sunPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
                      },
                    ]}
                  />
                ) : null)}

                {activeTab === "home" && homeVisualMode === "sunny" ? (
                  <Animated.View
                    style={[
                      styles.weatherSunRays,
                      {
                        opacity: sunPulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.85] }),
                        transform: [{ rotate: sunPulse.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "18deg"] }) }],
                      },
                    ]}
                  />
                ) : null}

                {activeTab === "home" && homeVisualMode === "cloudy" ? (
                  <Animated.View
                    style={[
                      styles.weatherCloudGroup,
                      {
                        transform: [{ translateX: cloudDrift.interpolate({ inputRange: [0, 1], outputRange: [-16, 10] }) }],
                      },
                    ]}
                  >
                    <View style={styles.weatherCloudBlobLarge} />
                    <View style={styles.weatherCloudBlobMid} />
                    <View style={styles.weatherCloudBlobSmall} />
                  </Animated.View>
                ) : null}

                {activeTab === "home" && (homeVisualMode === "night" || homeVisualMode === "rainy-night") ? (
                  <>
                    {[
                      { left: 56, top: 84, size: 2 },
                      { left: 102, top: 58, size: 3 },
                      { left: 168, top: 72, size: 2 },
                      { left: 242, top: 54, size: 3 },
                      { left: 296, top: 94, size: 2 },
                    ].map((star, index) => (
                      <Animated.View
                        key={`star-${index}`}
                        style={[
                          styles.weatherStar,
                          {
                            left: star.left,
                            top: star.top,
                            width: star.size,
                            height: star.size,
                            opacity: starTwinkle.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.95] }),
                          },
                        ]}
                      />
                    ))}
                  </>
                ) : null}

                {activeTab === "home" && (homeVisualMode === "rainy-day" || homeVisualMode === "rainy-night") ? (
                  <>
                    {Array.from({ length: homeVisualMode === "rainy-day" ? 22 : 28 }, (_, index) => {
                      const laneProgress = Animated.modulo(Animated.add(rainFall, index * 0.095), 1);
                      const baseOpacity = homeVisualMode === "rainy-night" ? 0.5 - (index % 5) * 0.05 : 0.38 - (index % 5) * 0.04;

                      return (
                        <Animated.View
                          key={`rain-${index}`}
                          style={[
                            styles.weatherRainDrop,
                            {
                              left: `${4 + (index % 10) * 9.2}%`,
                              opacity: laneProgress.interpolate({
                                inputRange: [0, 0.16, 0.86, 1],
                                outputRange: [0, baseOpacity, baseOpacity * 0.9, 0],
                              }),
                              transform: [
                                {
                                  translateY: laneProgress.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [-210 - (index % 9) * 30, 380 + (index % 6) * 18],
                                  }),
                                },
                                {
                                  translateX: laneProgress.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, index % 2 === 0 ? 7 : -7],
                                  }),
                                },
                                { rotate: "-14deg" },
                              ],
                            },
                          ]}
                        />
                      );
                    })}

                    {Array.from({ length: homeVisualMode === "rainy-day" ? 18 : 24 }, (_, index) => {
                      const mistProgress = Animated.modulo(Animated.add(rainFallSoft, index * 0.12), 1);
                      const mistOpacity = homeVisualMode === "rainy-night" ? 0.26 - (index % 4) * 0.03 : 0.2 - (index % 4) * 0.025;

                      return (
                        <Animated.View
                          key={`rain-soft-${index}`}
                          style={[
                            styles.weatherRainDropSoft,
                            {
                              left: `${2 + (index % 12) * 8.2}%`,
                              opacity: mistProgress.interpolate({
                                inputRange: [0, 0.2, 0.82, 1],
                                outputRange: [0, mistOpacity, mistOpacity * 0.85, 0],
                              }),
                              transform: [
                                {
                                  translateY: mistProgress.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [-235 - (index % 6) * 22, 382 + (index % 5) * 20],
                                  }),
                                },
                                {
                                  translateX: mistProgress.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, index % 2 === 0 ? 4 : -4],
                                  }),
                                },
                                { rotate: "-16deg" },
                              ],
                            },
                          ]}
                        />
                      );
                    })}
                  </>
                ) : null}

                <Animated.View
                  style={[
                    styles.homeAuraBlob,
                    styles.homeAuraBlobTop,
                    { backgroundColor: dashboardAtmosphere.auraTop },
                    topAuraAnimatedStyle,
                  ]}
                />
                <Animated.View
                  style={[
                    styles.homeAuraBlob,
                    styles.homeAuraBlobBottom,
                    { backgroundColor: dashboardAtmosphere.auraBottom },
                    bottomAuraAnimatedStyle,
                  ]}
                />
                <BlurView intensity={dashboardAtmosphere.blurIntensity} tint={dashboardAtmosphere.blurTint} style={styles.homeBlurLayer} />
                <View style={[styles.homeAtmosphereVeil, { backgroundColor: dashboardAtmosphere.veil }]} />
              </Animated.View>
            <LoadingToast visible={isRefreshToastVisible} message={refreshToastMessage} topOffset={66} />
            <StatusToast
              visible={Boolean(statusModalMessage)}
              message={statusModalMessage}
              variant={statusVariant}
              topOffset={66}
              onClose={clearAlerts}
            />
            {isUsingCachedData && cachedDataBanner ? (
              <View style={styles.cachedBanner}>
                <Ionicons name="cloud-offline-outline" size={14} color="#b45309" />
                <Text style={styles.cachedBannerText}>{cachedDataBanner}</Text>
              </View>
            ) : null}
            <ScrollView
              contentContainerStyle={[styles.dashboardContainer, styles.dashboardContainerHome]}
              alwaysBounceVertical
              onScrollEndDrag={(event) => {
                if (activeTab === "profile") return;

                const y = event.nativeEvent.contentOffset.y;
                const now = Date.now();
                const cooldownMs = 5000;

                if (y <= 0 && now - lastScrollRefreshAtRef.current >= cooldownMs) {
                  lastScrollRefreshAtRef.current = now;
                  const label = activeTab === "news" ? "Refreshing News..." : "Refreshing Home...";
                  void runManualRefresh(label);
                }
              }}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshingDashboard}
                  onRefresh={() => void runManualRefresh("Refreshing dashboard...")}
                  tintColor="#2f8d41"
                  colors={["#2f8d41"]}
                />
              }
            >
              <Animated.View style={[styles.dashboardBodyWrap, sectionAnimatedStyle]}>
                {isDashboardLoading ? renderDashboardSkeleton() : renderDashboardBody()}
              </Animated.View>
            </ScrollView>
            <BottomNav
              activeTab={activeTab}
              themeVariant="dark"
              onChange={setActiveTab}
              onReselect={(tab) => {
                if (tab === "home") {
                  void runManualRefresh("Refreshing Home...");
                  return;
                }

                if (tab === "news") {
                  void runManualRefresh("Refreshing News...");
                  return;
                }

                if (tab === "history") {
                  void runManualRefresh("Refreshing History...");
                }
              }}
            />

            <AnnouncementCommentsModal
              visible={isCommentsModalOpen}
              announcement={selectedAnnouncementForComments}
              currentCommenterName={currentCommenterName}
              currentUserAvatarSource={selectedAvatar.source}
              sessionUserId={session.user.id}
              onRequestClose={closeCommentsModal}
              onError={setErrorMessage}
            />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor="#f3f5f5" />
        <StatusToast
          visible={Boolean(statusModalMessage)}
          message={statusModalMessage}
          variant={statusVariant}
          topOffset={56}
          onClose={clearAlerts}
        />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
            <View style={styles.container}>
              <Image source={require("./assets/images/Sta Rita.png")} style={styles.logo} resizeMode="contain" />

            <Text style={styles.brandTitle}>RESINA</Text>
            <Text style={styles.brandSubtitle}>Citizen Access Portal</Text>

            {mode === "login" ? (
              <View>
                <Text style={styles.inputLabel}>EMAIL</Text>
                <TextInput
                  value={loginForm.email}
                  onChangeText={(value) => setLoginForm((prev) => ({ ...prev, email: value }))}
                  style={styles.input}
                  placeholder="juandelacruz@gmail.com"
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <View style={styles.passwordHeaderRow}>
                  <Text style={styles.inputLabel}>PASSWORD</Text>
                  <Pressable>
                    <Text style={styles.forgotPassword}>Forgot Password?</Text>
                  </Pressable>
                </View>

                <View style={styles.passwordRow}>
                  <TextInput
                    value={loginForm.password}
                    onChangeText={(value) => setLoginForm((prev) => ({ ...prev, password: value }))}
                    style={styles.passwordInput}
                    placeholder="Enter your password"
                    placeholderTextColor="#9ca3af"
                    secureTextEntry={!showLoginPassword}
                    autoCapitalize="none"
                  />
                  <Pressable onPress={() => setShowLoginPassword((prev) => !prev)}>
                    <Text style={styles.passwordToggle}>{showLoginPassword ? "Hide" : "Show"}</Text>
                  </Pressable>
                </View>

                <Pressable
                  style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
                  onPress={handleLogin}
                  disabled={isSubmitting}
                >
                  <Text style={styles.primaryButtonText}>{isSubmitting ? "Please wait..." : "Log In"}</Text>
                </Pressable>

                <View style={styles.divider} />

                <View style={styles.loginFooterRow}>
                  <Text style={styles.modeText}>Don't have an account?</Text>
                </View>

                <Pressable style={styles.secondaryButton} onPress={() => switchMode("register")}>
                  <Text style={styles.secondaryButtonText}>Register Now</Text>
                  <Text style={styles.secondaryButtonArrow}>›</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                <Text style={styles.headerTitle}>Create Account</Text>
                <Text style={styles.headerSubtitle}>Join your barangay community</Text>

                <Text style={styles.inputLabelRegister}>First Name</Text>
                <TextInput
                  value={registerForm.firstName}
                  onChangeText={(value) => setRegisterForm((prev) => ({ ...prev, firstName: value }))}
                  style={styles.input}
                  placeholder="Juan"
                  placeholderTextColor="#9ca3af"
                />

                <Text style={styles.inputLabelRegister}>Middle Name</Text>
                <TextInput
                  value={registerForm.middleName}
                  onChangeText={(value) => setRegisterForm((prev) => ({ ...prev, middleName: value }))}
                  style={styles.input}
                  placeholder="Santos"
                  placeholderTextColor="#9ca3af"
                />

                <Text style={styles.inputLabelRegister}>Last Name</Text>
                <TextInput
                  value={registerForm.lastName}
                  onChangeText={(value) => setRegisterForm((prev) => ({ ...prev, lastName: value }))}
                  style={styles.input}
                  placeholder="Dela Cruz"
                  placeholderTextColor="#9ca3af"
                />

                <Text style={styles.inputLabel}>EMAIL</Text>
                <TextInput
                  value={registerForm.email}
                  onChangeText={(value) => setRegisterForm((prev) => ({ ...prev, email: value }))}
                  style={styles.input}
                  placeholder="juandelacruz@gmail.com"
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Text style={styles.inputLabelRegister}>Phone Number</Text>
                <TextInput
                  value={registerForm.phoneNumber}
                  onChangeText={(value) => setRegisterForm((prev) => ({ ...prev, phoneNumber: value }))}
                  style={styles.input}
                  placeholder="0912 345 6789"
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                />

                <Text style={styles.inputLabelRegister}>Resident Type</Text>
                <View style={styles.registerResidentRow}>
                  <Pressable
                    style={[
                      styles.registerResidentChip,
                      registerForm.residentStatus === "resident" && styles.registerResidentChipActive,
                    ]}
                    onPress={() =>
                      setRegisterForm((prev) => ({
                        ...prev,
                        residentStatus: "resident",
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.registerResidentChipText,
                        registerForm.residentStatus === "resident" && styles.registerResidentChipTextActive,
                      ]}
                    >
                      Resident of Sta. Rita
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.registerResidentChip,
                      registerForm.residentStatus === "non_resident" && styles.registerResidentChipActive,
                    ]}
                    onPress={() =>
                      setRegisterForm((prev) => ({
                        ...prev,
                        residentStatus: "non_resident",
                        addressPurok: "",
                      }))
                    }
                  >
                    <Text
                      style={[
                        styles.registerResidentChipText,
                        registerForm.residentStatus === "non_resident" && styles.registerResidentChipTextActive,
                      ]}
                    >
                      Non-Resident
                    </Text>
                  </Pressable>
                </View>

                {registerForm.residentStatus === "resident" ? (
                  <>
                    <Text style={styles.inputLabelRegister}>Address / Purok</Text>
                    <TextInput
                      value={registerForm.addressPurok}
                      onChangeText={(value) => setRegisterForm((prev) => ({ ...prev, addressPurok: value }))}
                      style={styles.input}
                      placeholder="Purok 4, Riverside St."
                      placeholderTextColor="#9ca3af"
                    />
                  </>
                ) : null}

                <Text style={styles.inputLabelRegister}>Password</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    value={registerForm.password}
                    onChangeText={(value) => setRegisterForm((prev) => ({ ...prev, password: value }))}
                    style={styles.passwordInput}
                    placeholder="Your password"
                    placeholderTextColor="#9ca3af"
                    secureTextEntry={!showRegisterPassword}
                    autoCapitalize="none"
                  />
                  <Pressable onPress={() => setShowRegisterPassword((prev) => !prev)}>
                    <Text style={styles.passwordToggle}>{showRegisterPassword ? "Hide" : "Show"}</Text>
                  </Pressable>
                </View>

                <Text style={styles.inputLabelRegister}>Confirm Password</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    value={registerForm.confirmPassword}
                    onChangeText={(value) => setRegisterForm((prev) => ({ ...prev, confirmPassword: value }))}
                    style={styles.passwordInput}
                    placeholder="Repeat your password"
                    placeholderTextColor="#9ca3af"
                    secureTextEntry={!showRegisterConfirmPassword}
                    autoCapitalize="none"
                  />
                  <Pressable onPress={() => setShowRegisterConfirmPassword((prev) => !prev)}>
                    <Text style={styles.passwordToggle}>{showRegisterConfirmPassword ? "Hide" : "Show"}</Text>
                  </Pressable>
                </View>

                <View style={styles.infoCard}>
                  <Text style={styles.infoTitle}>Automated System:</Text>
                  <Text style={styles.infoText}>
                    By registering, you agree to receive automated SMS updates regarding barangay services and community alerts.
                  </Text>
                </View>

                <Pressable
                  style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
                  onPress={handleRegister}
                  disabled={isSubmitting}
                >
                  <Text style={styles.primaryButtonText}>{isSubmitting ? "Please wait..." : "Create My Account"}</Text>
                </Pressable>

                <View style={styles.modeRow}>
                  <Text style={styles.modeText}>Already have an account?</Text>
                  <Pressable onPress={() => switchMode("login")}>
                    <Text style={styles.modeAction}> Sign In</Text>
                  </Pressable>
                </View>
              </View>
            )}

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safe: {
    flex: 1,
    backgroundColor: "#f3f5f5",
  },
  centeredLoader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loaderText: {
    color: "#6b7280",
    fontSize: 14,
  },
  confirmTitle: {
    color: "#1f2937",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 6,
  },
  confirmSubtitle: {
    color: "#6b7280",
    fontSize: 14,
  },
  dashboardWrapper: {
    flex: 1,
  },
  homeAtmosphereLayer: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "none",
    overflow: "hidden",
    zIndex: 0,
  },
  homeAtmosphereBase: {
    ...StyleSheet.absoluteFillObject,
  },
  homeAuraBlob: {
    position: "absolute",
    borderRadius: 999,
    zIndex: 1,
  },
  homeAuraBlobTop: {
    width: 360,
    height: 360,
    top: -130,
    right: -110,
  },
  homeAuraBlobBottom: {
    width: 300,
    height: 300,
    bottom: 84,
    left: -100,
  },
  homeBlurLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  homeAtmosphereVeil: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
  },
  weatherSunCore: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 999,
    top: 52,
    right: 34,
    backgroundColor: "rgba(255, 218, 112, 0.76)",
    zIndex: 6,
  },
  weatherSunRays: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 999,
    top: 20,
    right: 2,
    borderWidth: 2,
    borderColor: "rgba(255, 221, 144, 0.52)",
    zIndex: 6,
  },
  weatherCloudGroup: {
    position: "absolute",
    top: 62,
    right: 22,
    width: 170,
    height: 84,
    zIndex: 6,
  },
  weatherCloudBlobLarge: {
    position: "absolute",
    right: 10,
    top: 24,
    width: 110,
    height: 48,
    borderRadius: 999,
    backgroundColor: "rgba(244, 248, 255, 0.46)",
  },
  weatherCloudBlobMid: {
    position: "absolute",
    right: 60,
    top: 10,
    width: 76,
    height: 48,
    borderRadius: 999,
    backgroundColor: "rgba(243, 248, 255, 0.44)",
  },
  weatherCloudBlobSmall: {
    position: "absolute",
    right: 0,
    top: 18,
    width: 58,
    height: 38,
    borderRadius: 999,
    backgroundColor: "rgba(242, 247, 255, 0.42)",
  },
  weatherStar: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "#e5eeff",
    zIndex: 6,
  },
  weatherRainDrop: {
    position: "absolute",
    width: 1.6,
    height: 22,
    borderRadius: 2,
    backgroundColor: "rgba(219, 236, 255, 0.9)",
    zIndex: 6,
  },
  weatherRainDropSoft: {
    position: "absolute",
    width: 1,
    height: 14,
    borderRadius: 1.5,
    backgroundColor: "rgba(222, 239, 255, 0.72)",
    zIndex: 6,
  },
  cachedBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: -4,
    borderWidth: 1,
    borderColor: "#fcd34d",
    backgroundColor: "#fffbeb",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cachedBannerText: {
    flex: 1,
    color: "#92400e",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
  },
  dashboardContainer: {
    paddingHorizontal: 16,
    paddingTop: DASHBOARD_TOP_PADDING,
    paddingBottom: 22,
    gap: 12,
  },
  dashboardBodyWrap: {
    minHeight: 360,
  },
  dashboardContainerHome: {
    zIndex: 2,
  },
  skeletonStack: {
    gap: 12,
    paddingTop: 2,
  },
  skeletonCardHero: {
    height: 228,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  skeletonCardWeather: {
    height: 132,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  skeletonCardTide: {
    height: 190,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  skeletonGridRow: {
    flexDirection: "row",
    gap: 12,
  },
  skeletonQuickAction: {
    flex: 1,
    height: 92,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  skeletonSectionHeader: {
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  skeletonFilterRow: {
    height: 44,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  skeletonCardNews: {
    height: 220,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.19)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  skeletonCardHistory: {
    height: 156,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
  },
  skeletonCardProfileTop: {
    height: 108,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  skeletonCardProfileInfo: {
    height: 126,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  locationRow: {
    borderTopWidth: 1,
    borderTopColor: "#d9dde3",
    paddingTop: 14,
    marginBottom: 4,
  },
  locationText: {
    color: "#1f2937",
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 23,
  },
  quickActionsTitle: {
    color: "#20232c",
    fontWeight: "700",
    fontSize: 20,
  },
  actionCardPrimary: {
    borderRadius: 14,
    backgroundColor: "#c8dcf0",
    borderWidth: 1,
    borderColor: "#bdd1e4",
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actionCardSecondary: {
    borderRadius: 14,
    backgroundColor: "#dbe9de",
    borderWidth: 1,
    borderColor: "#bfd8c4",
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actionTitle: {
    fontSize: 18,
    color: "#1f2937",
    fontWeight: "700",
  },
  actionSubtitle: {
    fontSize: 13,
    color: "#4b5563",
    marginTop: 2,
  },
  actionArrow: {
    color: "#6b7280",
    fontSize: 24,
    fontWeight: "500",
  },
  profileCard: {
    borderWidth: 1,
    borderColor: "#d9dde3",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    position: "relative",
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
  },
  profileInfoCol: {
    marginLeft: 12,
    flex: 1,
  },
  profileName: {
    color: "#1f2937",
    fontSize: 16,
    fontWeight: "700",
  },
  profileInlineEditBtn: {
    position: "absolute",
    right: 12,
    top: 10,
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
  },
  profileInlineEditText: {
    color: "#4b5563",
    fontSize: 14,
    fontWeight: "700",
  },
  profileRoleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  profileRoleBadge: {
    color: "#111827",
    backgroundColor: "#e5e7eb",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "700",
  },
  profileRoleText: {
    marginLeft: 8,
    color: "#6b7280",
    fontSize: 13,
  },
  avatarPickerCard: {
    borderWidth: 1,
    borderColor: "#cdd8f0",
    borderRadius: 14,
    backgroundColor: "#f8fbff",
    padding: 12,
    marginBottom: 12,
  },
  avatarPickerTitle: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
  },
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  avatarOption: {
    width: 64,
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  avatarOptionActive: {
    backgroundColor: "#ebf5ed",
    borderColor: "#6ec17b",
  },
  avatarOptionImage: {
    width: 40,
    height: 40,
    borderRadius: 999,
  },
  avatarOptionLabel: {
    marginTop: 6,
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "600",
  },
  avatarOptionLabelActive: {
    color: "#166534",
  },
  avatarSavingText: {
    marginTop: 8,
    color: "#2f8d41",
    fontSize: 12,
    fontWeight: "600",
  },
  profileSectionTitle: {
    color: "#556072",
    fontWeight: "700",
    fontSize: 14,
    marginTop: 4,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  profileInfoCard: {
    borderWidth: 1,
    borderColor: "#d9dde3",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    marginBottom: 12,
  },
  profileInfoRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  profileInfoHeadingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  profileInfoLabel: {
    color: "#6b7280",
    fontSize: 12,
    marginBottom: 2,
  },
  profilePill: {
    color: "#374151",
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: "600",
  },
  profileInfoValue: {
    color: "#1f2937",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  profileAddressInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    backgroundColor: "#f9fafb",
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: "#1f2937",
    fontSize: 14,
  },
  passwordChangeRow: {
    borderWidth: 1,
    borderColor: "#d9dde3",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  passwordMask: {
    color: "#374151",
    fontSize: 14,
    letterSpacing: 1,
    fontWeight: "600",
  },
  passwordActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  passwordActionIcon: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "700",
  },
  profilePasswordCard: {
    borderWidth: 1,
    borderColor: "#d9dde3",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 12,
    marginBottom: 12,
  },
  profilePasswordInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    backgroundColor: "#f9fafb",
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: "#1f2937",
    fontSize: 14,
  },
  profilePasswordLabelSpacing: {
    marginTop: 10,
  },
  passwordToggleMini: {
    alignSelf: "flex-end",
    marginTop: 5,
  },
  passwordToggleMiniText: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
  },
  profilePasswordSaveBtn: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: "#4caf50",
    paddingVertical: 10,
    alignItems: "center",
  },
  profilePasswordSaveText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  alertCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#bfdfc6",
    backgroundColor: "#eef7f0",
    padding: 14,
    marginBottom: 12,
  },
  alertCardTitle: {
    color: "#1f2937",
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 6,
  },
  alertCardBody: {
    color: "#4b5563",
    fontSize: 14,
    lineHeight: 20,
  },
  profileInfoDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  newsFiltersScroll: {
    marginBottom: 10,
  },
  newsFiltersRow: {
    paddingBottom: 2,
    paddingHorizontal: 2,
    gap: 8,
  },
  historyFiltersScroll: {
    marginBottom: 10,
  },
  historyFiltersRow: {
    paddingBottom: 2,
    paddingHorizontal: 2,
    gap: 8,
  },
  historyFilterChip: {
    borderRadius: 999,
    backgroundColor: "#f0f2f5",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  historyFilterChipActive: {
    backgroundColor: "#43aa52",
    borderColor: "#43aa52",
  },
  historyFilterText: {
    color: "#596172",
    fontSize: 13,
    fontWeight: "700",
  },
  historyFilterTextActive: {
    color: "#ffffff",
  },
  historyToolbarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  historyCalendarWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d9dde3",
    backgroundColor: "#ffffff",
    marginBottom: 10,
    overflow: "hidden",
    alignItems: "stretch",
  },
  historyClearDateBtn: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d9dde3",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 10,
  },
  historyClearDateText: {
    color: "#475467",
    fontSize: 12,
    fontWeight: "600",
  },
  historyDateRangeBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cfd4db",
    backgroundColor: "#f6f7f8",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  historyDateRangeText: {
    color: "#202a37",
    fontSize: 14,
    fontWeight: "500",
  },
  historySortedText: {
    color: "#556070",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
  },
  historyDayGroup: {
    marginBottom: 4,
  },
  historyDayGroupTitle: {
    color: "#1f2937",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 2,
  },
  historyCard: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e6e8eb",
  },
  historyCardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  historyDateTimeText: {
    color: "#5b6473",
    fontSize: 13,
    fontWeight: "600",
  },
  historyStatusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "#ffffff99",
  },
  historyStatusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  historyRangeText: {
    color: "#1b222c",
    fontSize: 44,
    fontWeight: "700",
  },
  historyDescriptionLabel: {
    color: "#374151",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 8,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  historyDescriptionText: {
    color: "#4b5563",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  historyLoadMoreBtn: {
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 6,
  },
  historyLoadMoreText: {
    color: "#586174",
    fontSize: 13,
    fontWeight: "500",
  },
  newsFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: "#f0f2f5",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  newsFilterChipActive: {
    backgroundColor: "#48a957",
    borderColor: "#48a957",
  },
  newsFilterIcon: {
    marginRight: 6,
  },
  newsFilterText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  newsFilterTextActive: {
    color: "#ffffff",
  },
  placeholderWrap: {
    minHeight: 420,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2937",
  },
  placeholderText: {
    fontSize: 14,
    color: "#6b7280",
  },
  logoutButton: {
    marginTop: 8,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d9dde3",
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: "center",
  },
  logoutText: {
    color: "#4b5563",
    fontWeight: "700",
    fontSize: 14,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    alignItems: "stretch",
    justifyContent: "flex-start",
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 24,
  },
  logo: {
    width: 88,
    height: 88,
    alignSelf: "center",
    marginBottom: 8,
  },
  brandTitle: {
    textAlign: "center",
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: 0.2,
  },
  brandSubtitle: {
    textAlign: "center",
    color: "#6b7280",
    fontSize: 16,
    marginBottom: 18,
  },
  headerTitle: {
    textAlign: "center",
    fontSize: 38,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 2,
  },
  headerSubtitle: {
    textAlign: "center",
    color: "#6b7280",
    fontSize: 16,
    marginBottom: 10,
  },
  inputLabel: {
    color: "#4b5563",
    fontWeight: "700",
    fontSize: 13,
    marginBottom: 8,
    marginTop: 12,
  },
  inputLabelRegister: {
    color: "#4b5563",
    fontWeight: "700",
    fontSize: 13,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f3f4f6",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    minHeight: 54,
    fontSize: 15,
    color: "#111827",
  },
  registerResidentRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 8,
    marginTop: 2,
  },
  registerResidentChip: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  registerResidentChipActive: {
    borderColor: "#4caf50",
    backgroundColor: "#e9f7ec",
  },
  registerResidentChipText: {
    color: "#4b5563",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  registerResidentChipTextActive: {
    color: "#166534",
  },
  passwordHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  forgotPassword: {
    color: "#1877f2",
    fontSize: 13,
    fontWeight: "700",
  },
  passwordRow: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 18,
    backgroundColor: "#f3f4f6",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    minHeight: 54,
  },
  passwordInput: {
    flex: 1,
    color: "#111827",
    fontSize: 15,
    paddingVertical: 12,
  },
  passwordToggle: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "700",
  },
  infoCard: {
    marginTop: 18,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cce5d1",
    backgroundColor: "#effaf2",
    padding: 14,
  },
  infoTitle: {
    color: "#2f9e44",
    fontWeight: "700",
    marginBottom: 4,
    fontSize: 14,
  },
  infoText: {
    color: "#4b5563",
    lineHeight: 22,
    fontSize: 12,
  },
  primaryButton: {
    marginTop: 18,
    borderRadius: 16,
    backgroundColor: "#4caf50",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 20,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  divider: {
    marginTop: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
  },
  loginFooterRow: {
    marginTop: 12,
    marginBottom: 12,
    alignItems: "center",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#b7e0c0",
    borderRadius: 16,
    minHeight: 54,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "space-between",
    flexDirection: "row",
  },
  secondaryButtonText: {
    color: "#34a853",
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryButtonArrow: {
    color: "#9ad6a8",
    fontSize: 22,
    fontWeight: "700",
  },
  modeRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 18,
    alignItems: "center",
  },
  modeText: {
    color: "#6b7280",
    fontSize: 13,
  },
  modeAction: {
    color: "#2f9e44",
    fontWeight: "700",
    fontSize: 13,
  },
});
