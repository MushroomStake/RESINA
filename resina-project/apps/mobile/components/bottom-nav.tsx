import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

export type DashboardTab = "home" | "news" | "history" | "profile";

type BottomNavProps = {
  activeTab: DashboardTab;
  onChange: (nextTab: DashboardTab) => void;
  onReselect?: (tab: DashboardTab) => void;
  themeVariant?: "light" | "dark";
};

const TABS: Array<{
  key: DashboardTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: "home", label: "Home", icon: "home-outline" },
  { key: "news", label: "News", icon: "paper-plane-outline" },
  { key: "history", label: "History", icon: "time-outline" },
  { key: "profile", label: "Profile", icon: "person-outline" },
];

export function BottomNav({ activeTab, onChange, onReselect, themeVariant = "light" }: BottomNavProps) {
  const isDark = themeVariant === "dark";

  return (
    <View style={styles.outerWrap}>
      <View style={[styles.wrapper, isDark ? styles.wrapperDark : styles.wrapperLight]}>
        <BlurView intensity={isDark ? 26 : 20} tint={isDark ? "dark" : "light"} style={styles.blurLayer} />
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          const iconColor = isActive ? (isDark ? "#8fd4ff" : "#166534") : isDark ? "#a4b6cc" : "#6b7280";

          return (
            <Pressable
              key={tab.key}
              style={[styles.item, isActive ? (isDark ? styles.itemActiveDark : styles.itemActiveLight) : null]}
              onPress={() => {
                if (isActive) {
                  onReselect?.(tab.key);
                  return;
                }

                onChange(tab.key);
              }}
            >
              <Ionicons name={tab.icon} size={22} color={iconColor} />
              <Text
                style={[
                  styles.label,
                  isDark ? styles.labelDark : null,
                  isActive ? (isDark ? styles.activeLabelDark : styles.activeLabelLight) : null,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrap: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
  },
  wrapper: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 8,
    paddingBottom: 10,
    minHeight: 72,
  },
  blurLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  wrapperLight: {
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderColor: "rgba(196, 211, 229, 0.9)",
  },
  wrapperDark: {
    backgroundColor: "rgba(8, 20, 40, 0.74)",
    borderColor: "rgba(90, 121, 160, 0.45)",
  },
  item: {
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  itemActiveLight: {
    backgroundColor: "rgba(220, 243, 227, 0.95)",
  },
  itemActiveDark: {
    backgroundColor: "rgba(25, 48, 82, 0.86)",
  },
  label: {
    color: "#6b7280",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 3,
  },
  labelDark: {
    color: "#a4b6cc",
  },
  activeLabelLight: {
    color: "#166534",
    fontWeight: "800",
  },
  activeLabelDark: {
    color: "#8fd4ff",
    fontWeight: "800",
  },
});
