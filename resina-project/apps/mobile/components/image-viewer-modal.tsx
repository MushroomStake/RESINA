import React, { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type ImageMedia = {
  id: string;
  file_name: string;
  public_url: string;
  display_order: number;
};

type ImageViewerModalProps = {
  isVisible: boolean;
  images: ImageMedia[];
  initialIndex?: number;
  onClose: () => void;
};

export function ImageViewerModal({ isVisible, images, initialIndex = 0, onClose }: ImageViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const currentImage = images[currentIndex];
  const totalImages = images.length;

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < totalImages - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={28} color="#ffffff" />
          </Pressable>
          <Text style={styles.counterText}>
            {currentIndex + 1} / {totalImages}
          </Text>
          <View style={styles.spacer} />
        </View>

        {/* Image viewer */}
        <View style={styles.imageViewerContainer}>
          {currentImage ? (
            <Image
              source={{ uri: currentImage.public_url }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          ) : null}
        </View>

        {/* Navigation buttons */}
        {totalImages > 1 ? (
          <View style={styles.navButtonsContainer}>
            <Pressable
              onPress={handlePrevious}
              disabled={currentIndex === 0}
              style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
            >
              <Ionicons
                name="chevron-back"
                size={32}
                color={currentIndex === 0 ? "#ffffff40" : "#ffffff"}
              />
            </Pressable>

            <Pressable
              onPress={handleNext}
              disabled={currentIndex === totalImages - 1}
              style={[styles.navBtn, currentIndex === totalImages - 1 && styles.navBtnDisabled]}
            >
              <Ionicons
                name="chevron-forward"
                size={32}
                color={currentIndex === totalImages - 1 ? "#ffffff40" : "#ffffff"}
              />
            </Pressable>
          </View>
        ) : null}

        {/* Thumbnail strip (if multiple images) */}
        {totalImages > 1 ? (
          <View style={styles.thumbnailContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailScroll}
            >
              {images.map((image, index) => (
                <Pressable
                  key={image.id}
                  onPress={() => setCurrentIndex(index)}
                  style={[
                    styles.thumbnail,
                    currentIndex === index && styles.thumbnailActive,
                  ]}
                >
                  <Image
                    source={{ uri: image.public_url }}
                    style={styles.thumbnailImage}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  closeBtn: {
    padding: 8,
  },
  counterText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  spacer: {
    width: 44,
  },
  imageViewerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
  navButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 16,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  navBtn: {
    padding: 8,
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  thumbnailContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  thumbnailScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  thumbnail: {
    width: 70,
    height: 70,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  thumbnailActive: {
    borderColor: "#2ecc71",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
});
