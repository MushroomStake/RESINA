"use client";

type AlertConfigProps = {
  title: string;
  badge: string;
  leftPanelClass: string;
  noticeClass: string;
  description: string;
};

type CurrentSensorStatusProps = {
  alertConfig: AlertConfigProps;
  rangeLabel: string;
  lastUpdateLabel: string;
  isLoadingData: boolean;
  sourceTable: string | null;
  fetchError: string | null;
};

export function CurrentSensorStatus({
  alertConfig,
  rangeLabel,
  lastUpdateLabel,
  isLoadingData,
  sourceTable,
  fetchError,
}: CurrentSensorStatusProps) {
  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white lg:grid-cols-[280px_1fr]">
      <div className={`flex flex-col items-center justify-center px-6 py-8 text-white ${alertConfig.leftPanelClass}`}>
        <div className="mb-4 rounded-full bg-white/15 p-4">
          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 5-3.5 8.5-7 9-3.5-.5-7-4-7-9V7l7-4z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 3h.01" />
          </svg>
        </div>
        <h2 className="whitespace-nowrap text-center text-[40px] font-extrabold leading-none tracking-tight">{alertConfig.title}</h2>
        <span className="mt-3 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#334155]">{alertConfig.badge}</span>
      </div>

      <div className="px-6 py-7">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#6b7280]">Current Sensor Status</p>
          <p className="text-xs italic text-[#9ca3af]">{lastUpdateLabel}</p>
        </div>

        <p className="mt-2 text-5xl font-extrabold text-[#111827]">{rangeLabel}</p>

        <div className={`mt-4 rounded-xl border px-4 py-3 text-sm leading-7 ${alertConfig.noticeClass}`}>{alertConfig.description}</div>

        {isLoadingData ? <p className="mt-3 text-xs text-[#6b7280]">Loading latest sensor row...</p> : null}
        {sourceTable ? <p className="mt-2 text-xs text-[#9ca3af]">Data source: {sourceTable}</p> : null}
        {fetchError ? <p className="mt-2 text-xs text-[#b91c1c]">{fetchError}</p> : null}
      </div>
    </div>
  );
}
