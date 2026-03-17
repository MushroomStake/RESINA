"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ImageViewerModal } from "./components/image-viewer-modal";

type AlertLevel = "normal" | "warning" | "emergency";

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
  alert_level: AlertLevel;
  posted_by_name: string;
  created_at: string;
  announcement_media?: AnnouncementMedia[];
};

type CommentItem = {
  id: string;
  announcement_id: string;
  parent_comment_id: string | null;
  commenter_name: string;
  comment_body: string;
  created_at: string;
};

type ReplyTarget = {
  id: string;
  commenter_name: string;
};

const REPLY_TOKEN_REGEX = /^\[\[reply:([^\]]+)\]\]\s*/i;
const LEGACY_MENTION_REGEX = /^@([^\s].*?)\s+/;

function parseReplyToken(body: string): { parentId: string | null; cleanBody: string } {
  const match = body.match(REPLY_TOKEN_REGEX);
  if (!match) {
    return { parentId: null, cleanBody: body };
  }

  return {
    parentId: match[1] ?? null,
    cleanBody: body.replace(REPLY_TOKEN_REGEX, "").trim(),
  };
}

function inferLegacyParentId(cleanBody: string, previous: CommentItem[]): string | null {
  const mentionMatch = cleanBody.match(LEGACY_MENTION_REGEX);
  if (!mentionMatch) return null;

  const targetName = (mentionMatch[1] ?? "").trim().toLowerCase();
  if (!targetName) return null;

  for (let i = previous.length - 1; i >= 0; i -= 1) {
    if (previous[i].commenter_name.trim().toLowerCase() === targetName) {
      return previous[i].id;
    }
  }

  return null;
}

function normalizeAnnouncementComments(rows: CommentItem[]): CommentItem[] {
  const normalized: CommentItem[] = [];

  for (const row of rows) {
    const { parentId: tokenParentId, cleanBody } = parseReplyToken(row.comment_body ?? "");
    const fallbackParentId = inferLegacyParentId(cleanBody, normalized);

    normalized.push({
      ...row,
      parent_comment_id: row.parent_comment_id ?? tokenParentId ?? fallbackParentId,
      comment_body: cleanBody,
    });
  }

  return normalized;
}

function threadIndentClass(depth: number): string {
  if (depth <= 0) return "";
  if (depth === 1) return "ml-5";
  if (depth === 2) return "ml-10";
  if (depth === 3) return "ml-14";
  return "ml-16";
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function alertClass(level: AlertLevel): string {
  if (level === "emergency") {
    return "bg-[#fff1f2] border-[#fecdd3] text-[#be123c]";
  }

  if (level === "warning") {
    return "bg-[#fff7ed] border-[#fed7aa] text-[#c2410c]";
  }

  return "bg-[#ecfdf3] border-[#bbf7d0] text-[#15803d]";
}

export default function ResidentAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [commentsMap, setCommentsMap] = useState<Record<string, CommentItem[]>>({});
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [commentMap, setCommentMap] = useState<Record<string, string>>({});
  const [replyTargetMap, setReplyTargetMap] = useState<Record<string, ReplyTarget | null>>({});
  const [submittingMap, setSubmittingMap] = useState<Record<string, boolean>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<AnnouncementMedia[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const loadAll = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [announcementsRes, commentsRes] = await Promise.all([
        fetch("/api/announcements", { cache: "no-store" }),
        fetch("/api/announcements/comments", { cache: "no-store" }),
      ]);

      const announcementsJson = (await announcementsRes.json()) as {
        announcements?: AnnouncementItem[];
        error?: string;
      };

      const commentsJson = (await commentsRes.json()) as {
        comments?: CommentItem[];
      };

      if (!announcementsRes.ok) {
        throw new Error(announcementsJson.error ?? "Unable to load announcements.");
      }

      setAnnouncements(announcementsJson.announcements ?? []);

      const groupedRaw: Record<string, CommentItem[]> = {};
      for (const row of commentsJson.comments ?? []) {
        if (!groupedRaw[row.announcement_id]) {
          groupedRaw[row.announcement_id] = [];
        }

        groupedRaw[row.announcement_id].push(row);
      }

      const grouped: Record<string, CommentItem[]> = {};
      for (const [announcementId, rows] of Object.entries(groupedRaw)) {
        const sortedRows = [...rows].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
        grouped[announcementId] = normalizeAnnouncementComments(sortedRows);
      }

      setCommentsMap(grouped);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const totalComments = useMemo(
    () => Object.values(commentsMap).reduce((sum, arr) => sum + arr.length, 0),
    [commentsMap],
  );

  const handleSubmitComment = async (event: FormEvent<HTMLFormElement>, announcementId: string) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const commenterName = (nameMap[announcementId] ?? "").trim();
    const commentBody = (commentMap[announcementId] ?? "").trim();
    const replyTarget = replyTargetMap[announcementId] ?? null;

    if (!commenterName || !commentBody) {
      setErrorMessage("Please enter your name and comment.");
      return;
    }

    setSubmittingMap((prev) => ({ ...prev, [announcementId]: true }));

    try {
      const response = await fetch("/api/announcements/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          announcementId,
          parentCommentId: replyTarget?.id ?? null,
          commenterName,
          commentBody: replyTarget?.id ? `[[reply:${replyTarget.id}]] ${commentBody}` : commentBody,
        }),
      });

      const json = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(json.error ?? "Unable to submit comment.");
      }

      setCommentMap((prev) => ({ ...prev, [announcementId]: "" }));
      setReplyTargetMap((prev) => ({ ...prev, [announcementId]: null }));
      setSuccessMessage("Comment posted successfully.");
      await loadAll();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit comment.";
      setErrorMessage(message);
    } finally {
      setSubmittingMap((prev) => ({ ...prev, [announcementId]: false }));
    }
  };

  return (
    <main className="min-h-dvh bg-[#f3f5f5] px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-2xl border border-[#e5e7eb] bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-[#111827]">Community Announcements</h1>
              <p className="text-sm text-[#6b7280]">Read updates and leave comments for barangay staff.</p>
            </div>

            <a
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-[#d1d5db] px-4 py-2 text-sm font-medium text-[#334155] hover:bg-[#f8fafc]"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back to Home
            </a>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
            <div className="rounded-xl bg-[#f8fafc] px-4 py-3 text-[#334155]">
              <p className="text-xs uppercase tracking-wide text-[#64748b]">Announcements</p>
              <p className="text-xl font-semibold">{announcements.length}</p>
            </div>
            <div className="rounded-xl bg-[#f8fafc] px-4 py-3 text-[#334155]">
              <p className="text-xs uppercase tracking-wide text-[#64748b]">Comments</p>
              <p className="text-xl font-semibold">{totalComments}</p>
            </div>
            <div className="rounded-xl bg-[#f8fafc] px-4 py-3 text-[#334155]">
              <p className="text-xs uppercase tracking-wide text-[#64748b]">Status</p>
              <p className="text-xl font-semibold">Interactive</p>
            </div>
          </div>
        </header>

        {errorMessage ? <p className="mt-4 text-sm text-[#b91c1c]">{errorMessage}</p> : null}
        {successMessage ? <p className="mt-4 text-sm text-[#15803d]">{successMessage}</p> : null}

        <section className="mt-6 space-y-5">
          {isLoading ? (
            <div className="rounded-2xl border border-[#e5e7eb] bg-white p-5 text-sm text-[#6b7280]">Loading...</div>
          ) : announcements.length === 0 ? (
            <div className="rounded-2xl border border-[#e5e7eb] bg-white p-5 text-sm text-[#6b7280]">
              No announcements published yet.
            </div>
          ) : (
            announcements.map((announcement) => (
              <article key={announcement.id} className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-[#111827]">{announcement.title}</h2>
                    <p className="text-sm text-[#64748b]">
                      Posted by <span className="font-medium text-[#334155]">{announcement.posted_by_name}</span> on {formatDateTime(announcement.created_at)}
                    </p>
                  </div>

                  <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold uppercase ${alertClass(announcement.alert_level)}`}>
                    {announcement.alert_level}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-6 text-[#334155]">{announcement.description}</p>

                {(announcement.announcement_media ?? []).length ? (
                  <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                    {(announcement.announcement_media ?? []).map((media, index) => (
                      <button
                        key={media.id}
                        onClick={() => {
                          setSelectedImages(announcement.announcement_media ?? []);
                          setSelectedImageIndex(index);
                          setImageViewerOpen(true);
                        }}
                        className="group relative overflow-hidden rounded-xl border border-[#e5e7eb] transition hover:border-[#2ecc71]"
                        type="button"
                        aria-label={`View image ${index + 1}`}
                      >
                        <div className="relative h-28 w-full">
                          <Image src={media.public_url} alt={media.file_name} fill className="object-cover" unoptimized />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="mt-5 rounded-xl border border-[#374151] bg-[#111827] p-4">
                  <p className="text-sm font-medium text-[#e5e7eb]">Leave a comment</p>

                  {replyTargetMap[announcement.id] ? (
                    <div className="mt-3 flex items-center justify-between rounded-lg bg-[#1e3a8a] px-3 py-2 text-xs text-[#93c5fd]">
                      <p>
                        Replying to <span className="font-semibold">{replyTargetMap[announcement.id]?.commenter_name}</span>
                      </p>
                      <button
                        type="button"
                        className="font-semibold text-[#93c5fd] hover:text-[#dbeafe]"
                        onClick={() =>
                          setReplyTargetMap((prev) => ({
                            ...prev,
                            [announcement.id]: null,
                          }))
                        }
                      >
                        Clear
                      </button>
                    </div>
                  ) : null}

                  <form className="mt-3 space-y-3" onSubmit={(event) => void handleSubmitComment(event, announcement.id)}>
                    <input
                      type="text"
                      placeholder="Your name"
                      value={nameMap[announcement.id] ?? ""}
                      onChange={(event) =>
                        setNameMap((prev) => ({
                          ...prev,
                          [announcement.id]: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-[#4b5563] bg-[#1f2937] px-4 py-2.5 text-sm text-[#e5e7eb] outline-none placeholder:text-[#9ca3af] focus:border-[#2e9d5a] focus:ring-2 focus:ring-[#2e9d5a]/20"
                    />

                    <textarea
                      rows={3}
                      placeholder="Write your comment"
                      value={commentMap[announcement.id] ?? ""}
                      onChange={(event) =>
                        setCommentMap((prev) => ({
                          ...prev,
                          [announcement.id]: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-[#4b5563] bg-[#1f2937] px-4 py-2.5 text-sm text-[#e5e7eb] outline-none placeholder:text-[#9ca3af] focus:border-[#2e9d5a] focus:ring-2 focus:ring-[#2e9d5a]/20"
                    />

                    <button
                      type="submit"
                      disabled={Boolean(submittingMap[announcement.id])}
                      className="rounded-xl bg-[#2e9d5a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#257a48] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {submittingMap[announcement.id] ? "Posting..." : "Post Comment"}
                    </button>
                  </form>

                  <div className="mt-4 space-y-2 rounded-xl bg-[#111827] p-4">
                    {(commentsMap[announcement.id] ?? []).length === 0 ? (
                      <p className="text-sm text-[#9ca3af]">No comments yet.</p>
                    ) : (
                      (() => {
                        const comments = commentsMap[announcement.id] ?? [];
                        const byParent = new Map<string | null, CommentItem[]>();

                        for (const comment of comments) {
                          const key = comment.parent_comment_id ?? null;
                          const list = byParent.get(key) ?? [];
                          list.push(comment);
                          byParent.set(key, list);
                        }

                        const renderThread = (parentId: string | null, depth = 0): React.ReactNode => {
                          const items = byParent.get(parentId) ?? [];

                          return items.map((comment) => (
                            <div key={comment.id} className={`py-1 ${threadIndentClass(depth)}`}>
                              <div className="flex items-start gap-2 rounded-lg bg-[#1f2937] p-3">
                                <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-[#9ca3af]" fill="none" stroke="currentColor" strokeWidth="1.8">
                                  <circle cx="12" cy="8" r="3.25" />
                                  <path d="M4.5 19.5c1.6-3 4.2-4.5 7.5-4.5s5.9 1.5 7.5 4.5" strokeLinecap="round" />
                                </svg>

                                <div className="min-w-0 flex-1">
                                  <p className="text-sm leading-6 text-[#e5e7eb]">
                                    <span className="font-semibold text-[#f3f4f6]">{comment.commenter_name}</span>{" "}
                                    {comment.comment_body}
                                  </p>

                                  <div className="mt-1 flex items-center gap-3 text-[11px] text-[#9ca3af]">
                                    <span>{formatDateTime(comment.created_at)}</span>
                                    <button
                                      type="button"
                                      className="font-semibold text-[#9ca3af] hover:text-[#d1d5db]"
                                      onClick={() =>
                                        setReplyTargetMap((prev) => ({
                                          ...prev,
                                          [announcement.id]: {
                                            id: comment.id,
                                            commenter_name: comment.commenter_name,
                                          },
                                        }))
                                      }
                                    >
                                      Reply
                                    </button>
                                  </div>

                                  {renderThread(comment.id, depth + 1)}
                                </div>
                              </div>
                            </div>
                          ));
                        };

                        return <>{renderThread(null)}</>;
                      })()
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </div>

      <ImageViewerModal
        isOpen={imageViewerOpen}
        images={selectedImages}
        initialIndex={selectedImageIndex}
        onClose={() => setImageViewerOpen(false)}
      />
    </main>
  );
}
