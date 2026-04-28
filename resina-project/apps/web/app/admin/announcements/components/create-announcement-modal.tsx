"use client";

import Image from "next/image";
import Portal from "../../../components/portal";

type AlertLevel = "normal" | "warning" | "emergency";

type PendingUpload = {
  id: string;
  file: File;
  previewUrl: string;
};

type AnnouncementMedia = {
  id: string;
  announcement_id: string;
  file_name: string;
  public_url: string;
  storage_path: string;
};

type CreateAnnouncementModalProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  mode: "create" | "edit";
  title: string;
  description: string;
  alertLevel: AlertLevel;
  pendingUploads: PendingUpload[];
  existingMedia: AnnouncementMedia[];
  formError: string | null;
  onClose: () => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onAlertLevelChange: (value: AlertLevel) => void;
  onSelectImages: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePending: (id: string) => void;
  onRemoveExisting: (media: AnnouncementMedia) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function CreateAnnouncementModal({
  isOpen,
  isSubmitting,
  mode,
  title,
  description,
  alertLevel,
  pendingUploads,
  existingMedia,
  formError,
  onClose,
  onTitleChange,
  onDescriptionChange,
  onAlertLevelChange,
  onSelectImages,
  onRemovePending,
  onRemoveExisting,
  onSubmit,
}: CreateAnnouncementModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button type="button" onClick={onClose} aria-label="Close modal" className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
        <div className="relative w-full max-w-3xl overflow-hidden rounded-[28px] border border-[#d7e4f2] bg-[#f8fbff] shadow-[0_26px_80px_rgba(15,23,42,0.25)]">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.18),transparent_65%)]" />
        <div className="relative z-10 flex items-center justify-between border-b border-[#d9e5f2] px-6 py-4">
          <div>
            <h2 className="text-2xl font-semibold text-[#0f2847]">
              {mode === "edit" ? "Update Announcement" : "Create New Announcement"}
            </h2>
            <p className="text-sm text-[#5f7ca3]">
              {mode === "edit" ? "Edit the post details and manage images." : "Draft and publish alerts for residents."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#d0dceb] bg-white px-3 py-1.5 text-sm text-[#475569] hover:bg-[#f8fafc]"
          >
            Close
          </button>
        </div>

        <form onSubmit={onSubmit} className="max-h-[80vh] space-y-4 overflow-y-auto px-6 py-5">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[#374151]">Headline</span>
            <input
              type="text"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder="e.g. Flood Alert: Riverside Zone"
              className="w-full rounded-xl border border-[#d0dceb] bg-white px-4 py-3 text-sm outline-none focus:border-[#2e9d5a] focus:ring-2 focus:ring-[#2e9d5a]/20"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[#374151]">Description</span>
            <textarea
              rows={5}
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              placeholder="Describe the update for residents..."
              className="w-full rounded-xl border border-[#d0dceb] bg-white px-4 py-3 text-sm outline-none focus:border-[#2e9d5a] focus:ring-2 focus:ring-[#2e9d5a]/20"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[#374151]">Emergency Alert</span>
              <select
                value={alertLevel}
                onChange={(event) => onAlertLevelChange(event.target.value as AlertLevel)}
                className="w-full rounded-xl border border-[#d0dceb] bg-white px-4 py-3 text-sm outline-none focus:border-[#2e9d5a] focus:ring-2 focus:ring-[#2e9d5a]/20"
              >
                <option value="normal">Normal</option>
                <option value="warning">Warning</option>
                <option value="emergency">Emergency</option>
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[#374151]">
                {mode === "edit" ? "Add More Images" : "Attach Images (multiple)"}
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={onSelectImages}
                className="block w-full rounded-xl border border-[#d0dceb] bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#e9f7ec] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[#2e9d5a]"
              />
            </label>
          </div>

          {mode === "edit" && existingMedia.length > 0 ? (
            <div className="rounded-xl border border-[#e5e7eb] p-3">
              <p className="mb-2 text-sm font-medium text-[#374151]">Published Images</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {existingMedia.map((media) => (
                  <div key={media.id} className="overflow-hidden rounded-lg border border-[#e5e7eb] bg-[#f8fafc]">
                    <div className="relative h-24 w-full">
                      <Image src={media.public_url} alt={media.file_name} fill className="object-cover" unoptimized />
                    </div>
                    <div className="p-2">
                      <p className="line-clamp-1 text-xs text-[#475569]" title={media.file_name}>
                        {media.file_name}
                      </p>
                      <button
                        type="button"
                        onClick={() => onRemoveExisting(media)}
                        className="mt-1 w-full rounded-md bg-[#fee2e2] px-2 py-1 text-xs font-medium text-[#b91c1c]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-dashed border-[#d0dceb] bg-white/75 p-3">
            <p className="mb-2 text-sm font-medium text-[#374151]">
              {mode === "edit" ? "New Images to Upload" : "Image Preview"}
            </p>
            {!pendingUploads.length ? (
              <p className="text-sm text-[#6b7280]">No image selected.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {pendingUploads.map((upload) => (
                  <div key={upload.id} className="overflow-hidden rounded-lg border border-[#e5e7eb] bg-[#f8fafc]">
                    <div className="relative h-24 w-full">
                      <Image src={upload.previewUrl} alt={upload.file.name} fill className="object-cover" unoptimized />
                    </div>
                    <div className="p-2">
                      <p className="line-clamp-1 text-xs text-[#475569]" title={upload.file.name}>
                        {upload.file.name}
                      </p>
                      <button
                        type="button"
                        onClick={() => onRemovePending(upload.id)}
                        className="mt-1 w-full rounded-md bg-[#fee2e2] px-2 py-1 text-xs font-medium text-[#b91c1c]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {formError ? <p className="text-sm text-[#b91c1c]">{formError}</p> : null}

          <div className="flex items-center justify-end gap-2 border-t border-[#d9e5f2] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#d0dceb] bg-white px-4 py-2 text-sm font-medium text-[#475569] hover:bg-[#f8fafc]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-[#2e9d5a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#257a48] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting
                ? mode === "edit"
                  ? "Saving…"
                  : "Publishing…"
                : mode === "edit"
                  ? "Save Changes"
                  : "Publish Now"}
            </button>
          </div>
        </form>
        </div>
      </div>
    </Portal>
  );
}
