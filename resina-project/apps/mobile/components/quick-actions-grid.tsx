import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type QuickActionItem = {
  id: string;
  title: string;
  subtitle: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: "primary" | "secondary" | "muted";
  onPress: () => void;
};

type QuickActionsGridProps = {
  title?: string;
  subtitle?: string;
  actions: QuickActionItem[];
  textVariant?: "light" | "dark";
};

const toneStyles = {
  primary: { backgroundColor: "#eaf2ff", borderColor: "#cfe0ff" },
  secondary: { backgroundColor: "#eef8ef", borderColor: "#d4ead7" },
  muted: { backgroundColor: "#f6f9ff", borderColor: "#dce6f4" },
} as const;

export function QuickActionsGrid({ title = "Quick Actions", subtitle, actions, textVariant = "dark" }: QuickActionsGridProps) {
  const isLightText = textVariant === "light";

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, isLightText ? styles.titleLight : null]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, isLightText ? styles.subtitleLight : null]}>{subtitle}</Text> : null}
      </View>

      <View style={styles.grid}>
        {actions.map((action) => {
          const tone = action.tone ?? "muted";
          const iconName = action.icon ?? "chevron-forward-outline";

          return (
            <Pressable key={action.id} onPress={action.onPress} style={[styles.card, toneStyles[tone]]}>
              <View style={styles.cardTopRow}>
                <View style={styles.iconWrap}>
                  <Ionicons name={iconName} size={18} color={tone === "primary" ? "#2457a6" : tone === "secondary" ? "#2e7d3b" : "#4b617b"} />
                </View>
              </View>
              <Text style={[styles.cardTitle, isLightText ? styles.cardTitleLight : null]}>{action.title}</Text>
              <Text style={[styles.cardSubtitle, isLightText ? styles.cardSubtitleLight : null]}>{action.subtitle}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 12,
  },
  headerRow: {
    marginBottom: 8,
  },
  title: {
    color: "#203759",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  titleLight: {
    color: "#f2f7ff",
    textShadowColor: "rgba(4, 12, 28, 0.28)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    marginTop: 3,
    color: "#60748f",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  subtitleLight: {
    color: "#c9d8ef",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    width: "48%",
    minHeight: 86,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  cardTitle: {
    marginTop: 8,
    color: "#1f3657",
    fontSize: 13,
    fontWeight: "800",
  },
  cardTitleLight: {
    color: "#173356",
  },
  cardSubtitle: {
    marginTop: 4,
    color: "#59708d",
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "500",
  },
  cardSubtitleLight: {
    color: "#355475",
  },
});
