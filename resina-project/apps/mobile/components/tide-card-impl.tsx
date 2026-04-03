import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";

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

function splitClockMeridiem(label: string): { clock: string; meridiem: string } {
  const matched = label.match(/^(.+)\s(AM|PM)$/i);
  if (!matched) {
    return { clock: label, meridiem: "" };
  }

  return {
    clock: matched[1],
    meridiem: matched[2].toUpperCase(),
  };
}

function formatTodayManila(): string {
  return new Date().toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function getManilaDateKey(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return "";
  }

  return `${year}-${month}-${day}`;
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

function toManilaHourFraction(value: string): number | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(parsed);

  const hourRaw = parts.find((part) => part.type === "hour")?.value;
  const minuteRaw = parts.find((part) => part.type === "minute")?.value;
  const hour = Number.parseInt(hourRaw ?? "", 10);
  const minute = Number.parseInt(minuteRaw ?? "", 10);

  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  return hour + minute / 60;
}

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (!points.length) {
    return "";
  }

  if (points.length === 1) {
    return `M${points[0].x},${points[0].y}`;
  }

  let d = `M${points[0].x},${points[0].y}`;
  const tension = 0.12;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  return d;
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

function getResponsiveChartWidth(windowWidth: number): number {
  if (windowWidth >= 1024) {
    return 1260;
  }

  if (windowWidth >= 640) {
    return 1120;
  }

  return 920;
}

export function TideCard({ tideStatus, tideExtremes, hourlyTides, isLoading, error }: TideCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const { width: windowWidth } = useWindowDimensions();
  const manilaNowHour = getManilaHourNow();
  const todayLabel = formatTodayManila();
  const nowMs = Date.now();
  const responsiveChartWidth = getResponsiveChartWidth(windowWidth);

  const nextHigh = useMemo(() => findNextByType(tideExtremes, "high"), [tideExtremes]);
  const nextLow = useMemo(() => findNextByType(tideExtremes, "low"), [tideExtremes]);

  const sortedExtremes = useMemo(
    () => [...tideExtremes].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()),
    [tideExtremes],
  );

  const lastExtreme = useMemo(
    () => [...sortedExtremes].reverse().find((entry) => new Date(entry.time).getTime() <= nowMs) ?? null,
    [sortedExtremes, nowMs],
  );

  const nextExtreme = useMemo(
    () => sortedExtremes.find((entry) => new Date(entry.time).getTime() > nowMs) ?? (tideStatus?.nextExtreme ?? null),
    [sortedExtremes, nowMs, tideStatus?.nextExtreme],
  );

  const chart = useMemo(() => {
    if (!hourlyTides.length) {
      return {
        points: [] as ChartPoint[],
        curvePoints: [] as Array<{ x: number; y: number }>,
        linePath: "",
        fillPath: "",
        yTicks: [] as Array<{ value: number; y: number }>,
        currentX: 0,
        lowestPoint: null as null | ChartPoint,
        highestPoint: null as null | ChartPoint,
        nextHighPoint: null as null | { x: number; y: number },
        nextLowPoint: null as null | { x: number; y: number },
        chartWidth: responsiveChartWidth,
        chartHeight: 236,
        baseline: 198,
      };
    }

    const byHour = new Map<number, TideHourly>();
    for (const entry of hourlyTides) {
      byHour.set(entry.hour, entry);
    }

    const hours = Array.from({ length: 24 }, (_, hour) => hour);
    const values = Array.from(byHour.values()).map((entry) => entry.estimatedHeight);
    const lowest = Math.min(...values);
    const highest = Math.max(...values);

    const chartWidth = responsiveChartWidth;
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

    const anchorPoints: Array<{ x: number; y: number; key: string }> = [];

    if (nextHigh) {
      const hourFraction = toManilaHourFraction(nextHigh.time);
      if (hourFraction !== null) {
        const x = leftPad + (Math.max(0, Math.min(23, hourFraction)) / 23) * usableWidth;
        const normalized = (nextHigh.height - lowest) / range;
        const y = topPad + (1 - normalized) * usableHeight;
        anchorPoints.push({ x, y, key: `high-${nextHigh.time}` });
      }
    }

    if (nextLow) {
      const hourFraction = toManilaHourFraction(nextLow.time);
      if (hourFraction !== null) {
        const x = leftPad + (Math.max(0, Math.min(23, hourFraction)) / 23) * usableWidth;
        const normalized = (nextLow.height - lowest) / range;
        const y = topPad + (1 - normalized) * usableHeight;
        anchorPoints.push({ x, y, key: `low-${nextLow.time}` });
      }
    }

    const curvePoints = [
      ...points.map((point) => ({ x: point.x, y: point.y, anchor: false as const })),
      ...anchorPoints.map((point) => ({ x: point.x, y: point.y, anchor: true as const })),
    ]
      .sort((a, b) => a.x - b.x)
      .reduce<Array<{ x: number; y: number; anchor: boolean }>>((acc, point) => {
        if (!acc.length) {
          acc.push(point);
          return acc;
        }

        const last = acc[acc.length - 1];
        if (Math.abs(last.x - point.x) < 0.35) {
          if (point.anchor) {
            acc[acc.length - 1] = point;
          }
          return acc;
        }

        acc.push(point);
        return acc;
      }, []);

    const linePath = buildSmoothPath(curvePoints);
    const fillPath = curvePoints.length
      ? `${linePath} L ${curvePoints[curvePoints.length - 1].x},${chartHeight - bottomPad} L ${curvePoints[0].x},${chartHeight - bottomPad} Z`
      : "";

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

    const nextHighPoint = anchorPoints.find((point) => point.key.startsWith("high-")) ?? null;
    const nextLowPoint = anchorPoints.find((point) => point.key.startsWith("low-")) ?? null;

    return {
      points,
      curvePoints,
      linePath,
      fillPath,
      yTicks,
      currentX,
      lowestPoint,
      highestPoint,
      nextHighPoint,
      nextLowPoint,
      chartWidth,
      chartHeight,
      baseline: chartHeight - bottomPad,
    };
  }, [hourlyTides, manilaNowHour, nextHigh, nextLow, responsiveChartWidth]);

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

  const nextHighParts = splitClockMeridiem(nextHighLabel);
  const nextLowParts = splitClockMeridiem(nextLowLabel);

  const currentTideLabel = tideStatus?.currentHeight === null || tideStatus?.currentHeight === undefined
    ? "-"
    : `${tideStatus.currentHeight.toFixed(2)}m`;
  const trendLabel = tideStatus?.state === "rising" ? "Rising" : "Falling";

  const lastSummary = lastExtreme
    ? `${lastExtreme.type === "high" ? "High" : "Low"} tide ${lastExtreme.height.toFixed(2)}m`
    : "No previous event";
  const lastTimeLabel = lastExtreme ? formatDateTimeLabel(lastExtreme.time) : "No previous event";

  const nextSummary = nextExtreme
    ? `${nextExtreme.type === "high" ? "High" : "Low"} tide next`
    : "No upcoming event";
  const nextTimeLabel = nextExtreme ? formatDateTimeLabel(nextExtreme.time) : "No upcoming event";

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

  // Build compact label boxes and keep them away from marker dots/edges.
  const lowMarker = chart.nextLowPoint ?? chart.lowestPoint;
  const highMarker = chart.nextHighPoint ?? chart.highestPoint;
  const buildMarkerLabelBox = (marker: { x: number; y: number } | null, text: string, preferAbove: boolean) => {
    if (!marker) {
      return null;
    }

    const labelWidth = Math.max(78, 10 + text.length * 6.4);
    const labelHeight = 20;
    const anchorToRight = marker.x < chart.chartWidth * 0.62;
    const xBase = anchorToRight ? marker.x + 10 : marker.x - labelWidth - 10;
    const yBase = preferAbove ? marker.y - labelHeight - 10 : marker.y + 10;

    const x = Math.max(48, Math.min(chart.chartWidth - labelWidth - 6, xBase));
    const y = Math.max(6, Math.min(chart.chartHeight - labelHeight - 6, yBase));

    return { x, y, width: labelWidth, height: labelHeight };
  };

  const lowLabelText = `Low ${nextLowLabel}`;
  const highLabelText = `High ${nextHighLabel}`;
  const lowLabelBox = buildMarkerLabelBox(lowMarker, lowLabelText, false);
  const highLabelBox = buildMarkerLabelBox(highMarker, highLabelText, true);

  useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 240,
      useNativeDriver: false,
    }).start();
  }, [expandAnim, isExpanded]);

  const toggleExpanded = () => {
    setIsExpanded((prev) => !prev);
  };

  const expandedPointerEvents: "auto" | "none" = isExpanded ? "auto" : "none";

  const expandedContainerStyle = {
    maxHeight: expandAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1400],
    }),
    opacity: expandAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
    transform: [
      {
        translateY: expandAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-6, 0],
        }),
      },
    ],
  };

  const chevronAnimatedStyle = {
    transform: [
      {
        rotate: expandAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ["0deg", "180deg"],
        }),
      },
    ],
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.headerPressable} onPress={toggleExpanded}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Hourly Tide Flow</Text>
          <View style={styles.headerRightGroup}>
            <Text style={styles.datePill}>{todayLabel}</Text>
            <View style={styles.dropdownBadge}>
              <Animated.Text style={[styles.headerChevron, chevronAnimatedStyle]}>⌄</Animated.Text>
            </View>
          </View>
        </View>
      </Pressable>

      <View style={[styles.summaryCard, styles.summaryCardPrimary]}>
        <Text style={styles.summaryLabel}>Current Tide</Text>
        <Text style={styles.summaryValue}>{currentTideLabel}</Text>
        <Text style={styles.summaryMeta}>{trendLabel}</Text>
      </View>

      <Animated.View style={[styles.expandableSection, expandedContainerStyle, { pointerEvents: expandedPointerEvents }]}>
        <Text style={styles.headerSubtitle}>Wave-style one-day view with hourly levels (0-23), current time line, and high/low markers.</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryPairRow}>
            <View style={styles.summaryHalfCard}>
              <Text style={styles.summaryLabel}>Last Tide</Text>
              <Text style={styles.summaryTitle}>{lastSummary}</Text>
              <Text style={styles.summaryMeta}>{lastTimeLabel}</Text>
            </View>

            <View style={styles.summaryHalfCard}>
              <Text style={styles.summaryLabel}>Next Tide</Text>
              <Text style={styles.summaryTitle}>{nextSummary}</Text>
              <Text style={styles.summaryMeta}>{nextTimeLabel}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tideCardRow}>
          <View style={styles.tideMomentCard}>
            <Image source={require("../assets/Tides/high-tide.png")} style={styles.tideMomentImage} resizeMode="contain" />
            <View style={styles.tideMomentTextBlock}>
              <Text style={styles.tideMomentTitle} numberOfLines={2}>
                Next high tide is at
              </Text>
              <View style={styles.tideMomentTimeRow}>
                <Text style={styles.tideMomentClock} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                  {nextHighParts.clock}
                </Text>
                {nextHighParts.meridiem ? <Text style={styles.tideMomentMeridiem}>{nextHighParts.meridiem}</Text> : null}
              </View>
            </View>
          </View>
          <View style={styles.tideMomentCard}>
            <Image source={require("../assets/Tides/low-tide.png")} style={styles.tideMomentImage} resizeMode="contain" />
            <View style={styles.tideMomentTextBlock}>
              <Text style={styles.tideMomentTitle} numberOfLines={2}>
                Next low tide is at
              </Text>
              <View style={styles.tideMomentTimeRow}>
                <Text style={styles.tideMomentClock} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                  {nextLowParts.clock}
                </Text>
                {nextLowParts.meridiem ? <Text style={styles.tideMomentMeridiem}>{nextLowParts.meridiem}</Text> : null}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.chartShell}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={[styles.chartFrame, { width: chart.chartWidth }]}>
              <View style={[styles.chartCanvas, { height: chart.chartHeight }]}>
                <Svg width={chart.chartWidth} height={chart.chartHeight}>
                <Defs>
                  <LinearGradient id="mobileTideAreaGradient" x1="0" x2="0" y1="0" y2="1">
                    <Stop offset="0%" stopColor="#60a5fa" stopOpacity="0.35" />
                    <Stop offset="100%" stopColor="#60a5fa" stopOpacity="0.03" />
                  </LinearGradient>
                  <LinearGradient id="mobileTideLineGradient" x1="0" x2="1" y1="0" y2="0">
                    <Stop offset="0%" stopColor="#2563eb" />
                    <Stop offset="100%" stopColor="#1d4ed8" />
                  </LinearGradient>
                </Defs>

                {Array.from({ length: 4 }, (_, idx) => (
                  <Rect
                    key={`band-${idx}`}
                    x={46 + idx * ((chart.chartWidth - 64) / 4)}
                    y={0}
                    width={(chart.chartWidth - 64) / 4}
                    height={chart.chartHeight}
                    fill={idx % 2 === 0 ? "rgba(56, 89, 136, 0.07)" : "rgba(56, 89, 136, 0.12)"}
                  />
                ))}

                {chart.yTicks.map((tick, index) => (
                  <G key={`ytick-${index}`}>
                    <Line x1={46} y1={tick.y} x2={chart.chartWidth} y2={tick.y} stroke="#d2e0f2" strokeWidth={1} />
                    <SvgText x={4} y={tick.y + 4} fontSize={10} fill="#5b7394" fontWeight="600">
                      {tick.value.toFixed(2)}
                    </SvgText>
                  </G>
                ))}

                <Rect x={chart.chartWidth - 118} y={8} rx={999} ry={999} width={108} height={22} fill="rgba(255,255,255,0.95)" stroke="#d8e4f8" />
                <SvgText x={chart.chartWidth - 64} y={23} textAnchor="middle" fontSize={10} fill="#27518f" fontWeight="700">
                  {todayLabel}
                </SvgText>

                <Path d={chart.fillPath} fill="url(#mobileTideAreaGradient)" />
                <Path d={chart.linePath} fill="none" stroke="url(#mobileTideLineGradient)" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />

                <Line x1={chart.currentX} y1={0} x2={chart.currentX} y2={chart.baseline + 18} stroke="#ef4444" strokeWidth={1} />

                {lowMarker ? <Circle cx={lowMarker.x} cy={lowMarker.y} r={5.5} fill="#ef4444" /> : null}
                {highMarker ? <Circle cx={highMarker.x} cy={highMarker.y} r={5.5} fill="#1d4ed8" /> : null}

                {lowLabelBox ? (
                  <G>
                    <Rect
                      x={lowLabelBox.x}
                      y={lowLabelBox.y}
                      width={lowLabelBox.width}
                      height={lowLabelBox.height}
                      rx={7}
                      ry={7}
                      fill="rgba(255,255,255,0.96)"
                      stroke="#fecaca"
                    />
                    <SvgText x={lowLabelBox.x + 7} y={lowLabelBox.y + 13} fontSize={11} fill="#b91c1c" fontWeight="700">
                      {lowLabelText}
                    </SvgText>
                  </G>
                ) : null}

                {highLabelBox ? (
                  <G>
                    <Rect
                      x={highLabelBox.x}
                      y={highLabelBox.y}
                      width={highLabelBox.width}
                      height={highLabelBox.height}
                      rx={7}
                      ry={7}
                      fill="rgba(255,255,255,0.96)"
                      stroke="#bfdbfe"
                    />
                    <SvgText x={highLabelBox.x + 7} y={highLabelBox.y + 13} fontSize={11} fill="#1d4ed8" fontWeight="700">
                      {highLabelText}
                    </SvgText>
                  </G>
                ) : null}

                {chart.points.map((point) => (
                  <SvgText
                    key={`hour-${point.hour}`}
                    x={point.x}
                    y={chart.chartHeight - 10}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#4b617b"
                    fontWeight="600"
                  >
                    {point.hour}
                  </SvgText>
                ))}
                </Svg>
              </View>
            </View>
          </ScrollView>
        </View>
      </Animated.View>
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
  headerPressable: {
    borderRadius: 10,
  },
  headerRightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dropdownBadge: {
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dbeafe",
    borderWidth: 1,
    borderColor: "#93c5fd",
  },
  headerChevron: {
    color: "#1d4ed8",
    fontSize: 14,
    fontWeight: "800",
    width: 16,
    textAlign: "center",
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
    marginTop: 10,
    fontSize: 12,
    color: "#5f7391",
    lineHeight: 18,
  },
  expandableSection: {
    overflow: "hidden",
  },
  summaryGrid: {
    marginTop: 12,
    gap: 10,
  },
  summaryPairRow: {
    flexDirection: "row",
    gap: 10,
  },
  summaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dce6f4",
    backgroundColor: "#f6f9ff",
    padding: 12,
  },
  summaryHalfCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dce6f4",
    backgroundColor: "#f6f9ff",
    padding: 12,
    minHeight: 104,
  },
  summaryCardPrimary: {
    backgroundColor: "#eef5ff",
  },
  summaryLabel: {
    fontSize: 11,
    color: "#5d7292",
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  summaryValue: {
    marginTop: 4,
    fontSize: 30,
    fontWeight: "900",
    color: "#12335e",
    lineHeight: 34,
  },
  summaryTitle: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: "800",
    color: "#1f3b61",
  },
  summaryMeta: {
    marginTop: 2,
    fontSize: 12,
    color: "#5f7898",
    fontWeight: "600",
  },
  tideCardRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  tideMomentCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dce6f4",
    backgroundColor: "#ffffff",
    padding: 10,
  },
  tideMomentImage: {
    width: 42,
    height: 42,
  },
  tideMomentTextBlock: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  tideMomentTitle: {
    fontSize: 11,
    lineHeight: 14,
    color: "#2a405f",
    fontWeight: "600",
  },
  tideMomentTimeRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  tideMomentClock: {
    fontSize: 24,
    lineHeight: 26,
    fontWeight: "900",
    color: "#1e63a8",
  },
  tideMomentMeridiem: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "800",
    color: "#1e63a8",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  tideMomentTime: {
    marginTop: 2,
    fontSize: 26,
    lineHeight: 28,
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
  graphDateBadge: {
    position: "absolute",
    top: 8,
    right: 10,
    zIndex: 10,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderWidth: 1,
    borderColor: "#d8e4f8",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  graphDateText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#27518f",
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
