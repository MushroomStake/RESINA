import DateTimePicker from "@react-native-community/datetimepicker";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Pressable, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { MobileSectionHeader, SectionSyncBadge, type SectionSyncBadgeVariant } from "./mobile-section-header";

export type HistoryAlertLevel = "normal" | "critical" | "evacuation" | "spilling";

export type HistoryRecord = {
  id: string;
  recordedAt: string;
  readingDate: string | null;
  readingTime: string | null;
  waterLevel: number;
  alertLevel: HistoryAlertLevel;
  statusLabel: string;
  rangeLabel: string;
  description: string;
};

export type HistoryDayGroup = {
  dateKey: string;
  dateLabel: string;
  entries: HistoryRecord[];
};

type HistorySectionProps = {
  groups: HistoryDayGroup[];
  isLoading: boolean;
  canLoadMore: boolean;
  selectedDateLabel: string;
  selectedDateValue: Date;
  showDatePicker: boolean;
  onToggleDatePicker: () => void;
  onDateChange: (event: DateTimePickerEvent, date?: Date) => void;
  onClearDate: () => void;
  onLoadMore: () => void;
  statusFilter: "all" | HistoryAlertLevel;
  onChangeStatusFilter: (nextFilter: "all" | HistoryAlertLevel) => void;
  title?: string;
  subtitle?: string;
  textVariant?: "light" | "dark";
  statusLabel?: string | null;
  statusVariant?: SectionSyncBadgeVariant;
};

const historyFilterOptions: Array<{ key: "all" | HistoryAlertLevel; label: string }> = [
  { key: "all", label: "All" },
  { key: "normal", label: "Normal" },
  { key: "critical", label: "Critical" },
  { key: "evacuation", label: "Evacuation" },
  { key: "spilling", label: "Spilling" },
];

const HISTORY_LEVELS: Record<
  HistoryAlertLevel,
  {
    cardBackground: string;
    badgeBorder: string;
    badgeText: string;
  }
> = {
  normal: {
    cardBackground: "#dbe2dd",
    badgeBorder: "#67b56e",
    badgeText: "#2d8a39",
  },
  critical: {
    cardBackground: "#ece6c8",
    badgeBorder: "#9f8c28",
    badgeText: "#8b7300",
  },
  evacuation: {
    cardBackground: "#e9e5e5",
    badgeBorder: "#c36d37",
    badgeText: "#b55f2d",
  },
  spilling: {
    cardBackground: "#ebe1e3",
    badgeBorder: "#f06868",
    badgeText: "#ef4e4e",
  },
};

export function HistorySection({
  groups,
  isLoading,
  canLoadMore,
  selectedDateLabel,
  selectedDateValue,
  showDatePicker,
  onToggleDatePicker,
  onDateChange,
  onClearDate,
  onLoadMore,
  statusFilter,
  onChangeStatusFilter,
  title = "HISTORY",
  subtitle = "Sorted by newest records with date filtering and water level status.",
  textVariant = "dark",
  statusLabel,
  statusVariant = "neutral",
}: HistorySectionProps) {
  const isLightText = textVariant === "light";

  return (
    <View>
      <MobileSectionHeader title={title} textVariant={textVariant} />
      <Text style={[styles.subtitle, isLightText ? styles.subtitleLight : null]}>{subtitle}</Text>
      {statusLabel ? <SectionSyncBadge label={statusLabel} variant={statusVariant} /> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersRow}>
        {historyFilterOptions.map((option) => {
          const isActive = statusFilter === option.key;

          return (
            <Pressable
              key={option.key}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => onChangeStatusFilter(option.key)}
            >
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.toolbarRow}>
        <Pressable style={styles.dateRangeBtn} onPress={onToggleDatePicker}>
          <Text style={styles.dateRangeText}>{selectedDateLabel}</Text>
        </Pressable>
        <Text style={styles.sortedText}>SORTED: NEWEST FIRST</Text>
      </View>

      {showDatePicker ? (
        <View style={styles.calendarWrap}>
          <DateTimePicker
            mode="date"
            value={selectedDateValue}
            display={Platform.OS === "ios" ? "inline" : "default"}
            onChange={onDateChange}
          />
        </View>
      ) : null}

      <Pressable style={styles.clearDateBtn} onPress={onClearDate} disabled={!selectedDateLabel}>
        <Text style={styles.clearDateText}>Show all dates</Text>
      </Pressable>

      {isLoading ? <Text style={[styles.loaderText, isLightText ? styles.loaderTextLight : null]}>Loading history...</Text> : null}

      {!isLoading && groups.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, isLightText ? styles.emptyTextLight : null]}>No history records found.</Text>
        </View>
      ) : null}

      {groups.map((group) => (
        <View key={group.dateKey} style={styles.dayGroup}>
          <Text style={[styles.dayGroupTitle, isLightText ? styles.dayGroupTitleLight : null]}>{group.dateLabel}</Text>

          {group.entries.map((entry) => {
            const config = HISTORY_LEVELS[entry.alertLevel];

            return (
              <View key={entry.id} style={[styles.historyCard, { backgroundColor: config.cardBackground }]}>
                <View style={styles.historyCardTopRow}>
                  <Text style={styles.historyDateTimeText}>{formatHistoryTimeOnly(entry)}</Text>
                  <View style={[styles.historyStatusBadge, { borderColor: config.badgeBorder }]}>
                    <Text style={[styles.historyStatusBadgeText, { color: config.badgeText }]}>{entry.statusLabel}</Text>
                  </View>
                </View>
                <Text style={styles.historyRangeText}>Water level: {entry.waterLevel.toFixed(2)}m</Text>
                <Text style={styles.historyDescriptionLabel}>Description</Text>
                <Text style={styles.historyDescriptionText}>{entry.description}</Text>
              </View>
            );
          })}
        </View>
      ))}

      {canLoadMore ? (
        <Pressable style={styles.loadMoreBtn} onPress={onLoadMore}>
          <Text style={styles.loadMoreText}>Load older records</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function formatHistoryTimeOnly(entry: HistoryRecord): string {
  const raw = entry.readingDate && entry.readingTime ? `${entry.readingDate}T${entry.readingTime}` : entry.recordedAt;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown time";
  }

  return parsed.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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
  filtersRow: {
    gap: 8,
    paddingRight: 4,
  },
  filterChip: {
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
  filterText: {
    color: "#4b5563",
    fontSize: 12,
    fontWeight: "700",
  },
  filterTextActive: {
    color: "#ffffff",
  },
  toolbarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  dateRangeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d8dde4",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dateRangeText: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "700",
  },
  sortedText: {
    color: "#6b7280",
    fontSize: 11,
    fontWeight: "700",
  },
  calendarWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d9dde3",
    backgroundColor: "#ffffff",
    padding: 8,
    marginBottom: 8,
  },
  clearDateBtn: {
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  clearDateText: {
    color: "#2f8d41",
    fontSize: 12,
    fontWeight: "700",
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
  emptyText: {
    color: "#4b5563",
    fontSize: 13,
    lineHeight: 18,
  },
  emptyTextLight: {
    color: "#3c516d",
  },
  dayGroup: {
    marginBottom: 10,
  },
  dayGroupTitle: {
    color: "#1f2937",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 6,
  },
  dayGroupTitleLight: {
    color: "#e5efff",
    textShadowColor: "rgba(5, 12, 24, 0.24)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  historyCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  historyCardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  historyDateTimeText: {
    flex: 1,
    color: "#1f2937",
    fontSize: 13,
    fontWeight: "800",
  },
  historyStatusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  historyStatusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  historyRangeText: {
    marginTop: 8,
    color: "#1f3657",
    fontSize: 15,
    fontWeight: "800",
  },
  historyDescriptionLabel: {
    marginTop: 8,
    color: "#516171",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  historyDescriptionText: {
    marginTop: 4,
    color: "#374151",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
  },
  loadMoreBtn: {
    alignSelf: "center",
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#dbe9de",
    borderWidth: 1,
    borderColor: "#bfd8c4",
  },
  loadMoreText: {
    color: "#1f6b34",
    fontSize: 12,
    fontWeight: "800",
  },
});
