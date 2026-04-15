import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { useMemo } from "react";
import Svg, { Path } from "react-native-svg";

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

interface TideCardProps {
  tideStatus: TideStatus | null;
  tideExtremes: TideExtreme[];
  isLoading: boolean;
  error: string | null;
}

function formatManilaTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }

  return parsed.toLocaleTimeString("en-PH", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatManilaDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }

  return parsed.toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatRemainingUntil(value: string): string {
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) {
    return "Remaining time unavailable";
  }

  const deltaMinutes = Math.round((target - Date.now()) / 60000);
  if (deltaMinutes <= 0) {
    return "Event already passed";
  }

  const hours = Math.floor(deltaMinutes / 60);
  const minutes = deltaMinutes % 60;
  if (hours === 0) {
    return `${minutes}m remaining`;
  }

  return `${hours}h ${minutes}m remaining`;
}

function TideArrowIcon({ direction }: { direction: "up" | "down" }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d={direction === "up" ? "M12 19V5M12 5l-5 5M12 5l5 5" : "M12 5v14M12 19l-5-5M12 19l5-5"}
        stroke="#ffffff"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TideCard({ tideStatus, tideExtremes, isLoading, error }: TideCardProps) {
  const nextHigh = useMemo(() => {
    const now = Date.now();
    const highs = tideExtremes
      .filter((entry) => entry.type === "high")
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    return highs.find((entry) => new Date(entry.time).getTime() >= now) ?? highs[0] ?? null;
  }, [tideExtremes]);

  const nextLow = useMemo(() => {
    const now = Date.now();
    const lows = tideExtremes
      .filter((entry) => entry.type === "low")
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    return lows.find((entry) => new Date(entry.time).getTime() >= now) ?? lows[0] ?? null;
  }, [tideExtremes]);

  const currentTideLabel = tideStatus?.currentHeight === null || tideStatus?.currentHeight === undefined
    ? "-"
    : `${tideStatus.currentHeight.toFixed(2)}m`;
  const trendLabel = tideStatus?.state === "rising" ? "Rising" : tideStatus?.state === "falling" ? "Falling" : "Stable";
  const nextHighLabel = nextHigh ? formatManilaTime(nextHigh.time) : "N/A";
  const nextLowLabel = nextLow ? formatManilaTime(nextLow.time) : "N/A";
  const nextHighDateLabel = nextHigh ? formatManilaDate(nextHigh.time) : "N/A";
  const nextLowDateLabel = nextLow ? formatManilaDate(nextLow.time) : "N/A";
  const nextHighRemainingLabel = nextHigh ? formatRemainingUntil(nextHigh.time) : "No upcoming high tide";
  const nextLowRemainingLabel = nextLow ? formatRemainingUntil(nextLow.time) : "No upcoming low tide";
  const hasAnyData = tideStatus?.currentHeight !== null || nextHigh !== null || nextLow !== null;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingPanel}>
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#ffffff" />
            <Text style={styles.loadingText}>Fetching tide records</Text>
          </View>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorPanel}>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        </View>
      </View>
    );
  }

  if (!hasAnyData) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyText}>No tide data available yet.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.currentCard}>
        <View style={styles.currentGradientBg}>
          <View style={styles.currentIconBg}>
            <TideArrowIcon direction={tideStatus?.state === "rising" ? "up" : "down"} />
          </View>
          <View style={styles.currentContent}>
            <Text style={styles.currentLabel}>Current Tide</Text>
            <Text style={styles.currentValue}>{currentTideLabel}</Text>
            <Text style={styles.currentTrend}>{trendLabel}</Text>
          </View>
        </View>
      </View>

      <View style={styles.nextGrid}>
        <View style={styles.nextCard}>
          <View style={styles.nextIconWrapper}>
            <Image source={require("../assets/Tides/high-tide.png")} style={styles.tideImage} resizeMode="contain" />
          </View>
          <View style={styles.nextContent}>
            <Text style={styles.nextSmallText}>Next High Tide</Text>
            <Text style={styles.nextTime}>{nextHighLabel}</Text>
            <Text style={styles.nextDate}>{nextHighDateLabel}</Text>
            <Text style={styles.nextRemaining}>{nextHighRemainingLabel}</Text>
          </View>
        </View>

        <View style={styles.nextCard}>
          <View style={styles.nextIconWrapper}>
            <Image source={require("../assets/Tides/low-tide.png")} style={styles.tideImage} resizeMode="contain" />
          </View>
          <View style={styles.nextContent}>
            <Text style={styles.nextSmallText}>Next Low Tide</Text>
            <Text style={styles.nextTime}>{nextLowLabel}</Text>
            <Text style={styles.nextDate}>{nextLowDateLabel}</Text>
            <Text style={styles.nextRemaining}>{nextLowRemainingLabel}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    gap: 10,
  },
  currentCard: {
    borderRadius: 20,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#1e3a5f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  currentGradientBg: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingLeft: 16,
    paddingRight: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1e5a96",
  },
  currentIconBg: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  currentContent: {
    flex: 1,
  },
  currentLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "rgba(255, 255, 255, 0.7)",
  },
  currentValue: {
    marginTop: 6,
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "900",
    color: "#ffffff",
  },
  currentTrend: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.85)",
  },
  nextGrid: {
    marginTop: 4,
    gap: 10,
  },
  nextCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#e0e8f5",
    backgroundColor: "#ffffff",
    padding: 14,
    elevation: 2,
    shadowColor: "#1e3a5f",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  nextIconWrapper: {
    width: 62,
    height: 62,
    borderRadius: 14,
    backgroundColor: "#f0f6ff",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  tideImage: {
    width: 48,
    height: 48,
  },
  nextContent: {
    flex: 1,
    justifyContent: "center",
  },
  nextSmallText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#5d7292",
  },
  nextTime: {
    marginTop: 5,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "900",
    color: "#1e5a96",
  },
  nextDate: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "700",
    color: "#3a5077",
  },
  nextRemaining: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: "#7a8fa8",
  },
  loadingPanel: {
    borderRadius: 20,
    backgroundColor: "#1e5a96",
    paddingVertical: 20,
    paddingHorizontal: 16,
    elevation: 4,
    shadowColor: "#1e3a5f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  errorPanel: {
    borderRadius: 20,
    backgroundColor: "#fee2e2",
    paddingVertical: 16,
    paddingHorizontal: 14,
    elevation: 4,
    shadowColor: "#7f1d1d",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  errorBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fca5a5",
    backgroundColor: "#fef2f2",
    padding: 12,
  },
  errorText: {
    color: "#991b1b",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyPanel: {
    borderRadius: 20,
    backgroundColor: "#f0f6ff",
    paddingVertical: 16,
    paddingHorizontal: 14,
    elevation: 2,
    shadowColor: "#1e3a5f",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  emptyText: {
    color: "#5d7292",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
});
