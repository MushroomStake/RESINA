"use client";

import Image from "next/image";
import { useState } from "react";

type AnnouncementMedia = {
  id: string;
  file_name: string;
  public_url: string;
  storage_path?: string;
};

type ImageViewerModalProps = {
  isOpen: boolean;
  images: AnnouncementMedia[];
  initialIndex?: number;
  onClose: () => void;
};

export function ImageViewerModal({
  isOpen,
  images,
  initialIndex = 0,
  onClose,
}: ImageViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const currentImage = images[currentIndex];
  const totalImages = images.length;

  if (!isOpen || !currentImage) {
    return null;
  }

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

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-viewer-title"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-6 top-6 z-50 rounded-lg bg-white/10 p-2 text-white transition hover:bg-white/20"
        aria-label="Close image viewer"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      {/* Image counter */}
      <div className="absolute left-6 top-6 text-lg font-semibold text-white">
        {currentIndex + 1} / {totalImages}
      </div>

      {/* Main image container */}
      <div className="relative w-full h-full flex items-center justify-center px-20">
        <Image
          src={currentImage.public_url}
          alt={currentImage.file_name}
          width={1200}
          height={900}
          className="max-h-[90vh] max-w-[90vw] w-auto h-auto object-contain"
          unoptimized
          priority
        />
      </div>

      {/* Navigation buttons */}
      {totalImages > 1 && (
        <>
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="absolute left-6 top-1/2 z-50 -translate-y-1/2 rounded-lg bg-white/10 p-3 text-white transition hover:bg-white/20 disabled:opacity-40"
            aria-label="Previous image"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <button
            onClick={handleNext}
            disabled={currentIndex === totalImages - 1}
            className="absolute right-6 top-1/2 z-50 -translate-y-1/2 rounded-lg bg-white/10 p-3 text-white transition hover:bg-white/20 disabled:opacity-40"
            aria-label="Next image"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </>
      )}

      {/* Thumbnail strip */}
      {totalImages > 1 && (
        <div className="absolute bottom-6 left-1/2 z-50 flex -translate-x-1/2 gap-3 overflow-x-auto rounded-lg bg-black/40 p-3 backdrop-blur-sm">
          {images.map((image, index) => (
            <button
              key={image.id}
              onClick={() => setCurrentIndex(index)}
              className={`h-16 w-16 overflow-hidden rounded-lg border-2 transition ${
                currentIndex === index
                  ? "border-green-400"
                  : "border-white/30 hover:border-white/50"
              }`}
              aria-label={`Go to image ${index + 1}`}
            >
              <Image
                src={image.public_url}
                alt={`Thumbnail ${index + 1}`}
                width={64}
                height={64}
                className="h-full w-full object-cover"
                unoptimized
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
