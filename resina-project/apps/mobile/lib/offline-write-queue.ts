import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import type { ProfileAvatarKey } from "../components/profile-section";

const OFFLINE_WRITE_QUEUE_KEY = "resina:queue:offline-writes";
const MAX_OFFLINE_WRITE_RETRIES = 3;

export type OfflineWriteQueueItem =
  | {
      id: string;
      kind: "profile-upsert";
      createdAt: number;
  retryCount?: number;
      payload: {
        userId: string;
        fullName: string;
        email: string;
        phoneNumber: string;
        role: string;
        residentStatus: "resident" | "non_resident";
        addressPurok: string;
        profileAvatarKey: ProfileAvatarKey;
        userMetadata: Record<string, unknown>;
      };
    }
  | {
      id: string;
      kind: "announcement-comment";
      createdAt: number;
      retryCount?: number;
      payload: {
        announcementId: string;
        commenterAuthUserId: string;
        commenterName: string;
        parentCommentId: string | null;
        body: string;
        supportsThreadParentColumn: boolean;
      };
    };

type OfflineQueueSummary = {
  syncedCount: number;
  remainingCount: number;
};

function buildQueueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readQueue(): Promise<OfflineWriteQueueItem[]> {
  const raw = await AsyncStorage.getItem(OFFLINE_WRITE_QUEUE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as OfflineWriteQueueItem[];
  } catch {
    return [];
  }
}

async function writeQueue(items: OfflineWriteQueueItem[]): Promise<void> {
  await AsyncStorage.setItem(OFFLINE_WRITE_QUEUE_KEY, JSON.stringify(items));
}

export async function enqueueProfileWrite(payload: Extract<OfflineWriteQueueItem, { kind: "profile-upsert" }>["payload"]): Promise<void> {
  const queue = await readQueue();
  const filtered = queue.filter((entry) => !(entry.kind === "profile-upsert" && entry.payload.userId === payload.userId));

  filtered.push({
    id: buildQueueId("profile"),
    kind: "profile-upsert",
    createdAt: Date.now(),
    retryCount: 0,
    payload,
  });

  await writeQueue(filtered);
}

export async function enqueueAnnouncementComment(
  payload: Extract<OfflineWriteQueueItem, { kind: "announcement-comment" }>["payload"],
): Promise<void> {
  const queue = await readQueue();
  queue.push({
    id: buildQueueId("comment"),
    kind: "announcement-comment",
    createdAt: Date.now(),
    retryCount: 0,
    payload,
  });
  await writeQueue(queue);
}

export async function readOfflineWriteQueueLength(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}

export async function flushOfflineWriteQueue(): Promise<OfflineQueueSummary> {
  const queue = await readQueue();
  if (queue.length === 0) {
    return {
      syncedCount: 0,
      remainingCount: 0,
    };
  }

  let syncedCount = 0;
  let nextQueue: OfflineWriteQueueItem[] = [];

  for (let index = 0; index < queue.length; index += 1) {
    const entry = queue[index];

    try {
      if (entry.kind === "profile-upsert") {
        const { payload } = entry;
        const metadata = payload.userMetadata;

        const { error: updateError } = await supabase.auth.updateUser({
          data: {
            ...metadata,
            full_name: payload.fullName,
            phone_number: payload.phoneNumber,
            role: payload.role,
            resident_status: payload.residentStatus,
            address_purok: payload.addressPurok,
            profile_avatar: payload.profileAvatarKey,
          },
        });

        if (updateError) {
          throw updateError;
        }

        const { error: profileError } = await supabase.from("profiles").upsert(
          {
            auth_user_id: payload.userId,
            full_name: payload.fullName,
            email: payload.email,
            phone_number: payload.phoneNumber,
            role: payload.role,
            resident_status: payload.residentStatus,
            address_purok: payload.addressPurok,
            profile_avatar: payload.profileAvatarKey,
          },
          {
            onConflict: "auth_user_id",
          },
        );

        if (profileError) {
          throw profileError;
        }
      } else {
        const { payload } = entry;
        const commentBody =
          !payload.supportsThreadParentColumn && payload.parentCommentId
            ? `[[reply:${payload.parentCommentId}]] ${payload.body}`
            : payload.body;

        const basePayload: Record<string, string | null> = {
          announcement_id: payload.announcementId,
          commenter_auth_user_id: payload.commenterAuthUserId,
          commenter_name: payload.commenterName,
          comment_body: commentBody,
        };

        if (payload.supportsThreadParentColumn) {
          basePayload.parent_comment_id = payload.parentCommentId;
        }

        let insertResult = await supabase.from("announcement_comments").insert(basePayload);

        if (insertResult.error && payload.supportsThreadParentColumn && insertResult.error.message.toLowerCase().includes("parent_comment_id")) {
          const fallbackPayload: Record<string, string> = {
            announcement_id: payload.announcementId,
            commenter_auth_user_id: payload.commenterAuthUserId,
            commenter_name: payload.commenterName,
            comment_body: payload.parentCommentId ? `[[reply:${payload.parentCommentId}]] ${payload.body}` : payload.body,
          };
          insertResult = await supabase.from("announcement_comments").insert(fallbackPayload);
        }

        if (insertResult.error) {
          throw insertResult.error;
        }
      }

      syncedCount += 1;
    } catch {
      const nextRetryCount = (entry.retryCount ?? 0) + 1;

      // Drop permanently failing item after retry limit so it cannot block the queue forever.
      if (nextRetryCount > MAX_OFFLINE_WRITE_RETRIES) {
        syncedCount += 1;
        continue;
      }

      const failedEntry: OfflineWriteQueueItem = {
        ...entry,
        retryCount: nextRetryCount,
      };

      nextQueue = [failedEntry, ...queue.slice(index + 1)];
      break;
    }
  }

  if (nextQueue.length === 0) {
    nextQueue = queue.slice(syncedCount);
  }

  await writeQueue(nextQueue);

  return {
    syncedCount,
    remainingCount: nextQueue.length,
  };
}

export async function queueProfileWrite(payload: Extract<OfflineWriteQueueItem, { kind: "profile-upsert" }>["payload"]): Promise<void> {
  await enqueueProfileWrite(payload);
}

export async function queueAnnouncementComment(
  payload: Extract<OfflineWriteQueueItem, { kind: "announcement-comment" }>["payload"],
): Promise<void> {
  await enqueueAnnouncementComment(payload);
}
