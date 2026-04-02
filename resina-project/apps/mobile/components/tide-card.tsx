import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMemo } from "react";

export interface TideStatus {
  currentHeight: number | null;
  nextExtreme: {
    type: "high" | "low";
    height: number;
    time: string;
  };
  state: "rising" | "falling";
}

export interface TideHourly {
  hour: number;
  estimatedHeight: number;
  confidence: "high" | "medium" | "low";
}

interface TideCardProps {
  tideStatus: TideStatus | null;
  hourlyTides: TideHourly[];
  isLoading: boolean;
  error: string | null;
}

function formatHourLabel(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:00${suffix}`;
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function TideCard({ tideStatus, hourlyTides, isLoading, error }: TideCardProps) {
  const graphStats = useMemo(() => {
    if (!hourlyTides.length) {
      return null;
    }

    const heights = hourlyTides.map((entry) => entry.estimatedHeight);
    const highest = Math.max(...heights);
    const lowest = Math.min(...heights);
    const highEntry = hourlyTides.find((entry) => entry.estimatedHeight === highest) ?? hourlyTides[0];
    const lowEntry = hourlyTides.find((entry) => entry.estimatedHeight === lowest) ?? hourlyTides[0];

    return {
      highest,
      lowest,
      highEntry,
      lowEntry,
      range: highest - lowest,
    };
  }, [hourlyTides]);

  const tideStats = useMemo(() => {
    if (!tideStatus || !graphStats) {
      return null;
    }

    const nextLabel = `${tideStatus.nextExtreme.type === "high" ? "High" : "Low"} tide in ${formatDurationUntil(tideStatus.nextExtreme.time)}`;
    const trendLabel = tideStatus.state === "rising" ? "Rising" : "Falling";
    const nextTimeLabel = formatDateTimeLabel(tideStatus.nextExtreme.time);

    return {
      currentHeight: tideStatus.currentHeight,
      trendLabel,
      nextLabel,
      nextTimeLabel,
      nextHeightLabel: `${tideStatus.nextExtreme.height.toFixed(2)}m`,
      lowestLabel: `${graphStats.lowest.toFixed(2)}m`,
      highestLabel: `${graphStats.highest.toFixed(2)}m`,
      rangeLabel: `${graphStats.range.toFixed(2)}m`,
      lowTime: formatHourLabel(graphStats.lowEntry.hour),
      highTime: formatHourLabel(graphStats.highEntry.hour),
    };
  }, [graphStats, tideStatus]);

  const lineChart = useMemo(() => {
    if (!hourlyTides.length || !graphStats) {
      return {
        points: [] as Array<{ x: number; y: number; confidence: "high" | "medium" | "low"; hour: number; value: number }>,
        segments: [] as Array<{ left: number; top: number; width: number; angle: string }>,
      };
    }

    const pointSpacing = 34;
    const chartHeight = 140;
    const safeRange = Math.max(0.01, graphStats.highest - graphStats.lowest);

    const points = hourlyTides.map((entry, index) => {
      const normalized = (entry.estimatedHeight - graphStats.lowest) / safeRange;
      return {
        x: index * pointSpacing + 10,
        y: chartHeight - normalized * chartHeight,
        confidence: entry.confidence,
        hour: entry.hour,
        value: entry.estimatedHeight,
      };
    });

    const segments = points.slice(0, -1).map((point, index) => {
      const next = points[index + 1];
      const dx = next.x - point.x;
      const dy = next.y - point.y;
      return {
        left: point.x,
        top: point.y,
        width: Math.sqrt(dx * dx + dy * dy),
        angle: `${Math.atan2(dy, dx)}rad`,
      };
    });

    return { points, segments };
  }, [graphStats, hourlyTides]);

  const currentFill = useMemo(() => {
    if (!tideStats || graphStats === null || tideStats.currentHeight === null) {
      return 0;
    }

    const safeRange = Math.max(0.01, graphStats.highest - graphStats.lowest);
    return clamp((tideStats.currentHeight - graphStats.lowest) / safeRange, 0, 1);
  }, [graphStats, tideStats]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.heroPanel}>
          <Text style={styles.kicker}>Tide Monitor</Text>
          <Text style={styles.heroTitle}>Sta. Rita Bridge tide outlook</Text>
          <Text style={styles.heroSubtitle}>Loading tide data...</Text>
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#ffffff" />
            <Text style={styles.loadingText}>Fetching tide records</Text>
          </View>
        </View>
      </View>
    );
  }

  if (error || !tideStatus || !tideStats) {
    return (
      <View style={styles.container}>
        <View style={styles.heroPanel}>
          <Text style={styles.kicker}>Tide Monitor</Text>
          <Text style={styles.heroTitle}>Sta. Rita Bridge tide outlook</Text>
          <Text style={styles.heroSubtitle}>Quick look at the water level trend, next tide event, and hourly movement.</Text>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error || "No tide data available yet"}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.kicker}>Tide Monitor</Text>
          <Text style={styles.heroTitle}>Sta. Rita Bridge tide outlook</Text>
          <Text style={styles.heroSubtitle}>Quick look at the water level trend, next tide event, and hourly movement near Sta. Rita Bridge.</Text>
        </View>
        <View style={styles.datePill}>
          <Text style={styles.datePillText}>Today</Text>
        </View>
      </View>

      <View style={styles.heroPanel}>
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.sectionLabel}>Current Tide</Text>
            <Text style={styles.currentHeight}>{tideStats.currentHeight === null ? "-" : `${tideStats.currentHeight.toFixed(2)}m`}</Text>
          </View>
          <View style={styles.trendPill}>
            <Text style={styles.trendPillText}>{tideStats.trendLabel}</Text>
          </View>
        </View>

        <Text style={styles.heroCopy}>
          {tideStatus.state === "rising"
            ? "Water is going up based on the latest tide records."
            : "Water is going down based on the latest tide records."}
        </Text>

        <View style={styles.nextCard}>
          <View style={styles.nextCardRow}>
            <Text style={styles.nextLabel}>Next Tide Event</Text>
            <Text style={styles.nextType}>{tideStatus.nextExtreme.type === "high" ? "High Tide" : "Low Tide"}</Text>
          </View>
          <Text style={styles.nextValue}>{tideStats.nextLabel}</Text>
          <Text style={styles.nextMeta}>{tideStats.nextHeightLabel} • {tideStats.nextTimeLabel}</Text>
        </View>

        <View style={styles.statGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Lowest</Text>
            <Text style={styles.statValue}>{tideStats.lowestLabel}</Text>
            <Text style={styles.statMeta}>{tideStats.lowTime}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Highest</Text>
            <Text style={styles.statValue}>{tideStats.highestLabel}</Text>
            <Text style={styles.statMeta}>{tideStats.highTime}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Range</Text>
            <Text style={styles.statValue}>{tideStats.rangeLabel}</Text>
            <Text style={styles.statMeta}>Today</Text>
          </View>
        </View>

        <View style={styles.locationCard}>
          <Text style={styles.locationLabel}>Location</Text>
          <Text style={styles.locationValue}>Sta. Rita Bridge, Olongapo</Text>
          <Text style={styles.locationMeta}>Updated daily from tide records</Text>
        </View>
      </View>

      {hourlyTides.length > 0 && (
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTitle}>Hourly Tide Flow</Text>
              <Text style={styles.chartSubtitle}>12-hour format with an overview of how the tide is moving.</Text>
            </View>
          </View>

          <View style={styles.chartStrip}>
            <View style={styles.chartMetaRow}>
              <View style={styles.chartMetaChip}>
                <Text style={styles.chartMetaLabel}>Lowest</Text>
                <Text style={styles.chartMetaValue}>{tideStats.lowestLabel}</Text>
              </View>
              <View style={styles.chartMetaChip}>
                <Text style={styles.chartMetaLabel}>Highest</Text>
                <Text style={styles.chartMetaValue}>{tideStats.highestLabel}</Text>
              </View>
              <View style={styles.chartMetaChip}>
                <Text style={styles.chartMetaLabel}>Range</Text>
                <Text style={styles.chartMetaValue}>{tideStats.rangeLabel}</Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourlyContent}>
              <View>
                <View style={styles.lineChartCanvas}>
                  <View style={[styles.currentBand, { left: `${currentFill * 100}%` }]} />
                  {lineChart.segments.map((segment, index) => (
                    <View
                      key={`segment-${index}`}
                      style={[
                        styles.lineSegment,
                        {
                          left: segment.left,
                          top: segment.top,
                          width: segment.width,
                          transform: [{ rotate: segment.angle }],
                        },
                      ]}
                    />
                  ))}

                  {lineChart.points.map((point) => (
                    <View
                      key={`point-${point.hour}`}
                      style={[
                        styles.linePoint,
                        {
                          left: point.x - 4,
                          top: point.y - 4,
                          opacity: point.confidence === "high" ? 1 : point.confidence === "medium" ? 0.85 : 0.7,
                        },
                      ]}
                    />
                  ))}
                </View>

                <View style={styles.lineLabelsRow}>
                  {lineChart.points
                    .filter((point) => point.hour % 3 === 0)
                    .map((point) => (
                      <View key={`label-${point.hour}`} style={[styles.lineLabelItem, { left: point.x - 18 }]}>
                        <Text style={styles.hourlyHour}>{formatHourLabel(point.hour)}</Text>
                        <Text style={styles.hourlyHeight}>{point.value.toFixed(2)}m</Text>
                      </View>
                    ))}
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      )}
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  kicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "#5f7aa1",
  },
  heroTitle: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 24,
    color: "#102f57",
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: "#607896",
  },
  datePill: {
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    boxShadow: "0px 2px 8px rgba(15, 23, 42, 0.06)",
  },
  datePillText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#27518f",
  },
  heroPanel: {
    borderRadius: 24,
    backgroundColor: "#0d2c52",
    padding: 16,
    overflow: "hidden",
    boxShadow: "0px 18px 44px rgba(15, 23, 42, 0.18)",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionLabel: {
    color: "#cfe8ff",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontSize: 11,
    fontWeight: "800",
  },
  currentHeight: {
    marginTop: 4,
    fontSize: 42,
    lineHeight: 46,
    fontWeight: "900",
    color: "#ffffff",
  },
  trendPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  trendPillText: {
    color: "#eef6ff",
    fontSize: 12,
    fontWeight: "800",
  },
  heroCopy: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: "rgba(225, 238, 255, 0.92)",
  },
  nextCard: {
    marginTop: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.10)",
    padding: 14,
  },
  nextCardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  nextLabel: {
    color: "#d7e6ff",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  nextType: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  nextValue: {
    marginTop: 8,
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  nextMeta: {
    marginTop: 4,
    color: "rgba(225, 238, 255, 0.82)",
    fontSize: 12,
    fontWeight: "600",
  },
  statGrid: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.10)",
    padding: 12,
  },
  statLabel: {
    color: "rgba(215, 230, 255, 0.78)",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  statValue: {
    marginTop: 6,
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  statMeta: {
    marginTop: 2,
    color: "rgba(225, 238, 255, 0.82)",
    fontSize: 11,
    fontWeight: "600",
  },
  locationCard: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.10)",
    padding: 12,
  },
  locationLabel: {
    color: "#d7e6ff",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  locationValue: {
    marginTop: 6,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  locationMeta: {
    marginTop: 2,
    color: "rgba(225, 238, 255, 0.82)",
    fontSize: 11,
    fontWeight: "600",
  },
  chartCard: {
    marginTop: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#ffffff",
    padding: 14,
    boxShadow: "0px 14px 32px rgba(15, 23, 42, 0.08)",
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#334155",
  },
  chartSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#6b7280",
  },
  chartStrip: {
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#f8fbff",
    padding: 12,
  },
  chartMetaRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  chartMetaChip: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#eff6ff",
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  chartMetaLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
  },
  chartMetaValue: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: "900",
    color: "#1d4ed8",
  },
  hourlyContent: {
    paddingRight: 8,
  },
  lineChartCanvas: {
    height: 140,
    minWidth: 820,
    borderRadius: 16,
    backgroundColor: "#eef6ff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    overflow: "hidden",
  },
  currentBand: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: "rgba(124, 58, 237, 0.35)",
  },
  lineSegment: {
    position: "absolute",
    height: 2,
    backgroundColor: "#2563eb",
  },
  linePoint: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#1d4ed8",
  },
  lineLabelsRow: {
    position: "relative",
    minWidth: 820,
    height: 30,
    marginTop: 6,
  },
  lineLabelItem: {
    position: "absolute",
    width: 44,
    alignItems: "center",
  },
  hourlyHour: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  hourlyHeight: {
    marginTop: 2,
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
  },
  loadingRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    color: "#eaf3ff",
    fontSize: 13,
    fontWeight: "600",
  },
  errorBox: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 12,
  },
  errorText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
});
