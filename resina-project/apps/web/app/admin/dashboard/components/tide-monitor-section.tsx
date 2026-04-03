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

function toManilaHourFraction(value: string): number | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(parsed);

  const hourRaw = parts.find((part) => part.type === "hour")?.value;
  const minuteRaw = parts.find((part) => part.type === "minute")?.value;
  const hour = Number.parseInt(hourRaw ?? "", 10);
  const minute = Number.parseInt(minuteRaw ?? "", 10);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  return hour + minute / 60;
}

function toManilaDateISO(value: string): string | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return null;
  }

  return `${year}-${month}-${day}`;
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

function formatTodayManila(): string {
  return new Date().toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "2-digit",
    year: "numeric",
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

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (!points.length) {
    return "";
  }

  if (points.length === 1) {
    return `M${points[0].x},${points[0].y}`;
  }

  let d = `M${points[0].x},${points[0].y}`;
  const tension = 0.12;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  return d;
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
  const currentDateLabel = formatTodayManila();
  const chartWidthClass = "w-[920px] sm:w-[1120px] xl:w-[1260px]";

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
        eventAnchors: [] as Array<{ x: number; y: number; type: "high" | "low"; time: string }>,
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
      byManilaHour.set(entry.hour, entry);
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

    const eventAnchors = extremes
      .filter((entry) => {
        if (!predictionDate) {
          return false;
        }
        return toManilaDateISO(entry.time) === predictionDate;
      })
      .map((entry) => {
        const hourFraction = toManilaHourFraction(entry.time);
        if (hourFraction === null) {
          return null;
        }

        const x = leftPad + (Math.max(0, Math.min(23, hourFraction)) / 23) * usableW;
        const normalized = (entry.height - tideStats.lowest) / range;
        const y = topPad + (1 - normalized) * usableH;

        return {
          x,
          y,
          type: entry.type,
          time: entry.time,
        };
      })
      .filter((entry): entry is { x: number; y: number; type: "high" | "low"; time: string } => entry !== null)
      .sort((a, b) => a.x - b.x);

    const combinedCurvePoints = [...points.map((point) => ({ x: point.x, y: point.y, anchor: false as const })), ...eventAnchors.map((anchor) => ({ x: anchor.x, y: anchor.y, anchor: true as const }))]
      .sort((a, b) => a.x - b.x)
      .reduce<Array<{ x: number; y: number; anchor: boolean }>>((acc, point) => {
        if (!acc.length) {
          acc.push(point);
          return acc;
        }

        const last = acc[acc.length - 1];
        if (Math.abs(last.x - point.x) < 0.35) {
          if (point.anchor) {
            acc[acc.length - 1] = point;
          }
          return acc;
        }

        acc.push(point);
        return acc;
      }, []);

    const linePath = buildSmoothPath(combinedCurvePoints);
    const fillPath = combinedCurvePoints.length
      ? `${linePath} L ${combinedCurvePoints[combinedCurvePoints.length - 1].x},${height - bottomPad} L ${combinedCurvePoints[0].x},${height - bottomPad} Z`
      : "";

    const yTicks = Array.from({ length: 5 }, (_, index) => {
      const value = tideStats.lowest + ((4 - index) / 4) * range;
      const normalized = (value - tideStats.lowest) / range;
      const y = topPad + (1 - normalized) * usableH;
      return { value, y };
    });

    const currentX = leftPad + (manilaNowHour / 23) * usableW;
    const lowestPoint = points.reduce((lowest, point) => (point.value < lowest.value ? point : lowest), points[0]);
    const highestPoint = points.reduce((highest, point) => (point.value > highest.value ? point : highest), points[0]);

    return { linePath, fillPath, points, eventAnchors, yTicks, currentX, lowestPoint, highestPoint };
  }, [extremes, hourly, manilaNowHour, predictionDate, tideStats]);

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

  const nextHighPoint = useMemo(() => {
    if (!nextHigh) {
      return null;
    }
    return chart.eventAnchors.find((entry) => entry.type === "high" && entry.time === nextHigh.time) ?? null;
  }, [chart.eventAnchors, nextHigh]);

  const nextLowPoint = useMemo(() => {
    if (!nextLow) {
      return null;
    }
    return chart.eventAnchors.find((entry) => entry.type === "low" && entry.time === nextLow.time) ?? null;
  }, [chart.eventAnchors, nextLow]);

  const lowMarker = nextLowPoint ?? chart.lowestPoint;
  const highMarker = nextHighPoint ?? chart.highestPoint;
  const lowLabelY = lowMarker ? (lowMarker.y > 246 ? lowMarker.y - 12 : lowMarker.y + 20) : 0;
  const highLabelY = highMarker ? (highMarker.y < 42 ? highMarker.y + 20 : highMarker.y - 12) : 0;

  const nextHighLabel = nextHigh
    ? formatDateTimeLabel(nextHigh.time).split(", ")[1]
    : chart.highestPoint
      ? `${formatHour24(chart.highestPoint.hour)}:00`
      : "N/A";

  const nextLowLabel = nextLow
    ? formatDateTimeLabel(nextLow.time).split(", ")[1]
    : chart.lowestPoint
      ? `${formatHour24(chart.lowestPoint.hour)}:00`
      : "N/A";

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
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Last Tide</p>
                <p className="mt-2 text-base font-bold text-[#1f3b61]">{tideStats.lastSummary}</p>
                <p className="mt-1 text-xs text-[#5f7898]">{tideStats.lastTime}</p>
              </div>
              <div className="rounded-2xl bg-[#f6f9ff] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">Next Tide</p>
                <p className="mt-2 text-base font-bold text-[#1f3b61]">{tideStats.nextSummary}</p>
                <p className="mt-1 text-xs text-[#5f7898]">{tideStats.nextTime}</p>
              </div>
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

            <div className="rounded-[26px] border border-slate-200 bg-white/90 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-[#4b5563]">Hourly Tide Flow</p>
                  <p className="mt-1 text-xs text-[#748299]">One-day view in Olongapo (PHT, UTC+8) with hourly tide levels.</p>
                </div>

                <div className="flex flex-wrap gap-2 text-[11px] text-[#60748f]">
                  <span className="rounded-full bg-[#eff6ff] px-3 py-1 font-semibold text-[#27518f]">Lowest {tideStats.lowest.toFixed(2)}m</span>
                  <span className="rounded-full bg-[#eff6ff] px-3 py-1 font-semibold text-[#27518f]">Highest {tideStats.highest.toFixed(2)}m</span>
                  <span className="rounded-full bg-[#eff6ff] px-3 py-1 font-semibold text-[#27518f]">Range {tideStats.range.toFixed(2)}m</span>
                </div>
              </div>

              <div className="mt-4 min-w-0 rounded-[22px] border border-[#dbeafe] bg-gradient-to-b from-[#eef6ff] to-[#f9fcff] p-4">
                <div className="scrollbar-hide overflow-x-auto pb-2">
                  <div className={chartWidthClass}>
                    <svg viewBox="0 0 1260 320" className={`h-[320px] ${chartWidthClass} rounded-[18px] bg-[#eef6ff]`}>
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

                      <g>
                        <rect x="1088" y="10" rx="999" ry="999" width="154" height="24" fill="rgba(255,255,255,0.95)" stroke="#d8e4f8" />
                        <text x="1165" y="26" textAnchor="middle" fontSize="11" fill="#27518f" fontWeight="700">
                          {currentDateLabel}
                        </text>
                      </g>

                      <path d={chart.fillPath} fill="url(#tideAreaGradient)" />
                      <path d={chart.linePath} fill="none" stroke="url(#tideLineGradient)" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />

                      <line x1={chart.currentX} y1="20" x2={chart.currentX} y2="268" stroke="#ef4444" strokeWidth="1.4" />

                      {lowMarker ? (
                        <circle cx={lowMarker.x} cy={lowMarker.y} r="6" fill="#ef4444" />
                      ) : null}
                      {highMarker ? (
                        <circle cx={highMarker.x} cy={highMarker.y} r="6" fill="#1d4ed8" />
                      ) : null}
                      {lowMarker ? (
                        <text
                          x={Math.max(66, Math.min(1168, lowMarker.x - 40))}
                          y={lowLabelY}
                          fontSize="14"
                          fill="#ef4444"
                          fontWeight="700"
                          stroke="#ffffff"
                          strokeWidth="3"
                          paintOrder="stroke"
                        >
                          Low {nextLowPoint ? nextLowLabel : `${formatHour24(chart.lowestPoint!.hour)}:00`}
                        </text>
                      ) : null}
                      {highMarker ? (
                        <text
                          x={Math.max(66, Math.min(1168, highMarker.x - 44))}
                          y={highLabelY}
                          fontSize="14"
                          fill="#1d4ed8"
                          fontWeight="700"
                          stroke="#ffffff"
                          strokeWidth="3"
                          paintOrder="stroke"
                        >
                          High {nextHighPoint ? nextHighLabel : `${formatHour24(chart.highestPoint!.hour)}:00`}
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
