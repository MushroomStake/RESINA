export type SensorSnapshotLike = {
  waterLevel: number | null;
  statusText: string | null;
};

export type AlertLevelKey = "normal" | "critical" | "evacuation" | "spilling";

export function inferAlertLevel(snapshot: SensorSnapshotLike): AlertLevelKey {
  const status = (snapshot.statusText ?? "").toLowerCase();

  if (status.includes("spill")) return "spilling";
  if (status.includes("evac")) return "evacuation";
  if (status.includes("critical") || status.includes("alert level 2") || status.includes("alert 2")) {
    return "critical";
  }
  if (status.includes("normal") || status.includes("alert level 1") || status.includes("alert 1")) {
    return "normal";
  }
  if (snapshot.waterLevel !== null) {
    if (snapshot.waterLevel >= 4) return "spilling";
    if (snapshot.waterLevel >= 3) return "evacuation";
    if (snapshot.waterLevel >= 2.5) return "critical";
  }

  return "normal";
}

export function formatRangeLabel(level: number | null, fallback: string): string {
  if (level === null || Number.isNaN(level)) return fallback;

  if (level >= 4) return "4.0+m";

  const upper = level >= 3 ? 3.9 : level >= 2.5 ? 2.9 : 2.49;
  return `${level.toFixed(1)} - ${upper.toFixed(2)}m`;
}

export function formatSensorUpdatedAt(updatedAt: string | null): string {
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
