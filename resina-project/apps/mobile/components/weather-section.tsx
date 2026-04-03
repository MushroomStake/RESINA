import { StyleSheet, View } from "react-native";
import { WeatherUpdateCard } from "./weather-update-card";

export type WeatherSectionProps = {
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

export function WeatherSection(props: WeatherSectionProps) {
  return (
    <View style={styles.section}>
      <WeatherUpdateCard {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 12,
  },
});
