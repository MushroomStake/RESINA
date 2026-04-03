import { StyleSheet, View } from "react-native";
import { TideCard } from "./tide-monitor-card";

export type TideSectionProps = {
  tideStatus: {
    currentHeight: number | null;
    nextExtreme: {
      type: "high" | "low";
      height: number;
      time: string;
    };
    state: "rising" | "falling";
  } | null;
  tideExtremes: Array<{
    type: "high" | "low";
    height: number;
    time: string;
  }>;
  hourlyTides: Array<{
    hour: number;
    estimatedHeight: number;
    confidence: "high" | "medium" | "low";
  }>;
  isLoading: boolean;
  error: string | null;
};

export function TideSection(props: TideSectionProps) {
  return (
    <View style={styles.section}>
      <TideCard {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 12,
  },
});
