import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";

// Static require map — all paths are literals so the bundler can resolve them.
const WEATHER_ICONS: Record<string, ReturnType<typeof require>> = {
  "/weather/dry-season/clear sky moon.png": require("../assets/Dry Season/clear sky moon.png"),
  "/weather/dry-season/few clouds moon.png": require("../assets/Dry Season/few clouds moon.png"),
  "/weather/dry-season/mist moon.png": require("../assets/Dry Season/mist moon.png"),
  "/weather/dry-season/sunrise.png": require("../assets/Dry Season/sunrise.png"),
  "/weather/dry-season/sunset.png": require("../assets/Dry Season/sunset.png"),
  "/weather/dry-season/sun Normal.png": require("../assets/Dry Season/sun Normal.png"),
  "/weather/dry-season/sun Caution.png": require("../assets/Dry Season/sun Caution.png"),
  "/weather/dry-season/sun Extreme Caution.png": require("../assets/Dry Season/sun Extreme Caution.png"),
  "/weather/dry-season/sun Danger.png": require("../assets/Dry Season/sun Danger.png"),
  Normal: require("../assets/Dry Season/sun Normal.png"),
  Caution: require("../assets/Dry Season/sun Caution.png"),
  "Extreme Caution": require("../assets/Dry Season/sun Extreme Caution.png"),
  Danger: require("../assets/Dry Season/sun Danger.png"),
  "Extreme Danger": require("../assets/Dry Season/sun Danger.png"),
  "Light Rain": require("../assets/Wet-Season/Light Rain.png"),
  "Moderate Rain": require("../assets/Wet-Season/Moderate Rain.png"),
  "Heavy Rain": require("../assets/Wet-Season/Heavy Rain.png"),
  "Torrential Rain": require("../assets/Wet-Season/Torrential Rain.png"),
};

const STAR_DOTS = [
  { top: 18, left: 24, size: 2.2, opacity: 0.9 },
  { top: 30, left: 70, size: 1.8, opacity: 0.7 },
  { top: 20, left: 140, size: 2.6, opacity: 0.85 },
  { top: 50, left: 190, size: 1.9, opacity: 0.65 },
  { top: 72, left: 26, size: 1.7, opacity: 0.7 },
  { top: 90, left: 120, size: 2.1, opacity: 0.8 },
  { top: 118, left: 80, size: 1.6, opacity: 0.6 },
  { top: 132, left: 172, size: 2.3, opacity: 0.75 },
];

type WeatherUpdateCardProps = {
  intensityLabel: string;
  iconPath: string;
  conditionDescription: string;
  dateLabel: string;
  temperature: number;
  humidity: number;
  heatIndex: number;
  advisoryText: string;
  backgroundColor: string;
  colorCodedWarning: string;
  signalNo: string;
};

export function WeatherUpdateCard({
  intensityLabel,
  iconPath,
  conditionDescription,
  dateLabel,
  temperature,
  humidity,
  heatIndex,
  advisoryText,
  backgroundColor,
  colorCodedWarning,
  signalNo,
}: WeatherUpdateCardProps) {
  const iconSource = WEATHER_ICONS[iconPath] ?? WEATHER_ICONS[intensityLabel] ?? WEATHER_ICONS["Normal"];
  const isNightCard = iconPath.toLowerCase().includes("moon");
  const isRainyCard = intensityLabel.toLowerCase().includes("rain");
  const hasSignal = signalNo !== "No Signal";
  const hasWarning = colorCodedWarning !== "No Warning";
  const showAlertBanner = hasSignal || hasWarning;

  const iconFloat = useRef(new Animated.Value(0)).current;
  const ambientPulse = useRef(new Animated.Value(0)).current;
  const rainShift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const iconAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(iconFloat, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(iconFloat, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const ambientAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(ambientPulse, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ambientPulse, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    const rainAnim = Animated.loop(
      Animated.timing(rainShift, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    iconAnim.start();
    ambientAnim.start();
    if (isRainyCard) {
      rainAnim.start();
    }

    return () => {
      iconAnim.stop();
      ambientAnim.stop();
      rainAnim.stop();
    };
  }, [ambientPulse, iconFloat, isRainyCard, rainShift]);

  const iconTranslateY = iconFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [1, -5],
  });

  const twinkleOpacity = ambientPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1],
  });

  const dayGlowOpacity = ambientPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.16, 0.34],
  });

  const rainTranslateY = rainShift.interpolate({
    inputRange: [0, 1],
    outputRange: [-24, 24],
  });

  return (
    <>
      <View style={[styles.weatherCard, { backgroundColor }, isNightCard && styles.weatherCardNight]}>
        {isNightCard ? (
          <Animated.View pointerEvents="none" style={[styles.starField, { opacity: twinkleOpacity }]}>
            {STAR_DOTS.map((star, index) => (
              <View
                key={index}
                style={[
                  styles.starDot,
                  {
                    top: star.top,
                    left: star.left,
                    width: star.size,
                    height: star.size,
                    opacity: star.opacity,
                  },
                ]}
              />
            ))}
          </Animated.View>
        ) : (
          <Animated.View pointerEvents="none" style={[styles.dayGlowLayer, { opacity: dayGlowOpacity }]}>
            <View style={styles.dayGlowOrbPrimary} />
            <View style={styles.dayGlowOrbSecondary} />
          </Animated.View>
        )}

        {isRainyCard ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.rainLayer,
              {
                transform: [{ translateY: rainTranslateY }],
              },
            ]}
          >
            <View style={[styles.rainStreak, { left: 20, top: 16 }]} />
            <View style={[styles.rainStreak, { left: 72, top: 10 }]} />
            <View style={[styles.rainStreak, { left: 132, top: 28 }]} />
            <View style={[styles.rainStreak, { left: 186, top: 4 }]} />
            <View style={[styles.rainStreak, { left: 242, top: 20 }]} />
          </Animated.View>
        ) : null}

        <View style={styles.weatherTopRow}>
          <Text style={[styles.weatherCondition, isNightCard && styles.weatherTextNight]}>{intensityLabel.toUpperCase()}</Text>
          <Text style={[styles.weatherDate, isNightCard && styles.weatherTextNight]}>{dateLabel}</Text>
        </View>

        <View style={styles.weatherBodyRow}>
          <Text style={[styles.weatherTemp, isNightCard && styles.weatherTempNight]}>{temperature}°C</Text>
          <Animated.View style={{ transform: [{ translateY: iconTranslateY }] }}>
            <Image source={iconSource} style={styles.weatherIcon} resizeMode="contain" />
          </Animated.View>
        </View>

        <View style={styles.detailsRow}>
          {conditionDescription ? (
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, isNightCard && styles.detailLabelNight]}>CONDITION</Text>
              <Text style={[styles.detailValue, isNightCard && styles.detailValueNight]}>{conditionDescription}</Text>
            </View>
          ) : null}
          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, isNightCard && styles.detailLabelNight]}>HUMIDITY</Text>
            <Text style={[styles.detailValue, isNightCard && styles.detailValueNight]}>{humidity}%</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, isNightCard && styles.detailLabelNight]}>HEAT INDEX</Text>
            <Text style={[styles.detailValue, isNightCard && styles.detailValueNight]}>{heatIndex}°C</Text>
          </View>
        </View>
      </View>

      {showAlertBanner && (
        <View style={styles.alertBanner}>
          {hasSignal && <Text style={styles.alertItem}>⚠ {signalNo}</Text>}
          {hasWarning && <Text style={styles.alertItem}>{colorCodedWarning}</Text>}
        </View>
      )}

      <View style={styles.noticeCard}>
        <Text style={styles.noticeText}>{advisoryText}</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  weatherCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#d5d9df",
    marginTop: 12,
    overflow: "hidden",
    position: "relative",
  },
  weatherCardNight: {
    borderColor: "#22314a",
    backgroundColor: "#0f1c30",
  },
  starField: {
    ...StyleSheet.absoluteFillObject,
  },
  starDot: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "#f8fbff",
  },
  dayGlowLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  dayGlowOrbPrimary: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 999,
    backgroundColor: "#fff9d8",
    top: -40,
    right: -18,
  },
  dayGlowOrbSecondary: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 999,
    backgroundColor: "#fff3be",
    top: 52,
    left: -24,
  },
  rainLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  rainStreak: {
    position: "absolute",
    width: 2,
    height: 16,
    borderRadius: 999,
    backgroundColor: "rgba(222, 236, 255, 0.55)",
    transform: [{ rotate: "16deg" }],
  },
  weatherTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  weatherCondition: {
    color: "#2f3645",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.3,
  },
  weatherDate: {
    color: "#2f3645",
    fontWeight: "600",
    fontSize: 13,
  },
  weatherTextNight: {
    color: "#dfe9ff",
  },
  weatherBodyRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  weatherTemp: {
    fontSize: 52,
    color: "#323948",
    fontWeight: "800",
  },
  weatherTempNight: {
    color: "#f2f7ff",
  },
  weatherIcon: {
    width: 104,
    height: 104,
    opacity: 0.9,
  },
  detailsRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailItem: {
    flex: 1,
    marginRight: 8,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4a5568",
    letterSpacing: 0.4,
  },
  detailLabelNight: {
    color: "#9eb5d6",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e2635",
    marginTop: 3,
    lineHeight: 19,
    textTransform: "capitalize",
  },
  detailValueNight: {
    color: "#edf4ff",
  },
  alertBanner: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#f0b83a",
    padding: 12,
    backgroundColor: "#fdf4e3",
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  alertItem: {
    color: "#7a5a1a",
    fontSize: 15,
    fontWeight: "700",
  },
  noticeCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d1d5db",
    padding: 14,
    backgroundColor: "#f1f3f5",
    marginTop: 10,
  },
  noticeText: {
    color: "#3f4654",
    fontSize: 15,
    lineHeight: 24,
  },
});
