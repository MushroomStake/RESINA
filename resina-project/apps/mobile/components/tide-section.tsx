import { StyleSheet, View } from "react-native";
import { TideCard } from "./tide-monitor-card";
import { SectionSyncBadge, type SectionSyncBadgeVariant } from "./mobile-section-header";

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
  statusLabel?: string | null;
  statusVariant?: SectionSyncBadgeVariant;
};

export function TideSection(props: TideSectionProps) {
  const { statusLabel, statusVariant = "neutral", ...cardProps } = props;

  return (
    <View style={styles.section}>
      {statusLabel ? <SectionSyncBadge label={statusLabel} variant={statusVariant} /> : null}
      <TideCard {...cardProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 12,
  },
});
