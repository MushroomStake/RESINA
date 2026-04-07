"use client";

import { FormEvent, useMemo, useState } from "react";

type AnnouncementCommentsModalProps = {
  isOpen: boolean;
  title: string;
  isLoading: boolean;
  error: string | null;
  deletingCommentId: string | null;
  comments: Array<{
    id: string;
    parent_comment_id?: string | null;
    commenter_name: string;
    comment_body: string;
    created_at: string;
  }>;
  onClose: () => void;
  onDeleteComment: (commentId: string, commenterName: string) => void;
  onAddComment: (commentBody: string, replyToCommentId: string | null) => Promise<void>;
  isSubmittingComment: boolean;
  formatDateTime: (value: string) => string;
};

const REPLY_TOKEN_REGEX = /^\[\[reply:([^\]]+)\]\]\s*/i;
const LEGACY_MENTION_REGEX = /^@([^\s].*?)\s+/;

function parseReplyToken(body: string): { parentId: string | null; cleanBody: string } {
  const tokenMatch = body.match(REPLY_TOKEN_REGEX);
  if (tokenMatch) {
    return {
      parentId: tokenMatch[1] ?? null,
      cleanBody: body.replace(REPLY_TOKEN_REGEX, "").trim(),
    };
  }

  return {
    parentId: null,
    cleanBody: body.replace(LEGACY_MENTION_REGEX, "").trim(),
  };
}

function threadIndentClass(depth: number): string {
  if (depth <= 0) return "";
  if (depth === 1) return "ml-5 border-l border-[#d5e3f1] pl-3";
  if (depth === 2) return "ml-9 border-l border-[#d5e3f1] pl-3";
  return "ml-12 border-l border-[#d5e3f1] pl-3";
}

export function AnnouncementCommentsModal({
  isOpen,
  title,
  isLoading,
  error,
  deletingCommentId,
  comments,
  onClose,
  onDeleteComment,
  onAddComment,
  isSubmittingComment,
  formatDateTime,
}: AnnouncementCommentsModalProps) {
  const [commentInput, setCommentInput] = useState("");
  const [replyTarget, setReplyTarget] = useState<{ id: string; commenterName: string } | null>(null);

  const threadedComments = useMemo(() => {
    const commentsById = new Map(comments.map((comment) => [comment.id, comment]));

    const normalized = comments.map((comment) => {
      const parsed = parseReplyToken(comment.comment_body);
      const parentFromBody = parsed.parentId;
      const parentId = comment.parent_comment_id ?? parentFromBody;

      return {
        ...comment,
        parentId: parentId && commentsById.has(parentId) ? parentId : null,
        cleanBody: parsed.cleanBody,
      };
    });

    const byParent = new Map<string | null, typeof normalized>();
    for (const comment of normalized) {
      const list = byParent.get(comment.parentId) ?? [];
      list.push(comment);
      byParent.set(comment.parentId, list);
    }

    return { normalized, byParent };
  }, [comments]);

  if (!isOpen) {
    return null;
  }

  const handleSubmitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = commentInput.trim();
    if (!body) {
      return;
    }

    await onAddComment(body, replyTarget?.id ?? null);
    setCommentInput("");
    setReplyTarget(null);
  };

  const renderThread = (parentId: string | null, depth = 0): React.ReactNode => {
    const items = threadedComments.byParent.get(parentId) ?? [];

    return items.map((comment) => {
      const parentName = comment.parentId ? threadedComments.normalized.find((entry) => entry.id === comment.parentId)?.commenter_name : null;

      return (
        <article key={comment.id} className={`rounded-xl border border-[#dbe7f2] bg-white/90 p-3 shadow-sm ${threadIndentClass(depth)}`}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-[#64748b]">
              <span className="font-medium text-[#334155]">{comment.commenter_name}</span> on {formatDateTime(comment.created_at)}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReplyTarget({ id: comment.id, commenterName: comment.commenter_name })}
                  className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-[#475569] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
              >
                Reply
              </button>
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
          </div>

          {parentName ? (
            <p className="mt-1 text-xs font-medium text-[#475569]">Replying to {parentName}</p>
          ) : null}

          <p className="mt-1 text-sm text-[#334155]">{comment.cleanBody || "(Empty comment)"}</p>

          <div className="mt-3 space-y-3">{renderThread(comment.id, depth + 1)}</div>
        </article>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close comments modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
      />

      <div className="relative w-full max-w-3xl overflow-hidden rounded-[28px] border border-[#d7e4f2] bg-[#f8fbff] shadow-[0_26px_80px_rgba(15,23,42,0.25)]">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.18),transparent_65%)]" />
        <div className="relative z-10 flex items-center justify-between border-b border-[#d9e5f2] px-6 py-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#4f709e]">Discussion Thread</p>
            <h2 className="mt-1 text-2xl font-semibold text-[#0f2847]">Comments</h2>
            <p className="line-clamp-1 text-sm text-[#5f7ca3]">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#d0dceb] bg-white px-3 py-1.5 text-sm text-[#475569] hover:bg-[#f8fafc]"
          >
            Close
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 pb-5 pt-4">
          {isLoading ? <p className="text-sm text-[#6b7280]">Loading comments...</p> : null}
          {error ? <p className="text-sm text-[#b91c1c]">{error}</p> : null}

          {!isLoading && !error && comments.length === 0 ? (
            <p className="text-sm text-[#6b7280]">No comments yet.</p>
          ) : null}

          {!isLoading && !error && comments.length > 0 ? (
            <div className="space-y-3">
              {renderThread(null)}
            </div>
          ) : null}

          <form onSubmit={(event) => void handleSubmitComment(event)} className="mt-4 rounded-xl border border-[#dbe7f2] bg-white/90 p-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Comment as BRGY. STA. RITA</p>
            {replyTarget ? (
              <div className="mt-2 flex items-center justify-between rounded-lg bg-[#e8f1fb] px-3 py-1.5 text-xs text-[#334155]">
                <span>Replying to {replyTarget.commenterName}</span>
                <button type="button" onClick={() => setReplyTarget(null)} className="font-semibold hover:text-[#0f172a]">
                  Clear
                </button>
              </div>
            ) : null}
            <textarea
              rows={3}
              value={commentInput}
              onChange={(event) => setCommentInput(event.target.value)}
              placeholder="Write a comment..."
              className="mt-2 w-full rounded-lg border border-[#d0dceb] bg-white px-3 py-2 text-sm text-[#334155] outline-none placeholder:text-[#94a3b8] focus:border-[#9bc2e8]"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmittingComment || !commentInput.trim()}
                className="rounded-lg bg-[#2e9d5a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#257a48] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmittingComment ? "Posting..." : "Post Comment"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
