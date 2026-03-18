import { StyleSheet, Text, View } from "react-native";

type SensorStatusCardProps = {
  stationLabel: string;
  updatedLabel: string;
  rangeLabel: string;
  alertTitle: string;
  alertBadge: string;
  alertDescription: string;
  backgroundColor: string;
};

export function SensorStatusCard({
  stationLabel,
  updatedLabel,
  rangeLabel,
  alertTitle,
  alertBadge,
  alertDescription,
  backgroundColor,
}: SensorStatusCardProps) {
  return (
    <View style={[styles.sensorCard, { backgroundColor }]}> 
      <View style={styles.sensorMetaRow}>
        <Text style={styles.sensorChip}>{stationLabel}</Text>
        <Text style={styles.sensorUpdated}>{updatedLabel}</Text>
      </View>

      <Text style={styles.sensorRange}>{rangeLabel}</Text>
      <Text style={styles.sensorLevel}>{alertTitle}</Text>
      <Text style={styles.sensorBadge}>{alertBadge}</Text>
      <View style={styles.sensorDescriptionWrap}>
        <Text style={styles.sensorDescriptionLabel}>DESKRIPSYON</Text>
        <Text style={styles.sensorDescriptionText}>{alertDescription}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sensorCard: {
    borderRadius: 14,
    padding: 14,
  },
  sensorMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sensorChip: {
    color: "#2f8d41",
    backgroundColor: "#e8f5eb",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontWeight: "700",
    fontSize: 12,
  },
  sensorUpdated: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 11,
  },
  sensorRange: {
    textAlign: "center",
    color: "#ffffff",
    fontSize: 50,
    fontWeight: "800",
    marginTop: 16,
  },
  sensorLevel: {
    textAlign: "center",
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 18,
    marginTop: 12,
  },
  sensorBadge: {
    alignSelf: "center",
    marginTop: 22,
    marginBottom: 8,
    color: "#2f8d41",
    backgroundColor: "#eef8ef",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    fontSize: 13,
    fontWeight: "700",
  },
  sensorDescriptionWrap: {
    marginTop: 10,
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
    letterSpacing: 0.6,
  },
  sensorDescriptionText: {
    color: "#ffffff",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    fontWeight: "500",
  },
});
