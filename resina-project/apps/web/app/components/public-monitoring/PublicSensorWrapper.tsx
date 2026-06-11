"use client";

import { useEffect, useState } from "react";
import { CurrentSensorStatus } from "../../admin/dashboard/components/current-sensor-status";

export default function PublicSensorWrapper() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
    const url = API_BASE ? `${API_BASE}/api/sensor/current` : `/api/sensor/current`;
    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        if (!mounted) return;
        if (json?.error) setError(json.error);
        else setData(json);
      })
      .catch((e) => mounted && setError(e?.message || String(e)))
      .finally(() => mounted && setLoading(false));

    return () => { mounted = false; };
  }, []);

  const ALERT_LEVELS: Record<string, any> = {
    normal: {
      title: "Normal Level",
      badge: "Alert Level 1",
      rangeLabel: "1.5 - 2.49m",
      sensorGradientClass: "bg-[linear-gradient(135deg,#4CAF50_0%,#3f9d57_45%,#2f8a5f_100%)]",
      noticeClass: "border-[#c9e7cd] bg-[#edf8ef] text-[#355f3a]",
      description: "Normal ang antas ng tubig. Ligtas ang sitwasyon.",
    },
    critical: {
      title: "Critical Level",
      badge: "Alert Level 2",
      rangeLabel: "2.5 - 2.9m",
      sensorGradientClass: "bg-[linear-gradient(135deg,#F7C520_0%,#e3b31d_48%,#c79a12_100%)]",
      noticeClass: "border-[#efdfad] bg-[#fdf9ea] text-[#6a5c28]",
      description: "Mataas ang tubig. Maging alerto.",
    },
    evacuation: {
      title: "Evacuation Level",
      badge: "Alert Level 3",
      rangeLabel: "3.0 - 3.9m",
      sensorGradientClass: "bg-[linear-gradient(135deg,#FF7E1C_0%,#e96d1b_50%,#c9581b_100%)]",
      noticeClass: "border-[#efcec1] bg-[#fef5f1] text-[#70402a]",
      description: "Mapanganib ang antas ng tubig. Lumikas na agad.",
    },
    spilling: {
      title: "Spilling Level",
      badge: "Alert Level 4",
      rangeLabel: "4.0m",
      sensorGradientClass: "bg-[linear-gradient(135deg,#A82A2A_0%,#8f2323_48%,#6f1f1f_100%)]",
      noticeClass: "border-[#efc4c6] bg-[#fff0f1] text-[#6a2830]",
      description: "Umaapaw na ang tubig. Delikado na ang sitwasyon.",
    },
  };

  function inferAlertLevel(waterLevel: number | null, statusText: string | null) {
    const status = (statusText ?? "").toLowerCase();
    if (status.includes("spill") || (waterLevel !== null && waterLevel >= 4)) return "spilling";
    if (status.includes("evac") || (waterLevel !== null && waterLevel >= 3)) return "evacuation";
    if (status.includes("critical") || (waterLevel !== null && waterLevel >= 2.5)) return "critical";
    return "normal";
  }

  const rangeLabel = "Normal: 0.00 - 1.50m";
  const waterLevel = data?.current?.waterLevel ?? null;
  const lastUpdateLabel = data?.current?.updatedAt ? `Last update: ${new Date(data.current.updatedAt).toLocaleString()}` : "Last update: -";

  const inferred = inferAlertLevel(waterLevel, data?.current?.statusLabel ?? null);
  const alertConfig = ALERT_LEVELS[inferred] ?? ALERT_LEVELS.normal;

  return (
    <CurrentSensorStatus
      alertConfig={alertConfig}
      rangeLabel={rangeLabel}
      waterLevel={waterLevel}
      lastUpdateLabel={lastUpdateLabel}
      isLoadingData={loading}
      sourceTable={null}
      fetchError={error}
    />
  );
}
