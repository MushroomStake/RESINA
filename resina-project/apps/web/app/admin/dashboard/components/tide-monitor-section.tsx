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

  return (
    <section className="mt-6 overflow-hidden rounded-[28px] border border-sky-100 bg-gradient-to-br from-[#f5fbff] via-white to-[#eef6ff] p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#5f7aa1]">Tide Monitor</p>
          <h3 className="mt-1 text-2xl font-black tracking-tight text-[#102f57] md:text-[28px]">Sta. Rita Bridge tide outlook</h3>
          <p className="mt-1 text-sm text-[#607896]">Current tide level and upcoming high/low tide schedule.</p>
        </div>

        <span className="inline-flex w-fit items-center rounded-full border border-sky-100 bg-white/85 px-3 py-1.5 text-xs font-semibold text-[#27518f] shadow-sm">
          {predictionDate ? `Prediction Date: ${predictionDate}` : "No tide data yet"}
        </span>
      </div>

      {isLoading ? (
        <div className="mt-5 rounded-2xl border border-sky-100 bg-white/80 p-5 text-sm text-[#5f6f85] shadow-sm">Loading tide data...</div>
      ) : error ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-[#8c1d32] shadow-sm">{error}</div>
      ) : !hasAnyData ? (
        <div className="mt-5 rounded-2xl border border-sky-100 bg-white/80 p-5 text-sm text-[#5f6f85] shadow-sm">No tide data available yet.</div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4">
          <div className="rounded-2xl bg-[#eef5ff] p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5d7292]">Current Tide</p>
            <p className="mt-2 text-4xl font-black leading-none text-[#12335e]">{currentTideLabel}</p>
            <p className="mt-1 text-sm font-semibold text-[#2d5fa3]">{trendLabel}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex items-center gap-4 rounded-2xl border border-[#dbe5f3] bg-white/90 p-5 shadow-sm">
              <Image src="/Tides/high-tide.png" alt="High tide" width={74} height={74} className="h-[74px] w-[74px] object-contain" />
              <div className="text-right">
                <p className="text-[30px] leading-none text-[#1f3657]">Next high tide is at</p>
                <p className="mt-2 text-[44px] font-black leading-none text-[#1e63a8]">{nextHighLabel}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-2xl border border-[#dbe5f3] bg-white/90 p-5 shadow-sm">
              <Image src="/Tides/low-tide.png" alt="Low tide" width={74} height={74} className="h-[74px] w-[74px] object-contain" />
              <div className="text-right">
                <p className="text-[30px] leading-none text-[#1f3657]">Next low tide is at</p>
                <p className="mt-2 text-[44px] font-black leading-none text-[#1e63a8]">{nextLowLabel}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
