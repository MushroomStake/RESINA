import { ScrollView, StyleSheet, Text, View, ActivityIndicator } from "react-native";
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

export function TideCard({ tideStatus, hourlyTides, isLoading, error }: TideCardProps) {
  const nextExtremeTiming = useMemo(() => {
    if (!tideStatus) return null;

    const nextTime = new Date(tideStatus.nextExtreme.time);
    const now = new Date();
    const diffMs = nextTime.getTime() - now.getTime();
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));

    return `${hours}h ${minutes}m`;
  }, [tideStatus]);

  const formatHourLabel = (hour: number): string => {
    const suffix = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:00${suffix}`;
  };

  const currentHeight = tideStatus?.currentHeight ?? null;
  const currentLevelLabel = currentHeight !== null ? `${currentHeight.toFixed(2)}m` : "No data";
  const movementLabel = tideStatus ? (tideStatus.state === "rising" ? "Water is going up" : "Water is going down") : "No data";
  const nextTideLabel = tideStatus
    ? `${tideStatus.nextExtreme.type === "high" ? "High" : "Low"} tide in ${nextExtremeTiming}`
    : "No data";
  const graphStats = useMemo(() => {
    if (!hourlyTides.length) {
      return null;
    }

    const heights = hourlyTides.map((entry) => entry.estimatedHeight);
    const maxHeight = Math.max(...heights);
    const minHeight = Math.min(...heights);
    const maxEntry = hourlyTides.find((entry) => entry.estimatedHeight === maxHeight) ?? hourlyTides[0];
    const minEntry = hourlyTides.find((entry) => entry.estimatedHeight === minHeight) ?? hourlyTides[0];

    return {
      maxHeight,
      minHeight,
      maxEntry,
      minEntry,
      range: maxHeight - minHeight,
    };
  }, [hourlyTides]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>🌊 Today’s Tide</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading tide information...</Text>
        </View>
      </View>
    );
  }

  if (error || !tideStatus) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>🌊 Today’s Tide</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error || "No tide data available yet"}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🌊 Today’s Tide</Text>
        <Text style={styles.subtitle}>A quick look at the water level near Sta. Rita Bridge</Text>
      </View>

      <View style={styles.statusSection}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Current level</Text>
          <Text style={styles.summaryValue}>{currentLevelLabel}</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>What it means</Text>
          <View style={styles.trendBadge}>
            <Text style={styles.trendText}>{movementLabel}</Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Next tide</Text>
          <Text style={styles.nextExtremeValue}>{nextTideLabel}</Text>
        </View>
      </View>

      {hourlyTides.length > 0 && (
        <View style={styles.hourlySection}>
          <Text style={styles.hourlyTitle}>Tide graph</Text>
          <Text style={styles.hourlySubtitle}>Higher bars mean higher water. Times are shown in 12-hour format.</Text>

          {graphStats && (
            <View style={styles.graphStatsRow}>
              <View style={styles.graphStatChip}>
                <Text style={styles.graphStatLabel}>Lowest</Text>
                <Text style={styles.graphStatValue}>{graphStats.minHeight.toFixed(2)}m</Text>
                <Text style={styles.graphStatMeta}>{formatHourLabel(graphStats.minEntry.hour)}</Text>
              </View>
              <View style={styles.graphStatChip}>
                <Text style={styles.graphStatLabel}>Highest</Text>
                <Text style={styles.graphStatValue}>{graphStats.maxHeight.toFixed(2)}m</Text>
                <Text style={styles.graphStatMeta}>{formatHourLabel(graphStats.maxEntry.hour)}</Text>
              </View>
              <View style={styles.graphStatChip}>
                <Text style={styles.graphStatLabel}>Range</Text>
                <Text style={styles.graphStatValue}>{graphStats.range.toFixed(2)}m</Text>
                <Text style={styles.graphStatMeta}>Today</Text>
              </View>
            </View>
          )}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.hourlyScrollView}
            contentContainerStyle={styles.hourlyContent}
          >
            {hourlyTides.map((tide) => (
              <View key={`tide-${tide.hour}`} style={styles.hourlyItem}>
                <Text style={styles.hourlyHour}>{formatHourLabel(tide.hour)}</Text>
                <View
                  style={[
                    styles.hourlyBar,
                    {
                      height: 28 + tide.estimatedHeight * 22,
                      backgroundColor:
                        tide.confidence === "high" ? "#2563eb" : tide.confidence === "medium" ? "#60a5fa" : "#93c5fd",
                      opacity: tide.confidence === "high" ? 1 : tide.confidence === "medium" ? 0.88 : 0.72,
                    },
                  ]}
                />
                <Text style={styles.hourlyHeight}>{tide.estimatedHeight.toFixed(2)}m</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>Location: Sta. Rita Bridge, Olongapo</Text>
        <Text style={styles.footerText}>Updated daily from tide records</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f0f9ff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#2563eb",
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e40af",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#4b5563",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  errorContainer: {
    backgroundColor: "#fee2e2",
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: "#991b1b",
    fontSize: 14,
  },
  statusSection: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  summaryCard: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e7ff",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "600",
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1e40af",
  },
  trendBadge: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  trendText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e40af",
  },
  nextExtremeValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#7c3aed",
  },
  hourlySection: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  hourlyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
  },
  hourlySubtitle: {
    marginTop: 4,
    marginBottom: 12,
    fontSize: 12,
    color: "#6b7280",
  },
  graphStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  graphStatChip: {
    flex: 1,
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  graphStatLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "700",
  },
  graphStatValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "800",
    color: "#1d4ed8",
  },
  graphStatMeta: {
    marginTop: 2,
    fontSize: 11,
    color: "#475569",
  },
  hourlyScrollView: {
    marginHorizontal: -12,
  },
  hourlyContent: {
    paddingHorizontal: 12,
    gap: 10,
    alignItems: "flex-end",
  },
  hourlyItem: {
    width: 50,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    minHeight: 140,
  },
  hourlyHour: {
    fontSize: 11,
    fontWeight: "600",
    color: "#666",
  },
  hourlyBar: {
    width: 30,
    backgroundColor: "#3b82f6",
    borderRadius: 4,
  },
  hourlyHeight: {
    fontSize: 10,
    color: "#666",
    fontWeight: "500",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#e0e7ff",
    paddingTop: 10,
  },
  footerText: {
    fontSize: 12,
    color: "#999",
    marginVertical: 2,
  },
});
