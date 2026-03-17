import { Pressable, StyleSheet, Text, View } from "react-native";

export type DashboardTab = "home" | "news" | "history" | "profile";

type BottomNavProps = {
  activeTab: DashboardTab;
  onChange: (nextTab: DashboardTab) => void;
};

const TABS: Array<{ key: DashboardTab; label: string }> = [
  { key: "home", label: "Home" },
  { key: "news", label: "News" },
  { key: "history", label: "History" },
  { key: "profile", label: "Profile" },
];

export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  return (
    <View style={styles.wrapper}>
      {TABS.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <Pressable key={tab.key} style={styles.item} onPress={() => onChange(tab.key)}>
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
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  label: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "500",
  },
  activeLabel: {
    color: "#35a14a",
    fontWeight: "700",
  },
});
