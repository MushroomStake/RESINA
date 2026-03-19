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
  colorCodedWarning: string;
  signalNo: string;
  manualDescription: string;
  iconPath: string;
};

type WeatherUpdateSectionProps = {
  weatherState: WeatherView;
  weatherDraft: WeatherView;
  weatherCardClass: string;
  isWeatherModalOpen: boolean;
  isFetchingWeather: boolean;
  isSavingWeather: boolean;
  warningOptions: readonly string[];
  signalOptions: readonly string[];
  onOpenWeatherUpdateModal: () => void;
  onCloseWeatherModal: () => void;
  onRefreshWeather: () => void;
  onPublishWeather: () => void;
  onWarningChange: (value: string) => void;
  onSignalChange: (value: string) => void;
  onManualDescriptionChange: (value: string) => void;
};

export function WeatherUpdateSection({
  weatherState,
  weatherDraft,
  weatherCardClass,
  isWeatherModalOpen,
  isFetchingWeather,
  isSavingWeather,
  warningOptions,
  signalOptions,
  onOpenWeatherUpdateModal,
  onCloseWeatherModal,
  onRefreshWeather,
  onPublishWeather,
  onWarningChange,
  onSignalChange,
  onManualDescriptionChange,
}: WeatherUpdateSectionProps) {
  const isNightCard = weatherState.iconPath.toLowerCase().includes("moon");
  const isRainyCard = weatherState.intensityDescription.toLowerCase().includes("rain");

  return (
    <>
      <section className="mt-6 rounded-2xl border border-[#e5e7eb] bg-white p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-[#4b5563]">Weather Update</h3>
          <button
            type="button"
            onClick={onOpenWeatherUpdateModal}
            className="rounded-lg bg-[#4CAF50] px-3 py-1.5 text-xs font-semibold text-white"
          >
            Weather Update
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          <div
            className={`weather-card-animated relative min-h-[195px] overflow-hidden rounded-2xl px-7 py-7 text-[#2f3850] ${weatherCardClass} ${isNightCard ? "weather-card-night text-[#e6f0ff]" : ""}`}
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
              className={`relative z-20 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-extrabold uppercase tracking-wide ${isNightCard ? "bg-[#142541]/70 text-[#d7e6ff]" : "bg-white/60 text-[#273247]"}`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
              </svg>
              <span>{weatherState.dateLabel}</span>
            </div>

            <p
              className={`weather-temp-readability absolute left-7 top-1/2 z-20 -translate-y-1/2 text-7xl font-extrabold leading-none md:text-8xl ${isNightCard ? "text-[#f3f8ff]" : "text-[#f7fbff]"}`}
            >
              {weatherState.temperature}°C
            </p>

            <Image
              src={weatherState.iconPath}
              alt={weatherState.intensityDescription}
              width={170}
              height={170}
              className={`weather-icon-float absolute right-0 top-1/2 h-[146px] w-[146px] -translate-y-1/2 object-contain ${isNightCard ? "opacity-95" : "opacity-88"}`}
            />
          </div>

          <div className="grid gap-2 rounded-xl border border-[#e5e7eb] bg-[#fbfcfe] p-4 text-[15px] leading-6 text-[#374151]">
            <p className="break-words">
              <span className="font-semibold">Weather Condition:</span> {weatherState.owmMain || "-"}
            </p>
            <p className="break-words">
              <span className="font-semibold">Detailed Condition:</span> {weatherState.owmDescription || "-"}
            </p>
            <p className="break-words">
              <span className="font-semibold">Weather Intensity:</span> {weatherState.intensityDescription}
            </p>
            <p className="break-words">
              <span className="font-semibold">Humidity:</span> {weatherState.humidity === null ? "-" : `${weatherState.humidity}%`}
            </p>
            <p className="break-words">
              <span className="font-semibold">Heat Index:</span>{" "}
              {weatherState.heatIndex === null ? "-" : `${weatherState.heatIndex.toFixed(1)}°C`}
            </p>
            <p className="break-words">
              <span className="font-semibold">Color Coded Warning:</span> {weatherState.colorCodedWarning}
            </p>
            <p className="break-words">
              <span className="font-semibold">Signal Level:</span> {weatherState.signalNo}
            </p>
            <p className="min-w-0 text-sm leading-6 text-[#556071]">
              <span className="font-semibold text-[#4b5563]">Description:</span>{" "}
              <span className="inline-block max-w-full align-bottom" title={weatherState.manualDescription || "-"}>
                {weatherState.manualDescription || "-"}
              </span>
            </p>
          </div>
        </div>
      </section>

      {isWeatherModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-[820px] overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-5">
              <h2 className="text-2xl font-bold uppercase text-[#1f2937]">Weather Update</h2>
              <button
                type="button"
                onClick={onCloseWeatherModal}
                className="rounded-md p-1 text-[#6b7280] hover:bg-[#f3f4f6]"
                aria-label="Close modal"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="weather-temperature" className="mb-1 block text-sm font-medium text-[#374151]">
                    Current Temperature (°C)
                  </label>
                  <input
                    id="weather-temperature"
                    title="Current temperature in Celsius"
                    type="number"
                    value={weatherDraft.temperature}
                    readOnly
                    disabled
                    className="w-full rounded-lg border border-[#d1d5db] bg-[#f3f4f6] px-3 py-2 text-sm text-[#6b7280]"
                  />
                </div>

                <div>
                  <label htmlFor="weather-humidity" className="mb-1 block text-sm font-medium text-[#374151]">
                    Humidity (%)
                  </label>
                  <input
                    id="weather-humidity"
                    title="Current humidity percentage"
                    value={weatherDraft.humidity ?? "-"}
                    readOnly
                    disabled
                    className="w-full rounded-lg border border-[#d1d5db] bg-[#f3f4f6] px-3 py-2 text-sm text-[#6b7280]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="weather-main" className="mb-1 block text-sm font-medium text-[#374151]">
                    Weather Condition
                  </label>
                  <input
                    id="weather-main"
                    title="Primary weather condition"
                    value={weatherDraft.owmMain}
                    readOnly
                    disabled
                    className="w-full rounded-lg border border-[#d1d5db] bg-[#f3f4f6] px-3 py-2 text-sm text-[#6b7280]"
                  />
                </div>

                <div>
                  <label htmlFor="weather-description" className="mb-1 block text-sm font-medium text-[#374151]">
                    Detailed Condition
                  </label>
                  <input
                    id="weather-description"
                    title="Detailed weather condition"
                    value={weatherDraft.owmDescription}
                    readOnly
                    disabled
                    className="w-full rounded-lg border border-[#d1d5db] bg-[#f3f4f6] px-3 py-2 text-sm text-[#6b7280]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="weather-intensity" className="mb-1 block text-sm font-medium text-[#374151]">
                    Intensity Description
                  </label>
                  <input
                    id="weather-intensity"
                    title="Computed intensity description"
                    value={weatherDraft.intensityDescription}
                    readOnly
                    disabled
                    className="w-full rounded-lg border border-[#d1d5db] bg-[#f3f4f6] px-3 py-2 text-sm text-[#6b7280]"
                  />
                </div>

                <div>
                  <label htmlFor="weather-heat-index" className="mb-1 block text-sm font-medium text-[#374151]">
                    Heat Index (°C)
                  </label>
                  <input
                    id="weather-heat-index"
                    title="Computed heat index in Celsius"
                    value={weatherDraft.heatIndex === null ? "-" : weatherDraft.heatIndex.toFixed(1)}
                    readOnly
                    disabled
                    className="w-full rounded-lg border border-[#d1d5db] bg-[#f3f4f6] px-3 py-2 text-sm text-[#6b7280]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="weather-warning" className="mb-1 block text-sm font-medium text-[#374151]">
                    Color Coded Warning
                  </label>
                  <select
                    id="weather-warning"
                    title="Color coded warning"
                    value={weatherDraft.colorCodedWarning}
                    onChange={(event) => onWarningChange(event.target.value)}
                    className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm focus:border-[#4CAF50] focus:outline-none"
                  >
                    {warningOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="weather-signal" className="mb-1 block text-sm font-medium text-[#374151]">
                    Signal No.
                  </label>
                  <select
                    id="weather-signal"
                    title="Weather signal number"
                    value={weatherDraft.signalNo}
                    onChange={(event) => onSignalChange(event.target.value)}
                    className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm focus:border-[#4CAF50] focus:outline-none"
                  >
                    {signalOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="weather-manual-description" className="mb-1 block text-sm font-medium text-[#374151]">
                  Description (Manual)
                </label>
                <textarea
                  id="weather-manual-description"
                  title="Weather manual description"
                  placeholder="Enter any description format for broadcast"
                  value={weatherDraft.manualDescription}
                  onChange={(event) => onManualDescriptionChange(event.target.value)}
                  rows={5}
                  className="w-full resize-none rounded-lg border border-[#d1d5db] px-3 py-2 text-sm focus:border-[#4CAF50] focus:outline-none"
                />
              </div>

            </div>

            <div className="flex items-center justify-between border-t border-[#e5e7eb] px-6 py-4">
              <button
                type="button"
                onClick={onCloseWeatherModal}
                className="rounded-lg px-3 py-2 text-sm text-[#374151] hover:bg-[#f3f4f6]"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onRefreshWeather}
                  disabled={isFetchingWeather}
                  className="rounded-lg border border-[#d1d5db] px-3 py-2 text-sm text-[#374151] hover:bg-[#f9fafb] disabled:opacity-60"
                >
                  {isFetchingWeather ? "Refreshing..." : "Refresh Weather Data"}
                </button>
                <button
                  type="button"
                  onClick={onPublishWeather}
                  disabled={isSavingWeather}
                  className="rounded-lg bg-[#4CAF50] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3d9a40] disabled:opacity-60"
                >
                  {isSavingWeather ? "Publishing..." : "Publish Now"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
