import "./global.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { BlurView } from "expo-blur";
import {
  Animated,
  AppState,
  Easing,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
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
import { readCache, writeCache } from "./lib/cache";
import { CACHE_KEYS, CACHE_TTL_MS } from "./lib/cache-config";
import { inferAlertLevel, formatRangeLabel, formatSensorUpdatedAt } from "./lib/helpers/sensor-helpers";
import {
  DEFAULT_WEATHER_ADVISORY,
  getWeatherBackground,
  getWeatherVisualMode,
  getHomeAtmosphereTheme,
  getWeatherShowcaseScenes,
  mapWeatherRowToSnapshot,
} from "./lib/helpers/weather-helpers";
import {
  getHistoryDateKey,
  getHistorySourceTimestamp,
  formatHistoryGroupDateLabel,
  mapHistoryRowToRecord,
  trimHistoryForCache,
  resolveLoadBanner,
  getSectionSyncLabel,
  getSectionSyncVariant,
} from "./lib/helpers/history-helpers";
import { flushOfflineWriteQueue, queueProfileWrite } from "./lib/offline-write-queue";
import { clearStoredSupabaseAuth, isSupabaseConfigured, supabase } from "./lib/supabase";
import { BottomNav, type DashboardTab } from "./components/bottom-nav";
import { StatusToast } from "./components/status-toast";
import { AnnouncementCommentsModal } from "./components/announcement-comments-modal";
import { HomeHeroSection } from "./components/home-hero-section";
import { WeatherSection } from "./components/weather-section";
import { TideSection } from "./components/tide-section";
import { AnnouncementsSection } from "./components/announcements-section";
import { HistorySection } from "./components/history-section";
import { ProfileSection } from "./components/profile-section";

type AuthMode = "login" | "register" | "forgot-password";
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
  signalNo: string;
  manualDescription: string;
};

type WeatherRow = {
  recorded_at?: string | null;
  temperature?: number | string | null;
  icon_path?: string | null;
  humidity?: number | string | null;
  heat_index?: number | string | null;
  weather_description?: string | null;
  intensity?: string | null;
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

type WeatherVisualMode =
  | "sunny"
  | "partly-cloudy"
  | "cloudy"
  | "hazy"
  | "thunderstorm"
  | "night"
  | "rainy-day"
  | "rainy-night";

type WeatherShowcaseScene = {
  mode: WeatherVisualMode;
  theme: HomeAtmosphereTheme;
};

const IS_BACKGROUND_SHOWCASE_ENABLED = false;

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
  firstName: string;
  middleName: string;
  lastName: string;
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

const ANNOUNCEMENTS_CACHE_MAX_ITEMS = 20;
const ANNOUNCEMENTS_PAGE_SIZE = 8;
const HISTORY_PAGE_SIZE = 20;

const PROFILE_AVATAR_OPTIONS: Array<{ key: ProfileAvatarKey; label: string; source: ReturnType<typeof require> }> = [
  { key: "user", label: "User", source: require("./assets/Profile/user.png") },
  { key: "man", label: "Man", source: require("./assets/Profile/man.png") },
  { key: "boy", label: "Boy", source: require("./assets/Profile/boy.png") },
  { key: "woman", label: "Woman", source: require("./assets/Profile/woman.png") },
  { key: "woman2", label: "Woman 2", source: require("./assets/Profile/woman 2.png") },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_COUNTRY_PREFIX = "+63";
const PHONE_LOCAL_LENGTH = 10;
const mobileEmailRedirectUrl =
  process.env.EXPO_PUBLIC_MOBILE_EMAIL_REDIRECT_URL ?? "https://resina-two.vercel.app/";
const resolveMobilePasswordResetRedirectUrl = (): string => {
  const webBase = mobileEmailRedirectUrl.trim().replace(/\/+$/, "");
  return `${webBase}/reset-password?view=change-password`;
};

const mobilePasswordResetRedirectUrl = resolveMobilePasswordResetRedirectUrl();
const DASHBOARD_TOP_PADDING = Platform.OS === "android" ? 14 : 16;
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
    rangeLabel: "4.0m onwards",
    cardColor: "#a43737",
    description: "Umaapaw na ang tubig. Delikado na ang sitwasyon; unahin ang kaligtasan ng buhay at sumunod sa mga rescuer.",
  },
};

function buildFullName(firstName: string, middleName: string, lastName: string): string {
  return [firstName.trim(), middleName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

function splitFullName(fullName: string): { firstName: string; middleName: string; lastName: string } {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return {
      firstName: "",
      middleName: "",
      lastName: "",
    };
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      middleName: "",
      lastName: "",
    };
  }

  if (parts.length === 2) {
    return {
      firstName: parts[0],
      middleName: "",
      lastName: parts[1],
    };
  }

  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
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

function isOfflineLikeError(message: string | null | undefined): boolean {
  const normalized = (message ?? "").toLowerCase();
  return (
    normalized.includes("network request failed") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("network error") ||
    normalized.includes("internet connection") ||
    normalized.includes("offline")
  );
}

function isAuthSessionMissingError(message: string | null | undefined): boolean {
  const normalized = (message ?? "").toLowerCase();
  return normalized.includes("auth session missing");
}

function extractPhoneLocalDigits(value: string): string {
  const digitsOnly = value.replace(/\D/g, "");

  if (!digitsOnly) {
    return "";
  }

  if (digitsOnly.startsWith("63")) {
    return digitsOnly.slice(2, 2 + PHONE_LOCAL_LENGTH);
  }

  if (digitsOnly.startsWith("0")) {
    return digitsOnly.slice(1, 1 + PHONE_LOCAL_LENGTH);
  }

  return digitsOnly.slice(0, PHONE_LOCAL_LENGTH);
}

function normalizePhoneNumber(value: string): string {
  const localDigits = extractPhoneLocalDigits(value);
  if (!localDigits) {
    return "";
  }

  return `${PHONE_COUNTRY_PREFIX}${localDigits}`;
}

function normalizePhoneInput(value: string): string {
  const normalized = normalizePhoneNumber(value);
  return normalized || PHONE_COUNTRY_PREFIX;
}

function isValidPhoneNumber(value: string): boolean {
  return extractPhoneLocalDigits(value).length === PHONE_LOCAL_LENGTH;
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

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesNormalized(haystack: string, query: string): boolean {
  if (!query) {
    return true;
  }

  return normalizeSearchText(haystack).includes(query);
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
  const currentHour = currentHourManila;
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
  const [cachedDataBanner, setCachedDataBanner] = useState("");
  const [isUsingCachedData, setIsUsingCachedData] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);
  const [isSendingPasswordReset, setIsSendingPasswordReset] = useState(false);
  const [isRecoveryPasswordFlow, setIsRecoveryPasswordFlow] = useState(false);

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
    signalNo: "No Signal",
    manualDescription: DEFAULT_WEATHER_ADVISORY,
  });

  const [tideStatus, setTideStatus] = useState<TideStatus | null>(null);
  const [tideHourly, setTideHourly] = useState<TideHourly[]>([]);
  const [tideExtremes, setTideExtremes] = useState<TideExtreme[]>([]);
  const [isTideLoading, setIsTideLoading] = useState(false);
  const [tideError, setTideError] = useState<string | null>(null);

  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [announcementFilter, setAnnouncementFilter] = useState<AnnouncementFilterKey>("all");
  const [announcementSearchInput, setAnnouncementSearchInput] = useState("");
  const [announcementSearchQuery, setAnnouncementSearchQuery] = useState("");
  const [isAnnouncementsLoading, setIsAnnouncementsLoading] = useState(false);
  const [isLoadingMoreAnnouncements, setIsLoadingMoreAnnouncements] = useState(false);
  const [hasMoreAnnouncements, setHasMoreAnnouncements] = useState(true);
  const [announcementPage, setAnnouncementPage] = useState(0);
  const [isCommentsModalOpen, setIsCommentsModalOpen] = useState(false);
  const [selectedAnnouncementForComments, setSelectedAnnouncementForComments] = useState<AnnouncementItem | null>(null);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<"all" | HistoryAlertLevel>("all");
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false);
  const [hasMoreHistoryRecords, setHasMoreHistoryRecords] = useState(true);
  const [historyPage, setHistoryPage] = useState(0);
  const [profileState, setProfileState] = useState<ProfileState>({
    firstName: "",
    middleName: "",
    lastName: "",
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
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingProfileName, setIsSavingProfileName] = useState(false);
  const [isEditingPhoneNumber, setIsEditingPhoneNumber] = useState(false);
  const [isSavingPhoneNumber, setIsSavingPhoneNumber] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
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
  const isOnlineRef = useRef(isOnline);

  const [loginForm, setLoginForm] = useState<LoginForm>({
    email: "",
    password: "",
  });
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");

  const [registerForm, setRegisterForm] = useState<RegisterForm>({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    phoneNumber: PHONE_COUNTRY_PREFIX,
    residentStatus: "resident",
    addressPurok: "",
    password: "",
    confirmPassword: "",
  });
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [hasAcceptedRegistrationConsent, setHasAcceptedRegistrationConsent] = useState(false);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);

  const [sensorSyncState, setSensorSyncState] = useState<CacheAwareLoadResult>({ source: "none", cachedAt: null });
  const [weatherSyncState, setWeatherSyncState] = useState<CacheAwareLoadResult>({ source: "none", cachedAt: null });
  const [tideSyncState, setTideSyncState] = useState<CacheAwareLoadResult>({ source: "none", cachedAt: null });
  const [announcementsSyncState, setAnnouncementsSyncState] = useState<CacheAwareLoadResult>({
    source: "none",
    cachedAt: null,
  });
  const [historySyncState, setHistorySyncState] = useState<CacheAwareLoadResult>({ source: "none", cachedAt: null });
  const [profileSyncState, setProfileSyncState] = useState<CacheAwareLoadResult>({ source: "none", cachedAt: null });

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
    const normalizedQuery = normalizeSearchText(announcementSearchQuery);

    return announcements.filter((entry) => {
      const matchesFilter = announcementFilter === "all" || entry.alert_level === announcementFilter;
      const matchesSearch =
        !normalizedQuery ||
        includesNormalized(entry.title, normalizedQuery) ||
        includesNormalized(entry.description, normalizedQuery) ||
        includesNormalized(entry.posted_by_name, normalizedQuery);

      return matchesFilter && matchesSearch;
    });
  }, [announcementFilter, announcementSearchQuery, announcements]);

  const filteredHistoryRecords = useMemo(() => {
    return historyRecords.filter((entry) => {
      const matchesStatus = historyStatusFilter === "all" || entry.alertLevel === historyStatusFilter;
      return matchesStatus;
    });
  }, [historyRecords, historyStatusFilter]);

  const groupedHistoryRecords = useMemo<HistoryDayGroup[]>(() => {
    const grouped = new Map<string, HistoryRecord[]>();

    filteredHistoryRecords.forEach((entry) => {
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
  }, [filteredHistoryRecords]);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnnouncementSearchQuery(announcementSearchInput);
    }, 300);

    return () => clearTimeout(timer);
  }, [announcementSearchInput]);

  const statusVariant = errorMessage ? "error" : "success";
  const statusModalMessage = useMemo(
    () => normalizeStatusMessage(errorMessage || successMessage, statusVariant),
    [errorMessage, successMessage, statusVariant],
  );

  useEffect(() => {
    latestWeatherRecordedAtRef.current = weatherSnapshot.recordedAt;
  }, [weatherSnapshot.recordedAt]);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setErrorMessage("App config is incomplete. Please rebuild with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.");
    }
  }, []);

  const clearAlerts = () => {
    setErrorMessage("");
    setSuccessMessage("");
  };

  const resolveProfileIdentity = () => {
    const fallbackEmail = String(session?.user?.email ?? "").trim();
    const firstName = profileState.firstName.trim();
    const middleName = profileState.middleName.trim();
    const lastName = profileState.lastName.trim();
    const fullName = buildFullName(firstName, middleName, lastName) || profileState.fullName.trim() || "Resident";
    const email = profileState.email.trim() && profileState.email.trim() !== "-" ? profileState.email.trim() : fallbackEmail;
    const phoneNumber = normalizePhoneNumber(
      profileState.phoneNumber.trim() && profileState.phoneNumber.trim() !== "-" ? profileState.phoneNumber.trim() : "",
    );
    const role = profileState.role === "admin" || profileState.role === "member" || profileState.role === "user" ? profileState.role : "user";
    const residentStatus = profileState.residentStatus;
    const addressPurok = residentStatus === "resident" ? profileState.addressPurok.trim() : "";
    const avatarKey = profileState.avatarKey;

    return {
      firstName,
      middleName,
      lastName,
      fullName,
      email,
      phoneNumber,
      role,
      residentStatus,
      addressPurok,
      avatarKey,
    };
  };

  const runManualRefresh = async () => {
    if (!session || isRefreshingDashboard) {
      return;
    }
    setIsRefreshingDashboard(true);

    try {
      const results = await Promise.all([
        loadSensorSnapshot(isOnline),
        loadWeatherSnapshot(isOnline),
        loadAnnouncements(0, "replace", isOnline),
        loadHistoryRecords(0, "replace", isOnline),
      ]);
      const banner = resolveLoadBanner(results);
      setIsUsingCachedData(banner.showCached);
      setCachedDataBanner(banner.message);
    } finally {
      setIsRefreshingDashboard(false);
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
      const authType = (hashParams.get("type") ?? queryParams.get("type") ?? "").toLowerCase();
      const requestedView = (queryParams.get("view") ?? "").toLowerCase();
      const isPasswordRecovery = authType === "recovery" || requestedView === "change-password";

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
        if (isPasswordRecovery) {
          setActiveTab("profile");
          setIsPasswordEditorOpen(true);
          setIsRecoveryPasswordFlow(true);
          setPasswordForm({
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
          });
          setSuccessMessage("Recovery verified. Set your new password now.");
        } else {
          setSuccessMessage("Email confirmed. You are now logged in.");
        }
        return;
      }

      if (authCode) {
        const { error } = await supabase.auth.exchangeCodeForSession(authCode);
        if (error) {
          setErrorMessage(error.message);
          return;
        }

        clearAlerts();
        if (isPasswordRecovery) {
          setActiveTab("profile");
          setIsPasswordEditorOpen(true);
          setIsRecoveryPasswordFlow(true);
          setPasswordForm({
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
          });
          setSuccessMessage("Recovery verified. Set your new password now.");
        } else {
          setSuccessMessage("Email confirmed. You are now logged in.");
        }
      }
    } catch {
      // Ignore unrelated deep links.
    } finally {
      setIsConfirmingAccount(false);
    }
  };

  const loadProfileData = async (authUserId: string, fallbackUser?: Session["user"], allowLiveFetch = true) => {
    const profileCacheKey = CACHE_KEYS.profile(authUserId);
    const cachedProfile = await readCache<ProfileCachePayload>(profileCacheKey, CACHE_TTL_MS.profile);

    if (cachedProfile) {
      setRole(cachedProfile.value.role);
      setProfileState(cachedProfile.value.profileState);
      setProfileSyncState({ source: "cache", cachedAt: cachedProfile.updatedAt });
    }

    if (!allowLiveFetch) {
      if (!cachedProfile) {
        setProfileSyncState({ source: "none", cachedAt: null });
      }

      return;
    }

    try {
      const { data } = await supabase.from("profiles").select("*").eq("auth_user_id", authUserId).maybeSingle();

      const row = (data ?? {}) as Record<string, unknown>;
      const metadata = ((fallbackUser?.user_metadata as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;

      const rowFirstName = String(row.first_name ?? "").trim();
      const rowMiddleName = String(row.middle_name ?? "").trim();
      const rowLastName = String(row.last_name ?? "").trim();
      const rowFullName = String(row.full_name ?? "").trim();
      const metadataFirstName = String(metadata.first_name ?? "").trim();
      const metadataMiddleName = String(metadata.middle_name ?? "").trim();
      const metadataLastName = String(metadata.last_name ?? "").trim();
      const metadataFullName = String(metadata.full_name ?? "").trim();
      const firstName = rowFirstName || metadataFirstName;
      const middleName = rowMiddleName || metadataMiddleName;
      const lastName = rowLastName || metadataLastName;
      const fallbackName = [firstName, middleName, lastName].filter(Boolean).join(" ").trim();

      const roleValue = String(row.role ?? metadata.role ?? "user");
      const avatarRaw = String(metadata.profile_avatar ?? "user") as ProfileAvatarKey;
      const avatarKey = PROFILE_AVATAR_OPTIONS.some((item) => item.key === avatarRaw) ? avatarRaw : "user";

      const fullName = String(rowFullName || metadataFullName || fallbackName || "Resident").trim();
      const derivedNameParts = splitFullName(fullName);
      const resolvedFirstName = firstName || derivedNameParts.firstName;
      const resolvedMiddleName = middleName || derivedNameParts.middleName;
      const resolvedLastName = lastName || derivedNameParts.lastName;
      const email = String(row.email ?? fallbackUser?.email ?? "-").trim();
      const phoneNumber = normalizePhoneNumber(String(row.phone_number ?? metadata.phone_number ?? ""));
      const residentStatus = normalizeResidentStatus(row.resident_status ?? metadata.resident_status);
      const rowAddress = String(row.address_purok ?? "").trim();
      const metadataAddress = String(metadata.address_purok ?? "").trim();
      const rowResidentStatus = normalizeResidentStatus(row.resident_status);
      const rowPhoneNumber = normalizePhoneNumber(String(row.phone_number ?? "").trim());
      const addressPurok = residentStatus === "resident" ? rowAddress || metadataAddress : "";
      const normalizedRole = roleValue === "admin" || roleValue === "member" || roleValue === "user" ? roleValue : "user";
      const resolvedAddress = residentStatus === "resident" ? metadataAddress || rowAddress : "";
      const resolvedPhoneNumber = normalizePhoneNumber(String(metadata.phone_number ?? row.phone_number ?? "").trim());
      const shouldSyncProfile =
        rowResidentStatus !== residentStatus ||
        (residentStatus === "resident" ? rowAddress !== resolvedAddress : rowAddress !== "") ||
        rowPhoneNumber !== resolvedPhoneNumber ||
        rowFirstName !== resolvedFirstName ||
        rowMiddleName !== resolvedMiddleName ||
        rowLastName !== resolvedLastName ||
        rowFullName !== fullName;

      // Keep profile table in sync with auth metadata after registration confirmation.
      if (shouldSyncProfile) {
        const profileEmail = String(row.email ?? fallbackUser?.email ?? "").trim();

        if (profileEmail) {
          await supabase.from("profiles").upsert(
            {
              auth_user_id: authUserId,
              first_name: resolvedFirstName,
              middle_name: resolvedMiddleName,
              last_name: resolvedLastName,
              full_name: fullName || "Resident",
              email: profileEmail,
              phone_number: resolvedPhoneNumber,
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
        firstName: resolvedFirstName,
        middleName: resolvedMiddleName,
        lastName: resolvedLastName,
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
      setProfileSyncState({ source: "live", cachedAt: null });

      await writeCache(profileCacheKey, {
        role: normalizedRole,
        profileState: nextProfileState,
      });
    } catch {
      // Keep the currently rendered cached profile state when offline.
      if (!cachedProfile) {
        setProfileSyncState({ source: "none", cachedAt: null });
      }
    }
  };

  const loadSensorSnapshot = async (allowLiveFetch = true): Promise<CacheAwareLoadResult> => {
    const cached = await readCache<SensorSnapshot>(CACHE_KEYS.sensor, CACHE_TTL_MS.sensor);
    if (cached) {
      setSensorSnapshot(cached.value);
      setSensorSyncState({ source: "cache", cachedAt: cached.updatedAt });
    }

    if (!allowLiveFetch) {
      const result = cached ? { source: "cache" as const, cachedAt: cached.updatedAt } : { source: "none" as const, cachedAt: null };
      setSensorSyncState(result);
      return result;
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
        setSensorSyncState({ source: "live", cachedAt: null });
        return {
          source: "live",
          cachedAt: null,
        };
      }
    } catch {
      // Fall back to cached data.
    }

    if (cached) {
      setSensorSyncState({ source: "cache", cachedAt: cached.updatedAt });
      return {
        source: "cache",
        cachedAt: cached.updatedAt,
      };
    }

    setSensorSyncState({ source: "none", cachedAt: null });

    return {
      source: "none",
      cachedAt: null,
    };
  };

  const loadWeatherSnapshot = useCallback(async (allowLiveFetch = true): Promise<CacheAwareLoadResult> => {
    const cached = await readCache<WeatherSnapshot>(CACHE_KEYS.weather, CACHE_TTL_MS.weather);
    if (cached) {
      setWeatherSnapshot(cached.value);
      setWeatherSyncState({ source: "cache", cachedAt: cached.updatedAt });
    }

    if (!allowLiveFetch) {
      const result = cached ? { source: "cache" as const, cachedAt: cached.updatedAt } : { source: "none" as const, cachedAt: null };
      setWeatherSyncState(result);
      return result;
    }

    try {
      const { data } = await supabase
        .from("weather_logs")
        .select(
          "recorded_at, temperature, icon_path, humidity, heat_index, weather_description, intensity, signal_no, manual_description",
        )
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        const nextSnapshot = mapWeatherRowToSnapshot(data as WeatherRow);
        latestWeatherRecordedAtRef.current = nextSnapshot.recordedAt;
        setWeatherSnapshot(nextSnapshot);
        await writeCache(CACHE_KEYS.weather, nextSnapshot);
        setWeatherSyncState({ source: "live", cachedAt: null });
        return {
          source: "live",
          cachedAt: null,
        };
      }
    } catch {
      // Fall back to cached data.
    }

    if (cached) {
      setWeatherSyncState({ source: "cache", cachedAt: cached.updatedAt });
      return {
        source: "cache",
        cachedAt: cached.updatedAt,
      };
    }

    setWeatherSyncState({ source: "none", cachedAt: null });

    return {
      source: "none",
      cachedAt: null,
    };
  }, []);

  const loadTideStatus = async (allowLiveFetch = true): Promise<CacheAwareLoadResult> => {
    setIsTideLoading(true);
    const cached = await readCache<TideStatus>(CACHE_KEYS.tide, CACHE_TTL_MS.tide);
    const cachedExtremes = await readCache<TideExtreme[]>(CACHE_KEYS.tideExtremes, CACHE_TTL_MS.tideExtremes);
    if (cached) {
      setTideStatus(cached.value);
      setTideError(null);
      setTideSyncState({ source: "cache", cachedAt: cached.updatedAt });
    }
    if (cachedExtremes) {
      setTideExtremes(cachedExtremes.value);
    }

    if (!allowLiveFetch) {
      setIsTideLoading(false);
      const result = cached ? { source: "cache" as const, cachedAt: cached.updatedAt } : { source: "none" as const, cachedAt: null };
      setTideSyncState(result);
      return result;
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
      setTideSyncState({ source: "live", cachedAt: null });
      setIsTideLoading(false);
      return {
        source: "live",
        cachedAt: null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load tide data from database";
      setTideError(message);
      setIsTideLoading(false);

      if (cached) {
        setTideSyncState({ source: "cache", cachedAt: cached.updatedAt });
        return {
          source: "cache",
          cachedAt: cached.updatedAt,
        };
      }

      setTideSyncState({ source: "none", cachedAt: null });

      return {
        source: "none",
        cachedAt: null,
      };
    }
  };

  const loadTideHourly = async (allowLiveFetch = true): Promise<void> => {
    try {
      const today = getManilaDate();
      const cached = await readCache<TideHourly[]>(CACHE_KEYS.tideHourly, CACHE_TTL_MS.tideHourly);
      if (cached) {
        setTideHourly(cached.value);
      }

      if (!allowLiveFetch) {
        return;
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

  const loadAnnouncements = async (
    nextPage = 0,
    mode: "replace" | "append" = "replace",
    allowLiveFetch = true,
  ): Promise<CacheAwareLoadResult> => {
    if (mode === "replace") {
      setIsAnnouncementsLoading(true);
    } else {
      setIsLoadingMoreAnnouncements(true);
    }

    const cached = mode === "replace"
      ? await readCache<AnnouncementItem[]>(CACHE_KEYS.announcements, CACHE_TTL_MS.announcements)
      : null;
    if (cached) {
      setAnnouncements(cached.value);
      setAnnouncementsSyncState({ source: "cache", cachedAt: cached.updatedAt });
    }

    if (!allowLiveFetch) {
      if (mode === "replace") {
        setIsAnnouncementsLoading(false);
      } else {
        setIsLoadingMoreAnnouncements(false);
      }

      const result = cached ? { source: "cache" as const, cachedAt: cached.updatedAt } : { source: "none" as const, cachedAt: null };
      setAnnouncementsSyncState(result);
      return result;
    }

    const start = nextPage * ANNOUNCEMENTS_PAGE_SIZE;
    const end = start + ANNOUNCEMENTS_PAGE_SIZE - 1;

    try {
      const { data } = await supabase
        .from("announcements")
        .select(
          "id, title, description, alert_level, posted_by_name, created_at, announcement_media(id, file_name, public_url, display_order)",
        )
        .order("created_at", { ascending: false })
        .range(start, end);

      const pageRows = ((data ?? []) as AnnouncementItem[]).map((entry) => ({
        ...entry,
        announcement_media: [...(entry.announcement_media ?? [])].sort((a, b) => a.display_order - b.display_order),
      }));

      setHasMoreAnnouncements(pageRows.length === ANNOUNCEMENTS_PAGE_SIZE);
      setAnnouncementPage(nextPage);

      if (mode === "append") {
        setAnnouncements((prev) => {
          const merged = [...prev, ...pageRows].filter(
            (entry, index, list) => list.findIndex((candidate) => candidate.id === entry.id) === index,
          );
          void writeCache(CACHE_KEYS.announcements, merged.slice(0, ANNOUNCEMENTS_CACHE_MAX_ITEMS));
          return merged;
        });
      } else {
        setAnnouncements(pageRows);
        await writeCache(CACHE_KEYS.announcements, pageRows.slice(0, ANNOUNCEMENTS_CACHE_MAX_ITEMS));
      }

      setAnnouncementsSyncState({ source: "live", cachedAt: null });

      return {
        source: "live",
        cachedAt: null,
      };
    } catch {
      // Fall back to cached data.
    } finally {
      if (mode === "replace") {
        setIsAnnouncementsLoading(false);
      } else {
        setIsLoadingMoreAnnouncements(false);
      }
    }

    if (cached) {
      setAnnouncementsSyncState({ source: "cache", cachedAt: cached.updatedAt });
      return {
        source: "cache",
        cachedAt: cached.updatedAt,
      };
    }

    setAnnouncementsSyncState({ source: "none", cachedAt: null });

    return {
      source: "none",
      cachedAt: null,
    };
  };

  const loadHistoryRecords = async (
    nextPage = 0,
    mode: "replace" | "append" = "replace",
    allowLiveFetch = true,
  ): Promise<CacheAwareLoadResult> => {
    if (mode === "replace") {
      setIsHistoryLoading(true);
    } else {
      setIsLoadingMoreHistory(true);
    }

    const cached = mode === "replace" ? await readCache<HistoryRecord[]>(CACHE_KEYS.history, CACHE_TTL_MS.history) : null;
    if (cached) {
      setHistoryRecords(cached.value);
      setHistorySyncState({ source: "cache", cachedAt: cached.updatedAt });
    }

    if (!allowLiveFetch) {
      if (mode === "replace") {
        setIsHistoryLoading(false);
      } else {
        setIsLoadingMoreHistory(false);
      }

      const result = cached ? { source: "cache" as const, cachedAt: cached.updatedAt } : { source: "none" as const, cachedAt: null };
      setHistorySyncState(result);
      return result;
    }

    const start = nextPage * HISTORY_PAGE_SIZE;
    const end = start + HISTORY_PAGE_SIZE - 1;

    try {
      const { data, error } = await supabase
        .from("sensor_readings")
        .select("id, water_level, status, reading_date, reading_time, created_at")
        .order("created_at", { ascending: false })
        .range(start, end);

      if (!error) {
        const pageRows = (data ?? [])
          .map((row) => mapHistoryRowToRecord(row as Record<string, unknown>))
          .filter((row): row is HistoryRecord => row !== null)
          .sort((left, right) => getHistorySourceTimestamp(right) - getHistorySourceTimestamp(left));

        setHasMoreHistoryRecords(pageRows.length === HISTORY_PAGE_SIZE);
        setHistoryPage(nextPage);

        if (mode === "append") {
          setHistoryRecords((prev) => {
            const merged = [...prev, ...pageRows]
              .filter((entry, index, list) => list.findIndex((candidate) => candidate.id === entry.id) === index)
              .sort((left, right) => getHistorySourceTimestamp(right) - getHistorySourceTimestamp(left));
            void writeCache(CACHE_KEYS.history, trimHistoryForCache(merged));
            return merged;
          });
        } else {
          setHistoryRecords(pageRows);
          await writeCache(CACHE_KEYS.history, trimHistoryForCache(pageRows));
        }

        setHistorySyncState({ source: "live", cachedAt: null });

        return {
          source: "live",
          cachedAt: null,
        };
      }
    } catch {
      // Fall back to cached data.
    } finally {
      if (mode === "replace") {
        setIsHistoryLoading(false);
      } else {
        setIsLoadingMoreHistory(false);
      }
    }

    if (cached) {
      setHistorySyncState({ source: "cache", cachedAt: cached.updatedAt });
      return {
        source: "cache",
        cachedAt: cached.updatedAt,
      };
    }

    setHistorySyncState({ source: "none", cachedAt: null });

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

  const getValidatedSessionHydration = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        user: null,
        session: null,
      };
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session || session.user.id !== user.id) {
      return {
        user,
        session: null,
      };
    }

    return {
      user,
      session,
    };
  }, []);

  const loadDashboard = async () => {
    const onlineNow = isOnlineRef.current;
    setIsDashboardLoading(true);
    const results = await Promise.all([
      loadSensorSnapshot(onlineNow),
      loadWeatherSnapshot(onlineNow),
      loadTideStatus(onlineNow),
      loadAnnouncements(0, "replace", onlineNow),
      loadHistoryRecords(0, "replace", onlineNow),
    ]);
    const banner = resolveLoadBanner(results);
    setIsUsingCachedData(banner.showCached);
    setCachedDataBanner(banner.message);
    setIsDashboardLoading(false);
  };

  useEffect(() => {
    let isMounted = true;

    const applyNetworkState = (state: NetInfoState) => {
      if (!isMounted) {
        return;
      }

      const connected = Boolean(state.isConnected);
      setIsOnline(connected && state.isInternetReachable !== false);
    };

    const unsubscribe = NetInfo.addEventListener(applyNetworkState);

    void NetInfo.fetch().then(applyNetworkState).catch(() => {
      if (isMounted) {
        setIsOnline(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const boot = async () => {
      try {
        const { user: initialUser, session: initialSession } = await getValidatedSessionHydration();

        if (!isMounted) return;

        if (!initialUser || !initialSession) {
          setSession(null);
        } else {
          setSession(initialSession);
          await loadProfileData(initialUser.id, initialUser, isOnlineRef.current);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.toLowerCase().includes("refresh token")) {
          await clearStoredSupabaseAuth();
          await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
          if (isMounted) {
            setSession(null);
          }
        } else {
          throw error;
        }
      }

      setIsBootstrapping(false);
    };

    void boot();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user?.id) {
        void loadProfileData(nextSession.user.id, nextSession.user, isOnlineRef.current);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [getValidatedSessionHydration]);

  useEffect(() => {
    if (!session) return;

    void loadDashboard();
  }, [session, isOnline]);

  useEffect(() => {
    if (!session || !isOnline) return;

    let isMounted = true;

    void (async () => {
      const result = await flushOfflineWriteQueue();
      if (!isMounted || result.syncedCount === 0) {
        return;
      }

      await loadProfileData(session.user.id, session.user, true);
    })();

    return () => {
      isMounted = false;
    };
  }, [session, isOnline]);

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
    if (!session || !isOnline) return;
    let liveChannel: ReturnType<typeof supabase.channel> | null = null;
    let sensorReloadTimer: ReturnType<typeof setTimeout> | null = null;
    let historyReloadTimer: ReturnType<typeof setTimeout> | null = null;
    let tideReloadTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleSensorReload = () => {
      if (sensorReloadTimer) {
        return;
      }

      sensorReloadTimer = setTimeout(() => {
        sensorReloadTimer = null;
        void loadSensorSnapshot(true);
      }, 350);
    };

    const scheduleHistoryReload = () => {
      if (historyReloadTimer) {
        return;
      }

      historyReloadTimer = setTimeout(() => {
        historyReloadTimer = null;
        void loadHistoryRecords(0, "replace", true);
      }, 500);
    };

    const scheduleTideReload = () => {
      if (tideReloadTimer) {
        return;
      }

      // Tide upserts can emit many row-level events; coalesce into one reload.
      tideReloadTimer = setTimeout(() => {
        tideReloadTimer = null;
        void loadTideStatus(true);
      }, 500);
    };

    liveChannel = supabase
      .channel("resina-mobile-dashboard-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sensor_readings" },
        () => {
          scheduleSensorReload();
          scheduleHistoryReload();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sensor_status" },
        scheduleSensorReload,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "water_levels" },
        scheduleSensorReload,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sensor_logs" },
        scheduleSensorReload,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "weather_logs" },
        (payload) => {
          const row = (payload.new ?? null) as WeatherRow | null;

          if (row && Object.keys(row).length > 0) {
            const nextSnapshot = mapWeatherRowToSnapshot(row);
            latestWeatherRecordedAtRef.current = nextSnapshot.recordedAt;
            setWeatherSnapshot(nextSnapshot);
            void writeCache(CACHE_KEYS.weather, nextSnapshot);
            return;
          }

          void loadWeatherSnapshot(true);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tide_predictions" },
        scheduleTideReload,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tide_hourly" },
        scheduleTideReload,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        () => void loadAnnouncements(0, "replace", true),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcement_media" },
        () => void loadAnnouncements(0, "replace", true),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("Mobile realtime subscriptions active");
        }
      });

    return () => {
      if (sensorReloadTimer) {
        clearTimeout(sensorReloadTimer);
      }

      if (historyReloadTimer) {
        clearTimeout(historyReloadTimer);
      }

      if (tideReloadTimer) {
        clearTimeout(tideReloadTimer);
      }

      if (liveChannel) {
        void supabase.removeChannel(liveChannel);
      }
    };
  }, [session, isOnline]);

  const handleLoadMoreAnnouncements = () => {
    if (isAnnouncementsLoading || isLoadingMoreAnnouncements || !hasMoreAnnouncements) {
      return;
    }

    void loadAnnouncements(announcementPage + 1, "append", isOnline);
  };

  const handleLoadMoreHistory = () => {
    if (isHistoryLoading || isLoadingMoreHistory || !hasMoreHistoryRecords) {
      return;
    }

    void loadHistoryRecords(historyPage + 1, "append", isOnline);
  };

  useEffect(() => {
    if (!session || !isOnline) return;

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
          await loadWeatherSnapshot(true);
        }
      })();
    }, 12000);

    return () => {
      clearInterval(interval);
    };
  }, [session, isOnline, loadWeatherSnapshot]);

  useEffect(() => {
    if (!session) return;

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && isOnline) {
        void (async () => {
          const results = await Promise.all([
            loadSensorSnapshot(true),
            loadWeatherSnapshot(true),
            loadTideStatus(true),
            loadAnnouncements(0, "replace", true),
            loadHistoryRecords(0, "replace", true),
          ]);
          const banner = resolveLoadBanner(results);
          setIsUsingCachedData(banner.showCached);
          setCachedDataBanner(banner.message);
        })();
      }
    });

    return () => {
      sub.remove();
    };
  }, [session, isOnline]);

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
    const phoneNumber = normalizePhoneNumber(registerForm.phoneNumber.trim());
    const residentStatus = registerForm.residentStatus;
    const addressPurok = registerForm.addressPurok.trim();
    const password = registerForm.password;
    const confirmPassword = registerForm.confirmPassword;

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setErrorMessage("Please complete all required fields.");
      return;
    }

    if (!isValidPhoneNumber(phoneNumber)) {
      setErrorMessage("Please enter a valid phone number in the format +639XXXXXXXXX.");
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

    if (!hasAcceptedRegistrationConsent) {
      setErrorMessage("Please agree to the Data Privacy Notice and User Agreement to continue.");
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
          data_privacy_accepted: true,
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
      setHasAcceptedRegistrationConsent(false);
      setMode("login");
      return;
    }

    setPendingConfirmationEmail(null);
    setHasAcceptedRegistrationConsent(false);
    setSuccessMessage("Account created and logged in.");
  };

  const handleSelectProfileAvatar = async (avatarKey: ProfileAvatarKey) => {
    if (!session || isSavingAvatar) {
      return;
    }

    const nextProfileState: ProfileState = {
      ...profileState,
      avatarKey,
    };

    const queueProfileAvatar = async () => {
      const identity = resolveProfileIdentity();

      await queueProfileWrite({
        userId: session.user.id,
        firstName: identity.firstName,
        middleName: identity.middleName,
        lastName: identity.lastName,
        fullName: identity.fullName,
        email: identity.email,
        phoneNumber: identity.phoneNumber,
        role: identity.role,
        residentStatus: identity.residentStatus,
        addressPurok: identity.addressPurok,
        profileAvatarKey: avatarKey,
        userMetadata: {
          ...(session.user.user_metadata ?? {}),
          first_name: identity.firstName,
          middle_name: identity.middleName,
          last_name: identity.lastName,
          full_name: identity.fullName,
          profile_avatar: avatarKey,
          phone_number: identity.phoneNumber,
        },
      });

      await writeCache(CACHE_KEYS.profile(session.user.id), {
        role: nextProfileState.role,
        profileState: nextProfileState,
      });

      setProfileState(nextProfileState);
      setRole(nextProfileState.role);
      setProfileSyncState({ source: "cache", cachedAt: Date.now() });
      clearAlerts();
      setSuccessMessage("Profile avatar saved locally. It will sync when you're back online.");
      setIsAvatarPickerOpen(false);
      setIsSavingAvatar(false);
    };

    if (!isOnline) {
      await queueProfileAvatar();
      return;
    }

    setIsSavingAvatar(true);

    try {
      const identity = resolveProfileIdentity();

      const { data, error } = await supabase.auth.updateUser({
        data: {
          ...(session.user.user_metadata ?? {}),
          first_name: identity.firstName,
          middle_name: identity.middleName,
          last_name: identity.lastName,
          full_name: identity.fullName,
          profile_avatar: avatarKey,
          phone_number: identity.phoneNumber,
        },
      });

      const { error: profileAvatarError } = await supabase.from("profiles").upsert(
        {
          auth_user_id: session.user.id,
          first_name: identity.firstName,
          middle_name: identity.middleName,
          last_name: identity.lastName,
          full_name: identity.fullName,
          email: identity.email,
          phone_number: identity.phoneNumber,
          role: identity.role,
          resident_status: identity.residentStatus,
          address_purok: identity.addressPurok,
          profile_avatar: avatarKey,
        },
        {
          onConflict: "auth_user_id",
        },
      );

      if (error || profileAvatarError) {
        const message = error?.message ?? profileAvatarError?.message ?? null;
        if (isOfflineLikeError(message)) {
          await queueProfileAvatar();
          return;
        }

        setIsSavingAvatar(false);
        setErrorMessage(message ?? "Unable to save profile avatar.");
        return;
      }

      setIsSavingAvatar(false);

      clearAlerts();
      setSuccessMessage("Profile avatar updated.");
      setIsAvatarPickerOpen(false);
      await loadProfileData(session.user.id, data.user ?? session.user, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save profile avatar.";
      if (isOfflineLikeError(message)) {
        await queueProfileAvatar();
        return;
      }

      setIsSavingAvatar(false);
      setErrorMessage(message);
    }
  };

  const handleSaveProfileName = async () => {
    if (!session || isSavingProfileName) {
      return;
    }

    const normalizedFirstName = profileState.firstName.trim();
    const normalizedMiddleName = profileState.middleName.trim();
    const normalizedLastName = profileState.lastName.trim();

    if (!normalizedFirstName || !normalizedLastName) {
      setErrorMessage("First name and last name are required.");
      return;
    }

    const normalizedFullName = buildFullName(normalizedFirstName, normalizedMiddleName, normalizedLastName);

    const queueProfileName = async () => {
      const identity = resolveProfileIdentity();
      const nextProfileState: ProfileState = {
        ...profileState,
        firstName: normalizedFirstName,
        middleName: normalizedMiddleName,
        lastName: normalizedLastName,
        fullName: normalizedFullName,
      };

      await queueProfileWrite({
        userId: session.user.id,
        firstName: normalizedFirstName,
        middleName: normalizedMiddleName,
        lastName: normalizedLastName,
        fullName: normalizedFullName,
        email: identity.email,
        phoneNumber: identity.phoneNumber,
        role: identity.role,
        residentStatus: identity.residentStatus,
        addressPurok: identity.addressPurok,
        profileAvatarKey: identity.avatarKey,
        userMetadata: {
          ...(session.user.user_metadata ?? {}),
          first_name: normalizedFirstName,
          middle_name: normalizedMiddleName,
          last_name: normalizedLastName,
          full_name: normalizedFullName,
          phone_number: identity.phoneNumber,
        },
      });

      await writeCache(CACHE_KEYS.profile(session.user.id), {
        role: nextProfileState.role,
        profileState: nextProfileState,
      });

      setProfileState(nextProfileState);
      setProfileSyncState({ source: "cache", cachedAt: Date.now() });
      setIsEditingName(false);
      clearAlerts();
      setSuccessMessage("Name saved locally. It will sync when you're back online.");
      setIsSavingProfileName(false);
    };

    if (!isOnline) {
      await queueProfileName();
      return;
    }

    setIsSavingProfileName(true);

    try {
      const identity = resolveProfileIdentity();

      const { data, error } = await supabase.auth.updateUser({
        data: {
          ...(session.user.user_metadata ?? {}),
          first_name: normalizedFirstName,
          middle_name: normalizedMiddleName,
          last_name: normalizedLastName,
          full_name: normalizedFullName,
          phone_number: identity.phoneNumber,
          resident_status: identity.residentStatus,
          address_purok: identity.addressPurok,
          profile_avatar: identity.avatarKey,
          role: identity.role,
        },
      });

      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          auth_user_id: session.user.id,
          first_name: normalizedFirstName,
          middle_name: normalizedMiddleName,
          last_name: normalizedLastName,
          full_name: normalizedFullName,
          email: identity.email,
          phone_number: identity.phoneNumber,
          role: identity.role,
          resident_status: identity.residentStatus,
          address_purok: identity.addressPurok,
          profile_avatar: identity.avatarKey,
        },
        {
          onConflict: "auth_user_id",
        },
      );

      if (error || profileError) {
        const message = error?.message ?? profileError?.message ?? "Unable to update name.";
        if (isOfflineLikeError(message)) {
          await queueProfileName();
          return;
        }

        setIsSavingProfileName(false);
        setErrorMessage(message);
        return;
      }

      setIsSavingProfileName(false);
      setIsEditingName(false);
      clearAlerts();
      setSuccessMessage("Name updated.");
      await loadProfileData(session.user.id, data.user ?? session.user, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update name.";
      if (isOfflineLikeError(message)) {
        await queueProfileName();
        return;
      }

      setIsSavingProfileName(false);
      setErrorMessage(message);
    }
  };

  const handleSaveAddressPurok = async () => {
    if (!session || isSavingAddress) {
      return;
    }

    if (profileState.residentStatus !== "resident") {
      return;
    }

    const normalizedAddress = profileState.addressPurok.trim();

    const queueProfileAddress = async () => {
      const identity = resolveProfileIdentity();

      await queueProfileWrite({
        userId: session.user.id,
        firstName: identity.firstName,
        middleName: identity.middleName,
        lastName: identity.lastName,
        fullName: identity.fullName,
        email: identity.email,
        phoneNumber: identity.phoneNumber,
        role: identity.role,
        residentStatus: identity.residentStatus,
        addressPurok: normalizedAddress,
        profileAvatarKey: identity.avatarKey,
        userMetadata: {
          ...(session.user.user_metadata ?? {}),
          first_name: identity.firstName,
          middle_name: identity.middleName,
          last_name: identity.lastName,
          full_name: identity.fullName,
          phone_number: identity.phoneNumber,
          resident_status: identity.residentStatus,
          address_purok: normalizedAddress,
        },
      });

      await writeCache(CACHE_KEYS.profile(session.user.id), {
        role: profileState.role,
        profileState: {
          ...profileState,
          addressPurok: normalizedAddress,
        },
      });

      setProfileState((prev) => ({
        ...prev,
        addressPurok: normalizedAddress,
      }));
      setProfileSyncState({ source: "cache", cachedAt: Date.now() });
      setIsEditingAddress(false);
      clearAlerts();
      setSuccessMessage("Address saved locally. It will sync when you're back online.");
      setIsSavingAddress(false);
    };

    if (!isOnline) {
      await queueProfileAddress();
      return;
    }

    setIsSavingAddress(true);

    try {
      const identity = resolveProfileIdentity();

      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          auth_user_id: session.user.id,
          first_name: identity.firstName,
          middle_name: identity.middleName,
          last_name: identity.lastName,
          full_name: identity.fullName,
          email: identity.email,
          phone_number: identity.phoneNumber,
          role: identity.role,
          resident_status: identity.residentStatus,
          address_purok: normalizedAddress,
          profile_avatar: identity.avatarKey,
        },
        {
          onConflict: "auth_user_id",
        },
      );

      if (profileError) {
        if (isOfflineLikeError(profileError.message)) {
          await queueProfileAddress();
          return;
        }

        setIsSavingAddress(false);
        setErrorMessage(profileError.message);
        return;
      }

      let refreshedUser = session.user;
      const { user: activeUser, session: activeSession } = await getValidatedSessionHydration();

      if (activeSession && activeUser) {
        const { data, error } = await supabase.auth.updateUser({
          data: {
            ...(session.user.user_metadata ?? {}),
            first_name: identity.firstName,
            middle_name: identity.middleName,
            last_name: identity.lastName,
            full_name: identity.fullName,
            phone_number: identity.phoneNumber,
            resident_status: identity.residentStatus,
            address_purok: normalizedAddress,
          },
        });

        if (error) {
          if (isOfflineLikeError(error.message)) {
            await queueProfileAddress();
            return;
          }

          if (!isAuthSessionMissingError(error.message)) {
            setIsSavingAddress(false);
            setErrorMessage(error.message);
            return;
          }
        } else {
          refreshedUser = data.user ?? activeUser;
        }
      }

      setIsSavingAddress(false);

      clearAlerts();
      setSuccessMessage("Address updated.");
      setIsEditingAddress(false);
      await loadProfileData(session.user.id, refreshedUser, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save address.";
      if (isOfflineLikeError(message)) {
        await queueProfileAddress();
        return;
      }

      setIsSavingAddress(false);
      setErrorMessage(message);
    }
  };

  const handleSavePhoneNumber = async () => {
    if (!session || isSavingPhoneNumber) {
      return;
    }

    const normalizedPhoneNumber = normalizePhoneNumber(profileState.phoneNumber.trim());

    if (!isValidPhoneNumber(normalizedPhoneNumber)) {
      setErrorMessage("Please enter a valid phone number in the format +639XXXXXXXXX.");
      return;
    }

    const queuePhoneNumberUpdate = async () => {
      const identity = resolveProfileIdentity();

      await queueProfileWrite({
        userId: session.user.id,
        firstName: identity.firstName,
        middleName: identity.middleName,
        lastName: identity.lastName,
        fullName: identity.fullName,
        email: identity.email,
        phoneNumber: normalizedPhoneNumber,
        role: identity.role,
        residentStatus: identity.residentStatus,
        addressPurok: identity.addressPurok,
        profileAvatarKey: identity.avatarKey,
        userMetadata: {
          ...(session.user.user_metadata ?? {}),
          first_name: identity.firstName,
          middle_name: identity.middleName,
          last_name: identity.lastName,
          full_name: identity.fullName,
          phone_number: normalizedPhoneNumber,
        },
      });

      await writeCache(CACHE_KEYS.profile(session.user.id), {
        role: profileState.role,
        profileState: {
          ...profileState,
          phoneNumber: normalizedPhoneNumber,
        },
      });

      setProfileState((prev) => ({
        ...prev,
        phoneNumber: normalizedPhoneNumber,
      }));
      setProfileSyncState({ source: "cache", cachedAt: Date.now() });
      setIsEditingPhoneNumber(false);
      clearAlerts();
      setSuccessMessage("Phone number saved locally. It will sync when you're back online.");
      setIsSavingPhoneNumber(false);
    };

    if (!isOnline) {
      await queuePhoneNumberUpdate();
      return;
    }

    setIsSavingPhoneNumber(true);

    try {
      const identity = resolveProfileIdentity();

      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          auth_user_id: session.user.id,
          first_name: identity.firstName,
          middle_name: identity.middleName,
          last_name: identity.lastName,
          full_name: identity.fullName,
          email: identity.email,
          phone_number: normalizedPhoneNumber,
          role: identity.role,
          resident_status: identity.residentStatus,
          address_purok: identity.addressPurok,
          profile_avatar: identity.avatarKey,
        },
        {
          onConflict: "auth_user_id",
        },
      );

      if (profileError) {
        const message = profileError.message ?? "Unable to save phone number.";

        if (isOfflineLikeError(message)) {
          await queuePhoneNumberUpdate();
          return;
        }

        setIsSavingPhoneNumber(false);
        setErrorMessage(message);
        return;
      }

      let refreshedUser = session.user;
      const { user: activeUser, session: activeSession } = await getValidatedSessionHydration();

      if (activeSession && activeUser) {
        const { data, error } = await supabase.auth.updateUser({
          data: {
            ...(session.user.user_metadata ?? {}),
            first_name: identity.firstName,
            middle_name: identity.middleName,
            last_name: identity.lastName,
            full_name: identity.fullName,
            phone_number: normalizedPhoneNumber,
          },
        });

        if (error) {
          if (isOfflineLikeError(error.message)) {
            await queuePhoneNumberUpdate();
            return;
          }

          if (!isAuthSessionMissingError(error.message)) {
            setIsSavingPhoneNumber(false);
            setErrorMessage(error.message);
            return;
          }
        } else {
          refreshedUser = data.user ?? activeUser;
        }
      }

      setIsSavingPhoneNumber(false);
      clearAlerts();
      setSuccessMessage("Phone number updated.");
      setIsEditingPhoneNumber(false);
      await loadProfileData(session.user.id, refreshedUser, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save phone number.";

      if (isOfflineLikeError(message)) {
        await queuePhoneNumberUpdate();
        return;
      }

      setIsSavingPhoneNumber(false);
      setErrorMessage(message);
    }
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

    if (!newPassword || !confirmPassword) {
      setErrorMessage("Please complete all password fields.");
      return;
    }

    if (!isRecoveryPasswordFlow && !currentPassword) {
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

    if (!isRecoveryPasswordFlow && !EMAIL_REGEX.test(email)) {
      setErrorMessage("Cannot verify account email for password update.");
      return;
    }

    setIsChangingPassword(true);

    try {
      const { user: activeUser, session: activeSession } = await getValidatedSessionHydration();

      if (!activeSession || !activeUser) {
        setErrorMessage("Session expired. Please log in again before updating your password.");
        return;
      }

      if (!isRecoveryPasswordFlow) {
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email,
          password: currentPassword,
        });

        if (verifyError) {
          setErrorMessage("Current password is incorrect.");
          return;
        }
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setErrorMessage(updateError.message);
        return;
      }

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setIsRecoveryPasswordFlow(false);
      setIsPasswordEditorOpen(false);
      setSuccessMessage("Password updated successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update password right now.";
      setErrorMessage(message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleForgotPassword = async () => {
    clearAlerts();

    const email = forgotPasswordEmail.trim().toLowerCase();
    if (!email) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setIsSendingPasswordReset(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: mobilePasswordResetRedirectUrl,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage("Password reset link sent. Open the link in your web browser to update your password.");
      setLoginForm((prev) => ({ ...prev, email }));
      setMode("login");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send reset link right now.";
      setErrorMessage(message);
    } finally {
      setIsSendingPasswordReset(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setActiveTab("home");
    clearAlerts();
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    if (nextMode === "forgot-password") {
      setForgotPasswordEmail(loginForm.email.trim().toLowerCase());
    }
    clearAlerts();
  };

  const renderHomeTab = () => {
    const weatherCardBackground = getWeatherBackground(
      weatherSnapshot.intensityDescription,
      weatherSnapshot.heatIndex,
    );

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
          statusLabel={getSectionSyncLabel(sensorSyncState, isOnline)}
          statusVariant={getSectionSyncVariant(sensorSyncState, isOnline)}
        />

        <WeatherSection
          intensityLabel={weatherSnapshot.intensityDescription}
          iconPath={weatherSnapshot.iconPath}
          conditionDescription={weatherSnapshot.conditionDescription}
          dateLabel={weatherSnapshot.dateLabel}
          temperature={weatherSnapshot.temperature}
          humidity={weatherSnapshot.humidity}
          heatIndex={weatherSnapshot.heatIndex}
          signalNo={weatherSnapshot.signalNo}
          advisoryText={weatherSnapshot.manualDescription}
          backgroundColor={weatherCardBackground}
          statusLabel={getSectionSyncLabel(weatherSyncState, isOnline)}
          statusVariant={getSectionSyncVariant(weatherSyncState, isOnline)}
        />

        <TideSection
          tideStatus={tideStatus}
          hourlyTides={tideHourly}
          tideExtremes={tideExtremes}
          isLoading={isTideLoading}
          error={tideError}
          statusLabel={getSectionSyncLabel(tideSyncState, isOnline)}
          statusVariant={getSectionSyncVariant(tideSyncState, isOnline)}
        />
      </>
    );
  };

  const isProfileCustomizationOpen = isAvatarPickerOpen || isEditingName;

  const toggleProfileCustomization = () => {
    const nextOpenState = !isProfileCustomizationOpen;
    setIsAvatarPickerOpen(nextOpenState);
    setIsEditingName(nextOpenState);
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
          isLoadingMore={isLoadingMoreAnnouncements}
          canLoadMore={hasMoreAnnouncements}
          filter={announcementFilter}
          searchQuery={announcementSearchInput}
          textVariant={dashboardAtmosphere.textVariant}
          onChangeFilter={setAnnouncementFilter}
          onChangeSearchQuery={setAnnouncementSearchInput}
          onOpenComments={openCommentsForAnnouncement}
          onLoadMore={handleLoadMoreAnnouncements}
          statusLabel={getSectionSyncLabel(announcementsSyncState, isOnline)}
          statusVariant={getSectionSyncVariant(announcementsSyncState, isOnline)}
        />
      );
    }

    if (activeTab === "history") {
      return (
        <HistorySection
          groups={groupedHistoryRecords}
          isLoading={isHistoryLoading}
          canLoadMore={hasMoreHistoryRecords}
          textVariant={dashboardAtmosphere.textVariant}
          onLoadMore={handleLoadMoreHistory}
          statusFilter={historyStatusFilter}
          onChangeStatusFilter={setHistoryStatusFilter}
          statusLabel={getSectionSyncLabel(historySyncState, isOnline)}
          statusVariant={getSectionSyncVariant(historySyncState, isOnline)}
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
        onToggleAvatarPicker={toggleProfileCustomization}
        onSelectAvatar={(avatarKey) => void handleSelectProfileAvatar(avatarKey)}
        isSavingAvatar={isSavingAvatar}
        isPasswordEditorOpen={isPasswordEditorOpen}
        onTogglePasswordEditor={() => setIsPasswordEditorOpen((prev) => !prev)}
        passwordForm={passwordForm}
        onPasswordFormChange={(nextForm) => setPasswordForm(nextForm)}
        onSavePassword={() => void handleChangePassword()}
        isChangingPassword={isChangingPassword}
        isRecoveryPasswordFlow={isRecoveryPasswordFlow}
        showNewPassword={showNewPassword}
        onToggleShowNewPassword={() => setShowNewPassword((prev) => !prev)}
        showConfirmPassword={showConfirmPassword}
        onToggleShowConfirmPassword={() => setShowConfirmPassword((prev) => !prev)}
        isEditingName={isEditingName}
        onChangeFirstName={(value) =>
          setProfileState((prev) => ({
            ...prev,
            firstName: value,
          }))
        }
        onChangeMiddleName={(value) =>
          setProfileState((prev) => ({
            ...prev,
            middleName: value,
          }))
        }
        onChangeLastName={(value) =>
          setProfileState((prev) => ({
            ...prev,
            lastName: value,
          }))
        }
        onSaveProfileName={() => void handleSaveProfileName()}
        isSavingProfileName={isSavingProfileName}
        isEditingPhoneNumber={isEditingPhoneNumber}
        onToggleEditPhoneNumber={() => {
          if (isEditingPhoneNumber) {
            void handleSavePhoneNumber();
            return;
          }

          setIsEditingPhoneNumber(true);
          setProfileState((current) => ({
            ...current,
            phoneNumber:
              current.phoneNumber.trim() && current.phoneNumber.trim() !== "-"
                ? normalizePhoneInput(current.phoneNumber)
                : PHONE_COUNTRY_PREFIX,
          }));
        }}
        onChangePhoneNumber={(value) =>
          setProfileState((prev) => ({
            ...prev,
            phoneNumber: normalizePhoneInput(value),
          }))
        }
        onSavePhoneNumber={() => void handleSavePhoneNumber()}
        isSavingPhoneNumber={isSavingPhoneNumber}
        isEditingAddress={isEditingAddress}
        onToggleEditAddress={() => setIsEditingAddress((prev) => !prev)}
        onChangeAddress={(value) =>
          setProfileState((prev) => ({
            ...prev,
            addressPurok: value,
          }))
        }
        onSaveAddressPurok={() => void handleSaveAddressPurok()}
        isSavingAddress={isSavingAddress}
        onLogout={handleLogout}
        statusLabel={getSectionSyncLabel(profileSyncState, isOnline)}
        statusVariant={getSectionSyncVariant(profileSyncState, isOnline)}
      />
    );
  };

  const homeAtmosphere = getHomeAtmosphereTheme(weatherSnapshot);
  const weatherShowcaseScenes = useMemo(() => getWeatherShowcaseScenes(), []);
  const activeShowcaseScene = weatherShowcaseScenes[showcaseThemeIndex % weatherShowcaseScenes.length];
  const isHomeTabActive = activeTab === "home";
  const realHomeVisualMode = useMemo(() => getWeatherVisualMode(weatherSnapshot), [weatherSnapshot]);
  const homeVisualMode: WeatherVisualMode = IS_BACKGROUND_SHOWCASE_ENABLED ? activeShowcaseScene.mode : realHomeVisualMode;
  // Keep all tabs in sync with the live weather atmosphere.
  const defaultDashboardAtmosphere: HomeAtmosphereTheme = homeAtmosphere;
  const dashboardAtmosphere = IS_BACKGROUND_SHOWCASE_ENABLED
    ? activeShowcaseScene.theme
    : defaultDashboardAtmosphere;
  const homeTextVariant = IS_BACKGROUND_SHOWCASE_ENABLED ? dashboardAtmosphere.textVariant : homeAtmosphere.textVariant;
  const shouldShowWeatherScene = true;

  const shouldAnimateAtmosphere = true;

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
                {shouldShowWeatherScene && (homeVisualMode === "sunny" || homeVisualMode === "partly-cloudy") ? (
                  <Animated.View
                    style={[
                      styles.weatherSunCore,
                      {
                        opacity: sunPulse.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }),
                        transform: [{ scale: sunPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
                      },
                    ]}
                  />
                ) : null}

                {shouldShowWeatherScene && (homeVisualMode === "sunny" || homeVisualMode === "partly-cloudy") ? (
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

                {shouldShowWeatherScene && (homeVisualMode === "cloudy" || homeVisualMode === "partly-cloudy") ? (
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

                {shouldShowWeatherScene && homeVisualMode === "hazy" ? (
                  <View style={styles.weatherHazeLayer}>
                    <View style={styles.weatherHazeBandTop} />
                    <View style={styles.weatherHazeBandMid} />
                    <View style={styles.weatherHazeBandBottom} />
                  </View>
                ) : null}

                {shouldShowWeatherScene && (homeVisualMode === "night" || homeVisualMode === "rainy-night" || homeVisualMode === "thunderstorm") ? (
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

                {shouldShowWeatherScene && (homeVisualMode === "rainy-day" || homeVisualMode === "rainy-night" || homeVisualMode === "thunderstorm") ? (
                  <>
                    {Array.from({ length: homeVisualMode === "rainy-day" ? 22 : 30 }, (_, index) => {
                      const laneProgress = Animated.modulo(Animated.add(rainFall, index * 0.095), 1);
                      const baseOpacity =
                        homeVisualMode === "rainy-night" || homeVisualMode === "thunderstorm"
                          ? 0.52 - (index % 5) * 0.05
                          : 0.38 - (index % 5) * 0.04;

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

                    {Array.from({ length: homeVisualMode === "rainy-day" ? 18 : 26 }, (_, index) => {
                      const mistProgress = Animated.modulo(Animated.add(rainFallSoft, index * 0.12), 1);
                      const mistOpacity =
                        homeVisualMode === "rainy-night" || homeVisualMode === "thunderstorm"
                          ? 0.28 - (index % 4) * 0.03
                          : 0.2 - (index % 4) * 0.025;

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

                {shouldShowWeatherScene && homeVisualMode === "thunderstorm" ? (
                  <Animated.View
                    style={[
                      styles.weatherLightningFlash,
                      {
                        opacity: starTwinkle.interpolate({ inputRange: [0, 0.35, 0.55, 1], outputRange: [0, 0.2, 0.55, 0] }),
                      },
                    ]}
                  />
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
                {Platform.OS === "android" ? (
                  <View
                    style={[
                      styles.homeBlurLayer,
                      dashboardAtmosphere.blurTint === "dark" ? styles.homeBlurFallbackDark : styles.homeBlurFallbackLight,
                    ]}
                  />
                ) : (
                  <BlurView intensity={dashboardAtmosphere.blurIntensity} tint={dashboardAtmosphere.blurTint} style={styles.homeBlurLayer} />
                )}
                <View style={[styles.homeAtmosphereVeil, { backgroundColor: dashboardAtmosphere.veil }]} />
              </Animated.View>
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
                  void runManualRefresh();
                }
              }}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshingDashboard}
                  onRefresh={() => void runManualRefresh()}
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
              themeVariant={dashboardAtmosphere.blurTint}
              onChange={setActiveTab}
              onReselect={(tab) => {
                if (tab === "home") {
                  void runManualRefresh();
                  return;
                }

                if (tab === "news") {
                  void runManualRefresh();
                  return;
                }

                if (tab === "history") {
                  void runManualRefresh();
                }
              }}
            />

            <AnnouncementCommentsModal
              visible={isCommentsModalOpen}
              announcement={selectedAnnouncementForComments}
              currentCommenterName={currentCommenterName}
              currentUserAvatarSource={selectedAvatar.source}
              sessionUserId={session.user.id}
              isOnline={isOnline}
              onRequestClose={closeCommentsModal}
              onError={setErrorMessage}
              onQueued={setSuccessMessage}
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
                  <Pressable onPress={() => switchMode("forgot-password")}>
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
            ) : mode === "forgot-password" ? (
              <View>
                <Text style={styles.headerTitle}>Reset Password</Text>
                <Text style={styles.headerSubtitle}>Enter your email to receive a secure reset link.</Text>

                <Text style={styles.inputLabel}>EMAIL</Text>
                <TextInput
                  value={forgotPasswordEmail}
                  onChangeText={setForgotPasswordEmail}
                  style={styles.input}
                  placeholder="juandelacruz@gmail.com"
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Pressable
                  style={[styles.primaryButton, isSendingPasswordReset && styles.buttonDisabled]}
                  onPress={handleForgotPassword}
                  disabled={isSendingPasswordReset}
                >
                  <Text style={styles.primaryButtonText}>
                    {isSendingPasswordReset ? "Sending link..." : "Send Reset Link"}
                  </Text>
                </Pressable>

                <View style={styles.modeRow}>
                  <Text style={styles.modeText}>Remember your password?</Text>
                  <Pressable onPress={() => switchMode("login")}>
                    <Text style={styles.modeAction}> Sign In</Text>
                  </Pressable>
                </View>
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

                <Text style={styles.inputLabelRegister}>Middle Name (Optional)</Text>
                <TextInput
                  value={registerForm.middleName}
                  onChangeText={(value) => setRegisterForm((prev) => ({ ...prev, middleName: value }))}
                  style={styles.input}
                  placeholder="S"
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
                <View style={styles.phoneInputRow}>
                  <Text style={styles.phonePrefixText}>{PHONE_COUNTRY_PREFIX}</Text>
                  <TextInput
                    value={extractPhoneLocalDigits(registerForm.phoneNumber)}
                    onChangeText={(value) =>
                      setRegisterForm((prev) => ({
                        ...prev,
                        phoneNumber: normalizePhoneInput(`${PHONE_COUNTRY_PREFIX}${value}`),
                      }))
                    }
                    style={styles.phoneLocalInput}
                    placeholder="9123456789"
                    placeholderTextColor="#9ca3af"
                    keyboardType="phone-pad"
                  />
                </View>

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

                <View style={styles.policyCard}>
                  <Pressable style={styles.policyHeaderRow} onPress={() => setIsPolicyModalOpen(true)}>
                    <Text style={styles.policyTitle}>Data Privacy Notice & User Agreement</Text>
                    <Text style={styles.policyOpenText}>View</Text>
                  </Pressable>
                  <Text style={styles.policyHintText}>Please read and review the full agreement before creating your account.</Text>
                  <Pressable
                    style={styles.policyConsentRow}
                    onPress={() => setHasAcceptedRegistrationConsent((prev) => !prev)}
                  >
                    <View
                      style={[
                        styles.policyCheckbox,
                        hasAcceptedRegistrationConsent && styles.policyCheckboxChecked,
                      ]}
                    >
                      {hasAcceptedRegistrationConsent ? <Text style={styles.policyCheckboxCheck}>✓</Text> : null}
                    </View>
                    <Text style={styles.policyConsentText}>
                      I have read and agree to the Data Privacy Notice and User Agreement.
                    </Text>
                  </Pressable>
                </View>

                <Modal
                  visible={isPolicyModalOpen}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setIsPolicyModalOpen(false)}
                >
                  <View style={styles.policyModalBackdrop}>
                    <View style={styles.policyModalCard}>
                      <View style={styles.policyModalHeader}>
                        <Text style={styles.policyModalTitle}>Data Privacy & User Agreement</Text>
                        <Pressable onPress={() => setIsPolicyModalOpen(false)}>
                          <Text style={styles.policyModalCloseText}>Close</Text>
                        </Pressable>
                      </View>

                      <ScrollView style={styles.policyModalScroll} showsVerticalScrollIndicator={false}>
                        <Text style={styles.policyModalParagraph}>
                          We collect your registration details, including your name, contact information, resident status,
                          and account credentials, to verify your identity, create your account, and deliver barangay
                          services through the RESINA app.
                        </Text>
                        <Text style={styles.policyModalParagraph}>
                          Your phone number may be used for automated SMS notifications related to water level alerts,
                          emergency advisories, and relevant community updates. Information is only used for official app
                          functions and barangay service operations.
                        </Text>
                        <Text style={styles.policyModalParagraph}>
                          By proceeding, you confirm that the information you provide is accurate, that you are authorized
                          to submit it, and that you agree to use the app responsibly in accordance with barangay policies
                          and applicable data privacy regulations.
                        </Text>
                      </ScrollView>

                      <Pressable
                        style={styles.policyModalAgreeButton}
                        onPress={() => {
                          setHasAcceptedRegistrationConsent(true);
                          setIsPolicyModalOpen(false);
                        }}
                      >
                        <Text style={styles.policyModalAgreeButtonText}>I Understand and Agree</Text>
                      </Pressable>
                    </View>
                  </View>
                </Modal>

                <Pressable
                  style={[
                    styles.primaryButton,
                    (isSubmitting || !hasAcceptedRegistrationConsent) && styles.buttonDisabled,
                  ]}
                  onPress={handleRegister}
                  disabled={isSubmitting || !hasAcceptedRegistrationConsent}
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
  homeBlurFallbackLight: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  homeBlurFallbackDark: {
    backgroundColor: "rgba(8, 18, 32, 0.22)",
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
  weatherHazeLayer: {
    position: "absolute",
    top: 42,
    right: 8,
    left: 8,
    height: 156,
    zIndex: 5,
  },
  weatherHazeBandTop: {
    position: "absolute",
    top: 0,
    left: 26,
    right: 18,
    height: 42,
    borderRadius: 999,
    backgroundColor: "rgba(255, 236, 205, 0.36)",
  },
  weatherHazeBandMid: {
    position: "absolute",
    top: 44,
    left: 8,
    right: 34,
    height: 52,
    borderRadius: 999,
    backgroundColor: "rgba(245, 219, 180, 0.32)",
  },
  weatherHazeBandBottom: {
    position: "absolute",
    top: 96,
    left: 22,
    right: 2,
    height: 46,
    borderRadius: 999,
    backgroundColor: "rgba(239, 201, 151, 0.28)",
  },
  weatherStar: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "#e5eeff",
    zIndex: 6,
  },
  weatherLightningFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(219, 234, 255, 0.42)",
    zIndex: 7,
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
  phoneInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f3f4f6",
    borderRadius: 18,
    minHeight: 54,
    overflow: "hidden",
  },
  phonePrefixText: {
    color: "#4b5563",
    fontSize: 15,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: "#d1d5db",
    backgroundColor: "#e5e7eb",
    alignSelf: "stretch",
    textAlignVertical: "center",
  },
  phoneLocalInput: {
    flex: 1,
    color: "#111827",
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 54,
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
  policyCard: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    padding: 14,
  },
  policyTitle: {
    color: "#1d4ed8",
    fontWeight: "700",
    flex: 1,
    fontSize: 14,
  },
  policyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  policyOpenText: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "700",
  },
  policyHintText: {
    color: "#475569",
    lineHeight: 19,
    fontSize: 12,
    marginTop: 6,
  },
  policyConsentRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  policyCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#93c5fd",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  policyCheckboxChecked: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  policyCheckboxCheck: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 14,
  },
  policyConsentText: {
    flex: 1,
    color: "#1e293b",
    fontSize: 12,
    lineHeight: 18,
  },
  policyModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.52)",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  policyModalCard: {
    borderRadius: 16,
    backgroundColor: "#ffffff",
    maxHeight: "72%",
    overflow: "hidden",
  },
  policyModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  policyModalTitle: {
    flex: 1,
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
    marginRight: 12,
  },
  policyModalCloseText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "700",
  },
  policyModalScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  policyModalParagraph: {
    color: "#334155",
    fontSize: 13,
    lineHeight: 22,
    marginBottom: 10,
  },
  policyModalAgreeButton: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    backgroundColor: "#eff6ff",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  policyModalAgreeButtonText: {
    color: "#1d4ed8",
    fontSize: 14,
    fontWeight: "700",
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
