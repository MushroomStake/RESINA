"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { DeleteConfirmationModal } from "./delete-confirmation-modal";

type AnnouncementCommentsModalProps = {
  isOpen: boolean;
  title: string;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  deletingCommentId: string | null;
  hasMoreComments: boolean;
  totalCount: number;
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
  onLoadMoreComments: () => void;
  isSubmittingComment: boolean;
  formatDateTime: (value: string) => string;
};

const REPLY_TOKEN_REGEX = /^\[\[reply:([^\]]+)\]\]\s*/i;
const LEGACY_MENTION_REGEX = /^@([^\s].*?)\s+/;
const ADMIN_COMMENTER_NAME = "BRGY. STA. RITA";
const ADMIN_AVATAR_SRC = "/images/Sta%20Rita%20Icon.png";
const USER_AVATAR_SRC = "/Profile/user.png";

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
  if (depth === 1) return "ml-5";
  if (depth === 2) return "ml-9";
  return "ml-11";
}

function formatCommentAge(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Now";

  const diffMs = Date.now() - parsed.getTime();
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return `${mins}m`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function resolveAvatarSrc(commenterName: string): string {
  return commenterName.trim().toLowerCase() === ADMIN_COMMENTER_NAME.toLowerCase() ? ADMIN_AVATAR_SRC : USER_AVATAR_SRC;
}

function shouldShowCommentSeeMore(body: string): boolean {
  const normalized = body ?? "";
  const lineCount = normalized.split(/\r?\n/).length;
  return normalized.length > 180 || lineCount > 3;
}

function getCollapsedCommentPreview(body: string): string {
  const normalized = body ?? "";
  const lines = normalized.split(/\r?\n/);

  if (lines.length > 3) {
    return `${lines.slice(0, 3).join("\n")}...`;
  }

  if (normalized.length > 180) {
    return `${normalized.slice(0, 180).trimEnd()}...`;
  }

  return normalized;
}

export function AnnouncementCommentsModal({
  isOpen,
  title,
  isLoading,
  isLoadingMore,
  error,
  deletingCommentId,
  hasMoreComments,
  totalCount,
  comments,
  onClose,
  onDeleteComment,
  onAddComment,
  onLoadMoreComments,
  isSubmittingComment,
  formatDateTime,
}: AnnouncementCommentsModalProps) {
  const [commentInput, setCommentInput] = useState("");
  const [replyTarget, setReplyTarget] = useState<{ id: string; commenterName: string } | null>(null);
  const [collapsedCommentIds, setCollapsedCommentIds] = useState<Set<string>>(new Set());
  const [expandedCommentIds, setExpandedCommentIds] = useState<Set<string>>(new Set());
  const [pendingDeleteComment, setPendingDeleteComment] = useState<{ id: string; commenterName: string } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setCommentInput("");
      setReplyTarget(null);
      setCollapsedCommentIds(new Set());
      setExpandedCommentIds(new Set());
      setPendingDeleteComment(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const parentIds = new Set<string>();
    const commentIds = new Set(comments.map((comment) => comment.id));

    for (const comment of comments) {
      const parsed = parseReplyToken(comment.comment_body);
      const parentId = comment.parent_comment_id ?? parsed.parentId;

      if (parentId && commentIds.has(parentId)) {
        parentIds.add(parentId);
      }
    }

    setCollapsedCommentIds((prev) => {
      const next = new Set(prev);
      for (const id of parentIds) {
        next.add(id);
      }
      return next;
    });
  }, [comments]);

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

  const handleToggleCommentCollapse = (commentId: string) => {
    setCollapsedCommentIds((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  const renderThread = (parentId: string | null, depth = 0): React.ReactNode => {
    const items = threadedComments.byParent.get(parentId) ?? [];

    return items.map((comment) => {
      const parentName = comment.parentId ? threadedComments.normalized.find((entry) => entry.id === comment.parentId)?.commenter_name : null;
      const childCount = threadedComments.byParent.get(comment.id)?.length ?? 0;
      const isCollapsed = collapsedCommentIds.has(comment.id);
      const isExpandedComment = expandedCommentIds.has(comment.id);
      const commentBody = comment.cleanBody || "(Empty comment)";
      const isLongComment = shouldShowCommentSeeMore(commentBody);
      const previewBody = isExpandedComment ? commentBody : getCollapsedCommentPreview(commentBody);

      return (
        <article key={comment.id} className={`py-2 ${threadIndentClass(depth)}`}>
          <div className="flex items-start gap-2">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[#d8e4f1] bg-[#e7eef8] sm:h-11 sm:w-11">
              <Image
                src={resolveAvatarSrc(comment.commenter_name)}
                alt={comment.commenter_name}
                width={44}
                height={44}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[15px] leading-6 text-[#2f343d]">
                <span className="block font-bold text-[#111827]">{comment.commenter_name}</span>
                <span className={`block whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${isExpandedComment ? "" : "line-clamp-3"}`}>
                  {previewBody}
                </span>
              </p>
              {isLongComment ? (
                <button
                  type="button"
                  onClick={() => {
                    setExpandedCommentIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(comment.id)) {
                        next.delete(comment.id);
                      } else {
                        next.add(comment.id);
                      }
                      return next;
                    });
                  }}
                  className="mt-1 text-xs font-semibold text-[#4f84db] hover:text-[#2f6ed2]"
                >
                  {isExpandedComment ? "See less" : "See more"}
                </button>
              ) : null}

              {parentName ? (
                <p className="mt-0.5 text-[11px] font-semibold text-[#6b7280]">Replying to {parentName}</p>
              ) : null}

              <div className="mt-1.5 flex items-center gap-3 text-[11px]">
                <span className="text-[#9ca3af]" title={formatDateTime(comment.created_at)}>
                  {formatCommentAge(comment.created_at)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setReplyTarget({ id: comment.id, commenterName: comment.commenter_name });
                    setCollapsedCommentIds((prev) => {
                      const next = new Set(prev);
                      next.delete(comment.id);
                      return next;
                    });
                  }}
                  className="font-semibold text-[#8b8f98] hover:text-[#4b5563]"
                >
                  Reply
                </button>
                <button
                  type="button"
                  disabled={deletingCommentId === comment.id}
                  onClick={() => setPendingDeleteComment({ id: comment.id, commenterName: comment.commenter_name })}
                  title="Remove comment"
                  aria-label="Remove comment"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#9ca3af] hover:bg-[#fee2e2] hover:text-[#b91c1c] disabled:opacity-40"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M6 6l1 14h10l1-14" />
                    <path d="M10 11v5" />
                    <path d="M14 11v5" />
                  </svg>
                </button>
              </div>

              {childCount > 0 ? (
                <button
                  type="button"
                  className="mt-1.5 text-[14px] font-medium text-[#4f84db] hover:text-[#2f6ed2]"
                  onClick={() => handleToggleCommentCollapse(comment.id)}
                >
                  {isCollapsed
                    ? `View ${childCount} more repl${childCount === 1 ? "y" : "ies"}`
                    : "Hide replies"}
                </button>
              ) : null}

              {!isCollapsed ? (
                <div className="mt-1.5">{renderThread(comment.id, depth + 1)}</div>
              ) : null}
            </div>
          </div>
        </article>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-3">
      <button
        type="button"
        aria-label="Close comments modal"
        onClick={onClose}
        className="comments-backdrop absolute inset-0 bg-black/55"
      />

      <div className="comments-modal-shell relative z-10 flex max-h-[calc(100vh-16px)] w-[calc(100vw-8px)] max-w-[2300px] flex-col overflow-hidden rounded-[26px] border border-[#d1d5db] bg-white shadow-[0_22px_60px_rgba(15,23,42,0.28)] sm:w-[calc(100vw-24px)]">
        <div className="flex items-start justify-between border-b border-[#e5e7eb] px-6 py-5 sm:px-8">
          <div>
            <h2 className="text-[34px] font-bold leading-tight text-[#1f2937] sm:text-[40px]">Comments</h2>
            <p className="mt-1 line-clamp-1 text-[13px] font-semibold text-[#6b7280]">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#374151] px-4 py-1.5 text-sm font-semibold text-[#4b5563] hover:bg-[#f9fafb]"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#f3f4f6] px-6 pt-4 sm:px-8">
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-[#dbe7f2] bg-white/85 px-4 py-3 text-xs font-semibold text-[#64748b] shadow-sm">
            <span>{totalCount} comment{totalCount === 1 ? "" : "s"}</span>
            {hasMoreComments ? <span>More comments available</span> : <span>All comments loaded</span>}
          </div>

          {isLoading ? <p className="text-sm text-[#6b7280]">Loading comments...</p> : null}
          {error ? <p className="text-sm font-semibold text-[#b91c1c]">{error}</p> : null}

          {!isLoading && !error && comments.length === 0 ? (
            <p className="text-sm text-[#6b7280]">No comments yet.</p>
          ) : null}

          {!isLoading && !error && comments.length > 0 ? (
            <div className="space-y-1 pb-4">
              {renderThread(null)}
            </div>
          ) : null}

          {!isLoading && !error && hasMoreComments ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={onLoadMoreComments}
                disabled={isLoadingMore}
                className="rounded-full border border-[#cbd5e1] bg-white px-4 py-2 text-sm font-semibold text-[#334155] shadow-sm transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[#f8fafc] disabled:translate-y-0 disabled:opacity-60"
              >
                {isLoadingMore ? "Loading more..." : "Load more comments"}
              </button>
            </div>
          ) : null}

          <form onSubmit={(event) => void handleSubmitComment(event)} className="sticky bottom-0 z-20 mt-4 -mx-6 border-t border-[#e5e7eb] bg-white pb-4 pt-3 sm:-mx-8">
            {replyTarget ? (
              <div className="mx-3 mb-2 flex items-center justify-between rounded-full bg-[#eef2ff] px-3 py-1.5 text-xs text-[#4f46e5] sm:mx-5">
                <span>Replying to {replyTarget.commenterName}</span>
                <button type="button" onClick={() => setReplyTarget(null)} className="font-semibold text-[#6b7280] hover:text-[#111827]">
                  Clear
                </button>
              </div>
            ) : null}

            <div className="flex w-full items-end gap-3 px-2 sm:px-4">
              <div className="flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[#d8e4f1] bg-[#e7eef8] sm:h-11 sm:w-11">
                <Image src={ADMIN_AVATAR_SRC} alt="BRGY. STA. RITA" width={44} height={44} className="h-full w-full object-cover" />
              </div>
              <textarea
                value={commentInput}
                onChange={(event) => setCommentInput(event.target.value)}
                placeholder="Write a comment..."
                rows={3}
                className="min-h-[88px] w-full flex-1 resize-none rounded-md bg-[#f3f4f6] px-3 py-2.5 text-sm leading-6 text-[#111827] outline-none placeholder:text-[#9ca3af]"
              />
              <button
                type="submit"
                disabled={isSubmittingComment || !commentInput.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#6b7280] disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Send comment"
              >
                {isSubmittingComment ? (
                  <span className="text-sm font-bold">...</span>
                ) : (
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 2L11 13" />
                    <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                  </svg>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <DeleteConfirmationModal
        isOpen={pendingDeleteComment !== null}
        title={pendingDeleteComment?.commenterName ?? "this comment"}
        isDeleting={deletingCommentId === pendingDeleteComment?.id}
        onCancel={() => setPendingDeleteComment(null)}
        onConfirm={() => {
          if (!pendingDeleteComment) {
            return;
          }

          onDeleteComment(pendingDeleteComment.id, pendingDeleteComment.commenterName);
          setPendingDeleteComment(null);
        }}
        heading="Delete Comment"
        description={
          pendingDeleteComment
            ? `Are you sure you want to delete this comment by ${pendingDeleteComment.commenterName}? This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete Comment"
      />

      <style jsx>{`
        .comments-backdrop {
          animation: commentsBackdropIn 180ms ease-out both;
        }

        .comments-modal-shell {
          animation: commentsModalIn 240ms cubic-bezier(0.16, 1, 0.3, 1) both;
          transform-origin: center bottom;
        }

        @keyframes commentsBackdropIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes commentsModalIn {
          from {
            opacity: 0;
            transform: translateY(18px) scale(0.985);
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
