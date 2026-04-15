import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

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
const LABEL_MAX_METER = 4;
const NORMAL_MIN = 1.5;
const CRITICAL_MIN = 2.5;
const EVACUATION_MIN = 3.0;
const SPILLING_MIN = 4.0;

const BAND_FLEX = {
  low: Math.max(1, Math.round(NORMAL_MIN * 100)),
  normal: Math.max(1, Math.round((CRITICAL_MIN - NORMAL_MIN) * 100)),
  critical: Math.max(1, Math.round((EVACUATION_MIN - CRITICAL_MIN) * 100)),
  evacuation: Math.max(1, Math.round((SPILLING_MIN - EVACUATION_MIN) * 100)),
  spilling: Math.max(1, Math.round((VISUAL_MAX_METER - SPILLING_MIN) * 100)),
};

type WaterNoiseSpeckle = {
  left: string;
  top: string;
  size: number;
  opacity: number;
};

const WATER_NOISE_SPECKLES: WaterNoiseSpeckle[] = Array.from({ length: 18 }, (_, index) => ({
  left: `${(index * 37) % 100}%`,
  top: `${(index * 29) % 74}%`,
  size: index % 3 === 0 ? 3 : 2,
  opacity: index % 4 === 0 ? 0.16 : index % 2 === 0 ? 0.12 : 0.08,
}));

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

  if (level >= SPILLING_MIN) {
    return {
      title: "Spilling Level",
      badge: "Alert Level 4",
      color: "#d94545",
    };
  }

  if (level >= EVACUATION_MIN) {
    return {
      title: "Evacuate Level",
      badge: "Alert Level 3",
      color: "#f08d2a",
    };
  }

  if (level >= CRITICAL_MIN) {
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

function resolveSensorGradientColors(level: number | null, fallbackColor: string): readonly [string, string, string] {
  if (level === null) {
    return [fallbackColor, fallbackColor, fallbackColor];
  }

  if (level >= SPILLING_MIN) {
    return ["#A82A2A", "#8f2323", "#6f1f1f"];
  }

  if (level >= EVACUATION_MIN) {
    return ["#FF7E1C", "#e96d1b", "#c9581b"];
  }

  if (level >= CRITICAL_MIN) {
    return ["#F7C520", "#e3b31d", "#c79a12"];
  }

  return ["#4CAF50", "#3f9d57", "#2f8a5f"];
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
  const sensorGradientColors = resolveSensorGradientColors(safeLevel, backgroundColor);
  const displayTitle = safeLevel === null ? alertTitle : levelVisual.title;
  const displayBadge = safeLevel === null ? alertBadge : levelVisual.badge;
  const trendRef = useRef<number | null>(safeLevel);
  const [trendLabel, setTrendLabel] = useState<"Rising" | "Falling" | null>(null);

  const fillAnim = useRef(new Animated.Value(normalizedLevel)).current;
  const waveAnimA = useRef(new Animated.Value(0)).current;
  const waveAnimB = useRef(new Animated.Value(0)).current;
  const waveAnimC = useRef(new Animated.Value(0)).current;

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
        duration: 6800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const loopB = Animated.loop(
      Animated.timing(waveAnimB, {
        toValue: 1,
        duration: 8600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const loopC = Animated.loop(
      Animated.timing(waveAnimC, {
        toValue: 1,
        duration: 10400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    loopA.start();
    loopB.start();
    loopC.start();

    return () => {
      loopA.stop();
      loopB.stop();
      loopC.stop();
      waveAnimA.setValue(0);
      waveAnimB.setValue(0);
      waveAnimC.setValue(0);
    };
  }, [waveAnimA, waveAnimB, waveAnimC]);

  const fillHeight = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 100],
  });

  const waveTranslateA = waveAnimA.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -110],
  });

  const waveTranslateB = waveAnimB.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -130],
  });

  const waveLiftA = waveAnimA.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -1.5, 0],
  });

  const waveLiftB = waveAnimB.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -1, 0],
  });

  const shimmerDrift = waveAnimB.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -28],
  });

  const shimmerPulse = waveAnimA.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.11, 0.17, 0.11],
  });

  const shimmerSweep = waveAnimC.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -44],
  });

  const shimmerGlow = waveAnimC.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.05, 0.12, 0.05],
  });

  const meterMarks = useMemo(() => [4, 3, 2, 1, 0], []);

  const labelScaleRatio = LABEL_MAX_METER / VISUAL_MAX_METER;
  const levelPointerBottom = fillAnim.interpolate({
    inputRange: [0, labelScaleRatio, 1],
    outputRange: ["10%", "90%", "90%"],
  });

  return (
    <LinearGradient colors={sensorGradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sensorCard}>
      <View style={styles.cardBackdropA} />
      <View style={styles.cardBackdropB} />
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
          <Animated.View style={[styles.levelPointerDotWrap, { bottom: levelPointerBottom }]}>
            <View style={[styles.levelPointerDot, { backgroundColor: levelVisual.color }]} />
          </Animated.View>
          <Animated.Text style={[styles.levelPointerValue, { bottom: levelPointerBottom }]}>
            {safeLevel === null ? "--" : safeLevel.toFixed(2)}
          </Animated.Text>
          <View style={styles.alertBandWrap}>
            <View style={[styles.alertBand, styles.alertBandSpilling, { flex: BAND_FLEX.spilling }]} />
            <View style={[styles.alertBand, styles.alertBandEvacuate, { flex: BAND_FLEX.evacuation }]} />
            <View style={[styles.alertBand, styles.alertBandCritical, { flex: BAND_FLEX.critical }]} />
            <View style={[styles.alertBand, styles.alertBandNormal, { flex: BAND_FLEX.normal }]} />
            <View style={[styles.alertBand, styles.alertBandLow, { flex: BAND_FLEX.low }]} />
          </View>
        </View>

        <View style={styles.tankWrap}>
          <View style={styles.tankInner}>
            <Animated.View style={[styles.waterFill, { height: fillHeight.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }) }]}>
              <Animated.View style={[styles.waveLayerPrimary, { transform: [{ translateX: waveTranslateA }, { translateY: waveLiftA }] }]}>
                <View style={styles.waveRibbonPrimary} />
                <View style={styles.waveRibbonHighlightPrimary} />
              </Animated.View>
              <Animated.View style={[styles.waveLayerSecondary, { transform: [{ translateX: waveTranslateB }, { translateY: waveLiftB }] }]}>
                <View style={styles.waveRibbonSecondary} />
                <View style={styles.waveRibbonHighlightSecondary} />
              </Animated.View>
              <Animated.View style={[styles.waterNoiseLayer, { opacity: shimmerPulse, transform: [{ translateX: shimmerDrift }] }]}> 
                <LinearGradient
                  colors={["rgba(255,255,255,0.20)", "rgba(255,255,255,0.03)", "rgba(255,255,255,0.16)"]}
                  start={{ x: 0, y: 0.1 }}
                  end={{ x: 1, y: 0.9 }}
                  style={styles.waterNoiseSheenA}
                />
                <LinearGradient
                  colors={["rgba(255,255,255,0.00)", "rgba(220,242,255,0.20)", "rgba(255,255,255,0.00)"]}
                  start={{ x: 0, y: 0.4 }}
                  end={{ x: 1, y: 0.6 }}
                  style={styles.waterNoiseSheenB}
                />
                <Animated.View style={[styles.waterNoiseSweep, { opacity: shimmerGlow, transform: [{ translateX: shimmerSweep }] }]} />
                {WATER_NOISE_SPECKLES.map((speckle, index) => (
                  <View
                    key={`water-speckle-${index}`}
                    style={[
                      styles.waterNoiseSpeckle,
                      {
                        left: speckle.left,
                        top: speckle.top,
                        width: speckle.size,
                        height: speckle.size,
                        opacity: speckle.opacity,
                      },
                    ]}
                  />
                ))}
              </Animated.View>
            </Animated.View>

            <View style={styles.blurOverlay}>
              <BlurView intensity={36} tint="light" style={styles.glassBlurLayer} />
              <View style={styles.glassBase} />
              <View style={styles.glassGlowTop} />
              <View style={styles.glassGlowBottom} />
              <View style={styles.glassBloomCenter} />
              <View style={styles.glassVignette} />
              <View style={styles.glassEdgeMask} />
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  sensorCard: {
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    overflow: "hidden",
    position: "relative",
    minHeight: 214,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  cardBackdropA: {
    position: "absolute",
    top: -34,
    right: -18,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  cardBackdropB: {
    position: "absolute",
    left: -26,
    bottom: -28,
    width: 130,
    height: 130,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)",
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
    minHeight: 208,
    marginTop: 2,
  },
  meterWrap: {
    width: 114,
    borderRadius: 18,
    backgroundColor: "#ffffff12",
    borderWidth: 1,
    borderColor: "#ffffff2f",
    paddingVertical: 14,
    paddingHorizontal: 10,
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
  levelPointerDotWrap: {
    position: "absolute",
    left: 18,
    zIndex: 3,
  },
  levelPointerDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
  },
  levelPointerValue: {
    position: "absolute",
    left: 30,
    marginBottom: -2,
    color: "#f6fbff",
    fontSize: 10,
    fontWeight: "800",
    zIndex: 3,
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
    backgroundColor: "#2cb47a",
  },
  alertBandCritical: {
    backgroundColor: "#f3bf3a",
  },
  alertBandEvacuate: {
    backgroundColor: "#f08d2a",
  },
  alertBandSpilling: {
    backgroundColor: "#d94545",
  },
  alertBandLow: {
    backgroundColor: "#4b7da6",
  },
  tankWrap: {
    flex: 1,
    borderRadius: 20,
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
    left: "-70%",
    width: "260%",
    top: -17,
    height: 28,
    justifyContent: "flex-end",
  },
  waveLayerSecondary: {
    position: "absolute",
    left: "-72%",
    width: "260%",
    top: -10,
    height: 22,
    justifyContent: "flex-end",
  },
  waveRibbonPrimary: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 16,
    borderRadius: 999,
    backgroundColor: "rgba(150,221,255,0.58)",
  },
  waveRibbonHighlightPrimary: {
    position: "absolute",
    left: "8%",
    right: "8%",
    bottom: 9,
    height: 4,
    borderRadius: 99,
    backgroundColor: "rgba(232,247,255,0.46)",
  },
  waveRibbonSecondary: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 12,
    borderRadius: 999,
    backgroundColor: "rgba(193,234,255,0.36)",
  },
  waveRibbonHighlightSecondary: {
    position: "absolute",
    left: "14%",
    right: "14%",
    bottom: 7,
    height: 3,
    borderRadius: 99,
    backgroundColor: "rgba(242,251,255,0.34)",
  },
  waterNoiseLayer: {
    position: "absolute",
    left: "-25%",
    width: "170%",
    top: 0,
    bottom: 0,
  },
  waterNoiseSheenA: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  waterNoiseSheenB: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "15%",
    bottom: "20%",
  },
  waterNoiseSpeckle: {
    position: "absolute",
    borderRadius: 99,
    backgroundColor: "#f2fbff",
  },
  waterNoiseSweep: {
    position: "absolute",
    left: "-18%",
    right: "-18%",
    top: "38%",
    height: 18,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  blurOverlay: {
    position: "absolute",
    top: 14,
    alignSelf: "center",
    width: "84%",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.40)",
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    overflow: "hidden",
  },
  glassBlurLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
  },
  glassBase: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  glassGlowTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 56,
    backgroundColor: "rgba(255,255,255,0.11)",
  },
  glassGlowBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 58,
    backgroundColor: "rgba(46,124,255,0.07)",
  },
  glassBloomCenter: {
    position: "absolute",
    left: 14,
    right: 14,
    top: 34,
    height: 74,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  glassVignette: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    backgroundColor: "rgba(6,18,36,0.10)",
  },
  glassEdgeMask: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  bigMeterText: {
    color: "#ffffff",
    fontSize: 42,
    fontWeight: "900",
    lineHeight: 48,
    letterSpacing: 0.2,
  },
  levelTitle: {
    marginTop: 2,
    color: "#ffffff",
    fontSize: 17,
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
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ffffff66",
    backgroundColor: "#ffffff1f",
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    lineHeight: 17,
    marginTop: 4,
    fontWeight: "500",
  },
});
