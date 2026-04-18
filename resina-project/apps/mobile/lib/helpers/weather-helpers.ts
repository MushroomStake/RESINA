export const DEFAULT_WEATHER_ADVISORY =
  "No urgent advisory right now. Keep alerts enabled and monitor weather updates from Barangay Sta. Rita.";

const MOBILE_DRY_NORMAL_ICON_PATH = "/weather/dry-season/sun Normal.png";

const MOBILE_WEATHER_ICON_MAP: Record<string, string> = {
  Normal: MOBILE_DRY_NORMAL_ICON_PATH,
  Caution: "/weather/dry-season/sun Caution.png",
  "Extreme Caution": "/weather/dry-season/sun Extreme Caution.png",
  Danger: "/weather/dry-season/sun Danger.png",
  "Extreme Danger": "/weather/dry-season/sun Danger.png",
  "Light Rain": "/weather/wet-season/Light Rain.png",
  "Moderate Rain": "/weather/wet-season/Moderate Rain.png",
  "Heavy Rain": "/weather/wet-season/Heavy Rain.png",
  "Torrential Rain": "/weather/wet-season/Torrential Rain.png",
};

export type HomeAtmosphereTheme = {
  base: string;
  auraTop: string;
  auraBottom: string;
  veil: string;
  blurTint: "light" | "dark";
  textVariant: "light" | "dark";
  blurIntensity: number;
};

export type WeatherVisualMode =
  | "sunny"
  | "partly-cloudy"
  | "cloudy"
  | "hazy"
  | "thunderstorm"
  | "night"
  | "rainy-day"
  | "rainy-night";

export type WeatherSnapshotLike = {
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

export type WeatherShowcaseScene = {
  mode: WeatherVisualMode;
  theme: HomeAtmosphereTheme;
};

export type WeatherRowLike = {
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

function getManilaHourNow(): number {
  const raw = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    hour12: false,
  }).format(new Date());
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? 0 : parsed % 24;
}

export function formatWeatherDate(dateISO: string | null): string {
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

export function getWeatherBackground(intensity: string, heatIndex: number): string {
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

export function getWeatherVisualMode(snapshot: WeatherSnapshotLike): WeatherVisualMode {
  const context = [
    snapshot.intensityDescription,
    snapshot.conditionDescription,
    snapshot.manualDescription,
  ]
    .join(" ")
    .toLowerCase();

  const iconPath = snapshot.iconPath.toLowerCase();
  const isNightByIcon = /(moon|night)/.test(iconPath);
  const isNightByContext = /(night|evening|overnight)/.test(context);
  const isNightByClock = getManilaHourNow() < 6 || getManilaHourNow() >= 18;
  const shouldUseClockFallback = !snapshot.iconPath.trim();
  const isNight = isNightByIcon || isNightByContext || (shouldUseClockFallback && isNightByClock);
  const isThunderstorm = /(thunder|lightning|storm|squall|bagyo|typhoon|cyclone)/.test(context);
  const isRainy = /(rain|shower|drizzle|downpour|precip)/.test(context);
  const isHazy = /(haze|smoke|smog|dust|ash|vog)/.test(context);
  const isPartlyCloudy = /(few clouds|scattered clouds|partly cloudy|broken clouds)/.test(context);
  const isCloudy = /(cloud|overcast|fog|mist)/.test(context);

  if (isThunderstorm) {
    return "thunderstorm";
  }

  if (isRainy) {
    return isNight ? "rainy-night" : "rainy-day";
  }

  if (isHazy) {
    return "hazy";
  }

  if (isNight) {
    return "night";
  }

  if (isPartlyCloudy) {
    return "partly-cloudy";
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

export function getWeatherShowcaseScenes(): WeatherShowcaseScene[] {
  const buildSnapshot = (
    intensityDescription: string,
    conditionDescription: string,
    heatIndex: number,
  ): WeatherSnapshotLike => ({
    recordedAt: null,
    dateLabel: "TODAY",
    temperature: heatIndex,
    iconPath: "",
    intensityDescription,
    conditionDescription,
    humidity: 0,
    heatIndex,
    signalNo: "No Signal",
    manualDescription: "",
  });

  const snapshots = [
    buildSnapshot("Normal", "Sunny", 31),
    buildSnapshot("Normal", "Sunny", 45),
    buildSnapshot("Normal", "Overcast clouds", 27),
    buildSnapshot("Normal", "Clear sky", 26),
    buildSnapshot("Light Rain", "Light rain", 26),
    buildSnapshot("Heavy Rain", "Thunderstorm rain", 26),
  ];

  return snapshots.map((snapshot) => ({
    mode: getWeatherVisualMode(snapshot),
    theme: getHomeAtmosphereTheme(snapshot),
  }));
}

export function getHomeAtmosphereTheme(snapshot: WeatherSnapshotLike): HomeAtmosphereTheme {
  const mode = getWeatherVisualMode(snapshot);
  const weatherCardBase = getWeatherBackground(snapshot.intensityDescription, snapshot.heatIndex);

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

  if (mode === "thunderstorm") {
    return {
      base: "#314469",
      auraTop: "rgba(109, 132, 173, 0.34)",
      auraBottom: "rgba(47, 67, 107, 0.28)",
      veil: "rgba(9, 17, 34, 0.26)",
      blurTint: "dark",
      textVariant: "light",
      blurIntensity: 16,
    };
  }

  if (mode === "hazy") {
    const base = "#E7B071";
    return {
      base,
      auraTop: "rgba(240, 196, 145, 0.34)",
      auraBottom: "rgba(208, 149, 92, 0.24)",
      veil: "rgba(255, 244, 226, 0.18)",
      blurTint: "light",
      textVariant: getAdaptiveTextVariant(base),
      blurIntensity: 12,
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

  if (mode === "partly-cloudy") {
    const base = "#6EA9E3";
    return {
      base,
      auraTop: "rgba(154, 197, 241, 0.34)",
      auraBottom: "rgba(89, 143, 206, 0.24)",
      veil: "rgba(255, 255, 255, 0.2)",
      blurTint: "light",
      textVariant: getAdaptiveTextVariant(base),
      blurIntensity: 13,
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

export function mapWeatherRowToSnapshot(
  row: WeatherRowLike,
  defaultWeatherAdvisory = DEFAULT_WEATHER_ADVISORY,
): WeatherSnapshotLike {
  const temp = Math.round(Number(row.temperature ?? 24));
  const intensityDescription = String(row.intensity ?? "Normal");
  const storedIconPath = String(row.icon_path ?? "").trim();
  const mappedIconPath = MOBILE_WEATHER_ICON_MAP[intensityDescription] ?? MOBILE_DRY_NORMAL_ICON_PATH;
  const isDaytime = getManilaHourNow() >= 6 && getManilaHourNow() < 18;
  const iconPath = isDaytime ? mappedIconPath : storedIconPath || mappedIconPath;

  return {
    recordedAt: row.recorded_at ?? null,
    dateLabel: formatWeatherDate(row.recorded_at ?? null),
    temperature: Number.isNaN(temp) ? 24 : temp,
    iconPath,
    intensityDescription,
    conditionDescription: String(row.weather_description ?? "").trim(),
    humidity: Math.round(Number(row.humidity ?? 0)),
    heatIndex: Math.round(Number(row.heat_index ?? (Number.isNaN(temp) ? 24 : temp))),
    signalNo: String(row.signal_no ?? "No Signal"),
    manualDescription: String(row.manual_description ?? "").trim() || defaultWeatherAdvisory,
  };
}
