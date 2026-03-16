"use client";

type DeleteConfirmationModalProps = {
  isOpen: boolean;
  title: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteConfirmationModal({
  isOpen,
  title,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteConfirmationModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#e5e7eb] bg-white shadow-2xl">
        <div className="px-6 py-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#fee2e2]">
            <svg viewBox="0 0 20 20" className="h-6 w-6 text-[#be123c]" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[#111827]">Delete Announcement</h2>
          <p className="mt-2 text-sm text-[#6b7280]">
            Are you sure you want to delete{" "}
            <span className="font-medium text-[#374151]">&ldquo;{title}&rdquo;</span>? All images and
            comments will also be permanently removed. This action cannot be undone.
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-[#e5e7eb] px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-xl border border-[#d1d5db] px-4 py-2 text-sm font-medium text-[#475569] hover:bg-[#f8fafc] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="rounded-xl bg-[#be123c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9f1239] disabled:opacity-60"
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
