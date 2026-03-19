import { useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import {
  AppState,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Session } from "@supabase/supabase-js";
import { clearExpiredCaches, readCache, writeCache } from "./lib/cache";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { BottomNav, type DashboardTab } from "./components/bottom-nav";
import { AnnouncementCard } from "./components/announcement-card";
import { LoadingToast } from "./components/loading-toast";
import { AnnouncementCommentsModal } from "./components/announcement-comments-modal";
import { SensorStatusCard } from "./components/sensor-status-card";
import { WeatherUpdateCard } from "./components/weather-update-card";
import { MobileSectionHeader } from "./components/mobile-section-header";

type AuthMode = "login" | "register";
type AlertLevelKey = "normal" | "critical" | "evacuation" | "spilling";

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

type ProfileState = {
  fullName: string;
  email: string;
  phoneNumber: string;
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
  profile: (userId: string) => `resina:cache:profile:${userId}`,
};

const CACHE_TTL_MS = {
  sensor: 5 * 60 * 1000,
  weather: 5 * 60 * 1000,
  announcements: 30 * 60 * 1000,
  history: 60 * 60 * 1000,
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
    password: "",
    confirmPassword: "",
  });

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
      return "RESIDENT";
    }

    return roleLabel.toUpperCase();
  }, [profileState.role]);

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
    const rowAddress = String(row.address_purok ?? "").trim();
    const metadataAddress = String(metadata.address_purok ?? "").trim();
    const addressPurok = rowAddress || metadataAddress;

    const nextProfileState: ProfileState = {
      fullName,
      email: email || "-",
      phoneNumber: phoneNumber || "-",
      addressPurok,
      role: roleValue,
      avatarKey,
    };

    setRole(roleValue);
    setProfileState(nextProfileState);

    await writeCache(profileCacheKey, {
      role: roleValue,
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
    const results = await Promise.all([loadSensorSnapshot(), loadWeatherSnapshot(), loadAnnouncements(), loadHistoryRecords()]);
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
      if (error.message.toLowerCase().includes("email not confirmed")) {
        setErrorMessage("Your email is not confirmed yet. Please check your email and confirm your account.");
        return;
      }

      setErrorMessage(error.message);
      return;
    }

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
    const password = registerForm.password;
    const confirmPassword = registerForm.confirmPassword;

    if (!firstName || !lastName || !email || !phoneNumber || !password || !confirmPassword) {
      setErrorMessage("Please complete all registration fields.");
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
      setSuccessMessage("Account created. Check your email and tap the confirmation link to return to the app.");
      setMode("login");
      return;
    }

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

    setIsSavingAvatar(false);

    if (error) {
      setErrorMessage(error.message);
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

    const normalizedAddress = profileState.addressPurok.trim();

    setIsSavingAddress(true);

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        auth_user_id: session.user.id,
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

    return (
      <>
        <MobileSectionHeader title="HOME" />

        <View style={styles.locationRow}>
          <Text style={styles.locationText}>BRIDGE WATER LEVEL AT STA. RITA, OLONGAPO CITY.</Text>
        </View>

        <SensorStatusCard
          stationLabel="Sta. Rita Bridge"
          updatedLabel={waterUpdatedLabel}
          rangeLabel={waterRange}
          alertTitle={alertConfig.title}
          alertBadge={alertConfig.badge}
          alertDescription={alertConfig.description}
          backgroundColor={alertConfig.cardColor}
        />

        <WeatherUpdateCard
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

        <Text style={styles.quickActionsTitle}>Quick Actions</Text>
        <Pressable style={styles.actionCardPrimary} onPress={() => setActiveTab("history")}>
          <View>
            <Text style={styles.actionTitle}>Water Level History</Text>
            <Text style={styles.actionSubtitle}>View historical water level trends and logs</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </Pressable>

        <Pressable style={styles.actionCardSecondary} onPress={() => setActiveTab("news")}>
          <View>
            <Text style={styles.actionTitle}>Announcements</Text>
            <Text style={styles.actionSubtitle}>Official updates from Barangay Sta. Rita</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </Pressable>
      </>
    );
  };

  const renderDashboardBody = () => {
    if (activeTab === "home") {
      return renderHomeTab();
    }

    if (activeTab === "news") {
      const badgeStyleByAlert: Record<AnnouncementAlertLevel, { bg: string; text: string; label: string }> = {
        normal: { bg: "#ecfdf3", text: "#15803d", label: "General Update" },
        warning: { bg: "#fff7ed", text: "#c2410c", label: "Warning Alert" },
        emergency: { bg: "#fff1f2", text: "#be123c", label: "Emergency Alert" },
      };

      const filterOptions: Array<{ key: AnnouncementFilterKey; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
        { key: "all", label: "All / Lahat", icon: "funnel-outline" },
        { key: "warning", label: "Warning", icon: "warning-outline" },
        { key: "emergency", label: "Emergency", icon: "alert-circle-outline" },
      ];

      return (
        <View>
          <MobileSectionHeader title="ANNOUNCEMENT" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.newsFiltersScroll}
            contentContainerStyle={styles.newsFiltersRow}
          >
            {filterOptions.map((option) => {
              const isActive = announcementFilter === option.key;

              return (
                <Pressable
                  key={option.key}
                  style={[styles.newsFilterChip, isActive && styles.newsFilterChipActive]}
                  onPress={() => setAnnouncementFilter(option.key)}
                >
                  <Ionicons
                    name={option.icon}
                    size={15}
                    color={isActive ? "#ffffff" : "#4b5563"}
                    style={styles.newsFilterIcon}
                  />
                  <Text style={[styles.newsFilterText, isActive && styles.newsFilterTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {isAnnouncementsLoading ? <Text style={styles.loaderText}>Loading announcements...</Text> : null}

          {!isAnnouncementsLoading && filteredAnnouncements.length === 0 ? (
            <View style={styles.placeholderWrap}>
              <Text style={styles.placeholderTitle}>NEWS</Text>
              <Text style={styles.placeholderText}>No announcements found for this filter.</Text>
            </View>
          ) : null}

          {filteredAnnouncements.map((entry) => {
            const tone = badgeStyleByAlert[entry.alert_level] ?? badgeStyleByAlert.normal;

            return (
              <AnnouncementCard
                key={entry.id}
                entry={entry}
                tone={tone}
                formattedDate={formatAnnouncementDate(entry.created_at)}
                onOpenComments={openCommentsForAnnouncement}
              />
            );
          })}
        </View>
      );
    }

    if (activeTab === "history") {
      const historyFilterOptions: Array<{ key: "all" | HistoryAlertLevel; label: string }> = [
        { key: "all", label: "All" },
        { key: "normal", label: "Normal" },
        { key: "critical", label: "Critical" },
        { key: "evacuation", label: "Evacuate" },
        { key: "spilling", label: "Spilling" },
      ];

      const canLoadMore = visibleHistoryRecords.length < filteredHistoryRecords.length;

      return (
        <View>
          <MobileSectionHeader title="HISTORY" />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.historyFiltersScroll}
            contentContainerStyle={styles.historyFiltersRow}
          >
            {historyFilterOptions.map((option) => {
              const isActive = historyStatusFilter === option.key;

              return (
                <Pressable
                  key={option.key}
                  style={[styles.historyFilterChip, isActive && styles.historyFilterChipActive]}
                  onPress={() => setHistoryStatusFilter(option.key)}
                >
                  <Text style={[styles.historyFilterText, isActive && styles.historyFilterTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.historyToolbarRow}>
            <Pressable
              style={styles.historyDateRangeBtn}
              onPress={() => setShowHistoryDatePicker(true)}
            >
              <Ionicons name="calendar-outline" size={15} color="#374151" />
              <Text style={styles.historyDateRangeText}>{selectedHistoryDateLabel}</Text>
            </Pressable>

            <Text style={styles.historySortedText}>SORTED: NEWEST FIRST</Text>
          </View>

          {showHistoryDatePicker ? (
            <View style={styles.historyCalendarWrap}>
              <DateTimePicker
                mode="date"
                value={selectedHistoryDateValue}
                display={Platform.OS === "ios" ? "inline" : "default"}
                onChange={handleHistoryDateChange}
              />
            </View>
          ) : null}

          {selectedHistoryDateKey ? (
            <Pressable style={styles.historyClearDateBtn} onPress={() => setSelectedHistoryDateKey(null)}>
              <Text style={styles.historyClearDateText}>Show all dates</Text>
            </Pressable>
          ) : null}

          {isHistoryLoading ? <Text style={styles.loaderText}>Loading history...</Text> : null}

          {!isHistoryLoading && filteredHistoryRecords.length === 0 ? (
            <View style={styles.placeholderWrap}>
              <Text style={styles.placeholderText}>No history records found.</Text>
            </View>
          ) : null}

          {groupedVisibleHistoryRecords.map((group) => (
            <View key={group.dateKey} style={styles.historyDayGroup}>
              <Text style={styles.historyDayGroupTitle}>{group.dateLabel}</Text>

              {group.entries.map((entry) => {
                const config = HISTORY_LEVELS[entry.alertLevel];

                return (
                  <View
                    key={entry.id}
                    style={[
                      styles.historyCard,
                      {
                        backgroundColor: config.cardBackground,
                      },
                    ]}
                  >
                    <View style={styles.historyCardTopRow}>
                      <Text style={styles.historyDateTimeText}>{formatHistoryTimeOnly(entry)}</Text>
                      <View style={[styles.historyStatusBadge, { borderColor: config.badgeBorder }]}>
                        <Text style={[styles.historyStatusBadgeText, { color: config.badgeText }]}>{entry.statusLabel}</Text>
                      </View>
                    </View>
                    <Text style={styles.historyRangeText}>{entry.rangeLabel}</Text>
                    <Text style={styles.historyDescriptionLabel}>Deskripsyon</Text>
                    <Text style={styles.historyDescriptionText}>{entry.description}</Text>
                  </View>
                );
              })}
            </View>
          ))}

          {!isHistoryLoading && canLoadMore ? (
            <Pressable
              style={styles.historyLoadMoreBtn}
              onPress={() => setHistoryVisibleCount((count) => count + 5)}
            >
              <Text style={styles.historyLoadMoreText}>Load older records</Text>
            </Pressable>
          ) : null}
        </View>
      );
    }

    return (
      <View>
        <MobileSectionHeader title="PROFILE" />

        <View style={styles.profileCard}>
          <Image source={selectedAvatar.source} style={styles.profileAvatar} resizeMode="cover" />
          <View style={styles.profileInfoCol}>
            <Text style={styles.profileName}>{profileState.fullName}</Text>
            <View style={styles.profileRoleRow}>
              <Text style={styles.profileRoleBadge}>{displayRoleLabel}</Text>
              <Text style={styles.profileRoleText}>Barangay Sta. Rita</Text>
            </View>
          </View>
          <Pressable style={styles.profileInlineEditBtn} onPress={() => setIsAvatarPickerOpen((prev) => !prev)}>
            <Text style={styles.profileInlineEditText}>{isAvatarPickerOpen ? "✕" : "✎"}</Text>
          </Pressable>
        </View>

        {isAvatarPickerOpen ? (
          <View style={styles.avatarPickerCard}>
            <Text style={styles.avatarPickerTitle}>Choose your profile avatar</Text>
            <View style={styles.avatarGrid}>
              {PROFILE_AVATAR_OPTIONS.map((item) => {
                const isSelected = item.key === profileState.avatarKey;

                return (
                  <Pressable
                    key={item.key}
                    style={[styles.avatarOption, isSelected && styles.avatarOptionActive]}
                    onPress={() => void handleSelectProfileAvatar(item.key)}
                    disabled={isSavingAvatar}
                  >
                    <Image source={item.source} style={styles.avatarOptionImage} resizeMode="cover" />
                  </Pressable>
                );
              })}
            </View>
            {isSavingAvatar ? <Text style={styles.avatarSavingText}>Saving avatar...</Text> : null}
          </View>
        ) : null}

        <Text style={styles.profileSectionTitle}>Contact Details</Text>
        <View style={styles.profileInfoCard}>
          <View style={styles.profileInfoRow}>
            <View style={styles.profileInfoHeadingRow}>
              <Text style={styles.profileInfoLabel}>Phone Number</Text>
              <Text style={styles.profilePill}>SMS Active</Text>
            </View>
            <Text style={styles.profileInfoValue}>{profileState.phoneNumber}</Text>
          </View>
          <View style={styles.profileInfoDivider} />
          <View style={styles.profileInfoRow}>
            <Text style={styles.profileInfoLabel}>Email Address</Text>
            <Text style={styles.profileInfoValue}>{profileState.email}</Text>
          </View>
          <View style={styles.profileInfoDivider} />
          <View style={styles.profileInfoRow}>
            <Text style={styles.profileInfoLabel}>Address / Purok</Text>
            <TextInput
              value={profileState.addressPurok}
              onChangeText={(value) =>
                setProfileState((prev) => ({
                  ...prev,
                  addressPurok: value,
                }))
              }
              onBlur={() => void handleSaveAddressPurok()}
              style={styles.profileAddressInput}
              placeholder="Purok 4, Riverside St."
              placeholderTextColor="#9ca3af"
              editable={!isSavingAddress}
            />
          </View>
        </View>

        <Text style={styles.profileSectionTitle}>Change Password</Text>
        <View style={styles.passwordChangeRow}>
          <Text style={styles.passwordMask}>{isPasswordEditorOpen ? "Enter new password" : "********"}</Text>
          <View style={styles.passwordActions}>
            <Pressable onPress={() => setIsPasswordEditorOpen((prev) => !prev)}>
              <Text style={styles.passwordActionIcon}>✎</Text>
            </Pressable>
          </View>
        </View>

        {isPasswordEditorOpen ? (
          <View style={styles.profilePasswordCard}>
            <Text style={styles.profileInfoLabel}>Current Password</Text>
            <TextInput
              value={passwordForm.currentPassword}
              onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, currentPassword: value }))}
              style={styles.profilePasswordInput}
              secureTextEntry
              autoCapitalize="none"
              placeholder="Enter current password"
              placeholderTextColor="#9ca3af"
            />

            <Text style={[styles.profileInfoLabel, styles.profilePasswordLabelSpacing]}>New Password</Text>
            <TextInput
              value={passwordForm.newPassword}
              onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, newPassword: value }))}
              style={styles.profilePasswordInput}
              secureTextEntry={!showNewPassword}
              autoCapitalize="none"
              placeholder="Enter new password"
              placeholderTextColor="#9ca3af"
            />
            <Pressable style={styles.passwordToggleMini} onPress={() => setShowNewPassword((prev) => !prev)}>
              <Text style={styles.passwordToggleMiniText}>{showNewPassword ? "Hide" : "Show"}</Text>
            </Pressable>

            <Text style={[styles.profileInfoLabel, styles.profilePasswordLabelSpacing]}>Confirm Password</Text>
            <TextInput
              value={passwordForm.confirmPassword}
              onChangeText={(value) => setPasswordForm((prev) => ({ ...prev, confirmPassword: value }))}
              style={styles.profilePasswordInput}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              placeholder="Confirm new password"
              placeholderTextColor="#9ca3af"
            />
            <Pressable style={styles.passwordToggleMini} onPress={() => setShowConfirmPassword((prev) => !prev)}>
              <Text style={styles.passwordToggleMiniText}>{showConfirmPassword ? "Hide" : "Show"}</Text>
            </Pressable>

            <Pressable
              style={[styles.profilePasswordSaveBtn, isChangingPassword && styles.buttonDisabled]}
              onPress={() => void handleChangePassword()}
              disabled={isChangingPassword}
            >
              <Text style={styles.profilePasswordSaveText}>{isChangingPassword ? "Updating..." : "Update Password"}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.alertCard}>
          <Text style={styles.alertCardTitle}>Alert Notifications</Text>
          <Text style={styles.alertCardBody}>
            Your primary phone number is registered for automated SMS alerts. In case of spills or critical levels, you
            will be notified immediately.
          </Text>
        </View>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout from Device</Text>
        </Pressable>
      </View>
    );
  };

  if (isBootstrapping) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor="#f3f5f5" />
        <View style={styles.centeredLoader}>
          <Text style={styles.loaderText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isConfirmingAccount) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor="#f3f5f5" />
        <View style={styles.centeredLoader}>
          <Text style={styles.confirmTitle}>Confirming your account...</Text>
          <Text style={styles.confirmSubtitle}>Please wait while we sign you in.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (session) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor="#f3f5f5" />
        <View style={styles.dashboardWrapper}>
          <LoadingToast visible={isRefreshToastVisible} message={refreshToastMessage} topOffset={66} />
          {isUsingCachedData && cachedDataBanner ? (
            <View style={styles.cachedBanner}>
              <Ionicons name="cloud-offline-outline" size={14} color="#b45309" />
              <Text style={styles.cachedBannerText}>{cachedDataBanner}</Text>
            </View>
          ) : null}
          <ScrollView
            contentContainerStyle={styles.dashboardContainer}
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
            {isDashboardLoading ? <Text style={styles.loaderText}>Refreshing live data...</Text> : renderDashboardBody()}
          </ScrollView>
          <BottomNav
            activeTab={activeTab}
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
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#f3f5f5" />
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

            {!!errorMessage && <Text style={styles.errorMessage}>{errorMessage}</Text>}
            {!!successMessage && <Text style={styles.successMessage}>{successMessage}</Text>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  errorMessage: {
    marginTop: 14,
    textAlign: "center",
    color: "#dc2626",
    fontSize: 13,
  },
  successMessage: {
    marginTop: 14,
    textAlign: "center",
    color: "#15803d",
    fontSize: 13,
  },
});
