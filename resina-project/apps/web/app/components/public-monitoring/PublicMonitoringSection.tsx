"use client";

import PublicSensorWrapper from "./PublicSensorWrapper";
import PublicWeatherWrapper from "./PublicWeatherWrapper";
import PublicTideWrapper from "./PublicTideWrapper";

export default function PublicMonitoringSection() {
  return (
    <section className="px-4 pb-10 pt-6 sm:px-5 md:px-10">
      <div className="mx-auto w-full max-w-[1200px]">
        <h3 className="mb-6 text-2xl font-bold">Monitoring (Public)</h3>
        <div className="flex w-full flex-col items-center gap-6">
          <div className="w-full max-w-[1100px]"><PublicSensorWrapper /></div>
          <div className="w-full max-w-[1100px]"><PublicWeatherWrapper /></div>
          <div className="w-full max-w-[1100px]"><PublicTideWrapper /></div>
        </div>
      </div>
    </section>
  );
}
