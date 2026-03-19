import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

type ToastShellProps = {
  visible: boolean;
  topOffset?: number;
  pointerEvents?: "none" | "box-none";
  zIndex?: number;
  horizontalPadding?: number;
  toastStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
};

export function ToastShell({
  visible,
  topOffset = 56,
  pointerEvents = "box-none",
  zIndex = 60,
  horizontalPadding = 16,
  toastStyle,
  children,
}: ToastShellProps) {
  if (!visible) {
    return null;
  }

  return (
    <View pointerEvents={pointerEvents} style={[styles.container, { top: topOffset, zIndex, paddingHorizontal: horizontalPadding }]}>
      <View style={[styles.toast, toastStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  toast: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#111827",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 2,
  },
});
