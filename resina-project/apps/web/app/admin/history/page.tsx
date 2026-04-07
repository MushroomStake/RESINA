"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { downloadAnalyticsReportXlsx } from "./xlsx-report";
import { ActivityLogSection } from "../dashboard/components/activity-log-section";

type AlertLevelKey = "normal" | "critical" | "evacuation" | "spilling";

type HistoryRecord = {
  id: string;
  recordedAt: string;
  readingDate: string | null;
  readingTime: string | null;
  waterLevel: number;
  alertLevel: AlertLevelKey;
  statusLabel: string;
  rangeLabel: string;
  description: string;
};

const ALERT_LEVELS: Record<
  AlertLevelKey,
  {
    statusLabel: string;
    rangeLabel: string;
    description: string;
    chipClass: string;
    activeFilterClass: string;
  }
> = {
  normal: {
    statusLabel: "Normal",
    rangeLabel: "1.5 - 2.49m",
    description: "Water level remains stable. No immediate threat observed at the current threshold.",
    chipClass: "border-[#A7F3D0] bg-[#D1FAE5] text-[#166534]",
    activeFilterClass: "border-[#A7F3D0] bg-[#D1FAE5] text-[#166534]",
  },
  critical: {
    statusLabel: "Critical",
    rangeLabel: "2.5 - 2.9m",
    description: "Caution; stay alert and monitor the situation within the critical threshold.",
    chipClass: "border-[#FDE68A] bg-[#FEF3C7] text-[#B45309]",
    activeFilterClass: "border-[#FDE68A] bg-[#FEF3C7] text-[#B45309]",
  },
  evacuation: {
    statusLabel: "Evacuation",
    rangeLabel: "3.0 - 3.9m",
    description: "Immediate danger; action is required now once readings enter the evacuation threshold.",
    chipClass: "border-[#A95C2B] bg-[#E6BA9F6E] text-[#A95C2B]",
    activeFilterClass: "border-[#A95C2B] bg-[#E6BA9F6E] text-[#A95C2B]",
  },
  spilling: {
    statusLabel: "Spilling",
    rangeLabel: "4.0+m",
    description: "Extreme hazard; overflow risk is active once readings reach the spilling threshold.",
    chipClass: "border-[#E54C4C] bg-[#F7C8C8] text-[#E54C4C]",
    activeFilterClass: "border-[#E54C4C] bg-[#F7C8C8] text-[#E54C4C]",
  },
};

function inferAlertLevel(statusText: string | null, waterLevel: number | null): AlertLevelKey {
  const status = (statusText ?? "").toLowerCase();

  if (status.includes("spill")) {
    return "spilling";
  }
  if (status.includes("evac")) {
    return "evacuation";
  }
  if (status.includes("critical") || status.includes("alert level 2") || status.includes("alert 2")) {
    return "critical";
  }
  if (status.includes("normal") || status.includes("alert level 1") || status.includes("alert 1")) {
    return "normal";
  }

  if (waterLevel !== null) {
    if (waterLevel >= 4) {
      return "spilling";
    }
    if (waterLevel >= 3) {
      return "evacuation";
    }
    if (waterLevel >= 2.5) {
      return "critical";
    }
  }

  return "normal";
}

function buildHistoryDescription(level: AlertLevelKey): string {
  if (level === "spilling") {
    return "Classified under the spilling threshold range.";
  }
  if (level === "evacuation") {
    return "Classified under the evacuation threshold range.";
  }
  if (level === "critical") {
    return "Classified under the critical threshold range.";
  }

  return "Classified under the normal threshold range.";
}

function resolveRangeLabel(level: AlertLevelKey, fallback: string): string {
  if (level === "spilling") {
    return "4.0+m";
  }

  return fallback;
}

function normalizeHistoryRow(row: Record<string, unknown>): HistoryRecord | null {
  const recordedAt = (row.created_at ?? null) as string | null;

  if (!recordedAt) {
    return null;
  }

  const rawLevel = Number(row.water_level ?? Number.NaN);
  if (Number.isNaN(rawLevel)) {
    return null;
  }

  const waterLevel = rawLevel;
  const statusText = (row.status ?? null) as string | null;
  const alertLevel = inferAlertLevel(statusText, waterLevel);
  const config = ALERT_LEVELS[alertLevel];

  return {
    id: String(row.id ?? recordedAt),
    recordedAt,
    readingDate: (row.reading_date ?? null) as string | null,
    readingTime: (row.reading_time ?? null) as string | null,
    waterLevel,
    alertLevel,
    statusLabel: config.statusLabel,
    rangeLabel: resolveRangeLabel(alertLevel, config.rangeLabel),
    description: buildHistoryDescription(alertLevel),
  };
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatHistoryDateTime(record: HistoryRecord): string {
  if (record.readingDate && record.readingTime) {
    const date = new Date(`${record.readingDate}T${record.readingTime}`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
  }

  return formatDateTime(record.recordedAt);
}

function formatHistoryDate(record: HistoryRecord): string {
  if (record.readingDate) {
    const date = new Date(`${record.readingDate}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-PH", {
        timeZone: "Asia/Manila",
        month: "short",
        day: "2-digit",
        year: "numeric",
      });
    }
  }

  return new Date(record.recordedAt).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatHistoryTime(record: HistoryRecord): string {
  if (record.readingTime) {
    const date = new Date(`2000-01-01T${record.readingTime}`);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString("en-PH", {
        timeZone: "Asia/Manila",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
  }

  return new Date(record.recordedAt).toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateForRangeLabel(value: Date): string {
  return value.toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatDateForFileName(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AdminHistoryPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [isChecking, setIsChecking] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AlertLevelKey>("all");
  const [dateFilter, setDateFilter] = useState<"7d" | "30d" | "90d" | "all" | "date">("30d");
  const [selectedDate, setSelectedDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const pageSize = 5;

  useEffect(() => {
    const initialize = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/admin");
        return;
      }

      setPageError(null);
      setIsLoading(true);

      const { data: rows, error } = await supabase
        .from("sensor_readings")
        .select("id, water_level, status, reading_date, reading_time, created_at")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) {
        setPageError(error.message);
        setRecords([]);
        setIsLoading(false);
        setIsChecking(false);
        return;
      }

      const normalized = (rows ?? [])
        .map((row) => normalizeHistoryRow(row as Record<string, unknown>))
        .filter((entry): entry is HistoryRecord => entry !== null)
        .sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime());

      setRecords(normalized);
      if (normalized.length === 0) {
        setPageError("No analytics data found for the selected period.");
      }

      setIsLoading(false);
      setIsChecking(false);
    };

    void initialize();
  }, [router, supabase]);

  const dateFilteredRecords = records.filter((entry) => {
    if (dateFilter === "all") {
      return true;
    }

    if (dateFilter === "date") {
      if (!selectedDate) {
        return true;
      }

      const entryDate = entry.readingDate ?? entry.recordedAt.slice(0, 10);
      return entryDate === selectedDate;
    }

    const dayWindow = dateFilter === "7d" ? 7 : dateFilter === "30d" ? 30 : 90;
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - dayWindow);

    return new Date(entry.recordedAt).getTime() >= since.getTime();
  });

  const filteredRecords = dateFilteredRecords.filter((entry) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      entry.statusLabel.toLowerCase().includes(query) ||
      entry.rangeLabel.toLowerCase().includes(query) ||
      entry.description.toLowerCase().includes(query) ||
      formatHistoryDateTime(entry).toLowerCase().includes(query) ||
      entry.waterLevel.toFixed(2).includes(query);

    const matchesFilter = statusFilter === "all" || entry.alertLevel === statusFilter;
    return matchesSearch && matchesFilter;
  });

  const currentDateRangeLabel = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateFilter === "all") {
      if (records.length === 0) {
        return "All available records";
      }

      const earliest = new Date(records[records.length - 1].recordedAt);
      const latest = new Date(records[0].recordedAt);
      return `${formatDateForRangeLabel(earliest)} - ${formatDateForRangeLabel(latest)}`;
    }

    if (dateFilter === "date") {
      if (!selectedDate) {
        return "Pick a specific date";
      }

      const picked = new Date(`${selectedDate}T00:00:00`);
      return `${formatDateForRangeLabel(picked)} - ${formatDateForRangeLabel(picked)}`;
    }

    const dayWindow = dateFilter === "7d" ? 7 : dateFilter === "30d" ? 30 : 90;
    const start = new Date(today);
    start.setDate(start.getDate() - dayWindow);
    return `${formatDateForRangeLabel(start)} - ${formatDateForRangeLabel(today)}`;
  })();

  const currentReportBaseName = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateFilter === "date" && selectedDate) {
      return `analytics-report-${selectedDate}`;
    }

    if (dateFilter === "all") {
      if (records.length === 0) {
        return "analytics-report-all";
      }

      const earliest = new Date(records[records.length - 1].recordedAt);
      const latest = new Date(records[0].recordedAt);
      return `analytics-report-${formatDateForFileName(earliest)}_to_${formatDateForFileName(latest)}`;
    }

    const dayWindow = dateFilter === "7d" ? 7 : dateFilter === "30d" ? 30 : 90;
    const start = new Date(today);
    start.setDate(start.getDate() - dayWindow);
    return `analytics-report-${formatDateForFileName(start)}_to_${formatDateForFileName(today)}`;
  })();

  const currentXlsxFileName = `${currentReportBaseName}.xlsx`;

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedRecords = filteredRecords.slice((safePage - 1) * pageSize, safePage * pageSize);
  const showingStart = filteredRecords.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const showingEnd = Math.min(safePage * pageSize, filteredRecords.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, dateFilter, selectedDate]);

  const handleDownloadXlsx = async () => {
    const generatedAt = new Date().toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      month: "long",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    await downloadAnalyticsReportXlsx(
      {
        rows: filteredRecords,
        dateRangeLabel: currentDateRangeLabel,
        generatedAt,
        reportTitle: "Sta. Rita Bridge Water Level Monitoring Report",
        barangayName: "Barangay Sta. Rita",
        cityName: "Lungsod ng Olongapo",
      },
      currentXlsxFileName,
    );
  };

  if (isChecking) {
    return (
      <section className="p-6 md:p-8">
        <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 text-sm text-[#6b7280]">
          Loading analytics report...
        </div>
      </section>
    );
  }

  return (
    <section className="p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[28px] border border-[#d5e2f1] bg-[linear-gradient(135deg,#f9fcff_0%,#f1f7ff_48%,#edf5ff_100%)] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] md:p-5">
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.18),transparent_70%)]" />
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="relative block min-w-0 flex-1 lg:max-w-sm">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 20l-3.5-3.5" />
                </svg>
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search status, water level, or date..."
                className="w-full rounded-xl border border-[#d0dceb] bg-white py-2.5 pl-9 pr-3 text-sm text-[#334155] outline-none placeholder:text-[#9db0c8] shadow-sm focus:border-[#9bc2e8]"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label className="flex items-center gap-2 rounded-xl border border-[#d0dceb] bg-white px-3 py-2.5 text-[#374151] shadow-sm">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#6b7280]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                <select
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value as "7d" | "30d" | "90d" | "all" | "date")}
                  aria-label="Filter history by date range"
                  className="bg-transparent outline-none"
                >
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="90d">Last 90 Days</option>
                  <option value="all">All Records</option>
                  <option value="date">Specific Date</option>
                </select>
              </label>

              {dateFilter === "date" ? (
                <label className="flex items-center gap-2 rounded-xl border border-[#d0dceb] bg-white px-3 py-2.5 text-[#374151] shadow-sm">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#6b7280]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    aria-label="Select a specific history date"
                    className="bg-transparent outline-none"
                  />
                </label>
              ) : null}

              <div className="rounded-xl border border-[#d0dceb] bg-white px-3 py-2.5 text-xs text-[#59779b] shadow-sm">
                Range: <span className="font-medium text-[#374151]">{currentDateRangeLabel}</span>
              </div>

              <span className="px-1 text-[#5f7ca3]">Status:</span>

              {(["all", "normal", "critical", "evacuation", "spilling"] as const).map((filter) => {
                const isActive = statusFilter === filter;
                const label =
                  filter === "all"
                    ? "All"
                    : filter === "evacuation"
                      ? "Evacuate"
                      : ALERT_LEVELS[filter].statusLabel;

                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setStatusFilter(filter)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition shadow-sm ${
                      isActive
                        ? filter === "all"
                          ? "border-[#bbf7d0] bg-[#ecfdf3] text-[#16a34a]"
                          : ALERT_LEVELS[filter].activeFilterClass
                        : "border-[#d0dceb] bg-white text-[#5d7390] hover:border-[#9bc2e8]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[30px] border border-[#d8e5f3] bg-white shadow-[0_24px_55px_rgba(15,23,42,0.12)]">
          <div className="relative border-b border-[#d9e5f2] bg-[linear-gradient(180deg,#f8fbff_0%,#eff6ff_100%)] px-5 py-5 md:px-6">
            <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(30,64,175,0.16),transparent_68%)]" />
            <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#5b7ea9]">Analytics Table</p>
                <h2 className="mt-1 text-2xl font-semibold text-[#0f2847]">Water Level Records</h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleDownloadXlsx()}
                  disabled={filteredRecords.length === 0}
                  className="rounded-xl bg-[#123b63] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f2f50] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Download Report
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-[#123b63] text-white">
                <tr>
                  <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-[0.16em]">Date</th>
                  <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-[0.16em]">Time</th>
                  <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-[0.16em]">Status</th>
                  <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-[0.16em]">Water Level (m)</th>
                  <th className="px-4 py-4 text-[11px] font-bold uppercase tracking-[0.16em]">Description</th>
                </tr>
              </thead>
              <tbody className="text-[#334155]">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-[#6b7280]">
                      Loading analytics records...
                    </td>
                  </tr>
                ) : pagedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-[#6b7280]">
                      {pageError ?? "No analytics records matched the current filters."}
                    </td>
                  </tr>
                ) : (
                  pagedRecords.map((entry) => {
                    const config = ALERT_LEVELS[entry.alertLevel];

                    return (
                      <tr key={entry.id} className="border-b border-[#e9f0f7] transition odd:bg-[#fbfdff] hover:bg-[#edf5ff] last:border-b-0">
                        <td className="px-4 py-4 whitespace-nowrap text-[#475569]">{formatHistoryDate(entry)}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-[#475569]">{formatHistoryTime(entry)}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium shadow-sm ${config.chipClass}`}>
                            {entry.statusLabel}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-semibold text-[#123b63]">{entry.waterLevel.toFixed(2)}</td>
                        <td className="px-4 py-4 leading-6 text-[#475569]">{entry.description}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#d9e5f2] bg-[#f8fbff] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <p className="text-xs text-[#6b7280]">
                Showing {showingStart} to {showingEnd} of {filteredRecords.length} entries
              </p>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safePage === 1}
                className="rounded-lg border border-[#d0dceb] bg-white px-3 py-1.5 text-sm text-[#52667b] transition hover:bg-[#f1f7ff] disabled:opacity-40"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`h-8 w-8 rounded-full border text-sm transition ${
                    page === safePage
                      ? "border-[#86d57e] bg-[#f0fdf4] text-[#16a34a] shadow-sm"
                      : "border-[#d0dceb] bg-white text-[#52667b] hover:bg-[#f1f7ff]"
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={safePage === totalPages}
                className="rounded-lg border border-[#d0dceb] bg-white px-3 py-1.5 text-sm text-[#52667b] transition hover:bg-[#f1f7ff] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </section>

        <ActivityLogSection />

      </div>
    </section>
  );
}