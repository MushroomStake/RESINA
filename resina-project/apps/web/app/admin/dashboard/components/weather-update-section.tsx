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
  weatherSaveMessage: string | null;
  weatherError: string | null;
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
  weatherSaveMessage,
  weatherError,
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
          <div className={`relative min-h-[195px] overflow-hidden rounded-2xl px-7 py-7 text-[#2f3850] ${weatherCardClass}`}>
            <div className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-wide">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
              </svg>
              <span>{weatherState.dateLabel}</span>
            </div>

            <p className="absolute left-7 top-1/2 z-10 -translate-y-1/2 text-8xl font-extrabold leading-none">{weatherState.temperature}°C</p>

            <Image
              src={weatherState.iconPath}
              alt={weatherState.intensityDescription}
              width={170}
              height={170}
              className="absolute -right-3 top-1/2 h-[154px] w-[154px] -translate-y-1/2 object-contain"
            />
          </div>

          <div className="grid gap-2 rounded-xl border border-[#e5e7eb] p-4 text-sm text-[#4b5563]">
            <p>
              <span className="font-semibold">Weather Condition:</span> {weatherState.owmMain || "-"}
            </p>
            <p>
              <span className="font-semibold">Detailed Condition:</span> {weatherState.owmDescription || "-"}
            </p>
            <p>
              <span className="font-semibold">Weather Intensity:</span> {weatherState.intensityDescription}
            </p>
            <p>
              <span className="font-semibold">Humidity:</span> {weatherState.humidity === null ? "-" : `${weatherState.humidity}%`}
            </p>
            <p>
              <span className="font-semibold">Heat Index:</span>{" "}
              {weatherState.heatIndex === null ? "-" : `${weatherState.heatIndex.toFixed(1)}°C`}
            </p>
            <p>
              <span className="font-semibold">Color Coded Warning:</span> {weatherState.colorCodedWarning}
            </p>
            <p>
              <span className="font-semibold">Signal Level:</span> {weatherState.signalNo}
            </p>
            <p className="min-w-0 text-xs text-[#6b7280]">
              <span className="font-semibold text-[#4b5563]">Description:</span>{" "}
              <span className="inline-block max-w-full truncate align-bottom" title={weatherState.manualDescription || "-"}>
                {weatherState.manualDescription || "-"}
              </span>
            </p>
            {weatherSaveMessage ? <p className="text-xs text-[#15803d]">{weatherSaveMessage}</p> : null}
            {weatherError ? <p className="text-xs text-[#b91c1c]">{weatherError}</p> : null}
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

              {weatherError ? <p className="text-sm text-[#b91c1c]">{weatherError}</p> : null}
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
    </>
  );
}
