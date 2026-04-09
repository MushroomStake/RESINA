"use client";

import Image from "next/image";

type WeatherView = {
  dateLabel: string;
  temperature: number;
  humidity: number | null;
  heatIndex: number | null;
  owmMain: string;
  owmDescription: string;
  intensityDescription: string;
  signalNo: string;
  manualDescription: string;
  iconPath: string;
};

type WeatherUpdateSectionProps = {
  weatherState: WeatherView;
  weatherCardClass: string;
};

export function WeatherUpdateSection({
  weatherState,
  weatherCardClass,
}: WeatherUpdateSectionProps) {
  const isNightCard = weatherState.iconPath.toLowerCase().includes("moon");
  const isRainyCard = weatherState.intensityDescription.toLowerCase().includes("rain");

  return (
    <>
      <section className="relative overflow-hidden rounded-[30px] border border-[#d7e4f2] bg-[#f8fbff] p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] md:p-5">
        <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.2),transparent_65%)]" />
        <div className="mb-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#4f709e]">Weather Monitor</p>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[260px_1fr]">
          <div
            className={`weather-card-animated relative min-h-[196px] overflow-hidden rounded-3xl border border-white/30 px-5 py-5 text-[#2f3850] shadow-[0_18px_45px_rgba(15,23,42,0.24)] ${weatherCardClass} ${isNightCard ? "weather-card-night text-[#e6f0ff]" : ""}`}
          >
            {isNightCard ? (
              <div className="weather-stars pointer-events-none absolute inset-0">
                {Array.from({ length: 12 }).map((_, index) => (
                  <span key={index} className="weather-star" />
                ))}
              </div>
            ) : (
              <div className="weather-day-glow pointer-events-none absolute inset-0" />
            )}

            {isRainyCard ? (
              <div className="weather-rain pointer-events-none absolute inset-0">
                {Array.from({ length: 8 }).map((_, index) => (
                  <span key={index} className="weather-raindrop" />
                ))}
              </div>
            ) : null}

            <div
              className={`relative z-20 inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[12px] font-extrabold uppercase tracking-wide ${isNightCard ? "bg-[#142541]/70 text-[#d7e6ff]" : "bg-white/60 text-[#273247]"}`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
              </svg>
              <span>{weatherState.dateLabel}</span>
            </div>

            <p className={`weather-temp-readability absolute left-5 top-1/2 z-20 -translate-y-1/2 text-6xl font-extrabold leading-none md:text-7xl ${isNightCard ? "text-[#f3f8ff]" : "text-[#f7fbff]"}`}>
              {weatherState.temperature}°C
            </p>

            <Image
              src={weatherState.iconPath}
              alt={weatherState.intensityDescription}
              width={140}
              height={140}
              className={`weather-icon-float absolute right-1 top-1/2 h-[124px] w-[124px] -translate-y-1/2 object-contain ${isNightCard ? "opacity-95" : "opacity-88"}`}
            />
          </div>

          <div className="grid gap-2.5 rounded-3xl border border-[#d8e4f1] bg-white/80 p-3.5 backdrop-blur-sm md:grid-cols-2 md:p-4">
            <div className="rounded-xl border border-[#e6edf5] bg-[#f9fbff] px-3.5 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6883a7]">Condition</p>
              <p className="mt-1 text-base font-bold text-[#16375f]">{weatherState.owmMain || "-"}</p>
              <p className="mt-1 text-sm text-[#5f7797]">{weatherState.owmDescription || "-"}</p>
            </div>
            <div className="rounded-xl border border-[#e6edf5] bg-[#f9fbff] px-3.5 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6883a7]">Intensity</p>
              <p className="mt-1 text-base font-bold text-[#16375f]">{weatherState.intensityDescription}</p>
              <p className="mt-1 text-sm text-[#5f7797]">Signal: {weatherState.signalNo}</p>
            </div>
            <div className="rounded-xl border border-[#e6edf5] bg-[#f9fbff] px-3.5 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6883a7]">Humidity</p>
              <p className="mt-1 text-base font-bold text-[#16375f]">{weatherState.humidity === null ? "-" : `${weatherState.humidity}%`}</p>
            </div>
            <div className="rounded-xl border border-[#e6edf5] bg-[#f9fbff] px-3.5 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6883a7]">Heat Index</p>
              <p className="mt-1 text-base font-bold text-[#16375f]">{weatherState.heatIndex === null ? "-" : `${weatherState.heatIndex.toFixed(1)}°C`}</p>
            </div>
            <div className="rounded-xl border border-[#e6edf5] bg-[#f9fbff] px-3.5 py-2.5 md:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6883a7]">Advisory</p>
              <p className="mt-1 text-sm leading-6 text-[#425a79]" title={weatherState.manualDescription || "-"}>
                {weatherState.manualDescription || "-"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .weather-icon-float {
          animation: weatherIconFloat 3.4s ease-in-out infinite;
        }

        .weather-card-animated {
          position: relative;
        }

        .weather-card-animated::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, rgba(9, 15, 28, 0.12) 0%, rgba(9, 15, 28, 0) 55%);
          pointer-events: none;
        }

        .weather-card-night {
          background: radial-gradient(circle at 75% 20%, #203a63 0%, #132745 46%, #0b1b33 100%) !important;
          border-color: #233a5f !important;
          box-shadow: inset 0 0 0 1px rgba(33, 53, 84, 0.55);
        }

        .weather-temp-readability {
          text-shadow: 0 2px 12px rgba(0, 0, 0, 0.32);
        }

        .weather-stars .weather-star {
          position: absolute;
          width: 3px;
          height: 3px;
          border-radius: 999px;
          background: rgba(248, 252, 255, 0.95);
          animation: weatherTwinkle 2.2s ease-in-out infinite;
        }

        .weather-stars .weather-star:nth-child(1) { top: 18px; left: 20px; animation-delay: 0s; }
        .weather-stars .weather-star:nth-child(2) { top: 30px; left: 68px; animation-delay: 0.2s; }
        .weather-stars .weather-star:nth-child(3) { top: 24px; left: 124px; animation-delay: 0.5s; }
        .weather-stars .weather-star:nth-child(4) { top: 14px; left: 196px; animation-delay: 0.8s; }
        .weather-stars .weather-star:nth-child(5) { top: 54px; left: 30px; animation-delay: 1.1s; }
        .weather-stars .weather-star:nth-child(6) { top: 68px; left: 96px; animation-delay: 1.3s; }
        .weather-stars .weather-star:nth-child(7) { top: 76px; left: 170px; animation-delay: 0.4s; }
        .weather-stars .weather-star:nth-child(8) { top: 92px; left: 228px; animation-delay: 1.5s; }
        .weather-stars .weather-star:nth-child(9) { top: 116px; left: 42px; animation-delay: 0.6s; }
        .weather-stars .weather-star:nth-child(10) { top: 130px; left: 88px; animation-delay: 0.9s; }
        .weather-stars .weather-star:nth-child(11) { top: 138px; left: 150px; animation-delay: 1.2s; }
        .weather-stars .weather-star:nth-child(12) { top: 118px; left: 216px; animation-delay: 1.7s; }

        .weather-day-glow::before,
        .weather-day-glow::after {
          content: "";
          position: absolute;
          border-radius: 999px;
          filter: blur(0.5px);
          animation: weatherGlowPulse 2.8s ease-in-out infinite;
        }

        .weather-day-glow::before {
          width: 132px;
          height: 132px;
          right: -26px;
          top: -34px;
          background: rgba(255, 247, 204, 0.55);
        }

        .weather-day-glow::after {
          width: 98px;
          height: 98px;
          left: -24px;
          top: 52px;
          background: rgba(255, 236, 170, 0.45);
          animation-delay: 0.4s;
        }

        .weather-rain .weather-raindrop {
          position: absolute;
          width: 2px;
          height: 18px;
          border-radius: 999px;
          background: rgba(230, 241, 255, 0.62);
          transform: rotate(16deg);
          animation: weatherRainFall 1.45s linear infinite;
        }

        .weather-rain .weather-raindrop:nth-child(1) { left: 20px; top: 10px; animation-delay: 0s; }
        .weather-rain .weather-raindrop:nth-child(2) { left: 54px; top: 22px; animation-delay: 0.18s; }
        .weather-rain .weather-raindrop:nth-child(3) { left: 90px; top: 4px; animation-delay: 0.35s; }
        .weather-rain .weather-raindrop:nth-child(4) { left: 126px; top: 26px; animation-delay: 0.52s; }
        .weather-rain .weather-raindrop:nth-child(5) { left: 164px; top: 8px; animation-delay: 0.7s; }
        .weather-rain .weather-raindrop:nth-child(6) { left: 198px; top: 30px; animation-delay: 0.9s; }
        .weather-rain .weather-raindrop:nth-child(7) { left: 226px; top: 14px; animation-delay: 1.08s; }
        .weather-rain .weather-raindrop:nth-child(8) { left: 248px; top: 0px; animation-delay: 1.25s; }

        @keyframes weatherIconFloat {
          0%,
          100% {
            transform: translateY(-50%) translateY(0);
          }
          50% {
            transform: translateY(-50%) translateY(-5px);
          }
        }

        @keyframes weatherTwinkle {
          0%,
          100% {
            opacity: 0.45;
            transform: scale(0.85);
          }
          50% {
            opacity: 1;
            transform: scale(1.15);
          }
        }

        @keyframes weatherGlowPulse {
          0%,
          100% {
            opacity: 0.22;
            transform: scale(0.98);
          }
          50% {
            opacity: 0.45;
            transform: scale(1.05);
          }
        }

        @keyframes weatherRainFall {
          0% {
            transform: translateY(-20px) rotate(16deg);
            opacity: 0;
          }
          20% {
            opacity: 0.7;
          }
          100% {
            transform: translateY(26px) rotate(16deg);
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
}
