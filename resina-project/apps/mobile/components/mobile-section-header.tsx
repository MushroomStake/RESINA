import { Platform, StatusBar, StyleSheet, Text, View } from "react-native";

type MobileSectionHeaderProps = {
  title: string;
};

const ANDROID_TOP_GAP = Math.max(StatusBar.currentHeight ?? 0, 0) * 0.15;

export function MobileSectionHeader({ title }: MobileSectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingTop: Platform.OS === "android" ? 8 + ANDROID_TOP_GAP : 8,
    paddingBottom: 6,
  },
  title: {
    textAlign: "center",
    color: "#1f2937",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.2,
  },
});
