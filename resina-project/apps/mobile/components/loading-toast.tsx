import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

type LoadingToastProps = {
  visible: boolean;
  message?: string;
  topOffset?: number;
};

export function LoadingToast({
  visible,
  message = "Refreshing data...",
  topOffset = 54,
}: LoadingToastProps) {
  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents="none" style={[styles.container, { top: topOffset }]}>
      <View style={styles.toast}>
        <ActivityIndicator size="small" color="#ffffff" />
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 40,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(31, 41, 55, 0.94)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  message: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
});
