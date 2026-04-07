import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
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
  const hasAnyData = tideStatus?.currentHeight !== null || nextHigh !== null || nextLow !== null;

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

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.heroPanel}>
          <Text style={styles.kicker}>Tide Monitor</Text>
          <Text style={styles.heroTitle}>Sta. Rita Bridge tide outlook</Text>
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
        <View style={styles.heroPanel}>
          <Text style={styles.kicker}>Tide Monitor</Text>
          <Text style={styles.heroTitle}>Sta. Rita Bridge tide outlook</Text>
          <Text style={styles.heroSubtitle}>No tide data available yet.</Text>
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
          <Text style={styles.heroSubtitle}>Current tide level and upcoming high/low tide schedule.</Text>
        </View>
      </View>

      <View style={styles.currentCard}>
        <Text style={styles.currentLabel}>Current Tide</Text>
        <Text style={styles.currentValue}>{currentTideLabel}</Text>
        <Text style={styles.currentTrend}>{trendLabel}</Text>
      </View>

      <View style={styles.nextGrid}>
        <View style={styles.nextCard}>
          <Image source={require("../assets/Tides/high-tide.png")} style={styles.tideImage} resizeMode="contain" />
          <View style={styles.nextTextWrap}>
            <Text style={styles.nextTitle}>Next high tide is at</Text>
            <Text style={styles.nextTime}>{nextHighLabel}</Text>
          </View>
        </View>

        <View style={styles.nextCard}>
          <Image source={require("../assets/Tides/low-tide.png")} style={styles.tideImage} resizeMode="contain" />
          <View style={styles.nextTextWrap}>
            <Text style={styles.nextTitle}>Next low tide is at</Text>
            <Text style={styles.nextTime}>{nextLowLabel}</Text>
          </View>
        </View>
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
  heroPanel: {
    borderRadius: 24,
    backgroundColor: "#0d2c52",
    padding: 16,
    overflow: "hidden",
  },
  currentCard: {
    borderRadius: 20,
    backgroundColor: "#eef5ff",
    padding: 16,
  },
  currentLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#5d7292",
  },
  currentValue: {
    marginTop: 8,
    fontSize: 38,
    lineHeight: 42,
    fontWeight: "900",
    color: "#12335e",
  },
  currentTrend: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
    color: "#2d5fa3",
  },
  nextGrid: {
    marginTop: 12,
    gap: 10,
  },
  nextCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dbe5f3",
    backgroundColor: "rgba(255,255,255,0.92)",
    padding: 14,
  },
  tideImage: {
    width: 60,
    height: 60,
  },
  nextTextWrap: {
    flex: 1,
    alignItems: "flex-end",
  },
  nextTitle: {
    fontSize: 18,
    lineHeight: 22,
    color: "#1f3657",
  },
  nextTime: {
    marginTop: 6,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
    color: "#1e63a8",
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
