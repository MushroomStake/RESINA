"use client";

type AnnouncementCommentsModalProps = {
  isOpen: boolean;
  title: string;
  isLoading: boolean;
  error: string | null;
  deletingCommentId: string | null;
  comments: Array<{
    id: string;
    commenter_name: string;
    comment_body: string;
    created_at: string;
  }>;
  onClose: () => void;
  onDeleteComment: (commentId: string, commenterName: string) => void;
  formatDateTime: (value: string) => string;
};

export function AnnouncementCommentsModal({
  isOpen,
  title,
  isLoading,
  error,
  deletingCommentId,
  comments,
  onClose,
  onDeleteComment,
  formatDateTime,
}: AnnouncementCommentsModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-2xl border border-[#e5e7eb] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#e5e7eb] px-6 py-4">
          <div>
            <h2 className="text-2xl font-semibold text-[#111827]">Comments</h2>
            <p className="line-clamp-1 text-sm text-[#6b7280]">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#d1d5db] px-3 py-1.5 text-sm text-[#475569] hover:bg-[#f8fafc]"
          >
            Close
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {isLoading ? <p className="text-sm text-[#6b7280]">Loading comments...</p> : null}
          {error ? <p className="text-sm text-[#b91c1c]">{error}</p> : null}

          {!isLoading && !error && comments.length === 0 ? (
            <p className="text-sm text-[#6b7280]">No comments yet.</p>
          ) : null}

          {!isLoading && !error && comments.length > 0 ? (
            <div className="space-y-3">
              {comments.map((comment) => (
                <article key={comment.id} className="rounded-xl border border-[#e5e7eb] bg-[#fcfcfd] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-[#64748b]">
                      <span className="font-medium text-[#334155]">{comment.commenter_name}</span> on {formatDateTime(comment.created_at)}
                    </p>
                    <button
                      type="button"
                      disabled={deletingCommentId === comment.id}
                      onClick={() => onDeleteComment(comment.id, comment.commenter_name)}
                      title="Remove comment"
                      aria-label="Remove comment"
                      className="shrink-0 rounded-md p-1 text-[#9ca3af] hover:bg-[#fee2e2] hover:text-[#b91c1c] disabled:opacity-40"
                    >
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-[#334155]">{comment.comment_body}</p>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
