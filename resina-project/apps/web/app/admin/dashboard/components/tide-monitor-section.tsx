"use client";

import Image from "next/image";
import { useMemo } from "react";

type TideExtreme = {
  type: "high" | "low";
  height: number;
  time: string;
};

type TideHourlyPoint = {
  hour: number;
  estimatedHeight: number;
  confidence: "high" | "medium" | "low";
};

type TideMonitorSectionProps = {
  isLoading: boolean;
  error: string | null;
  predictionDate: string | null;
  currentHeight: number | null;
  trend: "rising" | "falling" | null;
  extremes: TideExtreme[];
  lastExtreme: TideExtreme | null;
  nextExtreme: TideExtreme | null;
  hourly: TideHourlyPoint[];
};

function formatManilaTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }

  return parsed.toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatManilaDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }

  return parsed.toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatPredictionDate(value: string | null): string {
  if (!value) {
    return "No tide data yet";
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return `Prediction Date: ${value}`;
  }

  return `Prediction Date: ${parsed.toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "long",
    day: "numeric",
    year: "numeric",
  })}`;
}

function formatRemainingUntil(value: string): string {
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) {
    return "Remaining time unavailable";
  }

  const deltaMinutes = Math.round((target - Date.now()) / 60000);
  if (deltaMinutes <= 0) {
    return "Event already passed";
  }

  const hours = Math.floor(deltaMinutes / 60);
  const minutes = deltaMinutes % 60;
  if (hours === 0) {
    return `${minutes}m remaining`;
  }

  return `${hours}h ${minutes}m remaining`;
}

export function TideMonitorSection({
  isLoading,
  error,
  predictionDate,
  currentHeight,
  trend,
  extremes,
}: TideMonitorSectionProps) {
  const nextHigh = useMemo(() => {
    const now = Date.now();
    const highs = extremes
      .filter((entry) => entry.type === "high")
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    return highs.find((entry) => new Date(entry.time).getTime() >= now) ?? highs[0] ?? null;
  }, [extremes]);

  const nextLow = useMemo(() => {
    const now = Date.now();
    const lows = extremes
      .filter((entry) => entry.type === "low")
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    return lows.find((entry) => new Date(entry.time).getTime() >= now) ?? lows[0] ?? null;
  }, [extremes]);

  const hasAnyData = currentHeight !== null || nextHigh !== null || nextLow !== null;
  const trendLabel = trend === null ? "Stable" : trend === "rising" ? "Rising" : "Falling";
  const currentTideLabel = currentHeight === null ? "-" : `${currentHeight.toFixed(2)}m`;
  const nextHighLabel = nextHigh ? formatManilaTime(nextHigh.time) : "N/A";
  const nextLowLabel = nextLow ? formatManilaTime(nextLow.time) : "N/A";
  const nextHighDateLabel = nextHigh ? formatManilaDate(nextHigh.time) : "N/A";
  const nextLowDateLabel = nextLow ? formatManilaDate(nextLow.time) : "N/A";
  const nextHighRemainingLabel = nextHigh ? formatRemainingUntil(nextHigh.time) : "No upcoming high tide";
  const nextLowRemainingLabel = nextLow ? formatRemainingUntil(nextLow.time) : "No upcoming low tide";

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-[#d7e4f2] bg-[#f8fbff] p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] md:p-5">
      <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.2),transparent_65%)]" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#4f709e]">Tide Monitor</p>
        </div>

        <span className="inline-flex w-fit items-center rounded-full border border-[#b7d8ef] bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#27518f] shadow-sm">
          {formatPredictionDate(predictionDate)}
        </span>
      </div>

      {isLoading ? (
        <div className="mt-4 rounded-2xl border border-sky-100 bg-white/80 p-4 text-sm text-[#5f6f85] shadow-sm">Loading tide data...</div>
      ) : error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-[#8c1d32] shadow-sm">{error}</div>
      ) : !hasAnyData ? (
        <div className="mt-4 rounded-2xl border border-sky-100 bg-white/80 p-4 text-sm text-[#5f6f85] shadow-sm">No tide data available yet.</div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3">
          <div className="rounded-3xl border border-[#d5e4f2] bg-[linear-gradient(135deg,#e9f3ff_0%,#dceeff_100%)] p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5d7292]">Current Tide</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
              <p className="text-3xl font-black leading-none text-[#12335e] md:text-[40px]">{currentTideLabel}</p>
              <span className="rounded-full border border-[#c1d6ee] bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#34639c]">
                {trendLabel}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-3xl border border-[#d9e5f2] bg-white/95 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-[#edf6ff] p-2">
                  <Image src="/Tides/high-tide.png" alt="High tide" width={54} height={54} className="h-[54px] w-[54px] object-contain" />
                </div>
                <p className="text-[19px] font-semibold leading-tight text-[#1f3657] md:text-[21px]">Next high tide</p>
              </div>
              <div className="mt-3 text-right">
                <p className="text-[36px] font-black leading-none text-[#1e63a8] md:text-[40px]">{nextHighLabel}</p>
                <p className="mt-2 text-sm font-semibold text-[#1f3657]">{nextHighDateLabel}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#5f7898]">{nextHighRemainingLabel}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-[#d9e5f2] bg-white/95 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-[#edf6ff] p-2">
                  <Image src="/Tides/low-tide.png" alt="Low tide" width={54} height={54} className="h-[54px] w-[54px] object-contain" />
                </div>
                <p className="text-[19px] font-semibold leading-tight text-[#1f3657] md:text-[21px]">Next low tide</p>
              </div>
              <div className="mt-3 text-right">
                <p className="text-[36px] font-black leading-none text-[#1e63a8] md:text-[40px]">{nextLowLabel}</p>
                <p className="mt-2 text-sm font-semibold text-[#1f3657]">{nextLowDateLabel}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#5f7898]">{nextLowRemainingLabel}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
