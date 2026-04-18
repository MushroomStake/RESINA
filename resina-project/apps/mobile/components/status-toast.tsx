import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";

type StatusToastVariant = "success" | "error" | "info";

type StatusToastProps = {
  visible: boolean;
  message: string;
  variant: StatusToastVariant;
  topOffset?: number;
  onClose?: () => void;
  successDurationMs?: number;
};

const VARIANT_CONFIG: Record<StatusToastVariant, {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBorder: string;
  title: string;
  titleColor: string;
  text: string;
  buttonBg: string;
  buttonText: string;
}> = {
  success: {
    icon: "checkmark-circle",
    iconColor: "#5f9f4a",
    iconBorder: "#b9dcb2",
    title: "Success",
    titleColor: "#334155",
    text: "#475569",
    buttonBg: "#6b5fd6",
    buttonText: "#ffffff",
  },
  error: {
    icon: "close",
    iconColor: "#e56f75",
    iconBorder: "#e56f75",
    title: "Validation Error",
    titleColor: "#4b5563",
    text: "#334155",
    buttonBg: "#6b5fd6",
    buttonText: "#ffffff",
  },
  info: {
    icon: "information",
    iconColor: "#3b82f6",
    iconBorder: "#93c5fd",
    title: "Notice",
    titleColor: "#334155",
    text: "#334155",
    buttonBg: "#6b5fd6",
    buttonText: "#ffffff",
  },
};

export function StatusToast({
  visible,
  message,
  variant,
  topOffset = 62,
  onClose,
  successDurationMs = 2600,
}: StatusToastProps) {
  const { width } = useWindowDimensions();
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const successOpacity = useRef(new Animated.Value(0)).current;
  const successProgress = useRef(new Animated.Value(1)).current;
  const errorOpacity = useRef(new Animated.Value(0)).current;
  const closeRequestedRef = useRef(false);
  const successTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const config = VARIANT_CONFIG[variant];
  const isCompact = width < 390;
  const isTiny = width < 350;

  const iconSize = isTiny ? 30 : isCompact ? 34 : 38;
  const iconWrapSize = isTiny ? 72 : isCompact ? 80 : 88;
  const iconWrapBorder = isTiny ? 4 : 5;
  const titleSize = isTiny ? 22 : isCompact ? 26 : 30;
  const messageSize = isTiny ? 16 : isCompact ? 18 : 22;
  const messageLineHeight = isTiny ? 22 : isCompact ? 25 : 30;
  const buttonTextSize = isTiny ? 15 : isCompact ? 16 : 18;

  const clearSuccessTimers = () => {
    successTimersRef.current.forEach((timer) => clearTimeout(timer));
    successTimersRef.current = [];
  };

  const dismissSuccess = () => {
    Animated.timing(successOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setShowSuccessToast(false);
      onClose?.();
    });
  };

  const closeError = () => {
    if (closeRequestedRef.current) {
      return;
    }

    closeRequestedRef.current = true;
    Animated.timing(errorOpacity, {
      toValue: 0,
      duration: 190,
      useNativeDriver: true,
    }).start(() => {
      setShowErrorModal(false);
      closeRequestedRef.current = false;
      onClose?.();
    });
  };

  useEffect(() => {
    if (!visible || !message.trim()) {
      if (showSuccessToast) {
        dismissSuccess();
      }

      if (showErrorModal) {
        Animated.timing(errorOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }).start(() => {
          setShowErrorModal(false);
        });
      }

      return;
    }

    if (variant === "success") {
      clearSuccessTimers();
      setShowSuccessToast(true);
      successOpacity.setValue(0);
      successProgress.setValue(1);

      Animated.timing(successOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        Animated.timing(successProgress, {
          toValue: 0,
          duration: successDurationMs,
          useNativeDriver: false,
        }).start(({ finished }) => {
          if (finished) {
            dismissSuccess();
          }
        });
      });

      return;
    }

    setShowErrorModal(true);
    errorOpacity.setValue(0);
    Animated.timing(errorOpacity, {
      toValue: 1,
      duration: 190,
      useNativeDriver: true,
    }).start();
  }, [visible, message, variant, successDurationMs]);

  useEffect(() => {
    return () => {
      clearSuccessTimers();
      successOpacity.stopAnimation();
      successProgress.stopAnimation();
      errorOpacity.stopAnimation();
    };
  }, []);

  const progressWidth = successProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const shouldRenderForFade = showSuccessToast || showErrorModal;
  const hasActiveMessage = visible && Boolean(message.trim());

  if (!hasActiveMessage && !shouldRenderForFade) {
    return null;
  }

  if (variant === "success") {
    if (!showSuccessToast) {
      return null;
    }

    return (
      <Animated.View pointerEvents="none" style={[styles.successHost, { top: topOffset, opacity: successOpacity }]}> 
        <View style={styles.successCard}>
          <View style={styles.successIconWrap}>
            <Ionicons name={config.icon} size={34} color={config.iconColor} />
          </View>
          <Text style={styles.successMessage}>{message}</Text>
          <View style={styles.successDurationTrack}>
            <Animated.View style={[styles.successDurationFill, { width: progressWidth }]} />
          </View>
        </View>
      </Animated.View>
    );
  }

  if (!showErrorModal) {
    return null;
  }

  return (
    <Modal transparent animationType="none" visible={showErrorModal} onRequestClose={closeError}>
      <Animated.View style={[styles.backdrop, { paddingHorizontal: isTiny ? 14 : 20, paddingTop: topOffset, opacity: errorOpacity }]}> 
        <Animated.View style={[styles.card, { maxWidth: isTiny ? 320 : isCompact ? 340 : 360, opacity: errorOpacity }]}> 
          <View
            style={[
              styles.iconWrap,
              {
                borderColor: config.iconBorder,
                width: iconWrapSize,
                height: iconWrapSize,
                borderRadius: iconWrapSize / 2,
                borderWidth: iconWrapBorder,
              },
            ]}
          >
            <Ionicons name={config.icon} size={iconSize} color={config.iconColor} />
          </View>

          <Text style={[styles.title, { color: config.titleColor, fontSize: titleSize }]}>{config.title}</Text>
          <Text style={[styles.message, { color: config.text, fontSize: messageSize, lineHeight: messageLineHeight }]}>
            {message}
          </Text>

          <Pressable style={[styles.actionBtn, { backgroundColor: config.buttonBg }]} onPress={closeError}>
            <Text style={[styles.actionBtnText, { color: config.buttonText, fontSize: buttonTextSize }]}>OK</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  successHost: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 12,
    zIndex: 75,
  },
  successCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#f2f3f5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d9dee5",
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    overflow: "hidden",
    boxShadow: "0px 3px 8px rgba(17, 24, 39, 0.12)",
    elevation: 3,
  },
  successIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 5,
    borderColor: "#c8e2bf",
    alignItems: "center",
    justifyContent: "center",
  },
  successMessage: {
    flex: 1,
    color: "#4b5563",
    fontSize: 16,
    fontWeight: "500",
  },
  successDurationTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: "#e2e8f0",
  },
  successDurationFill: {
    height: "100%",
    backgroundColor: "#9ca3af",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 30,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 22,
    lineHeight: 30,
    textAlign: "center",
    fontWeight: "400",
    marginBottom: 22,
  },
  actionBtn: {
    minWidth: 96,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#b8b5ec",
  },
  actionBtnText: {
    fontSize: 18,
    fontWeight: "600",
  },
});
