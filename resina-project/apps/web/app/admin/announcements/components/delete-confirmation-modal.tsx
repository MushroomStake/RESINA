"use client";

type DeleteConfirmationModalProps = {
  isOpen: boolean;
  title: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  heading?: string;
  description?: string;
  confirmLabel?: string;
};

export function DeleteConfirmationModal({
  isOpen,
  title,
  isDeleting,
  onCancel,
  onConfirm,
  heading = "Delete Announcement",
  description,
  confirmLabel = "Delete",
}: DeleteConfirmationModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" onClick={onCancel} aria-label="Close delete modal" className="delete-backdrop absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
      <div className="delete-card relative w-full max-w-md overflow-hidden rounded-[28px] border border-[#d7e4f2] bg-[#f8fbff] shadow-[0_26px_80px_rgba(15,23,42,0.25)]">
        <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(239,68,68,0.22),transparent_68%)]" />
        <div className="relative z-10 px-6 py-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8b5160]">Action Required</p>
          <div className="mb-4 mt-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#fee2e2]">
            <svg viewBox="0 0 20 20" className="h-6 w-6 text-[#be123c]" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[#0f2847]">{heading}</h2>
          <p className="mt-2 text-sm text-[#5f7ca3]">
            {description ? (
              description
            ) : (
              <>
                Are you sure you want to delete <span className="font-medium text-[#374151]">&ldquo;{title}&rdquo;</span>?
                All images and comments will also be permanently removed. This action cannot be undone.
              </>
            )}
          </p>
        </div>
        <div className="relative z-10 flex items-center justify-end gap-3 border-t border-[#d9e5f2] px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="rounded-xl border border-[#d0dceb] bg-white px-4 py-2 text-sm font-medium text-[#475569] hover:bg-[#f8fafc] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="rounded-xl bg-[#be123c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9f1239] disabled:opacity-60"
          >
            {isDeleting ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>

      <style jsx>{`
        .delete-backdrop {
          animation: deleteBackdropIn 180ms ease-out both;
        }

        .delete-card {
          animation: deleteCardIn 220ms ease-out both;
        }

        @keyframes deleteBackdropIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes deleteCardIn {
          from {
            opacity: 0;
            transform: translateY(10px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
