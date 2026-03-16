"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";

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
  commenter_name: string;
  comment_body: string;
  created_at: string;
};

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
  const [submittingMap, setSubmittingMap] = useState<Record<string, boolean>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
        comments?: Array<CommentItem & { announcement_id: string }>;
      };

      if (!announcementsRes.ok) {
        throw new Error(announcementsJson.error ?? "Unable to load announcements.");
      }

      setAnnouncements(announcementsJson.announcements ?? []);

      const grouped: Record<string, CommentItem[]> = {};
      for (const row of commentsJson.comments ?? []) {
        if (!grouped[row.announcement_id]) {
          grouped[row.announcement_id] = [];
        }

        grouped[row.announcement_id].push({
          id: row.id,
          commenter_name: row.commenter_name,
          comment_body: row.comment_body,
          created_at: row.created_at,
        });
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
          commenterName,
          commentBody,
        }),
      });

      const json = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(json.error ?? "Unable to submit comment.");
      }

      setCommentMap((prev) => ({ ...prev, [announcementId]: "" }));
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
                    {(announcement.announcement_media ?? []).map((media) => (
                      <a
                        key={media.id}
                        href={media.public_url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open image ${media.file_name}`}
                        title={`Open image ${media.file_name}`}
                        className="overflow-hidden rounded-xl border border-[#e5e7eb]"
                      >
                        <div className="relative h-28 w-full">
                          <Image src={media.public_url} alt={media.file_name} fill className="object-cover" unoptimized />
                        </div>
                      </a>
                    ))}
                  </div>
                ) : null}

                <div className="mt-5 rounded-xl border border-[#e5e7eb] bg-[#fcfcfd] p-4">
                  <p className="text-sm font-medium text-[#374151]">Leave a comment</p>

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
                      className="w-full rounded-xl border border-[#d1d5db] px-4 py-2.5 text-sm outline-none focus:border-[#2e9d5a] focus:ring-2 focus:ring-[#2e9d5a]/20"
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
                      className="w-full rounded-xl border border-[#d1d5db] px-4 py-2.5 text-sm outline-none focus:border-[#2e9d5a] focus:ring-2 focus:ring-[#2e9d5a]/20"
                    />

                    <button
                      type="submit"
                      disabled={Boolean(submittingMap[announcement.id])}
                      className="rounded-xl bg-[#2e9d5a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#257a48] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {submittingMap[announcement.id] ? "Posting..." : "Post Comment"}
                    </button>
                  </form>

                  <div className="mt-4 space-y-2">
                    {(commentsMap[announcement.id] ?? []).length === 0 ? (
                      <p className="text-sm text-[#6b7280]">No comments yet.</p>
                    ) : (
                      (commentsMap[announcement.id] ?? []).map((comment) => (
                        <div key={comment.id} className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-2">
                          <p className="text-xs text-[#64748b]">
                            <span className="font-medium text-[#334155]">{comment.commenter_name}</span> • {formatDateTime(comment.created_at)}
                          </p>
                          <p className="mt-1 text-sm text-[#334155]">{comment.comment_body}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
