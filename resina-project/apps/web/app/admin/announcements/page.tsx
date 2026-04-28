"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { AnnouncementCommentsModal } from "./components/announcement-comments-modal";
import { CreateAnnouncementModal } from "./components/create-announcement-modal";
import { DeleteConfirmationModal } from "./components/delete-confirmation-modal";
import { ImageViewerModal } from "@/app/admin/announcements/components/image-viewer-modal";
import StatusFeedbackModal from "../components/status-feedback-modal";
import { AdminPageSkeleton } from "../components/admin-skeleton";

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

type AnnouncementRow = {
  id: string;
  title: string;
  description: string;
  alert_level: AlertLevel;
  posted_by_name: string;
  created_at: string;
  announcement_media?: AnnouncementMedia[];
};

type CommentRow = {
  id: string;
  announcement_id: string;
  parent_comment_id?: string | null;
  commenter_name: string;
  comment_body: string;
  created_at: string;
};

type CommentsResponse = {
  comments?: CommentRow[];
  totalCount?: number;
  hasMore?: boolean;
  page?: number;
  limit?: number;
  error?: string;
};

type ProfileRow = {
  full_name: string | null;
  email: string | null;
};

const BUCKET_NAME = "announcement-images";
const ADMIN_COMMENTER_NAME = "BRGY. STA. RITA";
const COMMENTS_PAGE_SIZE = 12;

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

function formatDateShort(value: string): string {
  return new Date(value).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function cleanFileName(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9.\-_]/g, "-");
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesNormalized(haystack: string, query: string): boolean {
  if (!query) {
    return true;
  }

  return normalizeSearchText(haystack).includes(query);
}

function alertPillClass(level: AlertLevel): string {
  if (level === "emergency") {
    return "bg-[#fff1f2] text-[#be123c] border-[#fecdd3]";
  }

  if (level === "warning") {
    return "bg-[#fff7ed] text-[#c2410c] border-[#fed7aa]";
  }

  return "bg-[#ecfdf3] text-[#15803d] border-[#bbf7d0]";
}

export default function AdminAnnouncementsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [isChecking, setIsChecking] = useState(true);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCommentsModalOpen, setIsCommentsModalOpen] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isLoadingMoreComments, setIsLoadingMoreComments] = useState(false);
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentsTotalCount, setCommentsTotalCount] = useState(0);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [postedByName, setPostedByName] = useState("Unknown Admin");
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementRow | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [alertLevel, setAlertLevel] = useState<AlertLevel>("normal");
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);

  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [selectedComments, setSelectedComments] = useState<CommentRow[]>([]);

  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState<string | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementRow | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<AnnouncementRow | null>(null);

  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<AnnouncementMedia[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [expandedHeadlineIds, setExpandedHeadlineIds] = useState<Set<string>>(new Set());
  const [expandedDescriptionIds, setExpandedDescriptionIds] = useState<Set<string>>(new Set());
  const [alertFilter, setAlertFilter] = useState<"all" | AlertLevel>("all");
  const [personnelCount, setPersonnelCount] = useState(0);
  const [statusVisible, setStatusVisible] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusVariant, setStatusVariant] = useState<"success" | "error" | "info">("info");

  const showStatus = (variant: "success" | "error" | "info", message: string) => {
    setStatusVariant(variant);
    setStatusMessage(message);
    setStatusVisible(true);
  };

  const loadAnnouncements = async () => {
    setIsLoadingAnnouncements(true);
    setPageError(null);

    const { data, error } = await supabase
      .from("announcements")
      .select("id, title, description, alert_level, posted_by_name, created_at, announcement_media(id, announcement_id, file_name, public_url, storage_path)")
      .order("created_at", { ascending: false });

    if (error) {
      setPageError(error.message);
      setAnnouncements([]);
      setIsLoadingAnnouncements(false);
      return;
    }

    setAnnouncements((data ?? []) as AnnouncementRow[]);
    setIsLoadingAnnouncements(false);
  };

  const loadCommentsPage = async (announcementId: string, page = 1, mode: "replace" | "append" = "replace") => {
    if (mode === "replace") {
      setIsLoadingComments(true);
      setCommentsError(null);
    } else {
      setIsLoadingMoreComments(true);
    }

    const response = await fetch(
      `/api/announcements/comments?announcementId=${encodeURIComponent(announcementId)}&page=${page}&limit=${COMMENTS_PAGE_SIZE}`,
      { method: "GET", cache: "no-store" },
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as CommentsResponse;
      const message = payload.error ?? "Failed to load comments.";
      setCommentsError(message);
      setIsLoadingComments(false);
      setIsLoadingMoreComments(false);
      return;
    }

    const payload = (await response.json()) as CommentsResponse;
    const nextComments = payload.comments ?? [];

    setCommentsTotalCount(payload.totalCount ?? nextComments.length);
    setCommentsHasMore(Boolean(payload.hasMore));
    setCommentsPage(page);

    if (mode === "append") {
      setSelectedComments((prev) => {
        const merged = [...prev, ...nextComments];
        const deduped = merged.filter((entry, index, list) => list.findIndex((candidate) => candidate.id === entry.id) === index);
        return deduped;
      });
    } else {
      setSelectedComments(nextComments);
    }

    setIsLoadingComments(false);
    setIsLoadingMoreComments(false);
  };

  const loadPersonnelCount = async () => {
    const { count, error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .in("role", ["admin", "member"]);

    if (error) {
      return;
    }

    setPersonnelCount(count ?? 0);
  };

  useEffect(() => {
    const initialize = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        router.replace("/admin");
        return;
      }

      setSessionUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      const profileRow = profile as ProfileRow | null;
      const fallbackName = user.email?.split("@")[0] ?? "Unknown Admin";
      const finalName = profileRow?.full_name?.trim() || profileRow?.email?.trim() || fallbackName;
      setPostedByName(finalName);

      await loadPersonnelCount();
      await loadAnnouncements();
      setIsChecking(false);
    };

    void initialize();
  }, [router, supabase]);

  useEffect(() => {
    return () => {
      pendingUploads.forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
    };
  }, [pendingUploads]);

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenuId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const filteredAnnouncements = announcements.filter((entry) => {
    const normalizedQuery = normalizeSearchText(searchQuery);
    const matchesSearch =
      !normalizedQuery ||
      includesNormalized(entry.title, normalizedQuery) ||
      includesNormalized(entry.description, normalizedQuery) ||
      includesNormalized(entry.posted_by_name, normalizedQuery);

    const matchesFilter = alertFilter === "all" || entry.alert_level === alertFilter;

    return matchesSearch && matchesFilter;
  });

  // Pagination for Published Announcements
  const pageSize = 6;
  const totalPages = Math.max(1, Math.ceil(filteredAnnouncements.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedAnnouncements = filteredAnnouncements.slice((safePage - 1) * pageSize, safePage * pageSize);
  const showingStart = filteredAnnouncements.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const showingEnd = Math.min(safePage * pageSize, filteredAnnouncements.length);

  function buildPageItems(total: number, current: number, maxVisible = 9): Array<number | "ellipsis"> {
    if (total <= maxVisible) return Array.from({ length: total }, (_, i) => i + 1);

    const items: Array<number | "ellipsis"> = [];
    const middleSize = Math.max(1, maxVisible - 2);

    let start = current - Math.floor(middleSize / 2);
    let end = current + Math.floor(middleSize / 2);

    if (start < 2) {
      start = 2;
      end = start + middleSize - 1;
    }

    if (end > total - 1) {
      end = total - 1;
      start = end - middleSize + 1;
    }

    items.push(1);
    if (start > 2) items.push("ellipsis");
    for (let p = start; p <= end; p++) items.push(p);
    if (end < total - 1) items.push("ellipsis");
    items.push(total);
    return items;
  }

  const pageItems = buildPageItems(totalPages, safePage, 9);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, alertFilter]);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 640px)");
    const onChange = (e: MediaQueryListEvent) => setIsSmallScreen(e.matches);
    setIsSmallScreen(mql.matches);
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange as any);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange as any);
    };
  }, []);

  const warningCount = useMemo(
    () => announcements.filter((entry) => entry.alert_level === "warning").length,
    [announcements],
  );
  const emergencyCount = useMemo(
    () => announcements.filter((entry) => entry.alert_level === "emergency").length,
    [announcements],
  );

  const handleSelectImages = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      return;
    }

    setFormError(null);

    const mapped = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setPendingUploads((prev) => [...prev, ...mapped]);
    event.target.value = "";
  };

  const handleRemovePending = (id: string) => {
    setPendingUploads((prev) => {
      const target = prev.find((entry) => entry.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }

      return prev.filter((entry) => entry.id !== id);
    });
  };

  const handlePublish = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!sessionUserId) {
      showStatus("error", "Session expired. Please log in again.");
      return;
    }

    if (!title.trim() || !description.trim()) {
      showStatus("error", "Headline and description are required.");
      return;
    }

    setIsSubmitting(true);
    setFormMessage(null);
    setFormError(null);

    try {
      if (editingAnnouncement) {
        // UPDATE path
        const { error: updateError } = await supabase
          .from("announcements")
          .update({
            title: title.trim(),
            description: description.trim(),
            alert_level: alertLevel,
          })
          .eq("id", editingAnnouncement.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        if (pendingUploads.length > 0) {
          const currentCount = editingAnnouncement.announcement_media?.length ?? 0;
          const newMediaRows: Array<{
            announcement_id: string;
            file_name: string;
            public_url: string;
            storage_path: string;
            display_order: number;
          }> = [];

          for (const [index, upload] of pendingUploads.entries()) {
            const safeName = cleanFileName(upload.file.name);
            const storagePath = `${editingAnnouncement.id}/${Date.now()}-${index}-${safeName}`;

            const { error: uploadError } = await supabase.storage
              .from(BUCKET_NAME)
              .upload(storagePath, upload.file, { upsert: false, contentType: upload.file.type });

            if (uploadError) {
              throw new Error(`Image upload failed for ${upload.file.name}: ${uploadError.message}`);
            }

            const { data: publicData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);

            newMediaRows.push({
              announcement_id: editingAnnouncement.id,
              file_name: upload.file.name,
              public_url: publicData.publicUrl,
              storage_path: storagePath,
              display_order: currentCount + index,
            });
          }

          if (newMediaRows.length) {
            const { error: mediaInsertError } = await supabase.from("announcement_media").insert(newMediaRows);
            if (mediaInsertError) {
              throw new Error(mediaInsertError.message);
            }
          }
        }

        pendingUploads.forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
        setPendingUploads([]);
        setTitle("");
        setDescription("");
        setAlertLevel("normal");
        setEditingAnnouncement(null);
        setIsCreateModalOpen(false);
        setFormMessage("Announcement updated.");
        showStatus("success", "Announcement updated.");
        await loadAnnouncements();
        return;
      }

      // CREATE path
      const { data: insertResult, error: announcementError } = await supabase
        .from("announcements")
        .insert({
          title: title.trim(),
          description: description.trim(),
          alert_level: alertLevel,
          posted_by_auth_user_id: sessionUserId,
          posted_by_name: postedByName,
        })
        .select("id")
        .single();

      if (announcementError || !insertResult?.id) {
        throw new Error(announcementError?.message ?? "Unable to create announcement.");
      }

      const announcementId = insertResult.id;
      const mediaRows: Array<{
        announcement_id: string;
        file_name: string;
        public_url: string;
        storage_path: string;
        display_order: number;
      }> = [];

      for (const [index, upload] of pendingUploads.entries()) {
        const safeName = cleanFileName(upload.file.name);
        const storagePath = `${announcementId}/${Date.now()}-${index}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, upload.file, { upsert: false, contentType: upload.file.type });

        if (uploadError) {
          throw new Error(`Image upload failed for ${upload.file.name}: ${uploadError.message}`);
        }

        const { data: publicData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);

        mediaRows.push({
          announcement_id: announcementId,
          file_name: upload.file.name,
          public_url: publicData.publicUrl,
          storage_path: storagePath,
          display_order: index,
        });
      }

      if (mediaRows.length) {
        const { error: mediaInsertError } = await supabase.from("announcement_media").insert(mediaRows);
        if (mediaInsertError) {
          throw new Error(mediaInsertError.message);
        }
      }

      pendingUploads.forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
      setPendingUploads([]);
      setTitle("");
      setDescription("");
      setAlertLevel("normal");
      setIsCreateModalOpen(false);
      setFormMessage("Announcement published.");
      showStatus("success", "Announcement published.");

      await loadAnnouncements();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save announcement.";
      setFormError(message);
      showStatus("error", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemovePublishedImage = async (media: AnnouncementMedia) => {
    setPageError(null);

    const { error: storageError } = await supabase.storage.from(BUCKET_NAME).remove([media.storage_path]);
    if (storageError) {
      setPageError(storageError.message);
      showStatus("error", storageError.message);
      return;
    }

    const { error: deleteRowError } = await supabase.from("announcement_media").delete().eq("id", media.id);
    if (deleteRowError) {
      setPageError(deleteRowError.message);
      showStatus("error", deleteRowError.message);
      return;
    }

    setAnnouncements((prev) =>
      prev.map((entry) => {
        if (entry.id !== media.announcement_id) {
          return entry;
        }

        return {
          ...entry,
          announcement_media: (entry.announcement_media ?? []).filter((img) => img.id !== media.id),
        };
      }),
    );

    setEditingAnnouncement((prev) => {
      if (!prev || prev.id !== media.announcement_id) return prev;
      return {
        ...prev,
        announcement_media: (prev.announcement_media ?? []).filter((img) => img.id !== media.id),
      };
    });
  };

  const openCommentsModal = async (announcement: AnnouncementRow) => {
    setSelectedAnnouncement(announcement);
    setSelectedComments([]);
    setCommentsError(null);
    setCommentsHasMore(false);
    setCommentsPage(1);
    setCommentsTotalCount(0);
    setIsCommentsModalOpen(true);
    await loadCommentsPage(announcement.id, 1, "replace");
  };

  const handleLoadMoreComments = async () => {
    if (!selectedAnnouncement || isLoadingComments || isLoadingMoreComments || !commentsHasMore) {
      return;
    }

    await loadCommentsPage(selectedAnnouncement.id, commentsPage + 1, "append");
  };

  const handleDeleteComment = async (commentId: string, commenterName: string) => {
    if (!selectedAnnouncement) return;
    setDeletingCommentId(commentId);

    const response = await fetch("/api/announcements/comments", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ commentId, announcementId: selectedAnnouncement.id }),
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string; deletedIds?: string[] };

    if (!response.ok) {
      setCommentsError(payload.error ?? "Failed to delete comment.");
      setDeletingCommentId(null);
      return;
    }

    // Write activity log entry
    await supabase.from("activity_logs").insert({
      action_type: "comment_deleted",
      actor_name: postedByName,
      detail: `Removed comment by "${commenterName}" on "${selectedAnnouncement.title}"`,
      reference_id: selectedAnnouncement.id,
    });

    const idsToRemove = new Set(payload.deletedIds?.length ? payload.deletedIds : [commentId]);
    setSelectedComments((prev) => prev.filter((c) => !idsToRemove.has(c.id)));
    setDeletingCommentId(null);
  };

  const handleAddComment = async (commentBody: string, replyToCommentId: string | null) => {
    if (!selectedAnnouncement) return;

    const trimmed = commentBody.trim();
    if (!trimmed) return;

    setIsSubmittingComment(true);
    setCommentsError(null);

    const response = await fetch("/api/announcements/comments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        announcementId: selectedAnnouncement.id,
        parentCommentId: replyToCommentId,
        commenterName: ADMIN_COMMENTER_NAME,
        commentBody: trimmed,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setCommentsError(payload.error ?? "Failed to add comment.");
      setIsSubmittingComment(false);
      return;
    }

    const payload = (await response.json()) as { comment?: CommentRow };

    await supabase.from("activity_logs").insert({
      action_type: "comment_added",
      actor_name: postedByName,
      detail: `Added admin comment on "${selectedAnnouncement.title}"`,
      reference_id: selectedAnnouncement.id,
    });

    if (payload.comment) {
      setSelectedComments((prev) => [payload.comment as CommentRow, ...prev]);
    }
    setIsSubmittingComment(false);
  };

  const handleDeleteAnnouncement = async (entry: AnnouncementRow) => {
    setDeletingAnnouncementId(entry.id);
    setPageError(null);

    const media = entry.announcement_media ?? [];

    if (media.length > 0) {
      const storagePaths = media.map((m) => m.storage_path);
      const { error: storageError } = await supabase.storage.from(BUCKET_NAME).remove(storagePaths);
      if (storageError) {
        setPageError(storageError.message);
        showStatus("error", storageError.message);
        setConfirmDeleteEntry(null);
        setDeletingAnnouncementId(null);
        return;
      }
    }

    const { error: deleteError } = await supabase
      .from("announcements")
      .delete()
      .eq("id", entry.id);

    if (deleteError) {
      setPageError(deleteError.message);
      showStatus("error", deleteError.message);
      setConfirmDeleteEntry(null);
      setDeletingAnnouncementId(null);
      return;
    }

    // Write activity log entry
    await supabase.from("activity_logs").insert({
      action_type: "announcement_deleted",
      actor_name: postedByName,
      detail: `Deleted announcement "${entry.title}" (${media.length} image${media.length !== 1 ? "s" : ""})`,
      reference_id: entry.id,
    });

    // Close comments modal if it was open for this announcement
    if (selectedAnnouncement?.id === entry.id) {
      setIsCommentsModalOpen(false);
      setSelectedAnnouncement(null);
      setSelectedComments([]);
    }

    setAnnouncements((prev) => prev.filter((a) => a.id !== entry.id));
    setConfirmDeleteEntry(null);
    setDeletingAnnouncementId(null);
    showStatus("success", "Announcement deleted.");
  };

  const openEditModal = (entry: AnnouncementRow) => {
    setEditingAnnouncement(entry);
    setTitle(entry.title);
    setDescription(entry.description);
    setAlertLevel(entry.alert_level);
    pendingUploads.forEach((e) => URL.revokeObjectURL(e.previewUrl));
    setPendingUploads([]);
    setFormError(null);
    setFormMessage(null);
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setEditingAnnouncement(null);
    setTitle("");
    setDescription("");
    setAlertLevel("normal");
    pendingUploads.forEach((e) => URL.revokeObjectURL(e.previewUrl));
    setPendingUploads([]);
    setFormError(null);
  };

  if (isChecking) {
    return <AdminPageSkeleton title="Loading announcements..." blockCount={2} />;
  }

  return (
    <section className="p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="relative overflow-hidden rounded-[30px] border border-[#d7e4f2] bg-[#f8fbff] p-5 shadow-[0_20px_60px_rgba(15,23,42,0.12)] md:p-6">
          <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.18),transparent_65%)]" />
          <div className="pointer-events-none absolute -left-24 -bottom-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(45,212,191,0.14),transparent_72%)]" />

          <div className="relative z-10">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#4f709e]">Communications Hub</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-[#0f2847] md:text-[28px]">Admin announcements</h2>
                <p className="mt-1 text-sm text-[#5f7ca3]">Publish advisories, manage comment threads, and keep residents informed.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="rounded-xl bg-[#2e9d5a] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#257a48]"
              >
                + Create New
              </button>
            </div>
            

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-[#d8e4f1] bg-white/85 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">Published</p>
                <p className="mt-2 text-3xl font-bold leading-none text-[#10253f]">{announcements.length}</p>
              </div>
              <div className="rounded-2xl border border-[#d8e4f1] bg-white/85 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">Personnel</p>
                <p className="mt-2 text-3xl font-bold leading-none text-[#10253f]">{personnelCount}</p>
              </div>
              <div className="rounded-2xl border border-[#d8e4f1] bg-white/85 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">Warnings</p>
                <p className="mt-2 text-3xl font-bold leading-none text-[#c2410c]">{warningCount}</p>
              </div>
              <div className="rounded-2xl border border-[#d8e4f1] bg-white/85 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">Emergency</p>
                <p className="mt-2 text-3xl font-bold leading-none text-[#be123c]">{emergencyCount}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative block min-w-0 flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7280]">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <circle cx="11" cy="11" r="7" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 20l-3.5-3.5" />
                  </svg>
                </span>
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search announcements..."
                  className="w-full rounded-xl border border-[#d8e4f1] bg-white py-2.5 pl-9 pr-3 text-sm text-[#334155] outline-none placeholder:text-[#94a3b8] focus:border-[#9bc2e8]"
                />
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-[#d8e4f1] bg-white px-3 py-2.5 text-sm text-[#374151]">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#6b7280]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16l-6 7v5l-4 2v-7L4 5z" />
                </svg>
                <select
                  value={alertFilter}
                  onChange={(event) => setAlertFilter(event.target.value as "all" | AlertLevel)}
                  aria-label="Filter announcements by alert level"
                  className="bg-transparent outline-none"
                >
                  <option value="all">All Alerts</option>
                  <option value="normal">Normal</option>
                  <option value="warning">Warning</option>
                  <option value="emergency">Emergency</option>
                </select>
              </label>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[30px] border border-[#d7e4f2] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.12)] md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#111827]">Published Announcements</h2>
            <p className="text-sm text-[#6b7280]">{filteredAnnouncements.length} shown</p>
          </div>

          {isLoadingAnnouncements ? (
            <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <article key={`announcement-skeleton-${index}`} className="animate-pulse overflow-hidden rounded-3xl border border-[#d9e5f2] bg-white shadow-sm">
                  <div className="h-52 bg-[#eef3f8]" />
                  <div className="space-y-3 p-4">
                    <div className="h-5 w-3/4 rounded bg-[#e2ebf5]" />
                    <div className="h-4 w-1/2 rounded bg-[#e2ebf5]" />
                    <div className="h-4 w-full rounded bg-[#e2ebf5]" />
                    <div className="h-4 w-5/6 rounded bg-[#e2ebf5]" />
                  </div>
                </article>
              ))}
            </div>
          ) : filteredAnnouncements.length === 0 ? (
            <p className="text-sm text-[#6b7280]">No announcements match the current search or filter.</p>
          ) : (
            <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-3">
              {pagedAnnouncements.map((entry) => (
                <article key={entry.id} className="group flex h-full flex-col overflow-hidden rounded-3xl border border-[#d9e5f2] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(15,23,42,0.1)]">
                  {/* Featured image or gallery */}
                  {(entry.announcement_media ?? []).length > 0 ? (
                    <div className="h-52 bg-[#f1f5f9]">
                      {(entry.announcement_media ?? []).length === 1 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedImages(entry.announcement_media ?? []);
                            setSelectedImageIndex(0);
                            setImageViewerOpen(true);
                          }}
                          className="group relative h-full w-full"
                          aria-label="View image"
                        >
                          <Image
                            src={(entry.announcement_media ?? [])[0]?.public_url ?? ""}
                            alt={(entry.announcement_media ?? [])[0]?.file_name ?? ""}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </button>
                      ) : (
                        <div className="grid h-full grid-cols-2 gap-2 p-2">
                          {(entry.announcement_media ?? []).map((media, index) => (
                            <button
                              key={media.id}
                              type="button"
                              onClick={() => {
                                setSelectedImages(entry.announcement_media ?? []);
                                setSelectedImageIndex(index);
                                setImageViewerOpen(true);
                              }}
                              className="relative h-full w-full overflow-hidden rounded-lg"
                              aria-label={`View image ${index + 1}`}
                            >
                              <Image
                                src={media.public_url}
                                alt={media.file_name}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-52 w-full items-center justify-center bg-[#f1f5f9] text-[#94a3b8]">
                      <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <path d="M8 13l2.5-2.5L14 14l2-2 2 2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}

                  {/* Card body */}
                  <div className="flex h-full flex-col p-4">
                    {/* Title + 3-dot menu */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-h-[52px] min-w-0 flex-1">
                        <h3 className={`text-base font-semibold leading-snug text-[#111827] ${expandedHeadlineIds.has(entry.id) ? "" : "overflow-hidden line-clamp-2"}`}>
                          {entry.title}
                        </h3>
                        {entry.title.length > 80 ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setExpandedHeadlineIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(entry.id)) {
                                  next.delete(entry.id);
                                } else {
                                  next.add(entry.id);
                                }
                                return next;
                              });
                            }}
                            className="mt-1 text-xs font-semibold text-[#4f84db] hover:text-[#2f6ed2]"
                          >
                            {expandedHeadlineIds.has(entry.id) ? "See less" : "See more"}
                          </button>
                        ) : null}
                      </div>
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === entry.id ? null : entry.id); }}
                          className="rounded-md p-1 text-[#6b7280] hover:bg-[#f3f4f6]"
                          aria-label="More options"
                        >
                          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                            <path d="M12 8a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm0 5.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm0 5.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                          </svg>
                        </button>

                        {openMenuId === entry.id && (
                          <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-xl border border-[#e5e7eb] bg-white py-1 shadow-lg">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openEditModal(entry); setOpenMenuId(null); }}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[#374151] hover:bg-[#f3f4f6]"
                            >
                              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                              </svg>
                              Update
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteEntry(entry); setOpenMenuId(null); }}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[#be123c] hover:bg-[#fff1f2]"
                            >
                              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${alertPillClass(entry.alert_level)}`}>
                        {entry.alert_level}
                      </span>
                      <span className="text-xs text-[#748299]">By {entry.posted_by_name}</span>
                    </div>

                    {/* Description */}
                    <div className="mt-2 min-h-[72px]">
                      <p className={`text-sm text-[#6b7280] ${expandedDescriptionIds.has(entry.id) ? "" : "overflow-hidden line-clamp-3"}`}>
                        {entry.description}
                      </p>
                      {entry.description.length > 140 ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setExpandedDescriptionIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(entry.id)) {
                                next.delete(entry.id);
                              } else {
                                next.add(entry.id);
                              }
                              return next;
                            });
                          }}
                          className="mt-1 text-xs font-semibold text-[#4f84db] hover:text-[#2f6ed2]"
                        >
                          {expandedDescriptionIds.has(entry.id) ? "See less" : "See more"}
                        </button>
                      ) : null}
                    </div>

                    {/* Divider */}
                    <div className="my-3 mt-auto border-t border-[#f0f2f4]" />

                    {/* Footer */}
                    <div className="flex items-center justify-between gap-2 text-xs text-[#6b7280]">
                      <button
                        type="button"
                        onClick={() => void openCommentsModal(entry)}
                        className="flex items-center gap-1.5 hover:text-[#374151]"
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        View Comment
                      </button>
                      <span className="flex items-center gap-1.5">
                        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.065 7-9.542 7S3.732 16.057 2.458 12z" />
                        </svg>
                        Published {formatDateShort(entry.created_at)}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="mt-4">
          <div className="grid grid-cols-1 gap-3 border-t border-[#d9e5f2] bg-[#f8fbff] px-4 py-4 sm:grid-cols-3 sm:items-center">
            <div className="flex items-center gap-4 sm:justify-start sm:col-span-1">
              <p className="text-xs text-[#6b7280]">
                Showing {showingStart} to {showingEnd} of {filteredAnnouncements.length} entries
              </p>
            </div>

            <div className="flex items-center gap-2 justify-center sm:col-span-1">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={safePage === 1}
                className="rounded-lg border border-[#d0dceb] bg-white px-3 py-1.5 text-sm text-[#52667b] transition hover:bg-[#f1f7ff] disabled:opacity-40"
              >
                Prev
              </button>
              {!isSmallScreen ? (
                pageItems.map((item, idx) =>
                  item === "ellipsis" ? (
                    <span key={`e-${idx}`} className="mx-1 inline-block px-2 text-sm text-[#6b7280]">
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCurrentPage(Number(item))}
                      className={`h-8 w-8 rounded-full border text-sm transition ${
                        item === safePage
                          ? "border-[#86d57e] bg-[#f0fdf4] text-[#16a34a] shadow-sm"
                          : "border-[#d0dceb] bg-white text-[#52667b] hover:bg-[#f1f7ff]"
                      }`}
                    >
                      {item}
                    </button>
                  ),
                )
              ) : (
                <span className="sr-only">Page {safePage} of {totalPages}</span>
              )}
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={safePage === totalPages}
                className="rounded-lg border border-[#d0dceb] bg-white px-3 py-1.5 text-sm text-[#52667b] transition hover:bg-[#f1f7ff] disabled:opacity-40"
              >
                Next
              </button>
            </div>

            <div className="sm:col-span-1" />
          </div>
        </div>

        <CreateAnnouncementModal
          isOpen={isCreateModalOpen}
          isSubmitting={isSubmitting}
          mode={editingAnnouncement ? "edit" : "create"}
          title={title}
          description={description}
          alertLevel={alertLevel}
          pendingUploads={pendingUploads}
          existingMedia={editingAnnouncement?.announcement_media ?? []}
          formError={formError}
          onClose={closeCreateModal}
          onTitleChange={setTitle}
          onDescriptionChange={setDescription}
          onAlertLevelChange={setAlertLevel}
          onSelectImages={handleSelectImages}
          onRemovePending={handleRemovePending}
          onRemoveExisting={handleRemovePublishedImage}
          onSubmit={handlePublish}
        />

        <AnnouncementCommentsModal
          isOpen={isCommentsModalOpen}
          title={selectedAnnouncement?.title ?? "Announcement"}
          isLoading={isLoadingComments}
          isLoadingMore={isLoadingMoreComments}
          error={commentsError}
          deletingCommentId={deletingCommentId}
          isSubmittingComment={isSubmittingComment}
          hasMoreComments={commentsHasMore}
          totalCount={commentsTotalCount}
          comments={selectedComments.map((comment) => ({
            ...comment,
            parent_comment_id: comment.parent_comment_id ?? null,
          }))}
          onClose={() => setIsCommentsModalOpen(false)}
          onDeleteComment={handleDeleteComment}
          onAddComment={handleAddComment}
          onLoadMoreComments={() => void handleLoadMoreComments()}
          formatDateTime={formatDateTime}
        />

        <DeleteConfirmationModal
          isOpen={confirmDeleteEntry !== null}
          title={confirmDeleteEntry?.title ?? ""}
          isDeleting={deletingAnnouncementId === confirmDeleteEntry?.id}
          onCancel={() => setConfirmDeleteEntry(null)}
          onConfirm={() => void handleDeleteAnnouncement(confirmDeleteEntry!)}
        />

        <ImageViewerModal
          isOpen={imageViewerOpen}
          images={selectedImages}
          initialIndex={selectedImageIndex}
          onClose={() => setImageViewerOpen(false)}
        />

        <StatusFeedbackModal
          visible={statusVisible}
          message={statusMessage}
          variant={statusVariant}
          onClose={() => {
            setStatusVisible(false);
            setStatusMessage("");
          }}
        />
      </div>
    </section>
  );
}
