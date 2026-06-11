"use client";

import { useEffect, useState } from "react";
import { TideMonitorSection } from "../../admin/dashboard/components/tide-monitor-section";

export default function PublicTideWrapper() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
    const url = API_BASE ? `${API_BASE}/api/tide/current` : `/api/tide/current`;
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

  const currentHeight = data?.current?.currentHeight ?? data?.current?.current_height ?? null;
  const trend = data?.current?.state ?? data?.current?.trend ?? null;
  const extremes = (data?.extremes ?? []).map((e: any) => ({ type: e.type, height: e.height, time: e.time }));

  return (
    <TideMonitorSection
      isLoading={loading}
      error={error}
      predictionDate={data?.date ?? null}
      currentHeight={currentHeight}
      trend={trend}
      extremes={extremes}
      lastExtreme={null}
      nextExtreme={null}
      hourly={data?.hours ?? []}
    />
  );
}
