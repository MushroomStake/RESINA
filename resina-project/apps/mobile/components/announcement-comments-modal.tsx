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
  onRequestClose: () => void;
  onError?: (message: string) => void;
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

function resolveAvatarSource(value: unknown): ImageSourcePropType {
  const key = String(value ?? "").trim().toLowerCase() as ProfileAvatarKey;
  return PROFILE_AVATAR_SOURCES[key] ?? PROFILE_AVATAR_SOURCES.user;
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

export function AnnouncementCommentsModal({
  visible,
  announcement,
  currentCommenterName,
  currentUserAvatarSource,
  sessionUserId,
  onRequestClose,
  onError,
}: AnnouncementCommentsModalProps) {
  const { height: windowHeight } = useWindowDimensions();
  const [announcementComments, setAnnouncementComments] = useState<AnnouncementCommentItem[]>([]);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [modalError, setModalError] = useState("");
  const [supportsThreadParentColumn, setSupportsThreadParentColumn] = useState(true);
  const [commentInput, setCommentInput] = useState("");
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [replyingToCommentName, setReplyingToCommentName] = useState<string | null>(null);
  const [collapsedCommentIds, setCollapsedCommentIds] = useState<Set<string>>(new Set());
  const [commenterAvatarByUserId, setCommenterAvatarByUserId] = useState<Record<string, ImageSourcePropType>>({});
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardOffset = Platform.OS === "ios" ? keyboardHeight : 0;
  const composerInset = replyingToCommentName ? 108 : 70;
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

  const loadAnnouncementComments = useCallback(async () => {
    if (!announcement?.id) return;

    setIsCommentsLoading(true);
    setModalError("");

    const threadedResult = await supabase
      .from("announcement_comments")
      .select("id, announcement_id, commenter_auth_user_id, parent_comment_id, commenter_name, comment_body, created_at")
      .eq("announcement_id", announcement.id)
      .order("created_at", { ascending: true });

    if (!threadedResult.error) {
      const nextComments = (threadedResult.data ?? []) as AnnouncementCommentItem[];
      setSupportsThreadParentColumn(true);
      setAnnouncementComments(nextComments);
      setCollapsedCommentIds(new Set());
      setIsCommentsLoading(false);
      return;
    }

    if (!threadedResult.error.message.toLowerCase().includes("parent_comment_id")) {
      setIsCommentsLoading(false);
      setModalError(threadedResult.error.message);
      onError?.(threadedResult.error.message);
      return;
    }

    const fallbackResult = await supabase
      .from("announcement_comments")
      .select("id, announcement_id, commenter_auth_user_id, commenter_name, comment_body, created_at")
      .eq("announcement_id", announcement.id)
      .order("created_at", { ascending: true });

    if (fallbackResult.error) {
      setIsCommentsLoading(false);
      setModalError(fallbackResult.error.message);
      onError?.(fallbackResult.error.message);
      return;
    }

    const nextComments = normalizeLegacyComments(
      (fallbackResult.data ?? []) as Array<Omit<AnnouncementCommentItem, "parent_comment_id">>,
    );

    setSupportsThreadParentColumn(false);
    setAnnouncementComments(nextComments);
    setCollapsedCommentIds(new Set());
    setIsCommentsLoading(false);
  }, [announcement?.id]);

  useEffect(() => {
    if (!visible || !announcement?.id) return;

    setCommentInput("");
    setReplyingToCommentId(null);
    setReplyingToCommentName(null);
    setCollapsedCommentIds(new Set());
    setModalError("");
    setKeyboardHeight(0);
    void loadAnnouncementComments();
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
          void loadAnnouncementComments();
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
      setModalError(insertResult.error.message);
      onError?.(insertResult.error.message);
      return;
    }

    setCommentInput("");
    setReplyingToCommentId(null);
    setReplyingToCommentName(null);
    await loadAnnouncementComments();
  };

  const handleModalClose = () => {
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
          {comment.commenter_auth_user_id ? (
            <Image
              source={
                comment.commenter_auth_user_id === sessionUserId
                  ? currentUserAvatarSource
                  : commenterAvatarByUserId[comment.commenter_auth_user_id] ?? PROFILE_AVATAR_SOURCES.user
              }
              style={styles.commentAvatarImage}
              resizeMode="cover"
            />
          ) : comment.commenter_name.trim().toLowerCase() === currentCommenterName.trim().toLowerCase() ? (
            <Image source={currentUserAvatarSource} style={styles.commentAvatarImage} resizeMode="cover" />
          ) : (
            <Ionicons name="person-circle-outline" size={24} color="#4b5563" style={styles.commentAvatar} />
          )}
          <View style={styles.commentContentCol}>
            <Text style={styles.commentBodyInline}>
              <Text style={styles.commentAuthor}>{comment.commenter_name}</Text> {comment.comment_body}
            </Text>

            <View style={styles.commentMetaRow}>
              <Text style={styles.commentAge}>{formatCommentAge(comment.created_at)}</Text>
              <Pressable onPress={() => handleReplyToComment(comment.id, comment.commenter_name)}>
                <Text style={styles.commentReplyText}>Reply</Text>
              </Pressable>
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
            contentContainerStyle={[styles.commentsListContent, { paddingBottom: composerInset }]}
            keyboardShouldPersistTaps="handled"
          >
            {modalError ? <Text style={styles.commentsErrorText}>{modalError}</Text> : null}
            {isCommentsLoading ? <Text style={styles.loaderText}>Loading comments...</Text> : null}

            {!isCommentsLoading && announcementComments.length === 0 ? (
              <Text style={styles.placeholderText}>No comments yet.</Text>
            ) : null}

            {!isCommentsLoading ? renderCommentThread(null) : null}
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
  commentsErrorText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "600",
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
    width: 24,
    height: 24,
    borderRadius: 999,
    marginRight: 8,
    marginTop: 1,
    backgroundColor: "#e5e7eb",
  },
  commentContentCol: {
    flex: 1,
  },
  commentAuthor: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  commentBodyInline: {
    color: "#2f343d",
    fontSize: 15,
    lineHeight: 24,
  },
  commentMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 2,
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
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  inputAvatarImage: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
  },
  commentInput: {
    flex: 1,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#111827",
    fontSize: 14,
  },
  commentSendBtn: {
    width: 32,
    height: 32,
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
});
