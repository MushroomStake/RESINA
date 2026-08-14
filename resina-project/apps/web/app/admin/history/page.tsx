"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Chart, registerables } from "chart.js";
import "chartjs-adapter-date-fns";
Chart.register(...registerables);
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { downloadAnalyticsReportPdf } from "./pdf-report";
import { downloadAnalyticsReportXlsx } from "./xlsx-report";
import { ActivityLogSection } from "../dashboard/components/activity-log-section";
import { AdminPageSkeleton } from "../components/admin-skeleton";

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
    description: "Water level is within the normal range. Continue regular monitoring.",
    chipClass: "border-[#A7F3D0] bg-[#D1FAE5] text-[#166534]",
    activeFilterClass: "border-[#A7F3D0] bg-[#D1FAE5] text-[#166534]",
  },
  critical: {
    statusLabel: "Critical",
    rangeLabel: "2.5 - 2.9m",
    description: "Water is high. Stay alert and prepare essentials in case conditions worsen.",
    chipClass: "border-[#FDE68A] bg-[#FEF3C7] text-[#B45309]",
    activeFilterClass: "border-[#FDE68A] bg-[#FEF3C7] text-[#B45309]",
  },
  evacuation: {
    statusLabel: "Evacuation",
    rangeLabel: "3.0 - 3.9m",
    description: "Danger level reached. Evacuate low-lying areas and follow barangay instructions.",
    chipClass: "border-[#A95C2B] bg-[#E6BA9F6E] text-[#A95C2B]",
    activeFilterClass: "border-[#A95C2B] bg-[#E6BA9F6E] text-[#A95C2B]",
  },
  spilling: {
    statusLabel: "Spilling",
    rangeLabel: "4.0m",
    description: "Overflow level reached. Immediate evacuation and emergency response are required.",
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
    return "Overflow level reached. Immediate evacuation and rescue response required.";
  }
  if (level === "evacuation") {
    return "Danger level reached. Move residents in low areas to safer ground now.";
  }
  if (level === "critical") {
    return "High-water warning. Stay alert and prepare for possible evacuation.";
  }

  return "Normal level. Continue monitoring and keep channels open for updates.";
}

function resolveRangeLabel(level: AlertLevelKey, fallback: string): string {
  if (level === "spilling") {
    return "4.0m";
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
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return value.toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

function resolveChartDateValue(value: string): Date {
  const parsed = value ? new Date(`${value}T00:00:00`) : new Date();
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const fallback = new Date();
  fallback.setHours(0, 0, 0, 0);
  return fallback;
}

function formatChartDateValue(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AdminHistoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [isChecking, setIsChecking] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AlertLevelKey>("all");
  const [dateFilter, setDateFilter] = useState<"7d" | "30d" | "90d" | "all" | "date">("30d");
  const [selectedDate, setSelectedDate] = useState("");
  const [chartDate, setChartDate] = useState(() => {
    return formatChartDateValue(new Date());
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [showDateFilterHelp, setShowDateFilterHelp] = useState(false);
  const [highlightedRecordId, setHighlightedRecordId] = useState<string | null>(null);
  const [zoomedChartPoint, setZoomedChartPoint] = useState<string | null>(null);
  const dateHelpButtonRef = useRef<HTMLButtonElement | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number } | null>(null);
  const tooltipElRef = useRef<HTMLDivElement | null>(null);
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  const pageSize = 5;

  const loadHistoryRecords = async (): Promise<void> => {
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
  };

  useEffect(() => {
    let isMounted = true;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleReload = () => {
      if (reloadTimer !== null) {
        return;
      }

      reloadTimer = setTimeout(() => {
        reloadTimer = null;
        if (isMounted) {
          void loadHistoryRecords();
        }
      }, 350);
    };

    const initialize = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        router.replace("/admin");
        return;
      }

      await loadHistoryRecords();
      setIsChecking(false);
    };

    void initialize();

    const channel = supabase
      .channel("admin-history-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sensor_readings" },
        scheduleReload,
      )
      .subscribe();

    const fallbackTimer = setInterval(() => {
      if (isMounted) {
        void loadHistoryRecords();
      }
    }, 10_000);

    return () => {
      isMounted = false;
      if (reloadTimer !== null) {
        clearTimeout(reloadTimer);
      }
      clearInterval(fallbackTimer);
      void supabase.removeChannel(channel);
    };
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
  const currentPdfFileName = `${currentReportBaseName}.pdf`;

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedRecords = filteredRecords.slice((safePage - 1) * pageSize, safePage * pageSize);
  const showingStart = filteredRecords.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const showingEnd = Math.min(safePage * pageSize, filteredRecords.length);

  // Build a compact page list for the pagination control (with ellipses when there
  // are many pages). Returns an array of numbers and the string 'ellipsis'.
  function buildPageItems(total: number, current: number, maxVisible = 7): Array<number | "ellipsis"> {
    if (total <= maxVisible) return Array.from({ length: total }, (_, i) => i + 1);

    const items: Array<number | "ellipsis"> = [];
    const middleSize = Math.max(1, maxVisible - 2); // reserve slots for first and last

    let start = current - Math.floor(middleSize / 2);
    let end = current + Math.floor(middleSize / 2);

    if (start < 2) {
      start = 2;
      end = start + middleSize - 1;
    }

    if (end > total - 1) {
      end = total - 1;
      start = end - middleSize + 1;
    }

    items.push(1);

    if (start > 2) {
      items.push("ellipsis");
    }

    for (let p = start; p <= end; p++) items.push(p);

    if (end < total - 1) {
      items.push("ellipsis");
    }

    items.push(total);
    return items;
  }

  const pageItems = buildPageItems(totalPages, safePage, 9);

  const chartPoints = useMemo(() => {
    const resolvedChartDate = resolveChartDateValue(chartDate);
    const resolvedChartDateKey = formatChartDateValue(resolvedChartDate);

    const dayRecords = records.filter((record) => {
      const entryDate = record.readingDate ?? record.recordedAt.slice(0, 10);
      return entryDate === resolvedChartDateKey;
    });

    return dayRecords
      .map((record) => {
        let timestamp: Date;
        if (record.readingDate && record.readingTime) {
          timestamp = new Date(`${record.readingDate}T${record.readingTime}`);
          if (Number.isNaN(timestamp.getTime())) {
            timestamp = new Date(record.recordedAt);
          }
        } else {
          timestamp = new Date(record.recordedAt);
        }

        return {
          x: timestamp.toISOString(),
          y: Math.round(record.waterLevel * 100) / 100,
        };
      })
      .sort((left, right) => new Date(left.x).getTime() - new Date(right.x).getTime());
  }, [chartDate, records]);

  const chartWindow = useMemo(() => {
    const resolvedChartDate = resolveChartDateValue(chartDate);
    const dayStart = new Date(resolvedChartDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 22 * 60 * 60 * 1000);

    if (!zoomedChartPoint) {
      return {
        min: dayStart,
        max: dayEnd,
        zoomed: false,
      };
    }

    const selectedPoint = new Date(zoomedChartPoint);
    if (Number.isNaN(selectedPoint.getTime())) {
      return {
        min: dayStart,
        max: dayEnd,
        zoomed: false,
      };
    }

    const halfWindowMs = 30 * 60 * 1000;
    const min = new Date(Math.max(dayStart.getTime(), selectedPoint.getTime() - halfWindowMs));
    const max = new Date(Math.min(dayEnd.getTime(), selectedPoint.getTime() + halfWindowMs));

    if (max.getTime() <= min.getTime()) {
      return {
        min: dayStart,
        max: dayEnd,
        zoomed: false,
      };
    }

    return {
      min,
      max,
      zoomed: true,
    };
  }, [chartDate, zoomedChartPoint]);

  useEffect(() => {
    const canvas = chartCanvasRef.current;
    if (!canvas) {
      return;
    }

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const thresholdPlugin = {
      id: "thresholdBands",
      beforeDraw: (chartInstance: any) => {
        const { ctx: c, chartArea, scales } = chartInstance;
        if (!chartArea) return;
        const yScale = scales.y;

        const bands = [
          { from: 0, to: 2.49, color: "rgba(167,243,208,0.12)" },
          { from: 2.5, to: 2.99, color: "rgba(253,230,138,0.12)" },
          { from: 3.0, to: 3.99, color: "rgba(230,186,159,0.12)" },
          { from: 4.0, to: 4.5, color: "rgba(229,76,76,0.12)" },
        ];

        for (const band of bands) {
          const y1 = yScale.getPixelForValue(band.to);
          const y2 = yScale.getPixelForValue(band.from);
          c.save();
          c.fillStyle = band.color;
          c.fillRect(chartArea.left, y1, chartArea.right - chartArea.left, y2 - y1);
          c.restore();
        }
      },
    };

    const chart = new Chart(canvas, {
      type: "line",
      data: {
        datasets: [
          {
            label: "Water Level (m)",
            data: chartPoints as any,
            borderColor: "#1e3a8a",
            backgroundColor: "rgba(30,58,138,0.08)",
            tension: chartWindow.zoomed ? 0.12 : 0.25,
            pointRadius: (context: { raw?: { x?: string } }) => {
              if (!chartWindow.zoomed) {
                return 3;
              }

              return context.raw?.x === zoomedChartPoint ? 8 : 5;
            },
            pointHoverRadius: chartWindow.zoomed ? 10 : 6,
            pointBackgroundColor: "#1e3a8a",
            fill: true,
          },
        ],
      } as any,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 450,
          easing: "easeInOutCubic",
        },
        interaction: {
          mode: "nearest",
          intersect: true,
        },
        onClick: (_event: unknown, elements: Array<{ datasetIndex: number; index: number }>, chartInstance: any) => {
          if (elements.length === 0) {
            setZoomedChartPoint(null);
            return;
          }

          const first = elements[0];
          const point = chartInstance.data.datasets[first.datasetIndex]?.data[first.index] as { x?: string } | undefined;
          if (point?.x) {
            setZoomedChartPoint(point.x);
          }
        },
        scales: {
          x: {
            type: "time",
            time: {
              unit: chartWindow.zoomed ? "minute" : "hour",
              tooltipFormat: "hh:mm a",
              displayFormats: chartWindow.zoomed
                ? {
                    minute: "hh:mm a",
                  }
                : {
                    hour: "hh:mm a",
                  },
            },
            min: chartWindow.min.toISOString(),
            max: chartWindow.max.toISOString(),
            title: { display: true, text: "Time (12-hour)" },
            ticks: {
              autoSkip: true,
              maxRotation: 0,
              minRotation: 0,
              stepSize: chartWindow.zoomed ? 1 : 2,
              callback: function (tickValue: any, index: number, ticks: any) {
                const raw = (ticks && ticks[index] && ticks[index].value) || tickValue;
                const d = new Date(raw);
                if (Number.isNaN(d.getTime())) return "";
                return d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true });
              },
            },
          },
          y: {
            min: 0,
            max: 4,
            title: { display: true, text: "Meters (m)" },
            ticks: { stepSize: 0.5 },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: { mode: chartWindow.zoomed ? "nearest" : "index", intersect: chartWindow.zoomed },
        },
      } as any,
      plugins: [thresholdPlugin],
    });

    canvas.style.height = "260px";
    chartRef.current = chart;

    return () => {
      chart.destroy();
      chartRef.current = null;
    };
  }, [chartPoints, chartWindow, zoomedChartPoint]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, dateFilter, selectedDate]);

  useEffect(() => {
    const targetRecordId = searchParams.get("recordId")?.trim() ?? "";
    if (!targetRecordId) {
      setHighlightedRecordId(null);
      return;
    }

    setHighlightedRecordId(targetRecordId);
    const index = filteredRecords.findIndex((entry) => entry.id === targetRecordId);
    if (index < 0) {
      return;
    }

    const targetPage = Math.floor(index / pageSize) + 1;
    if (targetPage !== currentPage) {
      setCurrentPage(targetPage);
    }
  }, [currentPage, filteredRecords, pageSize, searchParams]);

  useEffect(() => {
    if (!highlightedRecordId) {
      return;
    }

    const row = document.getElementById(`history-row-${highlightedRecordId}`);
    if (!row) {
      return;
    }

    row.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightedRecordId, pagedRecords]);

  useEffect(() => {
    function updatePos() {
      if (!dateHelpButtonRef.current) {
        setTooltipPos(null);
        return;
      }

      const rect = dateHelpButtonRef.current.getBoundingClientRect();
      setTooltipPos({ left: rect.left + rect.width / 2, top: rect.bottom + 8 });
    }

    if (showDateFilterHelp) {
      updatePos();
      window.addEventListener("resize", updatePos);
      window.addEventListener("scroll", updatePos, true);
      return () => {
        window.removeEventListener("resize", updatePos);
        window.removeEventListener("scroll", updatePos, true);
      };
    }

    setTooltipPos(null);
  }, [showDateFilterHelp]);

  useEffect(() => {
    if (!tooltipElRef.current) return;
    if (!tooltipPos) {
      tooltipElRef.current.style.left = "";
      tooltipElRef.current.style.top = "";
      tooltipElRef.current.style.transform = "";
      return;
    }

    tooltipElRef.current.style.left = `${tooltipPos.left}px`;
    tooltipElRef.current.style.top = `${tooltipPos.top}px`;
    tooltipElRef.current.style.transform = "translateX(-50%)";
  }, [tooltipPos]);

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

  const handleDownloadPdf = async () => {
    const generatedAt = new Date().toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      month: "long",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    await downloadAnalyticsReportPdf(
      {
        rows: filteredRecords,
        dateRangeLabel: currentDateRangeLabel,
        generatedAt,
        reportTitle: "Sta. Rita Bridge Water Level Monitoring Report",
        barangayName: "Barangay Sta. Rita",
        cityName: "Lungsod ng Olongapo",
      },
      currentPdfFileName,
    );
  };

  if (isChecking) {
    return <AdminPageSkeleton title="Loading analytics report..." blockCount={2} />;
  }

  return (
    <section className="p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[20px] border border-[#e6eef9] bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="mb-1 text-sm font-semibold text-[#0f2847]">Water Level (m) — Time Series</h3>
              <p className="text-xs text-[#5b6b80]">Daily chart of water level movement for the selected date.</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 rounded-xl border border-[#d0dceb] bg-white px-3 py-2 text-[#374151] shadow-sm">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#6b7280]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                <input
                  type="date"
                  value={chartDate}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    if (!nextValue) {
                      setChartDate(formatChartDateValue(new Date()));
                      return;
                    }

                    setChartDate(nextValue);
                  }}
                  aria-label="Select chart date for chart"
                  className="bg-transparent outline-none text-sm"
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  setChartDate(formatChartDateValue(new Date()));
                }}
                className="rounded-full border px-3 py-1 text-xs bg-white hover:bg-[#f1f7ff]"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = resolveChartDateValue(chartDate);
                  d.setDate(d.getDate() - 1);
                  setChartDate(formatChartDateValue(d));
                }}
                className="rounded-full border px-3 py-1 text-xs bg-white hover:bg-[#f1f7ff]"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = resolveChartDateValue(chartDate);
                  d.setDate(d.getDate() + 1);
                  setChartDate(formatChartDateValue(d));
                }}
                className="rounded-full border px-3 py-1 text-xs bg-white hover:bg-[#f1f7ff]"
              >
                Next
              </button>
            </div>
          </div>
          <div className="w-full mt-3">
            <canvas id="history-chart" ref={chartCanvasRef} />
          </div>
        </section>
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
              <div className="relative flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-[#d0dceb] bg-white px-3 py-2.5 text-[#374151] shadow-sm">
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
                </div>

                <div className="relative flex-shrink-0">
                  <button
                    ref={dateHelpButtonRef}
                    type="button"
                    aria-describedby="date-filter-help"
                    onMouseEnter={() => setShowDateFilterHelp(true)}
                    onMouseLeave={() => setShowDateFilterHelp(false)}
                    onFocus={() => setShowDateFilterHelp(true)}
                    onBlur={() => setShowDateFilterHelp(false)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#eef2ff] text-[#123b63] hover:bg-[#e6f0ff] focus-visible:ring-2 focus-visible:ring-[#c7ddff]
                      text-xs font-semibold"
                  >
                    <span className="sr-only">Date filter help</span>
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5" />
                      <path d="M12 16h.01" />
                    </svg>
                  </button>
                </div>
              </div>

              {dateFilter === "date" ? (
                <label className="flex items-center gap-2 rounded-xl border border-[#d0dceb] bg-white px-3 py-2.5 text-[#374151] shadow-sm">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#6b7280]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => {
                      setSelectedDate(event.target.value);
                    }}
                    aria-label="Select a specific history date"
                    className="bg-transparent outline-none"
                  />
                </label>
              ) : null}

              {/* removed: chart picker/buttons (moved to chart header) */}

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
                <p className="mt-1 text-sm text-[#5b6b80]">Each row shows the recorded water level, status, and plain-language risk note.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleDownloadXlsx()}
                  disabled={filteredRecords.length === 0}
                  className="rounded-xl bg-[#123b63] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f2f50] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Download XLSX
                </button>
                <button
                  type="button"
                  onClick={() => void handleDownloadPdf()}
                  disabled={filteredRecords.length === 0}
                  className="rounded-xl border border-[#c7d8ea] bg-white px-4 py-2 text-sm font-semibold text-[#123b63] shadow-sm transition hover:border-[#9bc2e8] hover:bg-[#f7fbff] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Download PDF
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
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={`skeleton-${index}`} className="border-b border-[#e9f0f7] odd:bg-[#fbfdff]">
                      <td className="px-4 py-4">
                        <div className="h-4 w-28 animate-pulse rounded bg-[#e3edf8]" />
                      </td>
                      <td className="px-4 py-4">
                        <div className="h-4 w-20 animate-pulse rounded bg-[#e3edf8]" />
                      </td>
                      <td className="px-4 py-4">
                        <div className="h-6 w-24 animate-pulse rounded-full bg-[#e3edf8]" />
                      </td>
                      <td className="px-4 py-4">
                        <div className="h-4 w-16 animate-pulse rounded bg-[#e3edf8]" />
                      </td>
                      <td className="px-4 py-4">
                        <div className="h-4 w-full animate-pulse rounded bg-[#e3edf8]" />
                      </td>
                    </tr>
                  ))
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
                      <tr
                        key={entry.id}
                        id={`history-row-${entry.id}`}
                        className={`border-b border-[#e9f0f7] transition odd:bg-[#fbfdff] hover:bg-[#edf5ff] last:border-b-0 ${
                          highlightedRecordId === entry.id ? "!bg-[#fff7ed]" : ""
                        }`}
                      >
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

          <div className="grid grid-cols-1 gap-3 border-t border-[#d9e5f2] bg-[#f8fbff] px-4 py-4 sm:grid-cols-3 sm:items-center">
            <div className="flex items-center gap-4 sm:justify-start sm:col-span-1">
              <p className="text-xs text-[#6b7280]">
                Showing {showingStart} to {showingEnd} of {filteredRecords.length} entries
              </p>
            </div>

            <div className="flex items-center gap-2 justify-center sm:col-span-1">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safePage === 1}
                className="rounded-lg border border-[#d0dceb] bg-white px-3 py-1.5 text-sm text-[#52667b] transition hover:bg-[#f1f7ff] disabled:opacity-40"
              >
                Prev
              </button>
              {pageItems.map((item, idx) =>
                item === "ellipsis" ? (
                  <span key={`e-${idx}`} className="mx-1 inline-block px-2 text-sm text-[#6b7280]">
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCurrentPage(Number(item))}
                    className={`h-8 w-8 rounded-full border text-sm transition ${
                      item === safePage
                        ? "border-[#86d57e] bg-[#f0fdf4] text-[#16a34a] shadow-sm"
                        : "border-[#d0dceb] bg-white text-[#52667b] hover:bg-[#f1f7ff]"
                    }`}
                  >
                    {item}
                  </button>
                ),
              )}
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={safePage === totalPages}
                className="rounded-lg border border-[#d0dceb] bg-white px-3 py-1.5 text-sm text-[#52667b] transition hover:bg-[#f1f7ff] disabled:opacity-40"
              >
                Next
              </button>
            </div>

            <div className="sm:col-span-1" />
          </div>
        </section>

        <ActivityLogSection />

        {typeof window !== "undefined" && tooltipPos && showDateFilterHelp
          ? createPortal(
              <div
                ref={tooltipElRef}
                id="date-filter-help"
                role="tooltip"
                className="pointer-events-none fixed z-50 w-72 rounded-lg border border-[#d1d5db] bg-white p-3 text-xs text-[#374151] shadow-lg"
              >
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#111827]">Date Filter</span>
                <p className="text-xs text-[#374151]">
                  Use this filter to pick a range (7/30/90 days) or choose "Specific Date" to select a single
                  date using the date picker that appears.
                </p>
              </div>,
              document.body,
            )
          : null}

      </div>
    </section>
  );
}