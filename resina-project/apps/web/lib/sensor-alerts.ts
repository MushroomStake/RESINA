export type AlertLevelKey = "normal" | "critical" | "evacuation" | "spilling";

export type SensorSnapshot = {
  waterLevel: number | null;
  statusText: string | null;
  updatedAt: string | null;
  sourceTable: string | null;
  recordId: string;
};

type AlertLevelInfo = {
  title: string;
  badge: string;
  rangeLabel: string;
  englishDescription: string;
  tagalogDescription: string;
  smsEnglishDescription: string;
  smsTagalogDescription: string;
};

export const ALERT_LEVELS: Record<AlertLevelKey, AlertLevelInfo> = {
  normal: {
    title: "Normal Level",
    badge: "Alert Level 1",
    rangeLabel: "1.5 - 2.49m",
    englishDescription: "Water level is normal. Conditions are safe for now.",
    tagalogDescription: "Normal ang antas ng tubig. Ligtas ang sitwasyon at walang inaasahang banta sa ngayon.",
    smsEnglishDescription: "Water level is normal.",
    smsTagalogDescription: "Normal ang antas ng tubig.",
  },
  critical: {
    title: "Critical Level",
    badge: "Alert Level 2",
    rangeLabel: "2.5 - 2.9m",
    englishDescription: "Water level is high. Stay alert, prepare supplies, and keep monitoring advisories.",
    tagalogDescription: "Mataas ang tubig. Maging alerto, ihanda ang mga gamit, at patuloy na magmonitor sa mga balita.",
    smsEnglishDescription: "Water level is high. Prepare now.",
    smsTagalogDescription: "Mataas ang tubig. Maghanda na.",
  },
  evacuation: {
    title: "Evacuation Level",
    badge: "Alert Level 3",
    rangeLabel: "3.0 - 3.9m",
    englishDescription: "Water level is dangerous. Evacuate immediately to higher ground or an evacuation center.",
    tagalogDescription: "Mapanganib ang antas ng tubig. Lumikas na agad patungo sa mas mataas na lugar o evacuation center.",
    smsEnglishDescription: "Dangerous water level. Evacuate now.",
    smsTagalogDescription: "Delikado ang tubig. Lumikas na agad.",
  },
  spilling: {
    title: "Spilling Level",
    badge: "Alert Level 4",
    rangeLabel: "4.0+m",
    englishDescription: "Water is overflowing. The situation is dangerous; prioritize safety and follow responders.",
    tagalogDescription: "Umaapaw na ang tubig. Delikado na ang sitwasyon; unahin ang kaligtasan ng buhay at sumunod sa mga rescuer.",
    smsEnglishDescription: "Water is overflowing. Stay safe.",
    smsTagalogDescription: "Umaapaw na ang tubig. Ligtas muna.",
  },
};

export function inferAlertLevel(snapshot: Pick<SensorSnapshot, "waterLevel" | "statusText">): AlertLevelKey {
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

export function isAlertLevelCriticalOrAbove(level: AlertLevelKey): boolean {
  return level !== "normal";
}

export function formatWaterLevel(level: number | null): string {
  if (level === null || Number.isNaN(level)) {
    return "Unavailable";
  }

  return `${level.toFixed(2)}m`;
}

export function formatAlertLevelName(level: AlertLevelKey): string {
  return ALERT_LEVELS[level].title;
}

export function formatAlertLevelBadge(level: AlertLevelKey): string {
  return ALERT_LEVELS[level].badge;
}

function formatManilaTimestamp(value: string): string {
  const date = new Date(value);
  const formatter = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "";
  const dayPeriod = (parts.find((part) => part.type === "dayPeriod")?.value ?? "").replace(/\s+/g, "");

  return `${month} ${day}, ${year} - ${hour}:${minute}${dayPeriod}`;
}

export function buildSensorAlertMessage(snapshot: SensorSnapshot): string {
  const alertLevel = inferAlertLevel(snapshot);
  const details = ALERT_LEVELS[alertLevel];
  const currentLevel = formatWaterLevel(snapshot.waterLevel);

  const updatedAt = snapshot.updatedAt ? formatManilaTimestamp(snapshot.updatedAt) : "Unknown";

  return [
    `${details.badge} ${details.title}`,
    `${currentLevel} | ${updatedAt}`,
    details.smsTagalogDescription,
    details.smsEnglishDescription,
  ].join("\n");
}