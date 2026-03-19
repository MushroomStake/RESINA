import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { ToastShell } from "./toast-shell";

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
  return (
    <ToastShell
      visible={visible}
      topOffset={topOffset}
      pointerEvents="none"
      zIndex={40}
      horizontalPadding={12}
      toastStyle={styles.toast}
    >
      <View style={styles.content}>
        <ActivityIndicator size="small" color="#ffffff" />
        <Text style={styles.message}>{message}</Text>
      </View>
    </ToastShell>
  );
}

const styles = StyleSheet.create({
  toast: {
    width: undefined,
    borderWidth: 0,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(31, 41, 55, 0.94)",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  message: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
});
