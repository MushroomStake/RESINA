import { StyleSheet, Text, View } from "react-native";
import { SensorStatusCard } from "./sensor-status-card";

export type HomeHeroSectionProps = {
  title: string;
  subtitle?: string | null;
  stationLabel: string;
  updatedLabel: string;
  rangeLabel: string;
  alertTitle: string;
  alertBadge: string;
  alertDescription: string;
  backgroundColor: string;
  waterLevel: number | null;
  textVariant?: "light" | "dark";
};

export function HomeHeroSection({
  title,
  subtitle,
  stationLabel,
  updatedLabel,
  rangeLabel,
  alertTitle,
  alertBadge,
  alertDescription,
  backgroundColor,
  waterLevel,
  textVariant = "dark",
}: HomeHeroSectionProps) {
  const isLightText = textVariant === "light";

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, isLightText ? styles.titleLight : null]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, isLightText ? styles.subtitleLight : null]}>{subtitle}</Text> : null}
      </View>

      <SensorStatusCard
        stationLabel={stationLabel}
        updatedLabel={updatedLabel}
        rangeLabel={rangeLabel}
        alertTitle={alertTitle}
        alertBadge={alertBadge}
        alertDescription={alertDescription}
        backgroundColor={backgroundColor}
        waterLevel={waterLevel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 2,
  },
  headerRow: {
    marginBottom: 8,
  },
  title: {
    color: "#203759",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  titleLight: {
    color: "#f4f8ff",
    textShadowColor: "rgba(4, 12, 28, 0.28)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    marginTop: 3,
    color: "#60748f",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  subtitleLight: {
    color: "#c9d8ef",
  },
});
