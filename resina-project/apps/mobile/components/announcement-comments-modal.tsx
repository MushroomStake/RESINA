import { useCallback, useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Image,
  Keyboard,
  Platform,
  type ImageSourcePropType,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { queueAnnouncementComment } from "../lib/offline-write-queue";

type AnnouncementCommentItem = {
  id: string;
  announcement_id: string;
  commenter_auth_user_id: string | null;
  parent_comment_id: string | null;
  commenter_name: string;
  comment_body: string;
  created_at: string;
};

type ProfileAvatarKey = "boy" | "man" | "user" | "woman" | "woman2";

type AnnouncementPreview = {
  id: string;
  title: string;
};

type AnnouncementCommentsModalProps = {
  visible: boolean;
  announcement: AnnouncementPreview | null;
  currentCommenterName: string;
  currentUserAvatarSource: ImageSourcePropType;
  sessionUserId: string | null;
  isOnline: boolean;
  onRequestClose: () => void;
  onError?: (message: string) => void;
  onQueued?: (message: string) => void;
};

const REPLY_TOKEN_REGEX = /^\[\[reply:([^\]]+)\]\]\s*/i;
const LEGACY_MENTION_REGEX = /^@([^\s].*?)\s+/;
const PROFILE_AVATAR_SOURCES: Record<ProfileAvatarKey, ImageSourcePropType> = {
  user: require("../assets/Profile/user.png"),
  man: require("../assets/Profile/man.png"),
  boy: require("../assets/Profile/boy.png"),
  woman: require("../assets/Profile/woman.png"),
  woman2: require("../assets/Profile/woman 2.png"),
};
const STA_RITA_ICON_SOURCE = require("../assets/images/Sta Rita.png");
const ADMIN_COMMENTER_NAME = "brgy. sta. rita";
const COMMENTS_PAGE_SIZE = 12;

function resolveAvatarSource(value: unknown): ImageSourcePropType {
  const key = String(value ?? "").trim().toLowerCase() as ProfileAvatarKey;
  return PROFILE_AVATAR_SOURCES[key] ?? PROFILE_AVATAR_SOURCES.user;
}

function resolveCommentAvatar(
  commenterName: string,
  commenterAuthUserId: string | null,
  sessionUserId: string | null,
  currentUserAvatarSource: ImageSourcePropType,
  currentCommenterName: string,
): ImageSourcePropType {
  if (commenterName.trim().toLowerCase() === ADMIN_COMMENTER_NAME) {
    return STA_RITA_ICON_SOURCE;
  }

  if (commenterAuthUserId) {
    if (commenterAuthUserId === sessionUserId) {
      return currentUserAvatarSource;
    }

    return PROFILE_AVATAR_SOURCES.user;
  }

  if (commenterName.trim().toLowerCase() === currentCommenterName.trim().toLowerCase()) {
    return currentUserAvatarSource;
  }

  return PROFILE_AVATAR_SOURCES.user;
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

function inferLegacyParentId(cleanBody: string, previous: AnnouncementCommentItem[]): string | null {
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

function normalizeLegacyComments(
  rows: Array<Omit<AnnouncementCommentItem, "parent_comment_id">>,
): AnnouncementCommentItem[] {
  const normalized: AnnouncementCommentItem[] = [];

  for (const row of rows) {
    const { parentId: tokenParentId, cleanBody } = parseReplyToken(row.comment_body ?? "");
    const inferredParentId = tokenParentId ?? inferLegacyParentId(cleanBody, normalized);

    normalized.push({
      ...row,
      parent_comment_id: inferredParentId,
      comment_body: cleanBody,
    });
  }

  return normalized;
}

function shouldShowCommentSeeMore(body: string): boolean {
  const normalized = body ?? "";
  const lineCount = normalized.split(/\r?\n/).length;
  return normalized.length > 180 || lineCount > 3;
}

export function AnnouncementCommentsModal({
  visible,
  announcement,
  currentCommenterName,
  currentUserAvatarSource,
  sessionUserId,
  isOnline,
  onRequestClose,
  onError,
  onQueued,
}: AnnouncementCommentsModalProps) {
  const { height: windowHeight } = useWindowDimensions();
  const [announcementComments, setAnnouncementComments] = useState<AnnouncementCommentItem[]>([]);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [isLoadingMoreComments, setIsLoadingMoreComments] = useState(false);
  const [commentsPage, setCommentsPage] = useState(1);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const [commentsTotalCount, setCommentsTotalCount] = useState(0);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [modalError, setModalError] = useState("");
  const [supportsThreadParentColumn, setSupportsThreadParentColumn] = useState(true);
  const [commentInput, setCommentInput] = useState("");
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [replyingToCommentName, setReplyingToCommentName] = useState<string | null>(null);
  const [collapsedCommentIds, setCollapsedCommentIds] = useState<Set<string>>(new Set());
  const [expandedCommentIds, setExpandedCommentIds] = useState<Set<string>>(new Set());
  const [commenterAvatarByUserId, setCommenterAvatarByUserId] = useState<Record<string, ImageSourcePropType>>({});
  const [activeOwnCommentTarget, setActiveOwnCommentTarget] = useState<AnnouncementCommentItem | null>(null);
  const [editingCommentTarget, setEditingCommentTarget] = useState<AnnouncementCommentItem | null>(null);
  const [editingCommentInput, setEditingCommentInput] = useState("");
  const [isSavingCommentAction, setIsSavingCommentAction] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardOffset = Platform.OS === "ios" ? keyboardHeight : 0;
  const composerInset = replyingToCommentName ? 150 : 118;
  const modalMaxHeight = Math.max(
    300,
    Math.min(windowHeight * 0.82, windowHeight - keyboardOffset - 96),
  );

  const commentsByParent = useMemo(() => {
    const grouped = new Map<string | null, AnnouncementCommentItem[]>();

    for (const comment of announcementComments) {
      const key = comment.parent_comment_id ?? null;
      const list = grouped.get(key) ?? [];
      list.push(comment);
      grouped.set(key, list);
    }

    return grouped;
  }, [announcementComments]);

  const buildCollapsedParentIds = (rows: AnnouncementCommentItem[]) => {
    const parentIds = new Set<string>();
    const availableIds = new Set(rows.map((row) => row.id));

    for (const row of rows) {
      const parsed = parseReplyToken(row.comment_body ?? "");
      const parentId = row.parent_comment_id ?? parsed.parentId;

      if (parentId && availableIds.has(parentId)) {
        parentIds.add(parentId);
      }
    }

    return parentIds;
  };

  const mergeDedupComments = (prev: AnnouncementCommentItem[], incoming: AnnouncementCommentItem[]) => {
    const merged = [...prev, ...incoming];
    return merged.filter((entry, index, list) => list.findIndex((candidate) => candidate.id === entry.id) === index);
  };

  const loadAnnouncementComments = useCallback(async (page = 1, mode: "replace" | "append" = "replace") => {
    if (!announcement?.id) return;

    if (mode === "replace") {
      setIsCommentsLoading(true);
      setModalError("");
    } else {
      setIsLoadingMoreComments(true);
    }

    const start = (page - 1) * COMMENTS_PAGE_SIZE;
    const end = start + COMMENTS_PAGE_SIZE - 1;

    const threadedResult = await supabase
      .from("announcement_comments")
      .select("id, announcement_id, commenter_auth_user_id, parent_comment_id, commenter_name, comment_body, created_at", { count: "exact" })
      .eq("announcement_id", announcement.id)
      .range(start, end)
      .order("created_at", { ascending: false });

    if (!threadedResult.error) {
      const nextComments = (threadedResult.data ?? []) as AnnouncementCommentItem[];
      setSupportsThreadParentColumn(true);
      setCommentsTotalCount(threadedResult.count ?? nextComments.length);
      setCommentsHasMore((threadedResult.count ?? 0) > end + 1);
      setCommentsPage(page);

      if (mode === "append") {
        let mergedComments: AnnouncementCommentItem[] = nextComments;
        setAnnouncementComments((prev) => {
          const merged = mergeDedupComments(prev, nextComments);
          mergedComments = merged;
          return merged;
        });
        setCollapsedCommentIds((prev) => {
          const next = new Set(prev);
          for (const id of buildCollapsedParentIds(mergedComments)) {
            next.add(id);
          }
          return next;
        });
      } else {
        setAnnouncementComments(nextComments);
        setCollapsedCommentIds(buildCollapsedParentIds(nextComments));
      }

      setIsCommentsLoading(false);
      setIsLoadingMoreComments(false);
      return;
    }

    if (!threadedResult.error.message.toLowerCase().includes("parent_comment_id")) {
      setIsCommentsLoading(false);
      setIsLoadingMoreComments(false);
      setModalError(threadedResult.error.message);
      onError?.(threadedResult.error.message);
      return;
    }

    const fallbackResult = await supabase
      .from("announcement_comments")
      .select("id, announcement_id, commenter_auth_user_id, commenter_name, comment_body, created_at", { count: "exact" })
      .eq("announcement_id", announcement.id)
      .range(start, end)
      .order("created_at", { ascending: false });

    if (fallbackResult.error) {
      setIsCommentsLoading(false);
      setIsLoadingMoreComments(false);
      setModalError(fallbackResult.error.message);
      onError?.(fallbackResult.error.message);
      return;
    }

    const nextComments = normalizeLegacyComments(
      (fallbackResult.data ?? []) as Array<Omit<AnnouncementCommentItem, "parent_comment_id">>,
    );

    setSupportsThreadParentColumn(false);
    setCommentsTotalCount(fallbackResult.count ?? nextComments.length);
    setCommentsHasMore((fallbackResult.count ?? 0) > end + 1);
    setCommentsPage(page);

    if (mode === "append") {
      let mergedComments: AnnouncementCommentItem[] = nextComments;
      setAnnouncementComments((prev) => {
        const merged = mergeDedupComments(prev, nextComments);
        mergedComments = merged;
        return merged;
      });
      setCollapsedCommentIds((prev) => {
        const next = new Set(prev);
        for (const id of buildCollapsedParentIds(mergedComments)) {
          next.add(id);
        }
        return next;
      });
    } else {
      setAnnouncementComments(nextComments);
      setCollapsedCommentIds(buildCollapsedParentIds(nextComments));
    }

    setIsCommentsLoading(false);
    setIsLoadingMoreComments(false);
  }, [announcement?.id]);

  const handleLoadMoreComments = async () => {
    if (!announcement?.id || isCommentsLoading || isLoadingMoreComments || !commentsHasMore) {
      return;
    }

    await loadAnnouncementComments(commentsPage + 1, "append");
  };

  useEffect(() => {
    if (!visible || !announcement?.id) return;

    setCommentInput("");
    setReplyingToCommentId(null);
    setReplyingToCommentName(null);
    setCollapsedCommentIds(new Set());
    setExpandedCommentIds(new Set());
    setCommentsPage(1);
    setCommentsHasMore(false);
    setCommentsTotalCount(0);
    setActiveOwnCommentTarget(null);
    setEditingCommentTarget(null);
    setEditingCommentInput("");
    setModalError("");
    setKeyboardHeight(0);
    void loadAnnouncementComments(1, "replace");
  }, [announcement?.id, loadAnnouncementComments, visible]);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }

    const handleShow = (event: { endCoordinates?: { height?: number } }) => {
      const nextHeight = Math.max(0, event.endCoordinates?.height ?? 0);
      setKeyboardHeight(nextHeight);
    };

    const handleHide = () => {
      setKeyboardHeight(0);
    };

    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      handleShow,
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      handleHide,
    );

    // iOS can resize keyboard frame (emoji/suggested bars); keep the input aligned.
    const frameSub = Platform.OS === "ios" ? Keyboard.addListener("keyboardWillChangeFrame", handleShow) : null;

    return () => {
      showSub.remove();
      hideSub.remove();
      frameSub?.remove();
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const commenterIds = Array.from(
      new Set(
        announcementComments
          .map((entry) => entry.commenter_auth_user_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    if (commenterIds.length === 0) {
      setCommenterAvatarByUserId({});
      return;
    }

    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("auth_user_id, profile_avatar")
        .in("auth_user_id", commenterIds);

      const nextMap: Record<string, ImageSourcePropType> = {};

      (data ?? []).forEach((row) => {
        const userId = String((row as { auth_user_id?: string }).auth_user_id ?? "").trim();
        if (!userId) {
          return;
        }

        nextMap[userId] = resolveAvatarSource((row as { profile_avatar?: unknown }).profile_avatar);
      });

      setCommenterAvatarByUserId(nextMap);
    })();
  }, [announcementComments, visible]);

  useEffect(() => {
    if (!visible || !announcement?.id) return;

    const channel = supabase
      .channel(`resina-announcement-comments-${announcement.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "announcement_comments",
          filter: `announcement_id=eq.${announcement.id}`,
        },
        () => {
          void loadAnnouncementComments(1, "replace");
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [announcement?.id, loadAnnouncementComments, visible]);

  const handleReplyToComment = (commentId: string, commenterName: string) => {
    setReplyingToCommentId(commentId);
    setReplyingToCommentName(commenterName);
    setCommentInput("");
    setCollapsedCommentIds((prev) => {
      const next = new Set(prev);
      next.delete(commentId);
      return next;
    });
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

  const isOwnComment = (comment: AnnouncementCommentItem): boolean => {
    if (sessionUserId && comment.commenter_auth_user_id) {
      return comment.commenter_auth_user_id === sessionUserId;
    }

    return comment.commenter_name.trim().toLowerCase() === currentCommenterName.trim().toLowerCase();
  };

  const buildPersistedCommentBody = (body: string, parentCommentId: string | null) => {
    if (!supportsThreadParentColumn && parentCommentId) {
      return `[[reply:${parentCommentId}]] ${body}`;
    }

    return body;
  };

  const collectThreadCommentIds = (rootCommentId: string): string[] => {
    const childIdsByParent = new Map<string, Set<string>>();

    const linkChildToParent = (parentId: string | null, childId: string) => {
      if (!parentId) {
        return;
      }

      const next = childIdsByParent.get(parentId) ?? new Set<string>();
      next.add(childId);
      childIdsByParent.set(parentId, next);
    };

    for (const row of announcementComments) {
      linkChildToParent(row.parent_comment_id, row.id);
      const parsed = parseReplyToken(row.comment_body ?? "");
      linkChildToParent(parsed.parentId, row.id);
    }

    const seen = new Set<string>();
    const stack = [rootCommentId];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || seen.has(current)) {
        continue;
      }

      seen.add(current);

      const childIds = childIdsByParent.get(current);
      if (!childIds) {
        continue;
      }

      childIds.forEach((childId) => {
        if (!seen.has(childId)) {
          stack.push(childId);
        }
      });
    }

    return Array.from(seen);
  };

  const handleDeleteOwnComment = async (comment: AnnouncementCommentItem) => {
    if (isSavingCommentAction) {
      return;
    }

    if (!isOwnComment(comment)) {
      const message = "You can only manage your own comments.";
      setModalError(message);
      onError?.(message);
      return;
    }

    setIsSavingCommentAction(true);
    setModalError("");

    const idsToDelete = collectThreadCommentIds(comment.id);
    if (idsToDelete.length === 0) {
      setIsSavingCommentAction(false);
      return;
    }

    const { error } = await supabase
      .from("announcement_comments")
      .delete()
      .in("id", idsToDelete);

    setIsSavingCommentAction(false);

    if (error) {
      setModalError(error.message);
      onError?.(error.message);
      return;
    }

    setActiveOwnCommentTarget(null);
    await loadAnnouncementComments(1, "replace");
  };

  const handleOpenEditOwnComment = (comment: AnnouncementCommentItem) => {
    setActiveOwnCommentTarget(null);
    setEditingCommentTarget(comment);
    setEditingCommentInput(comment.comment_body ?? "");
  };

  const handleSaveEditedComment = async () => {
    if (!editingCommentTarget || isSavingCommentAction) {
      return;
    }

    const nextBody = editingCommentInput.trim();
    if (!nextBody) {
      const message = "Comment cannot be empty.";
      setModalError(message);
      onError?.(message);
      return;
    }

    setIsSavingCommentAction(true);
    setModalError("");

    let updateQuery = supabase
      .from("announcement_comments")
      .update({
        comment_body: buildPersistedCommentBody(nextBody, editingCommentTarget.parent_comment_id),
      })
      .eq("id", editingCommentTarget.id);

    if (sessionUserId) {
      updateQuery = updateQuery.eq("commenter_auth_user_id", sessionUserId);
    }

    const { error } = await updateQuery;
    setIsSavingCommentAction(false);

    if (error) {
      setModalError(error.message);
      onError?.(error.message);
      return;
    }

    setEditingCommentTarget(null);
    setEditingCommentInput("");
    await loadAnnouncementComments(1, "replace");
  };

  const handlePostComment = async () => {
    if (!sessionUserId || !announcement?.id || isPostingComment) {
      return;
    }

    const body = commentInput.trim();
    if (!body) {
      const message = "Comment cannot be empty.";
      setModalError(message);
      onError?.(message);
      return;
    }

    setIsPostingComment(true);
    setModalError("");

    const queueComment = async () => {
      await queueAnnouncementComment({
        announcementId: announcement.id,
        commenterAuthUserId: sessionUserId,
        commenterName: currentCommenterName,
        parentCommentId: replyingToCommentId,
        body,
        supportsThreadParentColumn,
      });

      setCommentInput("");
      setReplyingToCommentId(null);
      setReplyingToCommentName(null);
      setIsPostingComment(false);
      onQueued?.("Comment saved offline. It will sync when you're back online.");
    };

    if (!isOnline) {
      await queueComment();
      return;
    }

    const payload: Record<string, string | null> = {
      announcement_id: announcement.id,
      commenter_auth_user_id: sessionUserId,
      commenter_name: currentCommenterName,
      comment_body:
        !supportsThreadParentColumn && replyingToCommentId ? `[[reply:${replyingToCommentId}]] ${body}` : body,
    };

    if (supportsThreadParentColumn) {
      payload.parent_comment_id = replyingToCommentId;
    }

    let insertResult = await supabase.from("announcement_comments").insert(payload);

    if (insertResult.error && supportsThreadParentColumn && insertResult.error.message.toLowerCase().includes("parent_comment_id")) {
      setSupportsThreadParentColumn(false);
      const fallbackPayload = {
        announcement_id: announcement.id,
        commenter_auth_user_id: sessionUserId,
        commenter_name: currentCommenterName,
        comment_body: replyingToCommentId ? `[[reply:${replyingToCommentId}]] ${body}` : body,
      };
      insertResult = await supabase.from("announcement_comments").insert(fallbackPayload);
    }

    setIsPostingComment(false);

    if (insertResult.error) {
      const normalizedMessage = insertResult.error.message.toLowerCase();
      if (
        normalizedMessage.includes("network request failed") ||
        normalizedMessage.includes("failed to fetch") ||
        normalizedMessage.includes("network error") ||
        normalizedMessage.includes("offline")
      ) {
        await queueComment();
        return;
      }

      setModalError(insertResult.error.message);
      onError?.(insertResult.error.message);
      return;
    }

    setCommentInput("");
    setReplyingToCommentId(null);
    setReplyingToCommentName(null);
    await loadAnnouncementComments(1, "replace");
  };

  const handleModalClose = () => {
    setActiveOwnCommentTarget(null);
    setEditingCommentTarget(null);
    setEditingCommentInput("");
    setKeyboardHeight(0);
    onRequestClose();
  };

  const renderCommentThread = (parentCommentId: string | null, depth = 0) => {
    const items = commentsByParent.get(parentCommentId) ?? [];

    return items.map((comment) => (
      <View
        key={comment.id}
        style={[styles.commentItem, depth > 0 && { marginLeft: Math.min(depth * 20, 44) }]}
      >
        <View style={styles.commentRowMain}>
          <Image
            source={resolveCommentAvatar(comment.commenter_name, comment.commenter_auth_user_id, sessionUserId, currentUserAvatarSource, currentCommenterName)}
            style={styles.commentAvatarImage}
            resizeMode="cover"
          />
          <View style={styles.commentContentCol}>
            <Text style={styles.commentAuthor}>{comment.commenter_name}</Text>
            <Text style={styles.commentBodyText} textBreakStrategy="simple" numberOfLines={expandedCommentIds.has(comment.id) ? undefined : 3}>
              {comment.comment_body || "(Empty comment)"}
            </Text>
            {shouldShowCommentSeeMore(comment.comment_body ?? "") ? (
              <Pressable
                style={styles.commentSeeMoreBtn}
                onPress={() => {
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
              >
                <Text style={styles.commentSeeMoreText}>{expandedCommentIds.has(comment.id) ? "See less" : "See more"}</Text>
              </Pressable>
            ) : null}

            <View style={styles.commentMetaRow}>
              <Text style={styles.commentAge}>{formatCommentAge(comment.created_at)}</Text>
              <Pressable onPress={() => handleReplyToComment(comment.id, comment.commenter_name)}>
                <Text style={styles.commentReplyText}>Reply</Text>
              </Pressable>
              {isOwnComment(comment) ? (
                <Pressable
                  style={styles.ownCommentMoreBtn}
                  onPress={() => setActiveOwnCommentTarget(comment)}
                  disabled={isSavingCommentAction}
                  accessibilityRole="button"
                  accessibilityLabel="Comment actions"
                >
                  <Ionicons name="ellipsis-vertical" size={16} color="#6b7280" />
                </Pressable>
              ) : null}
            </View>

            {(commentsByParent.get(comment.id)?.length ?? 0) > 0 ? (
              <Pressable style={styles.commentToggleBtn} onPress={() => handleToggleCommentCollapse(comment.id)}>
                <Text style={styles.commentToggleText}>
                  {collapsedCommentIds.has(comment.id)
                    ? `View ${commentsByParent.get(comment.id)?.length ?? 0} more repl${(commentsByParent.get(comment.id)?.length ?? 0) === 1 ? "y" : "ies"}`
                    : "Hide replies"}
                </Text>
              </Pressable>
            ) : null}

            {!collapsedCommentIds.has(comment.id) ? (
              <View style={styles.commentChildrenWrap}>{renderCommentThread(comment.id, depth + 1)}</View>
            ) : null}
          </View>
        </View>
      </View>
    ));
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={handleModalClose}>
      <View style={[styles.commentsModalOverlay, { paddingBottom: 14 + keyboardOffset }]}> 
        <View style={[styles.commentsModalCard, { maxHeight: modalMaxHeight }]}> 
          <View style={styles.commentsModalHeader}>
            <Text style={styles.commentsModalTitle}>Comments</Text>
            <Pressable style={styles.commentsCloseBtn} onPress={handleModalClose}>
              <Text style={styles.commentsCloseText}>Close</Text>
            </Pressable>
          </View>

          {announcement ? <Text style={styles.commentsAnnouncementTitle}>{announcement.title}</Text> : null}

          <ScrollView
            style={styles.commentsList}
            contentContainerStyle={[styles.commentsListContent, { paddingBottom: composerInset + 20 }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.commentsSummaryCard}>
              <Text style={styles.commentsSummaryText}>{commentsTotalCount} comment{commentsTotalCount === 1 ? "" : "s"}</Text>
              <Text style={styles.commentsSummaryText}>{commentsHasMore ? "More comments available" : "All comments loaded"}</Text>
            </View>

            {modalError ? <Text style={styles.commentsErrorText}>{modalError}</Text> : null}
            {isCommentsLoading ? <Text style={styles.loaderText}>Loading comments...</Text> : null}

            {!isCommentsLoading && announcementComments.length === 0 ? (
              <Text style={styles.placeholderText}>No comments yet.</Text>
            ) : null}

            {!isCommentsLoading ? renderCommentThread(null) : null}

            {!isCommentsLoading && !modalError && commentsHasMore ? (
              <Pressable
                style={[styles.loadMoreBtn, isLoadingMoreComments && styles.buttonDisabled]}
                onPress={() => void handleLoadMoreComments()}
                disabled={isLoadingMoreComments}
              >
                <Text style={styles.loadMoreBtnText}>{isLoadingMoreComments ? "Loading more..." : "Load more comments"}</Text>
              </Pressable>
            ) : null}
          </ScrollView>

          <View style={styles.commentComposerWrap}>
            {replyingToCommentName ? (
              <View style={styles.replyingTagRow}>
                <Text style={styles.replyingTagText}>Replying to {replyingToCommentName}</Text>
                <Pressable
                  onPress={() => {
                    setReplyingToCommentName(null);
                    setReplyingToCommentId(null);
                  }}
                >
                  <Text style={styles.replyingTagClear}>Clear</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.commentInputRow}>
              <Image source={currentUserAvatarSource} style={styles.inputAvatarImage} resizeMode="cover" />
              <TextInput
                value={commentInput}
                onChangeText={setCommentInput}
                onBlur={() => {
                  // Some Android keyboards skip hide events; force reset as fallback.
                  setTimeout(() => setKeyboardHeight(0), 120);
                }}
                multiline
                numberOfLines={3}
                scrollEnabled
                blurOnSubmit={false}
                style={styles.commentInput}
                placeholder="Write a comment..."
                placeholderTextColor="#9ca3af"
              />
              <Pressable
                style={[styles.commentSendBtn, isPostingComment && styles.buttonDisabled]}
                onPress={() => void handlePostComment()}
                disabled={isPostingComment}
              >
                {isPostingComment ? (
                  <Text style={styles.commentSendText}>...</Text>
                ) : (
                  <Ionicons name="paper-plane-outline" size={24} color="#9ca3af" />
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </View>
      </Modal>

      <Modal
        visible={Boolean(activeOwnCommentTarget)}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveOwnCommentTarget(null)}
      >
        <Pressable style={styles.actionModalOverlay} onPress={() => setActiveOwnCommentTarget(null)}>
          <Pressable style={styles.actionModalCard} onPress={() => undefined}>
            <Text style={styles.actionModalTitle}>Comment options</Text>

            <Pressable
              style={styles.actionModalBtn}
              onPress={() => {
                if (!activeOwnCommentTarget) {
                  return;
                }

                handleOpenEditOwnComment(activeOwnCommentTarget);
              }}
            >
              <Text style={styles.actionModalBtnText}>Edit</Text>
            </Pressable>

            <Pressable
              style={[styles.actionModalBtn, styles.actionModalDeleteBtn]}
              onPress={() => {
                if (!activeOwnCommentTarget) {
                  return;
                }

                void handleDeleteOwnComment(activeOwnCommentTarget);
              }}
              disabled={isSavingCommentAction}
            >
              <Text style={styles.actionModalDeleteText}>{isSavingCommentAction ? "Deleting..." : "Delete"}</Text>
            </Pressable>

          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={Boolean(editingCommentTarget)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setEditingCommentTarget(null);
          setEditingCommentInput("");
        }}
      >
        <Pressable
          style={styles.actionModalOverlay}
          onPress={() => {
            setEditingCommentTarget(null);
            setEditingCommentInput("");
          }}
        >
          <Pressable style={styles.editModalCard} onPress={() => undefined}>
            <Text style={styles.actionModalTitle}>Edit comment</Text>

            <TextInput
              value={editingCommentInput}
              onChangeText={setEditingCommentInput}
              multiline
              numberOfLines={4}
              style={styles.editModalInput}
              placeholder="Update your comment..."
              placeholderTextColor="#9ca3af"
            />

            <View style={styles.editModalActionsRow}>
              <Pressable
                style={styles.editModalCancelBtn}
                onPress={() => {
                  setEditingCommentTarget(null);
                  setEditingCommentInput("");
                }}
                disabled={isSavingCommentAction}
              >
                <Text style={styles.editModalCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.editModalSaveBtn, isSavingCommentAction && styles.buttonDisabled]}
                onPress={() => void handleSaveEditedComment()}
                disabled={isSavingCommentAction}
              >
                <Text style={styles.editModalSaveText}>{isSavingCommentAction ? "Saving..." : "Save"}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  loaderText: {
    color: "#6b7280",
    fontSize: 14,
  },
  placeholderText: {
    fontSize: 14,
    color: "#6b7280",
  },
  commentsModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
    padding: 14,
  },
  commentsModalCard: {
    minHeight: 320,
    flexShrink: 1,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    overflow: "hidden",
    position: "relative",
  },
  commentsModalHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  commentsModalTitle: {
    color: "#1f2937",
    fontSize: 19,
    fontWeight: "700",
  },
  commentsCloseBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  commentsCloseText: {
    color: "#4b5563",
    fontSize: 12,
    fontWeight: "700",
  },
  commentsAnnouncementTitle: {
    paddingHorizontal: 16,
    paddingTop: 10,
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "600",
  },
  commentsList: {
    flex: 1,
    minHeight: 220,
    marginTop: 8,
  },
  commentsListContent: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
  },
  commentsSummaryCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#dbe7f2",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 4,
  },
  commentsSummaryText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  commentsErrorText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "600",
  },
  loadMoreBtn: {
    alignSelf: "center",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  loadMoreBtnText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
  },
  commentItem: {
    paddingVertical: 8,
  },
  commentRowMain: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  commentAvatar: {
    marginRight: 8,
    marginTop: 1,
  },
  commentAvatarImage: {
    width: 30,
    height: 30,
    borderRadius: 999,
    marginRight: 8,
    marginTop: 1,
    backgroundColor: "#e5e7eb",
  },
  commentContentCol: {
    flex: 1,
    minWidth: 0,
  },
  commentAuthor: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  commentBodyText: {
    color: "#2f343d",
    fontSize: 15,
    lineHeight: 24,
    flexShrink: 1,
    flexWrap: "wrap",
    width: "100%",
  },
  commentMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 2,
  },
  commentSeeMoreBtn: {
    alignSelf: "flex-start",
    marginTop: 2,
  },
  commentSeeMoreText: {
    color: "#4f84db",
    fontSize: 12,
    fontWeight: "700",
  },
  ownCommentMoreBtn: {
    marginLeft: "auto",
    width: 22,
    height: 22,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  commentAge: {
    color: "#9ca3af",
    fontSize: 11,
  },
  commentReplyText: {
    color: "#8b8f98",
    fontSize: 11,
    fontWeight: "600",
  },
  commentToggleBtn: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingRight: 8,
  },
  commentToggleText: {
    color: "#4f84db",
    fontSize: 14,
    fontWeight: "500",
  },
  commentChildrenWrap: {
    marginTop: 8,
  },
  commentComposerWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  replyingTagRow: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 2,
    borderRadius: 999,
    backgroundColor: "#eef2ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  replyingTagText: {
    color: "#4f46e5",
    fontSize: 12,
    fontWeight: "600",
  },
  replyingTagClear: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
  },
  commentInputRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    flexShrink: 0,
  },
  inputAvatarImage: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
  },
  commentInput: {
    flex: 1,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 0,
    minHeight: 44,
    maxHeight: 96,
    color: "#111827",
    fontSize: 14,
    textAlignVertical: "top",
  },
  commentSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  commentSendText: {
    color: "#6b7280",
    fontSize: 15,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  actionModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  actionModalCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 14,
    gap: 8,
  },
  actionModalTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  actionModalBtn: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f3f4f6",
  },
  actionModalBtnText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  actionModalDeleteBtn: {
    backgroundColor: "#fee2e2",
  },
  actionModalDeleteText: {
    color: "#b91c1c",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  editModalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    padding: 14,
  },
  editModalInput: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 96,
    maxHeight: 160,
    color: "#111827",
    fontSize: 14,
    textAlignVertical: "top",
  },
  editModalActionsRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  editModalCancelBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editModalCancelText: {
    color: "#4b5563",
    fontSize: 13,
    fontWeight: "600",
  },
  editModalSaveBtn: {
    borderRadius: 10,
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editModalSaveText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
});
