"use client";

import { useEffect, useState } from "react";

export default function PublicWeatherCard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
    const url = API_BASE ? `${API_BASE}/api/weather/current` : `/api/weather/current`;
    fetch(url).then((res) => res.json()).then((json) => {
      if (!mounted) return;
      if (json?.error) setError(json.error);
      else setData(json);
    }).catch((e) => {
      if (!mounted) return;
      setError(e?.message || String(e));
    }).finally(() => mounted && setLoading(false));

    return () => { mounted = false; };
  }, []);

  const temp = data?.current?.temperature ?? null;
  const desc = data?.current?.intensityDescription ?? "-";

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">Weather</h4>
      <div className="rounded-lg border bg-white/90 p-3">
        {loading ? <div className="animate-pulse h-6 w-32 bg-slate-200" /> : error ? <div className="text-sm text-rose-600">{error}</div> : (
          <div>
            <p className="text-2xl font-bold">{temp === null ? "--°C" : `${temp}°C`}</p>
            <p className="text-sm text-slate-600">{desc}</p>
          </div>
        )}
      </div>
    </div>
  );
}
