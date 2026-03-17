import { useEffect, useMemo, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
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
  dateLabel: string;
  temperature: number;
  intensityDescription: string;
  manualDescription: string;
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

function formatRelativeUpdate(updatedAt: string | null): string {
  if (!updatedAt) return "UPDATED JUST NOW";

  const diffMinutes = Math.max(0, Math.round((Date.now() - new Date(updatedAt).getTime()) / 60000));
  if (diffMinutes < 1) return "UPDATED JUST NOW";
  if (diffMinutes === 1) return "UPDATED 1M AGO";
  return `UPDATED ${diffMinutes}M AGO`;
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

function getWeatherBackground(intensity: string): string {
  const lowered = intensity.toLowerCase();
  if (lowered.includes("heavy") || lowered.includes("torrential")) return "#cfd5de";
  if (lowered.includes("rain")) return "#d8dde4";
  return "#ece8d2";
}

function buildFullName(firstName: string, middleName: string, lastName: string): string {
  return [firstName.trim(), middleName.trim(), lastName.trim()].filter(Boolean).join(" ");
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
    dateLabel: "TODAY",
    temperature: 24,
    intensityDescription: "Clear Sky",
    manualDescription: "No active advisory right now.",
  });

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
  const waterUpdatedLabel = useMemo(() => formatRelativeUpdate(sensorSnapshot.updatedAt), [sensorSnapshot.updatedAt]);

  const clearAlerts = () => {
    setErrorMessage("");
    setSuccessMessage("");
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
      .select("recorded_at, temperature, intensity, manual_description")
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      return;
    }

    setWeatherSnapshot({
      dateLabel: formatWeatherDate(data.recorded_at as string | null),
      temperature: Math.round(Number(data.temperature ?? 24)),
      intensityDescription: String(data.intensity ?? "Clear Sky"),
      manualDescription: String(data.manual_description ?? "").trim() || "Stay updated with official barangay advisories.",
    });
  };

  const loadDashboard = async () => {
    setIsDashboardLoading(true);
    await Promise.all([loadSensorSnapshot(), loadWeatherSnapshot()]);
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

    const interval = setInterval(() => {
      void loadDashboard();
    }, 10000);

    return () => clearInterval(interval);
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
    const weatherCardBackground = getWeatherBackground(weatherSnapshot.intensityDescription);

    return (
      <>
        <Text style={styles.homeTitle}>HOME</Text>

        <View style={styles.locationRow}>
          <Text style={styles.locationText}>BRIDGE WATER LEVEL AT STA. RITA, OLONGAPO CITY.</Text>
        </View>

        <View style={[styles.sensorCard, { backgroundColor: alertConfig.cardColor }]}>
          <View style={styles.sensorMetaRow}>
            <Text style={styles.sensorChip}>Sta. Rita Bridge</Text>
            <Text style={styles.sensorUpdated}>{waterUpdatedLabel}</Text>
          </View>

          <Text style={styles.sensorRange}>{waterRange}</Text>
          <Text style={styles.sensorLevel}>{alertConfig.title}</Text>
          <Text style={styles.sensorBadge}>{alertConfig.badge}</Text>
        </View>

        <View style={[styles.weatherCard, { backgroundColor: weatherCardBackground }]}>
          <View style={styles.weatherTopRow}>
            <Text style={styles.weatherCondition}>{weatherSnapshot.intensityDescription.toUpperCase()}</Text>
            <Text style={styles.weatherDate}>{weatherSnapshot.dateLabel}</Text>
          </View>

          <View style={styles.weatherBodyRow}>
            <Text style={styles.weatherTemp}>{weatherSnapshot.temperature}°C</Text>
            <Image source={require("./assets/images/Sta-Rita.png")} style={styles.weatherIcon} resizeMode="contain" />
          </View>
        </View>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeText}>{weatherSnapshot.manualDescription}</Text>
        </View>

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
      return (
        <View style={styles.placeholderWrap}>
          <Text style={styles.placeholderTitle}>NEWS</Text>
          <Text style={styles.placeholderText}>Announcements will appear here.</Text>
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
          <ScrollView contentContainerStyle={styles.dashboardContainer}>
            {isDashboardLoading ? <Text style={styles.loaderText}>Refreshing live data...</Text> : renderDashboardBody()}
          </ScrollView>
          <BottomNav activeTab={activeTab} onChange={setActiveTab} />
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
    paddingTop: 12,
    paddingBottom: 22,
    gap: 12,
  },
  homeTitle: {
    textAlign: "center",
    color: "#1f2937",
    fontWeight: "700",
    fontSize: 20,
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
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 30,
  },
  sensorCard: {
    borderRadius: 14,
    padding: 14,
  },
  sensorMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sensorChip: {
    color: "#2f8d41",
    backgroundColor: "#e8f5eb",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontWeight: "700",
    fontSize: 12,
  },
  sensorUpdated: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 11,
  },
  sensorRange: {
    textAlign: "center",
    color: "#ffffff",
    fontSize: 50,
    fontWeight: "800",
    marginTop: 16,
  },
  sensorLevel: {
    textAlign: "center",
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 18,
    marginTop: 12,
  },
  sensorBadge: {
    alignSelf: "center",
    marginTop: 22,
    marginBottom: 8,
    color: "#2f8d41",
    backgroundColor: "#eef8ef",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    fontSize: 13,
    fontWeight: "700",
  },
  weatherCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#d5d9df",
  },
  weatherTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  weatherCondition: {
    color: "#2f3645",
    fontWeight: "700",
    fontSize: 12,
  },
  weatherDate: {
    color: "#2f3645",
    fontWeight: "700",
    fontSize: 12,
  },
  weatherBodyRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  weatherTemp: {
    fontSize: 56,
    color: "#323948",
    fontWeight: "800",
  },
  weatherIcon: {
    width: 104,
    height: 104,
    opacity: 0.9,
  },
  noticeCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d1d5db",
    padding: 14,
    backgroundColor: "#f1f3f5",
  },
  noticeText: {
    color: "#3f4654",
    fontSize: 18,
    lineHeight: 26,
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
