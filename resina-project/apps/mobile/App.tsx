import { useEffect, useMemo, useRef, useState } from "react";
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
import { supabase } from "./lib/supabase";
import { BottomNav, type DashboardTab } from "./components/bottom-nav";
import { LoadingToast } from "./components/loading-toast";
import { SensorStatusCard } from "./components/sensor-status-card";
import { WeatherUpdateCard } from "./components/weather-update-card";

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

type AnnouncementAlertLevel = "normal" | "warning" | "emergency";

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const expoEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
const mobileEmailRedirectUrl =
  expoEnv?.EXPO_PUBLIC_MOBILE_EMAIL_REDIRECT_URL ?? "https://resina-two.vercel.app/";

const ALERT_LEVELS: Record<
  AlertLevelKey,
  {
    title: string;
    badge: string;
    rangeLabel: string;
    cardColor: string;
  }
> = {
  normal: {
    title: "NORMAL LEVEL",
    badge: "Alert Level 1",
    rangeLabel: "1.5 - 2.49m",
    cardColor: "#4CAF50",
  },
  critical: {
    title: "CRITICAL LEVEL",
    badge: "Alert Level 2",
    rangeLabel: "2.5 - 2.9m",
    cardColor: "#F7C520",
  },
  evacuation: {
    title: "EVACUATION LEVEL",
    badge: "Alert Level 3",
    rangeLabel: "3.0 - 3.9m",
    cardColor: "#FF7E1C",
  },
  spilling: {
    title: "SPILLING LEVEL",
    badge: "Alert Level 4",
    rangeLabel: "4.0+m",
    cardColor: "#A82A2A",
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
    manualDescription: String(row.manual_description ?? "").trim() || "Stay updated with official barangay advisories.",
    colorCodedWarning: String(row.color_coded_warning ?? "No Warning"),
    signalNo: String(row.signal_no ?? "No Signal"),
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
    manualDescription: "No active advisory right now.",
    colorCodedWarning: "No Warning",
    signalNo: "No Signal",
  });
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [isAnnouncementsLoading, setIsAnnouncementsLoading] = useState(false);
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
      await Promise.all([loadSensorSnapshot(), loadWeatherSnapshot(), loadAnnouncements()]);
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

  const loadProfileRole = async (authUserId: string) => {
    const { data } = await supabase.from("profiles").select("role").eq("auth_user_id", authUserId).maybeSingle();

    if (data?.role) {
      setRole(data.role);
    }
  };

  const loadSensorSnapshot = async () => {
    const sources = [
      { table: "sensor_readings", orderBy: "created_at" },
      { table: "sensor_status", orderBy: "created_at" },
      { table: "water_levels", orderBy: "created_at" },
      { table: "sensor_logs", orderBy: "timestamp" },
    ];

    for (const source of sources) {
      const { data, error } = await supabase.from(source.table).select("*").order(source.orderBy, { ascending: false }).limit(1);

      if (error || !data || data.length === 0) {
        continue;
      }

      const row = data[0] as Record<string, unknown>;
      const waterLevel = Number(row.water_level ?? row.level ?? row.sensor_level ?? row.reading ?? row.value ?? Number.NaN);

      setSensorSnapshot({
        waterLevel: Number.isNaN(waterLevel) ? null : waterLevel,
        statusText: (row.status ?? row.level_status ?? row.alert_status ?? row.alert_level ?? null) as string | null,
        updatedAt: (row.created_at ?? row.timestamp ?? row.recorded_at ?? null) as string | null,
      });
      return;
    }
  };

  const loadWeatherSnapshot = async () => {
    const { data } = await supabase
      .from("weather_logs")
      .select("recorded_at, temperature, icon_path, humidity, heat_index, weather_description, intensity, color_coded_warning, signal_no, manual_description")
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      return;
    }

    setWeatherSnapshot(mapWeatherRowToSnapshot(data as WeatherRow));
  };

  const loadAnnouncements = async () => {
    setIsAnnouncementsLoading(true);

    const { data } = await supabase
      .from("announcements")
      .select(
        "id, title, description, alert_level, posted_by_name, created_at, announcement_media(id, file_name, public_url, display_order)",
      )
      .order("created_at", { ascending: false })
      .limit(20);

    const rows = ((data ?? []) as AnnouncementItem[]).map((entry) => ({
      ...entry,
      announcement_media: [...(entry.announcement_media ?? [])].sort((a, b) => a.display_order - b.display_order),
    }));

    setAnnouncements(rows);
    setIsAnnouncementsLoading(false);
  };

  const loadDashboard = async () => {
    setIsDashboardLoading(true);
    await Promise.all([loadSensorSnapshot(), loadWeatherSnapshot(), loadAnnouncements()]);
    setIsDashboardLoading(false);
  };

  useEffect(() => {
    let isMounted = true;

    const boot = async () => {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();

      if (!isMounted) return;

      setSession(initialSession);
      if (initialSession?.user?.id) {
        await loadProfileRole(initialSession.user.id);
      }

      setIsBootstrapping(false);
    };

    void boot();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user?.id) {
        void loadProfileRole(nextSession.user.id);
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
        () => void loadSensorSnapshot(),
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
            setWeatherSnapshot(mapWeatherRowToSnapshot(row));
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
        void Promise.all([loadWeatherSnapshot(), loadAnnouncements()]);
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
        <Text style={styles.homeTitle}>HOME</Text>

        <View style={styles.locationRow}>
          <Text style={styles.locationText}>BRIDGE WATER LEVEL AT STA. RITA, OLONGAPO CITY.</Text>
        </View>

        <SensorStatusCard
          stationLabel="Sta. Rita Bridge"
          updatedLabel={waterUpdatedLabel}
          rangeLabel={waterRange}
          alertTitle={alertConfig.title}
          alertBadge={alertConfig.badge}
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
        <View style={styles.actionCardPrimary}>
          <View>
            <Text style={styles.actionTitle}>Water Level History</Text>
            <Text style={styles.actionSubtitle}>View historical water level trends and logs</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </View>

        <View style={styles.actionCardSecondary}>
          <View>
            <Text style={styles.actionTitle}>Announcements</Text>
            <Text style={styles.actionSubtitle}>Official updates from Barangay Sta. Rita</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </View>
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

      return (
        <View>
          <Text style={styles.newsTitle}>ANNOUNCEMENT</Text>
          <Text style={styles.newsSubtitle}>Recent updates from Barangay Sta. Rita</Text>

          {isAnnouncementsLoading ? <Text style={styles.loaderText}>Loading announcements...</Text> : null}

          {!isAnnouncementsLoading && announcements.length === 0 ? (
            <View style={styles.placeholderWrap}>
              <Text style={styles.placeholderTitle}>NEWS</Text>
              <Text style={styles.placeholderText}>No announcements posted yet.</Text>
            </View>
          ) : null}

          {announcements.map((entry) => {
            const tone = badgeStyleByAlert[entry.alert_level] ?? badgeStyleByAlert.normal;
            const firstImage = entry.announcement_media?.[0]?.public_url;

            return (
              <View key={entry.id} style={styles.newsCard}>
                <View style={styles.newsMetaRow}>
                  <Text style={styles.newsAuthor}>{entry.posted_by_name || "Barangay Admin"}</Text>
                  <Text style={styles.newsDate}>{formatAnnouncementDate(entry.created_at)}</Text>
                </View>

                <Text style={styles.newsHeadline}>{entry.title}</Text>
                <View style={[styles.newsAlertBadge, { backgroundColor: tone.bg }]}>
                  <Text style={[styles.newsAlertText, { color: tone.text }]}>{tone.label}</Text>
                </View>

                <Text style={styles.newsDescription}>{entry.description}</Text>

                {firstImage ? <Image source={{ uri: firstImage }} style={styles.newsImage} resizeMode="cover" /> : null}
              </View>
            );
          })}
        </View>
      );
    }

    if (activeTab === "history") {
      return (
        <View style={styles.placeholderWrap}>
          <Text style={styles.placeholderTitle}>HISTORY</Text>
          <Text style={styles.placeholderText}>Historical sensor records will appear here.</Text>
        </View>
      );
    }

    return (
      <View style={styles.placeholderWrap}>
        <Text style={styles.placeholderTitle}>PROFILE</Text>
        <Text style={styles.placeholderText}>Role: {role}</Text>
        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
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
              }
            }}
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
            <Image source={require("./assets/images/Sta-Rita.png")} style={styles.logo} resizeMode="contain" />

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
  dashboardContainer: {
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 22,
    gap: 12,
  },
  homeTitle: {
    textAlign: "center",
    color: "#1f2937",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 6,
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
  newsTitle: {
    textAlign: "center",
    color: "#1f2937",
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 4,
  },
  newsSubtitle: {
    textAlign: "center",
    color: "#6b7280",
    fontSize: 13,
    marginBottom: 12,
  },
  newsCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d8dde4",
    backgroundColor: "#ffffff",
    padding: 14,
    marginBottom: 12,
  },
  newsMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  newsAuthor: {
    color: "#2f9e44",
    fontWeight: "700",
    fontSize: 13,
    flex: 1,
  },
  newsDate: {
    color: "#6b7280",
    fontSize: 12,
  },
  newsHeadline: {
    marginTop: 8,
    color: "#1f2937",
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 32,
  },
  newsAlertBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 10,
  },
  newsAlertText: {
    fontSize: 12,
    fontWeight: "700",
  },
  newsDescription: {
    marginTop: 10,
    color: "#4b5563",
    fontSize: 15,
    lineHeight: 22,
  },
  newsImage: {
    marginTop: 12,
    width: "100%",
    height: 180,
    borderRadius: 12,
    backgroundColor: "#e5e7eb",
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
    backgroundColor: "#4caf50",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  logoutText: {
    color: "#ffffff",
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
