import { Ionicons } from "@expo/vector-icons";
import { Platform, StatusBar, Text, View } from "react-native";

type MobileSectionHeaderProps = {
  title: string;
  textVariant?: "light" | "dark";
  statusLabel?: string | null;
  statusVariant?: SectionSyncBadgeVariant;
};

export type SectionSyncBadgeVariant = "live" | "cache" | "offline" | "neutral";

const ANDROID_TOP_GAP = Math.max(StatusBar.currentHeight ?? 0, 0) * 0.15;

export function MobileSectionHeader({ title, textVariant = "dark", statusLabel, statusVariant = "neutral" }: MobileSectionHeaderProps) {
  const isLightText = textVariant === "light";

  return (
    <View
      className="items-center pb-1.5"
      style={{ paddingTop: Platform.OS === "android" ? 8 + ANDROID_TOP_GAP : 8 }}
    >
      <Text
        className="text-center text-base font-bold tracking-[0.2px]"
        style={{
          color: isLightText ? "#edf4ff" : "#1f2937",
          textShadowColor: isLightText ? "rgba(5, 12, 24, 0.24)" : "transparent",
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: isLightText ? 2 : 0,
        }}
      >
        {title}
      </Text>
      {statusLabel ? <SectionSyncBadge label={statusLabel} variant={statusVariant} /> : null}
    </View>
  );
}

type SectionSyncBadgeProps = {
  label: string;
  variant?: SectionSyncBadgeVariant;
};

const BADGE_STYLES: Record<SectionSyncBadgeVariant, { backgroundColor: string; borderColor: string; textColor: string; icon: keyof typeof Ionicons.glyphMap }> = {
  live: {
    backgroundColor: "#ecfdf3",
    borderColor: "#bbf7d0",
    textColor: "#15803d",
    icon: "radio-outline",
  },
  cache: {
    backgroundColor: "#fff7ed",
    borderColor: "#fed7aa",
    textColor: "#9a5b00",
    icon: "cloud-offline-outline",
  },
  offline: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    textColor: "#b42318",
    icon: "cloud-offline-outline",
  },
  neutral: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    textColor: "#1d4ed8",
    icon: "sync-outline",
  },
};

export function SectionSyncBadge({ label, variant = "neutral" }: SectionSyncBadgeProps) {
  const config = BADGE_STYLES[variant];

  return (
    <View
      style={{
        alignSelf: "flex-start",
        marginTop: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: config.borderColor,
        backgroundColor: config.backgroundColor,
        paddingHorizontal: 10,
        paddingVertical: 5,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      <Ionicons name={config.icon} size={12} color={config.textColor} />
      <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 0.2, color: config.textColor }}>{label}</Text>
    </View>
  );
}
