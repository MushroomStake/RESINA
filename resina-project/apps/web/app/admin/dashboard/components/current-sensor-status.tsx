"use client";

type AlertConfigProps = {
  title: string;
  badge: string;
  sensorGradientClass: string;
  noticeClass: string;
  description: string;
};

type CurrentSensorStatusProps = {
  alertConfig: AlertConfigProps;
  rangeLabel: string;
  waterLevel: number | null;
  lastUpdateLabel: string;
  isLoadingData: boolean;
  sourceTable: string | null;
  fetchError: string | null;
};

const VISUAL_MAX_METER = 4.4;
const PERCENT_BUCKETS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100] as const;

const FILL_CLASS_BY_BUCKET: Record<(typeof PERCENT_BUCKETS)[number], string> = {
  0: "h-[0%]",
  5: "h-[5%]",
  10: "h-[10%]",
  15: "h-[15%]",
  20: "h-[20%]",
  25: "h-[25%]",
  30: "h-[30%]",
  35: "h-[35%]",
  40: "h-[40%]",
  45: "h-[45%]",
  50: "h-[50%]",
  55: "h-[55%]",
  60: "h-[60%]",
  65: "h-[65%]",
  70: "h-[70%]",
  75: "h-[75%]",
  80: "h-[80%]",
  85: "h-[85%]",
  90: "h-[90%]",
  95: "h-[95%]",
  100: "h-[100%]",
};

const BOTTOM_CLASS_BY_BUCKET: Record<(typeof PERCENT_BUCKETS)[number], string> = {
  0: "bottom-[0%]",
  5: "bottom-[5%]",
  10: "bottom-[10%]",
  15: "bottom-[15%]",
  20: "bottom-[20%]",
  25: "bottom-[25%]",
  30: "bottom-[30%]",
  35: "bottom-[35%]",
  40: "bottom-[40%]",
  45: "bottom-[45%]",
  50: "bottom-[50%]",
  55: "bottom-[55%]",
  60: "bottom-[60%]",
  65: "bottom-[65%]",
  70: "bottom-[70%]",
  75: "bottom-[75%]",
  80: "bottom-[80%]",
  85: "bottom-[85%]",
  90: "bottom-[90%]",
  95: "bottom-[95%]",
  100: "bottom-[100%]",
};

const METER_MARKER_LEVELS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4] as const;

const METER_BOTTOM_CLASS_BY_LEVEL: Record<(typeof METER_MARKER_LEVELS)[number], string> = {
  0: "bottom-[11%]",
  0.5: "bottom-[20.75%]",
  1: "bottom-[30.5%]",
  1.5: "bottom-[40.25%]",
  2: "bottom-[50%]",
  2.5: "bottom-[59.75%]",
  3: "bottom-[69.5%]",
  3.5: "bottom-[79.25%]",
  4: "bottom-[89%]",
};

const METER_FILL_CLASS_BY_LEVEL: Record<(typeof METER_MARKER_LEVELS)[number], string> = {
  0: "h-[11%]",
  0.5: "h-[20.75%]",
  1: "h-[30.5%]",
  1.5: "h-[40.25%]",
  2: "h-[50%]",
  2.5: "h-[59.75%]",
  3: "h-[69.5%]",
  3.5: "h-[79.25%]",
  4: "h-[89%]",
};

const METER_MARKER_TOP_CLASS_BY_LEVEL: Record<(typeof METER_MARKER_LEVELS)[number], string> = {
  0: "top-[176px]",
  0.5: "top-[154px]",
  1: "top-[132px]",
  1.5: "top-[110px]",
  2: "top-[88px]",
  2.5: "top-[66px]",
  3: "top-[44px]",
  3.5: "top-[22px]",
  4: "top-[0px]",
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resolveLevelColor(level: number | null): string {
  if (level === null) {
    return "#7e8ca5";
  }
  if (level >= 4) {
    return "#d94545";
  }
  if (level >= 3) {
    return "#f08d2a";
  }
  if (level >= 2.5) {
    return "#f3bf3a";
  }
  return "#2cb47a";
}

function resolveLevelDotClass(level: number | null): string {
  if (level === null) return "bg-[#7e8ca5]";
  if (level >= 4) return "bg-[#d94545]";
  if (level >= 3) return "bg-[#f08d2a]";
  if (level >= 2.5) return "bg-[#f3bf3a]";
  return "bg-[#2cb47a]";
}

function resolveLevelTextClass(level: number | null): string {
  if (level === null) return "text-[#7e8ca5]";
  if (level >= 4) return "text-[#d94545]";
  if (level >= 3) return "text-[#f08d2a]";
  if (level >= 2.5) return "text-[#f3bf3a]";
  return "text-[#2cb47a]";
}

function toBucket(percent: number): (typeof PERCENT_BUCKETS)[number] {
  const clamped = clamp(percent, 0, 100);
  const rounded = Math.round(clamped / 5) * 5;
  return rounded as (typeof PERCENT_BUCKETS)[number];
}

function toMeterMarkerLevel(level: number | null): (typeof METER_MARKER_LEVELS)[number] {
  if (level === null || Number.isNaN(level)) {
    return 0;
  }

  const snapped = Math.round(clamp(level, 0, 4) * 2) / 2;
  return snapped as (typeof METER_MARKER_LEVELS)[number];
}

export function CurrentSensorStatus({
  alertConfig,
  rangeLabel,
  waterLevel,
  lastUpdateLabel,
  isLoadingData,
  sourceTable,
  fetchError,
}: CurrentSensorStatusProps) {
  const safeLevel = waterLevel === null || Number.isNaN(waterLevel) ? null : clamp(waterLevel, 0, 5);
  const normalizedLevel = safeLevel === null ? 0 : clamp(safeLevel, 0, VISUAL_MAX_METER) / VISUAL_MAX_METER;
  const levelBucket = toBucket(normalizedLevel * 100);
  const markerLevel = toMeterMarkerLevel(safeLevel);
  const markerTopClass = METER_MARKER_TOP_CLASS_BY_LEVEL[markerLevel];
  const fillHeightClass = METER_FILL_CLASS_BY_LEVEL[markerLevel];
  const meterText = safeLevel === null ? "--.--m" : `${safeLevel.toFixed(2)}m`;
  const levelColor = resolveLevelColor(safeLevel);
  const levelDotClass = resolveLevelDotClass(safeLevel);
  const levelTextClass = resolveLevelTextClass(safeLevel);
  const shortUpdateLabel = lastUpdateLabel.replace("Last update:", "").trim();

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-[#d7e4f2] bg-[#f8fbff] p-5 shadow-[0_20px_60px_rgba(15,23,42,0.12)] md:p-6">
      <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.2),transparent_65%)]" />
      <div className="pointer-events-none absolute -left-20 -bottom-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(45,212,191,0.18),transparent_70%)]" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#4f709e]">Sensor Monitor</p>
          <h3 className="mt-1 text-2xl font-black tracking-tight text-[#0f2847] md:text-[28px]">Sta. Rita Bridge water level</h3>
          <p className="mt-1 text-sm text-[#5f7ca3]">Live flood thresholds with animated level tracking.</p>
        </div>
        <p className="text-xs italic text-[#9ca3af]">{lastUpdateLabel}</p>
      </div>

      <div
        className={`relative mt-4 rounded-3xl border border-white/20 p-4 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] md:p-5 ${alertConfig.sensorGradientClass}`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,rgba(255,255,255,0.14),transparent_40%)]" />
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full border border-white/35 bg-white/85 px-3 py-1 text-sm font-bold text-[#0d3152]">Sta. Rita Bridge</span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/12 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white/95">
            <span className="h-1.5 w-1.5 rounded-full bg-[#b8ffd2]" />
            Live Sensor
          </span>
        </div>

        <div className="relative mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[132px_1fr]">
          <div className="relative overflow-hidden rounded-2xl border border-white/25 bg-white/10 p-3 backdrop-blur-sm">
            <div className="absolute left-[20px] top-[12px] bottom-[12px] w-[4px] rounded-full bg-white/90" />
            <div className="relative z-10 flex h-[176px] flex-col justify-between pl-5">
              {[4, 3, 2, 1, 0].map((meter) => (
                <div key={meter} className="flex items-center">
                  <span className="mr-2 h-[2px] w-[14px] rounded bg-white/90" />
                  <span className="text-xs font-bold text-white/95">{meter}m</span>
                </div>
              ))}
            </div>

            <div className="absolute right-2 top-[10px] bottom-[10px] w-[8px] overflow-hidden rounded border border-white/40 bg-white/15">
              <div className="h-[9%] bg-[#d94545]" />
              <div className="h-[23%] bg-[#f08d2a]" />
              <div className="h-[11%] bg-[#f3bf3a]" />
              <div className="h-[23%] bg-[#2cb47a]" />
              <div className="h-[34%] bg-[#4b7da6]" />
            </div>

            <div className={`pointer-events-none absolute left-[19px] top-[12px] z-20 h-[176px] w-[100px]`}>
              <div className={`absolute left-0 flex -translate-y-1/2 items-center gap-2 ${markerTopClass}`}>
              <span className={`meter-dot h-2 w-2 rounded-full ${levelDotClass}`} />
              <span className="text-[11px] font-extrabold tracking-[0.01em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.42)]">
                {safeLevel === null ? "--" : safeLevel.toFixed(2)}
              </span>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-white/30 bg-[#12345a33] backdrop-blur-sm">
            <div className="relative h-full min-h-[176px] overflow-hidden rounded-2xl">
              <div className={`absolute inset-x-0 bottom-0 bg-[#2f8cffc8] transition-[height] duration-700 ${fillHeightClass}`}>
                <div className="water-surface absolute inset-x-0 top-[-2px] h-[10px]" />
                <div className="wave-layer-primary absolute -top-[8px] left-[-70%] h-[28px] w-[260%]">
                  <div className="wave-ribbon-primary" />
                  <div className="wave-ribbon-highlight-primary" />
                </div>
                <div className="wave-layer-secondary absolute -top-[5px] left-[-72%] h-[22px] w-[260%]">
                  <div className="wave-ribbon-secondary" />
                  <div className="wave-ribbon-highlight-secondary" />
                </div>
                <div className="water-noise absolute inset-0" />
                <div className="water-noise-2 absolute inset-0" />
              </div>

              <div className="absolute left-1/2 top-4 w-[68%] -translate-x-1/2 rounded-2xl border border-white/35 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.06))] px-5 py-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur-[6px] md:w-[58%] xl:w-[52%]">
                <p className="text-4xl font-black leading-none text-white md:text-5xl">{meterText}</p>
                <p className="mt-2 text-3xl font-extrabold leading-none text-white md:text-4xl">{alertConfig.title}</p>
                <span className={`mt-3 inline-block rounded-full bg-white px-3 py-1 text-base font-bold shadow-sm ${levelTextClass}`}>
                  {alertConfig.badge}
                </span>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-white/90">{rangeLabel}</p>
              </div>
            </div>
          </div>
        </div>

        <div className={`mt-3 rounded-xl border px-4 py-3 text-sm leading-7 shadow-sm ${alertConfig.noticeClass}`}>{alertConfig.description}</div>

        {isLoadingData ? (
          <div className="mt-3 animate-pulse rounded-lg border border-white/30 bg-white/25 p-2.5">
            <div className="h-3 w-40 rounded bg-white/55" />
          </div>
        ) : null}
        {sourceTable ? <p className="mt-2 text-xs text-white/75">Data source: {sourceTable}</p> : null}
        {fetchError ? <p className="mt-2 text-xs text-[#b91c1c]">{fetchError}</p> : null}
      </div>

      <style jsx>{`
        .wave-layer-primary {
          animation: waveA 7.6s linear infinite;
        }
        .wave-layer-secondary {
          animation: waveB 9.2s linear infinite;
        }
        .wave-ribbon-primary {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 16px;
          border-radius: 999px;
          background-color: rgba(150, 221, 255, 0.58);
        }
        .wave-ribbon-highlight-primary {
          position: absolute;
          left: 8%;
          right: 8%;
          bottom: 9px;
          height: 4px;
          border-radius: 99px;
          background-color: rgba(232, 247, 255, 0.46);
        }
        .wave-ribbon-secondary {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 12px;
          border-radius: 999px;
          background-color: rgba(193, 234, 255, 0.36);
        }
        .wave-ribbon-highlight-secondary {
          position: absolute;
          left: 14%;
          right: 14%;
          bottom: 7px;
          height: 3px;
          border-radius: 99px;
          background-color: rgba(242, 251, 255, 0.34);
        }
        .water-surface {
          pointer-events: none;
          background: linear-gradient(180deg, rgba(255,255,255,0.0), rgba(255,255,255,0.34), rgba(196,236,255,0.42), rgba(255,255,255,0.1));
          box-shadow: 0 0 10px rgba(214, 243, 255, 0.55);
          animation: surfaceGlow 3.8s ease-in-out infinite;
        }
        .water-noise {
          pointer-events: none;
          opacity: 0.14;
          mix-blend-mode: screen;
          background-image:
            radial-gradient(rgba(255, 255, 255, 0.24) 0.9px, transparent 1.2px),
            linear-gradient(120deg, transparent 18%, rgba(236, 248, 255, 0.22) 42%, transparent 64%),
            linear-gradient(165deg, transparent 24%, rgba(206, 238, 255, 0.18) 48%, transparent 70%);
          background-size: 18px 18px, 170% 100%, 190% 100%;
          background-position: 0 0, 0 0, 0 0;
          animation: noiseDrift 11.5s linear infinite;
        }
        .water-noise-2 {
          pointer-events: none;
          opacity: 0.09;
          mix-blend-mode: screen;
          background-image:
            linear-gradient(102deg, transparent 32%, rgba(255, 255, 255, 0.16) 49%, transparent 62%),
            linear-gradient(180deg, transparent 0%, rgba(247, 252, 255, 0.08) 50%, transparent 100%);
          background-size: 160% 100%, 100% 100%;
          background-position: 0 0, 0 0;
          animation: glintDrift 14s linear infinite;
        }
        .meter-dot {
          animation: meterPulse 1.4s ease-in-out infinite;
        }
        @keyframes waveA {
          0% {
            transform: translateX(0) translateY(0);
          }
          50% {
            transform: translateX(-24px) translateY(-1.5px);
          }
          100% {
            transform: translateX(-48px) translateY(0);
          }
        }
        @keyframes waveB {
          0% {
            transform: translateX(0) translateY(0);
          }
          50% {
            transform: translateX(-20px) translateY(-1px);
          }
          100% {
            transform: translateX(-40px) translateY(0);
          }
        }
        @keyframes noiseDrift {
          0% {
            background-position: 0 0, 0 0, 0 0;
            opacity: 0.1;
          }
          50% {
            background-position: 10px 7px, -70px 0, -52px 0;
            opacity: 0.16;
          }
          100% {
            background-position: 20px 14px, -140px 0, -104px 0;
            opacity: 0.11;
          }
        }
        @keyframes surfaceGlow {
          0%, 100% {
            opacity: 0.72;
            transform: translateY(0);
          }
          50% {
            opacity: 1;
            transform: translateY(-1px);
          }
        }
        @keyframes glintDrift {
          0% {
            background-position: 0 0, 0 0;
            opacity: 0.06;
          }
          45% {
            background-position: 48% 0, 0 0;
            opacity: 0.11;
          }
          100% {
            background-position: 100% 0, 0 0;
            opacity: 0.07;
          }
        }
        @keyframes meterPulse {
          0%,
          100% {
            transform: scale(1);
            opacity: 0.9;
          }
          50% {
            transform: scale(1.25);
            opacity: 1;
          }
        }
      `}</style>
    </section>
  );
}
