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
  const normalizedMessage = message.replace(/\s+/g, " ").trim();

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
        <ActivityIndicator size="small" color="#1877f2" />
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          allowFontScaling={false}
          maxFontSizeMultiplier={1}
          style={styles.message}
        >
          {normalizedMessage}
        </Text>
      </View>
    </ToastShell>
  );
}

const styles = StyleSheet.create({
  toast: {
    width: 228,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#dbe3f0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  message: {
    color: "#1f2937",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0,
    includeFontPadding: false,
    flexShrink: 1,
  },
});
