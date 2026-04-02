import { useMemo } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";

export interface TideStatus {
  currentHeight: number | null;
  nextExtreme: {
    type: "high" | "low";
    height: number;
    time: string;
  };
  state: "rising" | "falling";
}

export interface TideExtreme {
  type: "high" | "low";
  height: number;
  time: string;
}

export interface TideHourly {
  hour: number;
  estimatedHeight: number;
  confidence: "high" | "medium" | "low";
}

interface TideCardProps {
  tideStatus: TideStatus | null;
  tideExtremes: TideExtreme[];
  hourlyTides: TideHourly[];
  isLoading: boolean;
  error: string | null;
}

type ChartPoint = {
  hour: number;
  x: number;
  y: number;
  value: number;
  confidence: "high" | "medium" | "low";
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

function formatHour12FromHour(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:00 ${suffix}`;
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

function formatTimeOnly(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }

  return parsed.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
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

function catmullRom(p0: ChartPoint, p1: ChartPoint, p2: ChartPoint, p3: ChartPoint, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;

  const x =
    0.5 *
    ((2 * p1.x) +
      (-p0.x + p2.x) * t +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);

  const y =
    0.5 *
    ((2 * p1.y) +
      (-p0.y + p2.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

  return { x, y };
}

function findNextByType(extremes: TideExtreme[], type: "high" | "low"): TideExtreme | null {
  if (!extremes.length) {
    return null;
  }

  const sorted = [...extremes]
    .filter((entry) => entry.type === type)
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  if (!sorted.length) {
    return null;
  }

  const now = Date.now();
  return sorted.find((entry) => new Date(entry.time).getTime() >= now) ?? sorted[0];
}

export function TideCard({ tideStatus, tideExtremes, hourlyTides, isLoading, error }: TideCardProps) {
  const manilaNowHour = getManilaHourNow();
  const todayLabel = formatTodayManila();

  const nextHigh = useMemo(() => findNextByType(tideExtremes, "high"), [tideExtremes]);
  const nextLow = useMemo(() => findNextByType(tideExtremes, "low"), [tideExtremes]);

  const chart = useMemo(() => {
    if (!hourlyTides.length) {
      return {
        points: [] as ChartPoint[],
        smoothPoints: [] as Array<{ x: number; y: number }>,
        yTicks: [] as Array<{ value: number; y: number }>,
        currentX: 0,
        lowestPoint: null as null | ChartPoint,
        highestPoint: null as null | ChartPoint,
        chartWidth: 920,
        chartHeight: 236,
        baseline: 198,
      };
    }

    const byHour = new Map<number, TideHourly>();
    for (const entry of hourlyTides) {
      byHour.set(toManilaHour(entry.hour), entry);
    }

    const hours = Array.from({ length: 24 }, (_, hour) => hour);
    const values = Array.from(byHour.values()).map((entry) => entry.estimatedHeight);
    const lowest = Math.min(...values);
    const highest = Math.max(...values);

    const chartWidth = 920;
    const chartHeight = 236;
    const leftPad = 46;
    const rightPad = 18;
    const topPad = 20;
    const bottomPad = 38;
    const usableWidth = chartWidth - leftPad - rightPad;
    const usableHeight = chartHeight - topPad - bottomPad;
    const range = Math.max(0.01, highest - lowest);

    const points: ChartPoint[] = hours.map((hour, index) => {
      const entry = byHour.get(hour) ?? { hour, estimatedHeight: lowest, confidence: "low" as const };
      const x = leftPad + (index / 23) * usableWidth;
      const normalized = (entry.estimatedHeight - lowest) / range;
      const y = topPad + (1 - normalized) * usableHeight;
      return { hour, x, y, value: entry.estimatedHeight, confidence: entry.confidence };
    });

    const smoothPoints: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < points.length - 1; i++) {
      smoothPoints.push(points[i]);
      smoothPoints.push(points[i + 1]);
    }

    const yTicks = Array.from({ length: 5 }, (_, index) => {
      const value = lowest + ((4 - index) / 4) * range;
      const normalized = (value - lowest) / range;
      const y = topPad + (1 - normalized) * usableHeight;
      return { value, y };
    });

    const currentX = leftPad + (manilaNowHour / 23) * usableWidth;

    // Use chart's calculated points for dot positions (ensures alignment with line)
    const lowestPoint = points.reduce((memo, point) => (point.value < memo.value ? point : memo), points[0]);
    const highestPoint = points.reduce((memo, point) => (point.value > memo.value ? point : memo), points[0]);

    return {
      points,
      smoothPoints,
      yTicks,
      currentX,
      lowestPoint,
      highestPoint,
      chartWidth,
      chartHeight,
      baseline: chartHeight - bottomPad,
    };
  }, [hourlyTides, manilaNowHour]);

  const nextHighLabel = nextHigh
    ? formatTimeOnly(nextHigh.time)
    : chart.highestPoint
      ? formatHour12FromHour(chart.highestPoint.hour)
      : "N/A";

  const nextLowLabel = nextLow
    ? formatTimeOnly(nextLow.time)
    : chart.lowestPoint
      ? formatHour12FromHour(chart.lowestPoint.hour)
      : "N/A";

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Hourly Tide Flow</Text>
          <Text style={styles.datePill}>{todayLabel}</Text>
        </View>
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#1d4ed8" />
          <Text style={styles.loadingText}>Loading tide data...</Text>
        </View>
      </View>
    );
  }

  if (error || !tideStatus || !hourlyTides.length) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Hourly Tide Flow</Text>
          <Text style={styles.datePill}>{todayLabel}</Text>
        </View>
        <Text style={styles.errorText}>{error || "No tide data available yet."}</Text>
      </View>
    );
  }

  // Calculate label positions with improved bounds checking to prevent overlap with chart lines
  const lowLabelTop = chart.lowestPoint
    ? Math.max(8, Math.min(chart.chartHeight - 32, chart.lowestPoint.y > chart.chartHeight * 0.6 ? chart.lowestPoint.y - 32 : chart.lowestPoint.y + 14))
    : 8;
  const highLabelTop = chart.highestPoint
    ? chart.highestPoint.y < 28
      ? chart.highestPoint.y + 16
      : Math.max(8, chart.highestPoint.y - 32)
    : 8;

  // Add safe margins to prevent text from overlapping with the wave line
  const lowLabelLeft = chart.lowestPoint
    ? Math.max(60, Math.min(chart.chartWidth - 125, chart.lowestPoint.x - 55))
    : 60;
  const highLabelLeft = chart.highestPoint
    ? Math.max(60, Math.min(chart.chartWidth - 125, chart.highestPoint.x - 55))
    : 60;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Hourly Tide Flow</Text>
        <Text style={styles.datePill}>{todayLabel}</Text>
      </View>
      <Text style={styles.headerSubtitle}>Wave-style one-day view with hourly levels (0-23), current time line, and high/low markers.</Text>

      <View style={styles.tideCardRow}>
        <View style={styles.tideMomentCard}>
          <Image source={require("../assets/Tides/high-tide.png")} style={styles.tideMomentImage} resizeMode="contain" />
          <View style={styles.tideMomentTextBlock}>
            <Text style={styles.tideMomentTitle}>Next high tide is at</Text>
            <Text style={styles.tideMomentTime}>{nextHighLabel}</Text>
          </View>
        </View>

        <View style={styles.tideMomentCard}>
          <Image source={require("../assets/Tides/low-tide.png")} style={styles.tideMomentImage} resizeMode="contain" />
          <View style={styles.tideMomentTextBlock}>
            <Text style={styles.tideMomentTitle}>Next low tide is at</Text>
            <Text style={styles.tideMomentTime}>{nextLowLabel}</Text>
          </View>
        </View>
      </View>

      <View style={styles.chartShell}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={[styles.chartFrame, { width: chart.chartWidth }]}>
            <View style={[styles.chartCanvas, { height: chart.chartHeight }]}>
              {Array.from({ length: 4 }, (_, idx) => (
                <View
                  key={`band-${idx}`}
                  style={[
                    styles.hourBand,
                    {
                      left: 46 + idx * ((chart.chartWidth - 64) / 4),
                      width: (chart.chartWidth - 64) / 4,
                      backgroundColor: idx % 2 === 0 ? "rgba(56, 89, 136, 0.07)" : "rgba(56, 89, 136, 0.12)",
                    },
                  ]}
                />
              ))}

              {chart.yTicks.map((tick, index) => (
                <View key={`ytick-${index}`} style={[styles.yGridLine, { top: tick.y }]}>
                  <Text style={styles.yTickLabel}>{tick.value.toFixed(2)}</Text>
                </View>
              ))}

              <View style={[styles.currentLine, { left: chart.currentX }]} />

              {chart.smoothPoints.map((point, idx) => {
                const nextPoint = chart.smoothPoints[idx + 1];
                if (!nextPoint) return null;
                const dx = nextPoint.x - point.x;
                const dy = nextPoint.y - point.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx);
                return (
                  <View
                    key={`line-${idx}`}
                    style={[
                      styles.lineSegment,
                      {
                        left: point.x,
                        top: point.y,
                        width: length,
                        transform: [{ rotate: `${angle}rad` }],
                      },
                    ]}
                  />
                );
              })}


              {chart.lowestPoint ? <View style={[styles.lowPoint, { left: Math.round(chart.lowestPoint.x - 5), top: Math.round(chart.lowestPoint.y - 5) }]} /> : null}
              {chart.highestPoint ? <View style={[styles.highPoint, { left: Math.round(chart.highestPoint.x - 5), top: Math.round(chart.highestPoint.y - 5) }]} /> : null}

              {chart.lowestPoint ? (
                <Text style={[styles.lowLabel, { left: lowLabelLeft, top: lowLabelTop }]}>
                  {formatHour12FromHour(chart.lowestPoint.hour)}
                </Text>
              ) : null}

              {chart.highestPoint ? (
                <Text style={[styles.highLabel, { left: highLabelLeft, top: highLabelTop }]}>
                  {formatHour12FromHour(chart.highestPoint.hour)}
                </Text>
              ) : null}
            </View>

            <View style={styles.hourLabelsRow}>
              {Array.from({ length: 24 }, (_, hour) => {
                const usableWidth = chart.chartWidth - 64; // leftPad(46) + rightPad(18)
                const hourX = 46 + (hour / 23) * usableWidth;
                return (
                  <Text
                    key={`hour-${hour}`}
                    style={[styles.hourLabel, { position: "absolute", left: Math.round(hourX - 17) }]}
                  >
                    {hour}
                  </Text>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f5fbff",
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#2563eb",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#203759",
  },
  datePill: {
    fontSize: 11,
    fontWeight: "800",
    color: "#27518f",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d8e4f8",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#5f7391",
    lineHeight: 18,
  },
  tideCardRow: {
    marginTop: 12,
    gap: 10,
  },
  tideMomentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dce6f4",
    backgroundColor: "#ffffff",
    padding: 12,
  },
  tideMomentImage: {
    width: 56,
    height: 56,
  },
  tideMomentTextBlock: {
    flex: 1,
    alignItems: "flex-end",
  },
  tideMomentTitle: {
    fontSize: 13,
    color: "#2a405f",
    fontWeight: "600",
  },
  tideMomentTime: {
    marginTop: 2,
    fontSize: 22,
    fontWeight: "900",
    color: "#1e63a8",
  },
  chartShell: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dbe8f9",
    backgroundColor: "#f8fbff",
    padding: 10,
  },
  chartFrame: {
    width: 920,
  },
  chartCanvas: {
    height: 236,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d5e3f8",
    backgroundColor: "#edf5ff",
    overflow: "hidden",
  },
  hourBand: {
    position: "absolute",
    top: 0,
    bottom: 0,
  },
  yGridLine: {
    position: "absolute",
    left: 46,
    right: 0,
    height: 1,
    backgroundColor: "#d2e0f2",
  },
  yTickLabel: {
    position: "absolute",
    left: -42,
    top: -8,
    width: 38,
    textAlign: "right",
    fontSize: 10,
    color: "#5b7394",
    fontWeight: "600",
  },
  currentLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "#ef4444",
  },
  lineSegment: {
    position: "absolute",
    height: 4,
    backgroundColor: "#2e5db8",
    borderRadius: 2,
    transformOrigin: "0 50%",
  },
  lowPoint: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#ef4444",
  },
  highPoint: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#1d4ed8",
  },
  lowLabel: {
    position: "absolute",
    fontSize: 12,
    color: "#ef4444",
    fontWeight: "800",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  highLabel: {
    position: "absolute",
    fontSize: 12,
    color: "#1d4ed8",
    fontWeight: "800",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  hourLabelsRow: {
    marginTop: 8,
    marginLeft: 46,
    position: "relative",
    height: 24,
    width: "100%",
  },
  hourLabel: {
    width: 34,
    textAlign: "center",
    fontSize: 10,
    color: "#556f91",
    fontWeight: "700",
  },
  loadingRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    color: "#4d6384",
    fontSize: 13,
    fontWeight: "600",
  },
  errorText: {
    marginTop: 10,
    color: "#8c1d32",
    fontSize: 13,
    fontWeight: "600",
  },
});
