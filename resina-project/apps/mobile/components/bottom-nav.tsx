import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type DashboardTab = "home" | "news" | "history" | "profile";

type BottomNavProps = {
  activeTab: DashboardTab;
  onChange: (nextTab: DashboardTab) => void;
  onReselect?: (tab: DashboardTab) => void;
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

export function BottomNav({ activeTab, onChange, onReselect }: BottomNavProps) {
  return (
    <View style={styles.wrapper}>
      {TABS.map((tab) => {
        const isActive = tab.key === activeTab;
        const iconColor = isActive ? "#35a14a" : "#6b7280";
        return (
          <Pressable
            key={tab.key}
            style={styles.item}
            onPress={() => {
              if (isActive) {
                onReselect?.(tab.key);
                return;
              }

              onChange(tab.key);
            }}
          >
            <Ionicons name={tab.icon} size={20} color={iconColor} />
            <Text style={[styles.label, isActive && styles.activeLabel]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: 1,
    borderTopColor: "#d9dde3",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 8,
    paddingBottom: 10,
  },
  item: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  label: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 3,
  },
  activeLabel: {
    color: "#35a14a",
    fontWeight: "700",
  },
});
