import { memo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { ImageViewerModal } from "./image-viewer-modal";

type AnnouncementAlertLevel = "normal" | "warning" | "emergency";

type AnnouncementMedia = {
  id: string;
  file_name: string;
  public_url: string;
  display_order: number;
};

type AnnouncementItem = {
  id: string;
  title: string;
  description: string;
  alert_level: AnnouncementAlertLevel;
  posted_by_name: string;
  created_at: string;
  announcement_media: AnnouncementMedia[];
};

type ToneStyle = {
  bg: string;
  text: string;
  label: string;
};

type AnnouncementCardProps = {
  entry: AnnouncementItem;
  tone: ToneStyle;
  formattedDate: string;
  onOpenComments: (entry: AnnouncementItem) => void;
};

export const AnnouncementCard = memo(function AnnouncementCard({
  entry,
  tone,
  formattedDate,
  onOpenComments,
}: AnnouncementCardProps) {
  const { width } = useWindowDimensions();
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const hasImages = (entry.announcement_media ?? []).length > 0;
  const imageCount = (entry.announcement_media ?? []).length;
  const galleryImageWidth = Math.max(220, Math.min(width - 96, 320));

  const handleImagePress = (index: number) => {
    setSelectedImageIndex(index);
    setImageViewerVisible(true);
  };

  return (
    <>
      <View style={styles.newsCard}>
        <View style={styles.newsMetaRow}>
          <Text style={styles.newsAuthor}>BRGY. STA. RITA</Text>
          <Text style={styles.newsDate}>{formattedDate}</Text>
        </View>

        <Text style={styles.newsHeadline}>{entry.title}</Text>
        <View style={[styles.newsAlertBadge, { backgroundColor: tone.bg }]}>
          <Text style={[styles.newsAlertText, { color: tone.text }]}>{tone.label}</Text>
        </View>

        <Text style={styles.newsDescription}>{entry.description}</Text>

        {hasImages ? (
          <View style={styles.imageGalleryContainer}>
            {imageCount === 1 ? (
              <Pressable
                onPress={() => handleImagePress(0)}
                style={[styles.singleImageWrapper, { width: galleryImageWidth }]}
              >
                <Image source={{ uri: entry.announcement_media[0]?.public_url }} style={styles.newsImage} resizeMode="cover" />
              </Pressable>
            ) : (
              <ScrollView
                horizontal
                pagingEnabled
                decelerationRate="fast"
                snapToInterval={galleryImageWidth + 10}
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                contentContainerStyle={styles.imageGalleryContent}
              >
                {(entry.announcement_media ?? []).map((media, index) => (
                <Pressable
                  key={media.id}
                  onPress={() => handleImagePress(index)}
                  style={[styles.imageWrapper, { width: galleryImageWidth }, index === imageCount - 1 && styles.imageWrapperLast]}
                >
                  <Image source={{ uri: media.public_url }} style={styles.newsImage} resizeMode="cover" />
                  {imageCount > 1 ? (
                    <View style={styles.imageCounter}>
                      <Text style={styles.imageCounterText}>
                        {index + 1}/{imageCount}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        ) : null}

        <View style={styles.newsCardFooter}>
          <Pressable style={styles.newsCommentBtn} onPress={() => onOpenComments(entry)}>
            <Ionicons name="chatbubble-outline" size={19} color="#7d8693" style={styles.newsCommentIcon} />
            <Text style={styles.newsCommentBtnText}>View Comment</Text>
          </Pressable>
        </View>
      </View>

      <ImageViewerModal
        isVisible={imageViewerVisible}
        images={entry.announcement_media ?? []}
        initialIndex={selectedImageIndex}
        onClose={() => setImageViewerVisible(false)}
      />
    </>
  );
});

const styles = StyleSheet.create({
  newsCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d8dde4",
    backgroundColor: "#ffffff",
    padding: 14,
    marginBottom: 12,
  },
  newsMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  newsAuthor: {
    color: "#2f9e44",
    fontWeight: "700",
    fontSize: 13,
    flex: 1,
  },
  newsDate: {
    color: "#6b7280",
    fontSize: 12,
  },
  newsHeadline: {
    marginTop: 8,
    color: "#1f2937",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
  },
  newsAlertBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 10,
  },
  newsAlertText: {
    fontSize: 12,
    fontWeight: "700",
  },
  newsDescription: {
    marginTop: 10,
    color: "#4b5563",
    fontSize: 15,
    lineHeight: 22,
  },
  imageGalleryContainer: {
    marginTop: 12,
    marginBottom: 0,
    alignItems: "center",
  },
  imageGalleryContent: {
    paddingHorizontal: 2,
  },
  singleImageWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  imageWrapper: {
    position: "relative",
    marginRight: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  imageWrapperLast: {
    marginRight: 0,
  },
  newsImage: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    backgroundColor: "#e5e7eb",
  },
  imageCounter: {
    position: "absolute",
    bottom: 7,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  imageCounterText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
  },
  newsCardFooter: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    marginTop: 12,
    paddingTop: 10,
    alignItems: "flex-end",
  },
  newsCommentBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  newsCommentIcon: {
    marginTop: 1,
  },
  newsCommentBtnText: {
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "600",
  },
});
