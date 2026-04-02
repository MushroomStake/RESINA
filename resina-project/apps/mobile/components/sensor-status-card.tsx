import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

type SensorStatusCardProps = {
  stationLabel: string;
  updatedLabel: string;
  rangeLabel: string;
  alertTitle: string;
  alertBadge: string;
  alertDescription: string;
  backgroundColor: string;
  waterLevel: number | null;
};

const MAX_METER = 5;
const VISUAL_MAX_METER = 4.4;

type LevelVisual = {
  title: string;
  badge: string;
  color: string;
};

function resolveLevelVisual(level: number | null): LevelVisual {
  if (level === null) {
    return {
      title: "No Recent Data",
      badge: "No Alert",
      color: "#7e8ca5",
    };
  }

  if (level >= 4) {
    return {
      title: "Spilling Level",
      badge: "Alert Level 4",
      color: "#d94545",
    };
  }

  if (level >= 3) {
    return {
      title: "Evacuate Level",
      badge: "Alert Level 3",
      color: "#f08d2a",
    };
  }

  if (level >= 2.5) {
    return {
      title: "Critical Level",
      badge: "Alert Level 2",
      color: "#f3bf3a",
    };
  }

  return {
    title: "Normal Level",
    badge: "Alert Level 1",
    color: "#2cb47a",
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeUpdatedLabel(label: string): string {
  return label.replace(/^UPDATED:\s*/i, "");
}

export function SensorStatusCard({
  stationLabel,
  updatedLabel,
  rangeLabel,
  alertTitle,
  alertBadge,
  alertDescription,
  backgroundColor,
  waterLevel,
}: SensorStatusCardProps) {
  const safeLevel = waterLevel === null || Number.isNaN(waterLevel) ? null : clamp(waterLevel, 0, MAX_METER);
  const normalizedLevel = safeLevel === null ? 0 : clamp(safeLevel, 0, VISUAL_MAX_METER) / VISUAL_MAX_METER;
  const meterText = safeLevel === null ? "--.--m" : `${safeLevel.toFixed(2)}m`;
  const levelVisual = resolveLevelVisual(safeLevel);
  const displayTitle = safeLevel === null ? alertTitle : levelVisual.title;
  const displayBadge = safeLevel === null ? alertBadge : levelVisual.badge;
  const trendRef = useRef<number | null>(safeLevel);
  const [trendLabel, setTrendLabel] = useState<"Rising" | "Falling" | null>(null);

  const fillAnim = useRef(new Animated.Value(normalizedLevel)).current;
  const waveAnimA = useRef(new Animated.Value(0)).current;
  const waveAnimB = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const previous = trendRef.current;
    if (safeLevel !== null && previous !== null) {
      if (safeLevel > previous + 0.01) {
        setTrendLabel("Rising");
      } else if (safeLevel < previous - 0.01) {
        setTrendLabel("Falling");
      } else {
        setTrendLabel(null);
      }
    }

    trendRef.current = safeLevel;

    Animated.timing(fillAnim, {
      toValue: normalizedLevel,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fillAnim, normalizedLevel, safeLevel]);

  useEffect(() => {
    const loopA = Animated.loop(
      Animated.timing(waveAnimA, {
        toValue: 1,
        duration: 4200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const loopB = Animated.loop(
      Animated.timing(waveAnimB, {
        toValue: 1,
        duration: 5600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    loopA.start();
    loopB.start();

    return () => {
      loopA.stop();
      loopB.stop();
      waveAnimA.setValue(0);
      waveAnimB.setValue(0);
    };
  }, [waveAnimA, waveAnimB]);

  const fillHeight = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 100],
  });

  const waveTranslateA = waveAnimA.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -180],
  });

  const waveTranslateB = waveAnimB.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -220],
  });

  const wavePulse = waveAnimA.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -5, 0],
  });

  const meterMarks = useMemo(() => [4, 3, 2, 1, 0], []);

  const levelPointerBottom = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={[styles.sensorCard, { backgroundColor }]}>
      <View style={styles.sensorMetaRow}>
        <Text style={styles.sensorChip}>{stationLabel}</Text>
        <Text style={styles.sensorUpdated}>UPDATED • {normalizeUpdatedLabel(updatedLabel)}</Text>
      </View>

      <View style={styles.visualRow}>
        <View style={styles.meterWrap}>
          <View style={styles.meterPole} />
          <View style={styles.meterMarksWrap}>
            {meterMarks.map((meter) => (
              <View key={meter} style={styles.meterMarkRow}>
                <View style={styles.meterTick} />
                <Text style={styles.meterLabel}>{meter}m</Text>
              </View>
            ))}
          </View>
          <Animated.View style={[styles.levelPointer, { bottom: levelPointerBottom }]}> 
            <View style={[styles.levelPointerDot, { backgroundColor: levelVisual.color }]} />
            <Text style={styles.levelPointerText}>{safeLevel === null ? "--" : safeLevel.toFixed(2)}</Text>
          </Animated.View>
          <View style={styles.alertBandWrap}>
            <View style={[styles.alertBand, styles.alertBandSpilling]} />
            <View style={[styles.alertBand, styles.alertBandEvacuate]} />
            <View style={[styles.alertBand, styles.alertBandCritical]} />
            <View style={[styles.alertBand, styles.alertBandNormal]} />
            <View style={[styles.alertBand, styles.alertBandLow]} />
          </View>
        </View>

        <View style={styles.tankWrap}>
          <View style={styles.tankInner}>
            <Animated.View style={[styles.waterFill, { height: fillHeight.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }) }]}>
              <Animated.View style={[styles.waveLayerPrimary, { transform: [{ translateX: waveTranslateA }, { translateY: wavePulse }] }]} />
              <Animated.View style={[styles.waveLayerSecondary, { transform: [{ translateX: waveTranslateB }, { translateY: wavePulse }] }]} />
            </Animated.View>

            <View style={styles.blurOverlay}>
              <View style={styles.glassBase} />
              <View style={styles.glassGlowTop} />
              <View style={styles.glassGlowBottom} />
              <View style={styles.glassBloomCenter} />
              <View style={styles.glassSheen} />
              <View style={styles.glassNoiseRowA} />
              <View style={styles.glassNoiseRowB} />
              <View style={styles.glassNoiseRowC} />
              <View style={styles.glassNoiseRowD} />
              <View style={styles.glassVignette} />
              <Text style={styles.bigMeterText}>{meterText}</Text>
              <Text style={styles.levelTitle}>{displayTitle}</Text>
              <Text style={[styles.alertBadge, { color: levelVisual.color }]}>{displayBadge}</Text>
              {trendLabel ? <Text style={styles.trendText}>{trendLabel}</Text> : null}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.sensorDescriptionWrap}>
        <Text style={styles.sensorDescriptionLabel}>DESCRIPTION</Text>
        <Text style={styles.sensorDescriptionText}>{alertDescription}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sensorCard: {
    borderRadius: 18,
    padding: 14,
  },
  sensorMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sensorChip: {
    color: "#173b25",
    backgroundColor: "#edffef",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontWeight: "700",
    fontSize: 12,
  },
  sensorUpdated: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 10,
    opacity: 0.95,
    letterSpacing: 0.2,
  },
  visualRow: {
    flexDirection: "row",
    gap: 10,
    minHeight: 248,
  },
  meterWrap: {
    width: 108,
    borderRadius: 14,
    backgroundColor: "#ffffff12",
    borderWidth: 1,
    borderColor: "#ffffff2f",
    paddingVertical: 12,
    paddingHorizontal: 9,
    position: "relative",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  meterPole: {
    position: "absolute",
    left: 20,
    top: 10,
    bottom: 10,
    width: 4,
    borderRadius: 99,
    backgroundColor: "#f8fbff",
    opacity: 0.92,
  },
  meterMarksWrap: {
    flex: 1,
    justifyContent: "space-between",
    zIndex: 2,
  },
  meterMarkRow: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 18,
  },
  meterTick: {
    width: 14,
    height: 2,
    borderRadius: 10,
    backgroundColor: "#f6f8fb",
    marginRight: 7,
  },
  meterLabel: {
    color: "#f4f9ff",
    fontWeight: "700",
    fontSize: 10,
  },
  levelPointer: {
    position: "absolute",
    left: 18,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 3,
    marginBottom: -2,
  },
  levelPointerDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    marginRight: 5,
  },
  levelPointerText: {
    color: "#f6fbff",
    fontSize: 10,
    fontWeight: "800",
  },
  alertBandWrap: {
    position: "absolute",
    right: 8,
    top: 10,
    bottom: 10,
    width: 8,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#ffffff42",
    backgroundColor: "#ffffff14",
  },
  alertBand: {
    flex: 1,
  },
  alertBandNormal: {
    flex: 19,
    backgroundColor: "#2cb47a",
  },
  alertBandCritical: {
    flex: 8,
    backgroundColor: "#f3bf3a",
  },
  alertBandEvacuate: {
    flex: 16,
    backgroundColor: "#f08d2a",
  },
  alertBandSpilling: {
    flex: 11,
    backgroundColor: "#d94545",
  },
  alertBandLow: {
    flex: 20,
    backgroundColor: "#4b7da6",
  },
  tankWrap: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#ffffff32",
    backgroundColor: "#0a2a4f20",
  },
  tankInner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
  },
  waterFill: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#2f8cffc8",
  },
  waveLayerPrimary: {
    position: "absolute",
    left: -60,
    right: -60,
    top: -18,
    height: 30,
    borderRadius: 99,
    backgroundColor: "#8edbffe0",
  },
  waveLayerSecondary: {
    position: "absolute",
    left: -90,
    right: -90,
    top: -10,
    height: 26,
    borderRadius: 99,
    backgroundColor: "#e5f8ffa8",
  },
  blurOverlay: {
    marginHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#ffffff78",
    backgroundColor: "rgba(16,34,62,0.54)",
    paddingHorizontal: 15,
    paddingVertical: 13,
    alignItems: "center",
    minWidth: 176,
    overflow: "hidden",
  },
  glassBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  glassGlowTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 64,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  glassGlowBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 66,
    backgroundColor: "rgba(46,124,255,0.08)",
  },
  glassBloomCenter: {
    position: "absolute",
    left: 14,
    right: 14,
    top: 40,
    height: 88,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  glassSheen: {
    position: "absolute",
    top: -18,
    right: -20,
    width: 86,
    height: 150,
    backgroundColor: "rgba(255,255,255,0.10)",
    transform: [{ rotate: "18deg" }],
  },
  glassNoiseRowA: {
    position: "absolute",
    top: 18,
    left: 12,
    right: 18,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.10)",
    opacity: 0.32,
  },
  glassNoiseRowB: {
    position: "absolute",
    top: 40,
    left: 18,
    right: 28,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    opacity: 0.20,
  },
  glassNoiseRowC: {
    position: "absolute",
    top: 68,
    left: 26,
    right: 14,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    opacity: 0.24,
  },
  glassNoiseRowD: {
    position: "absolute",
    top: 104,
    left: 16,
    right: 22,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    opacity: 0.16,
  },
  glassVignette: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    backgroundColor: "rgba(6,18,36,0.18)",
  },
  bigMeterText: {
    color: "#ffffff",
    fontSize: 40,
    fontWeight: "900",
    lineHeight: 46,
    letterSpacing: 0.2,
  },
  levelTitle: {
    marginTop: 2,
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  alertBadge: {
    marginTop: 6,
    backgroundColor: "#f6fbffdc",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "700",
  },
  rangeText: {
    marginTop: 7,
    color: "#eff8ff",
    fontSize: 11,
    fontWeight: "600",
  },
  trendText: {
    marginTop: 4,
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    opacity: 0.95,
  },
  sensorDescriptionWrap: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ffffff66",
    backgroundColor: "#ffffff1f",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sensorDescriptionLabel: {
    color: "#f6fff7",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  sensorDescriptionText: {
    color: "#ffffff",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    fontWeight: "500",
  },
});
