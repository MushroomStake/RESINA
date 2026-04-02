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

function getManilaHourNow(): number {
  const raw = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    hour12: false,
  }).format(new Date());
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? 0 : parsed % 24;
}

function toManilaHour(utcHour: number): number {
  return (utcHour + 8) % 24;
}

function formatHour24(hour: number): string {
  return `${hour}`;
}

function formatDateTimeLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return parsed.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDurationUntil(value: string): string {
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) {
    return "Unknown";
  }

  const delta = Math.max(0, target - Date.now());
  const totalMinutes = Math.max(1, Math.round(delta / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

export function TideMonitorSection({
  isLoading,
  error,
  predictionDate,
  currentHeight,
  trend,
  extremes,
  lastExtreme,
  nextExtreme,
  hourly,
}: TideMonitorSectionProps) {
  const manilaNowHour = getManilaHourNow();

  const tideStats = useMemo(() => {
    if (!hourly.length) {
      return null;
    }

    const heights = hourly.map((entry) => entry.estimatedHeight);
    const lowest = Math.min(...heights);
    const highest = Math.max(...heights);
    const range = highest - lowest;
    const currentValue = currentHeight;
    const trendLabel = trend === null ? "Stable" : trend === "rising" ? "Rising" : "Falling";
    const lastSummary = lastExtreme
      ? `${lastExtreme.type === "high" ? "High" : "Low"} tide ${lastExtreme.height.toFixed(2)}m`
      : "No previous event";
    const lastTime = lastExtreme ? formatDateTimeLabel(lastExtreme.time) : "No previous event";
    const nextSummary = nextExtreme
      ? `${nextExtreme.type === "high" ? "High" : "Low"} tide in ${formatDurationUntil(nextExtreme.time)}`
      : "No upcoming event";
    const nextTime = nextExtreme ? formatDateTimeLabel(nextExtreme.time) : "No upcoming event";

    return {
      lowest,
      highest,
      range,
      currentValue,
      trendLabel,
      lastSummary,
      lastTime,
      nextSummary,
      nextTime,
    };
  }, [currentHeight, hourly, lastExtreme, nextExtreme, trend]);

  const chart = useMemo(() => {
    if (!hourly.length || tideStats === null) {
      return {
        linePath: "",
        fillPath: "",
        points: [] as Array<{ x: number; y: number; hour: number; value: number; confidence: "high" | "medium" | "low" }>,
        yTicks: [] as Array<{ value: number; y: number }>,
        currentX: 0,
        lowestPoint: null as null | { x: number; y: number; hour: number; value: number },
        highestPoint: null as null | { x: number; y: number; hour: number; value: number },
      };
    }

    const width = 1260;
    const height = 320;
    const leftPad = 62;
    const rightPad = 24;
    const topPad = 20;
    const bottomPad = 52;
    const usableW = width - leftPad - rightPad;
    const usableH = height - topPad - bottomPad;

    const byManilaHour = new Map<number, TideHourlyPoint>();
    for (const entry of hourly) {
      byManilaHour.set(toManilaHour(entry.hour), entry);
    }

    const orderedHours = Array.from({ length: 24 }, (_, hour) => hour);
    const range = Math.max(0.01, tideStats.highest - tideStats.lowest);
    const points = orderedHours.map((hour, index) => {
      const entry = byManilaHour.get(hour) ?? { hour, estimatedHeight: tideStats.lowest, confidence: "low" as const };
      const x = leftPad + (index / 23) * usableW;
      const normalized = (entry.estimatedHeight - tideStats.lowest) / range;
      const y = topPad + (1 - normalized) * usableH;
      return { x, y, hour, value: entry.estimatedHeight, confidence: entry.confidence };
    });

    const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
    const fillPath = `${linePath} L ${points[points.length - 1].x},${height - bottomPad} L ${points[0].x},${height - bottomPad} Z`;

    const yTicks = Array.from({ length: 5 }, (_, index) => {
      const value = tideStats.lowest + ((4 - index) / 4) * range;
      const normalized = (value - tideStats.lowest) / range;
      const y = topPad + (1 - normalized) * usableH;
      return { value, y };
    });

    const currentX = leftPad + (manilaNowHour / 23) * usableW;
    const lowestPoint = points.reduce((lowest, point) => (point.value < lowest.value ? point : lowest), points[0]);
    const highestPoint = points.reduce((highest, point) => (point.value > highest.value ? point : highest), points[0]);

    return { linePath, fillPath, points, yTicks, currentX, lowestPoint, highestPoint };
  }, [hourly, manilaNowHour, tideStats]);

  const nextHigh = useMemo(() => {
    const now = Date.now();
    return extremes
      .filter((entry) => entry.type === "high" && new Date(entry.time).getTime() >= now)
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())[0] ?? null;
  }, [extremes]);

  const nextLow = useMemo(() => {
    const now = Date.now();
    return extremes
      .filter((entry) => entry.type === "low" && new Date(entry.time).getTime() >= now)
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())[0] ?? null;
  }, [extremes]);

  const currentTideLabel = tideStats?.currentValue === null || tideStats?.currentValue === undefined ? "-" : `${tideStats.currentValue.toFixed(2)}m`;

  return (
    <section className="mt-6 overflow-hidden rounded-[28px] border border-sky-100 bg-gradient-to-br from-[#f5fbff] via-white to-[#eef6ff] p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#5f7aa1]">Tide Monitor</p>
          <h3 className="mt-1 text-2xl font-black tracking-tight text-[#102f57] md:text-[28px]">Sta. Rita Bridge tide outlook</h3>
          <p className="mt-1 text-sm text-[#607896]">Quick look at the water level trend, next tide event, and hourly movement near Sta. Rita Bridge.</p>
        </div>

        <span className="inline-flex w-fit items-center rounded-full border border-sky-100 bg-white/85 px-3 py-1.5 text-xs font-semibold text-[#27518f] shadow-sm">
          {predictionDate ? `Prediction Date: ${predictionDate}` : "No tide data yet"}
        </span>
      </div>

      {isLoading ? (
        <div className="mt-5 rounded-2xl border border-sky-100 bg-white/80 p-5 text-sm text-[#5f6f85] shadow-sm">Loading tide data...</div>
      ) : error ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-[#8c1d32] shadow-sm">{error}</div>
      ) : tideStats === null ? (
        <div className="mt-5 rounded-2xl border border-sky-100 bg-white/80 p-5 text-sm text-[#5f6f85] shadow-sm">No tide data available yet.</div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 gap-3 rounded-[24px] border border-[#dbeafe] bg-white/90 p-4 shadow-sm md:grid-cols-3">
              <div className="rounded-2xl bg-[#eef5ff] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5d7292]">Current Tide</p>
                <p className="mt-2 text-4xl font-black leading-none text-[#12335e]">{currentTideLabel}</p>
                <p className="mt-1 text-sm font-semibold text-[#2d5fa3]">{tideStats.trendLabel}</p>
              </div>
              <div className="rounded-2xl bg-[#f6f9ff] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Last Tide Today</p>
                <p className="mt-2 text-base font-bold text-[#1f3b61]">{tideStats.lastSummary}</p>
                <p className="mt-1 text-xs text-[#5f7898]">{tideStats.lastTime}</p>
              </div>
              <div className="rounded-2xl bg-[#f6f9ff] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Next Tide Today</p>
                <p className="mt-2 text-base font-bold text-[#1f3b61]">{tideStats.nextSummary}</p>
                <p className="mt-1 text-xs text-[#5f7898]">{tideStats.nextTime}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex items-center gap-4 rounded-2xl border border-[#dbe5f3] bg-white/90 p-5 shadow-sm">
                <Image src="/Tides/high-tide.png" alt="High tide" width={74} height={74} className="h-[74px] w-[74px] object-contain" />
                <div className="text-right">
                  <p className="text-[30px] leading-none text-[#1f3657]">Next high tide is at</p>
                  <p className="mt-2 text-[44px] font-black leading-none text-[#1e63a8]">{nextHigh ? formatDateTimeLabel(nextHigh.time).split(", ")[1] : "N/A"}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-2xl border border-[#dbe5f3] bg-white/90 p-5 shadow-sm">
                <Image src="/Tides/low-tide.png" alt="Low tide" width={74} height={74} className="h-[74px] w-[74px] object-contain" />
                <div className="text-right">
                  <p className="text-[30px] leading-none text-[#1f3657]">Next low tide is at</p>
                  <p className="mt-2 text-[44px] font-black leading-none text-[#1e63a8]">{nextLow ? formatDateTimeLabel(nextLow.time).split(", ")[1] : "N/A"}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-slate-200 bg-white/90 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-[#4b5563]">Hourly Tide Flow</p>
                  <p className="mt-1 text-xs text-[#748299]">One-day view in Manila time with hourly tide levels.</p>
                </div>

                <div className="flex flex-wrap gap-2 text-[11px] text-[#60748f]">
                  <span className="rounded-full bg-[#eff6ff] px-3 py-1 font-semibold text-[#27518f]">Lowest {tideStats.lowest.toFixed(2)}m</span>
                  <span className="rounded-full bg-[#eff6ff] px-3 py-1 font-semibold text-[#27518f]">Highest {tideStats.highest.toFixed(2)}m</span>
                  <span className="rounded-full bg-[#eff6ff] px-3 py-1 font-semibold text-[#27518f]">Range {tideStats.range.toFixed(2)}m</span>
                </div>
              </div>

              <div className="mt-4 min-w-0 rounded-[22px] border border-[#dbeafe] bg-gradient-to-b from-[#eef6ff] to-[#f9fcff] p-4">
                <div className="overflow-x-auto pb-2">
                  <div className="w-[1260px]">
                    <svg viewBox="0 0 1260 320" className="h-[320px] w-[1260px] rounded-[18px] bg-[#eef6ff]">
                      <defs>
                        <linearGradient id="tideAreaGradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.03" />
                        </linearGradient>
                        <linearGradient id="tideLineGradient" x1="0" x2="1" y1="0" y2="0">
                          <stop offset="0%" stopColor="#2563eb" />
                          <stop offset="100%" stopColor="#1d4ed8" />
                        </linearGradient>
                      </defs>

                      {chart.yTicks.map((tick, index) => (
                        <g key={`y-${index}`}>
                          <line x1="62" y1={tick.y} x2="1236" y2={tick.y} stroke="#d1def2" strokeWidth="1" />
                          <text x="8" y={tick.y + 4} fontSize="12" fill="#516a8a" fontWeight="600">{tick.value.toFixed(2)}m</text>
                        </g>
                      ))}

                      <path d={chart.fillPath} fill="url(#tideAreaGradient)" />
                      <path d={chart.linePath} fill="none" stroke="url(#tideLineGradient)" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />

                      <line x1={chart.currentX} y1="20" x2={chart.currentX} y2="268" stroke="#ef4444" strokeWidth="1.4" />

                      {chart.points.map((point) => (
                        <circle
                          key={`point-${point.hour}`}
                          cx={point.x}
                          cy={point.y}
                          r="4"
                          fill="#1d4ed8"
                          opacity={point.confidence === "high" ? 1 : point.confidence === "medium" ? 0.82 : 0.62}
                        />
                      ))}

                      {chart.lowestPoint ? <circle cx={chart.lowestPoint.x} cy={chart.lowestPoint.y} r="6" fill="#ef4444" /> : null}
                      {chart.highestPoint ? <circle cx={chart.highestPoint.x} cy={chart.highestPoint.y} r="6" fill="#1d4ed8" /> : null}
                      {chart.lowestPoint ? (
                        <text
                          x={Math.max(66, Math.min(1168, chart.lowestPoint.x - 40))}
                          y={chart.lowestPoint.y - 12}
                          fontSize="14"
                          fill="#ef4444"
                          fontWeight="700"
                          stroke="#ffffff"
                          strokeWidth="3"
                          paintOrder="stroke"
                        >
                          Low {formatHour24(chart.lowestPoint.hour)}:00
                        </text>
                      ) : null}
                      {chart.highestPoint ? (
                        <text
                          x={Math.max(66, Math.min(1168, chart.highestPoint.x - 44))}
                          y={chart.highestPoint.y - 12}
                          fontSize="14"
                          fill="#1d4ed8"
                          fontWeight="700"
                          stroke="#ffffff"
                          strokeWidth="3"
                          paintOrder="stroke"
                        >
                          High {formatHour24(chart.highestPoint.hour)}:00
                        </text>
                      ) : null}

                      {chart.points.map((point) => (
                        <text
                          key={`hour-${point.hour}`}
                          x={point.x}
                          y={306}
                          textAnchor="middle"
                          fontSize="11"
                          fill="#4b617b"
                          fontWeight="600"
                        >
                          {formatHour24(point.hour)}
                        </text>
                      ))}
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
