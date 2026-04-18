import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AnnouncementCard } from "./announcement-card";
import { MobileSectionHeader, SectionSyncBadge, type SectionSyncBadgeVariant } from "./mobile-section-header";

type AnnouncementAlertLevel = "normal" | "warning" | "emergency";
export type AnnouncementFilterKey = "all" | AnnouncementAlertLevel;

type AnnouncementMedia = {
  id: string;
  file_name: string;
  public_url: string;
  display_order: number;
};

export type AnnouncementItem = {
  id: string;
  title: string;
  description: string;
  alert_level: AnnouncementAlertLevel;
  posted_by_name: string;
  created_at: string;
  announcement_media: AnnouncementMedia[];
};

type AnnouncementTone = {
  bg: string;
  text: string;
  label: string;
};

type AnnouncementsSectionProps = {
  announcements: AnnouncementItem[];
  isLoading: boolean;
  isLoadingMore?: boolean;
  canLoadMore?: boolean;
  filter: AnnouncementFilterKey;
  searchQuery: string;
  onChangeFilter: (nextFilter: AnnouncementFilterKey) => void;
  onChangeSearchQuery: (value: string) => void;
  onOpenComments: (entry: AnnouncementItem) => void;
  onLoadMore?: () => void;
  title?: string;
  subtitle?: string;
  emptyText?: string;
  textVariant?: "light" | "dark";
  statusLabel?: string | null;
  statusVariant?: SectionSyncBadgeVariant;
};

const badgeStyleByAlert: Record<AnnouncementAlertLevel, AnnouncementTone> = {
  normal: { bg: "#ecfdf3", text: "#15803d", label: "General Update" },
  warning: { bg: "#fff7ed", text: "#c2410c", label: "Warning Alert" },
  emergency: { bg: "#fff1f2", text: "#be123c", label: "Emergency Alert" },
};

const filterOptions: Array<{ key: AnnouncementFilterKey; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: "all", label: "All / Lahat", icon: "funnel-outline" },
  { key: "warning", label: "Warning", icon: "warning-outline" },
  { key: "emergency", label: "Emergency", icon: "alert-circle-outline" },
];

export function AnnouncementsSection({
  announcements,
  isLoading,
  isLoadingMore = false,
  canLoadMore = false,
  filter,
  searchQuery,
  onChangeFilter,
  onChangeSearchQuery,
  onOpenComments,
  onLoadMore,
  title = "ANNOUNCEMENT",
  subtitle = "Official updates and advisories from Barangay Sta. Rita.",
  emptyText = "No announcements found for this filter.",
  textVariant = "dark",
  statusLabel,
  statusVariant = "neutral",
}: AnnouncementsSectionProps) {
  const isLightText = textVariant === "light";

  return (
    <View>
      <MobileSectionHeader title={title} textVariant={textVariant} />
      <Text style={[styles.subtitle, isLightText ? styles.subtitleLight : null]}>{subtitle}</Text>
      {statusLabel ? <SectionSyncBadge label={statusLabel} variant={statusVariant} /> : null}

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#64748b" style={styles.searchIcon} />
        <TextInput
          value={searchQuery}
          onChangeText={onChangeSearchQuery}
          placeholder="Search announcements..."
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersRow}>
        {filterOptions.map((option) => {
          const isActive = filter === option.key;

          return (
            <Pressable
              key={option.key}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => onChangeFilter(option.key)}
            >
              <Ionicons name={option.icon} size={15} color={isActive ? "#ffffff" : "#4b5563"} style={styles.filterIcon} />
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading ? <Text style={[styles.loaderText, isLightText ? styles.loaderTextLight : null]}>Loading announcements...</Text> : null}

      {!isLoading && announcements.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyTitle, isLightText ? styles.emptyTitleLight : null]}>NEWS</Text>
          <Text style={[styles.emptyText, isLightText ? styles.emptyTextLight : null]}>{emptyText}</Text>
        </View>
      ) : null}

      {announcements.map((entry) => {
        const tone = badgeStyleByAlert[entry.alert_level] ?? badgeStyleByAlert.normal;

        return (
          <AnnouncementCard
            key={entry.id}
            entry={entry}
            tone={tone}
            formattedDate={formatAnnouncementDate(entry.created_at)}
            onOpenComments={onOpenComments}
          />
        );
      })}

      {canLoadMore ? (
        <Pressable style={styles.loadMoreBtn} onPress={onLoadMore} disabled={isLoadingMore}>
          <Text style={styles.loadMoreText}>{isLoadingMore ? "Loading..." : "Load more announcements"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function formatAnnouncementDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Published recently";
  }

  return `Published ${parsed.toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "2-digit",
    year: "numeric",
  })}`;
}

const styles = StyleSheet.create({
  subtitle: {
    marginTop: 2,
    marginBottom: 8,
    color: "#60748f",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  subtitleLight: {
    color: "#c7d7ee",
  },
  filtersScroll: {
    marginBottom: 8,
  },
  searchWrap: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#d8dde4",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchIcon: {
    marginTop: 1,
  },
  searchInput: {
    flex: 1,
    minHeight: 20,
    color: "#334155",
    fontSize: 14,
  },
  filtersRow: {
    gap: 8,
    paddingRight: 4,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d8dde4",
    backgroundColor: "#ffffff",
  },
  filterChipActive: {
    backgroundColor: "#2f8d41",
    borderColor: "#2f8d41",
  },
  filterIcon: {
    marginTop: 1,
  },
  filterText: {
    color: "#4b5563",
    fontSize: 12,
    fontWeight: "700",
  },
  filterTextActive: {
    color: "#ffffff",
  },
  loaderText: {
    color: "#6b7280",
    fontSize: 14,
    marginBottom: 6,
  },
  loaderTextLight: {
    color: "#c4d5ed",
  },
  emptyState: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d9dde3",
    backgroundColor: "#ffffff",
    padding: 14,
    marginBottom: 10,
  },
  emptyTitle: {
    color: "#1f2937",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },
  emptyTitleLight: {
    color: "#203a5f",
  },
  emptyText: {
    color: "#4b5563",
    fontSize: 13,
    lineHeight: 18,
  },
  emptyTextLight: {
    color: "#3c516d",
  },
  loadMoreBtn: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8dde4",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  loadMoreText: {
    color: "#1f2937",
    fontSize: 13,
    fontWeight: "700",
  },
});
