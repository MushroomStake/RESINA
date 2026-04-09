import { StyleSheet, View } from "react-native";
import { WeatherUpdateCard } from "./weather-update-card";
import { SectionSyncBadge, type SectionSyncBadgeVariant } from "./mobile-section-header";

export type WeatherSectionProps = {
  intensityLabel: string;
  iconPath: string;
  conditionDescription: string;
  dateLabel: string;
  temperature: number;
  humidity: number;
  heatIndex: number;
  signalNo: string;
  advisoryText: string;
  backgroundColor: string;
  statusLabel?: string | null;
  statusVariant?: SectionSyncBadgeVariant;
};

export function WeatherSection(props: WeatherSectionProps) {
  const { statusLabel, statusVariant = "neutral", ...cardProps } = props;

  return (
    <View style={styles.section}>
      {statusLabel ? <SectionSyncBadge label={statusLabel} variant={statusVariant} /> : null}
      <WeatherUpdateCard {...cardProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 12,
  },
});
