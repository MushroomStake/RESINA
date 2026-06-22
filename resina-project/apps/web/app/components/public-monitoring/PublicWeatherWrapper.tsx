"use client";

import { useEffect, useState } from "react";
import { WeatherUpdateSection } from "../../admin/dashboard/components/weather-update-section";

export default function PublicWeatherWrapper() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const url = `/api/weather/current`;
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

  function isRainyIntensity(intensity: string) {
    const s = (intensity || "").toLowerCase();
    return s.includes("rain") || s.includes("drizzle") || s.includes("shower");
  }

  const intensity = data?.current?.intensityDescription ?? data?.current?.intensity ?? "-";
  const heatIndex = data?.current?.heatIndex ?? null;
  let weatherCardClass = "bg-[#ECE8D2]";
  if (isRainyIntensity(intensity)) weatherCardClass = "bg-[#B3B7C0]";
  else if (heatIndex === null) weatherCardClass = "bg-[#ECE8D2]";
  else if (heatIndex < 27) weatherCardClass = "bg-[#ECE8D2]";
  else if (heatIndex <= 32) weatherCardClass = "bg-[#F4E68E]";
  else if (heatIndex <= 41) weatherCardClass = "bg-[#FDDC00]";
  else if (heatIndex <= 51) weatherCardClass = "bg-[#FF7E1C]";
  else weatherCardClass = "bg-[#E74C4C]";

  const weatherState = {
    dateLabel: data?.current?.updatedAt
      ? new Date(data.current.updatedAt).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "long", day: "numeric", year: "numeric" })
      : "-",
    temperature: data?.current?.temperature ?? "-",
    humidity: data?.current?.humidity ?? null,
    heatIndex: heatIndex,
    windSpeed: data?.current?.windSpeed ?? data?.current?.wind_speed ?? null,
    owmMain: data?.current?.owmMain ?? data?.current?.weather_main ?? "-",
    owmDescription: data?.current?.owmDescription ?? data?.current?.weather_description ?? "-",
    intensityDescription: intensity,
    manualDescription: data?.current?.manualDescription ?? data?.current?.manual_description ?? "-",
    iconPath: data?.current?.iconPath ?? data?.current?.icon_path ?? "/weather/dry-season/sun Normal.png",
  };

  return <WeatherUpdateSection weatherState={weatherState} weatherCardClass={weatherCardClass} />;
}
