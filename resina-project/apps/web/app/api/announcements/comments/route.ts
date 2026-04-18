import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

const ANON_COMMENT_WINDOW_MS = 15 * 60 * 1000;
const ANON_COMMENT_MAX_PER_WINDOW = 10;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const anonCommentRateLimitStore = new Map<string, RateLimitEntry>();

type CreateCommentBody = {
  announcementId?: string;
  parentCommentId?: string | null;
  commenterName?: string;
  commentBody?: string;
};

type DeleteCommentBody = {
  commentId?: string;
  announcementId?: string;
};

async function requirePortalUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, error: "Unauthorized", status: 401 as const };
  }

  const adminSupabase = createAdminClient();
  const adminSupabaseDynamic = adminSupabase as any;
  const { data: profile } = await adminSupabaseDynamic
    .from("profiles")
    .select("role")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const role = String(profile?.role ?? "").toLowerCase();
  if (role !== "admin" && role !== "member") {
    return { user: null, error: "Forbidden", status: 403 as const };
  }

  return { user, error: null, status: 200 as const };
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  const firstIp = forwardedFor.split(",")[0]?.trim();
  return firstIp || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function enforceAnonymousCommentRateLimit(request: NextRequest, authUserId: string | null): boolean {
  if (authUserId) {
    return true;
  }

  const now = Date.now();
  const key = `anon:${getClientIp(request)}`;
  const existing = anonCommentRateLimitStore.get(key);

  if (!existing || now >= existing.resetAt) {
    anonCommentRateLimitStore.set(key, {
      count: 1,
      resetAt: now + ANON_COMMENT_WINDOW_MS,
    });
    return true;
  }

  if (existing.count >= ANON_COMMENT_MAX_PER_WINDOW) {
    return false;
  }

  existing.count += 1;
  anonCommentRateLimitStore.set(key, existing);
  return true;
}

export async function GET(request: NextRequest) {
  try {
    const access = await requirePortalUser();
    if (!access.user) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const announcementId = request.nextUrl.searchParams.get("announcementId")?.trim() ?? "";

    const adminSupabase = createAdminClient();
    const adminSupabaseDynamic = adminSupabase as any;
    let threadedQuery = adminSupabaseDynamic
      .from("announcement_comments")
      .select("id, announcement_id, parent_comment_id, commenter_name, comment_body, created_at")
      .order("created_at", { ascending: true });

    if (announcementId) {
      threadedQuery = threadedQuery.eq("announcement_id", announcementId);
    }

    const threadedResult = await threadedQuery.limit(200);

    if (!threadedResult.error) {
      return NextResponse.json({ comments: threadedResult.data ?? [] });
    }

    if (!threadedResult.error.message.toLowerCase().includes("parent_comment_id")) {
      return NextResponse.json({ error: threadedResult.error.message }, { status: 500 });
    }

    let fallbackQuery = adminSupabaseDynamic
      .from("announcement_comments")
      .select("id, announcement_id, commenter_name, comment_body, created_at")
      .order("created_at", { ascending: true });

    if (announcementId) {
      fallbackQuery = fallbackQuery.eq("announcement_id", announcementId);
    }

    const fallbackResult = await fallbackQuery.limit(200);

    if (fallbackResult.error) {
      return NextResponse.json({ error: fallbackResult.error.message }, { status: 500 });
    }

    return NextResponse.json({
      comments: (fallbackResult.data ?? []).map((rawRow: unknown) => {
        const row = rawRow as Record<string, unknown>;
        return {
          id: String(row.id ?? ""),
          announcement_id: String(row.announcement_id ?? ""),
          commenter_name: String(row.commenter_name ?? ""),
          comment_body: String(row.comment_body ?? ""),
          created_at: String(row.created_at ?? ""),
          parent_comment_id: null,
        };
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load comments.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateCommentBody;
    const announcementId = body.announcementId?.trim() ?? "";
    const parentCommentId = body.parentCommentId?.trim() || null;
    const commenterName = body.commenterName?.trim() ?? "";
    const commentBody = body.commentBody?.trim() ?? "";

    if (!announcementId || !commenterName || !commentBody) {
      return NextResponse.json(
        { error: "announcementId, commenterName, and commentBody are required." },
        { status: 400 },
      );
    }

    if (commenterName.length > 80) {
      return NextResponse.json({ error: "Commenter name must be 80 characters or less." }, { status: 400 });
    }

    if (commentBody.length > 1000) {
      return NextResponse.json({ error: "Comment must be 1000 characters or less." }, { status: 400 });
    }

    // Resolve current user if logged in; endpoint still supports guests.
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!enforceAnonymousCommentRateLimit(request, user?.id ?? null)) {
      return NextResponse.json(
        { error: "Too many anonymous comments. Please try again later." },
        { status: 429 },
      );
    }

    const adminSupabase = createAdminClient();
    const adminSupabaseDynamic = adminSupabase as any;

    const { data: announcement, error: announcementError } = await adminSupabaseDynamic
      .from("announcements")
      .select("id")
      .eq("id", announcementId)
      .maybeSingle();

    if (announcementError || !announcement) {
      return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
    }

    const insertPayload = {
      announcement_id: announcementId,
      parent_comment_id: parentCommentId,
      commenter_auth_user_id: user?.id ?? null,
      commenter_name: commenterName,
      comment_body: commentBody,
    };

    const insertResult = await adminSupabaseDynamic
      .from("announcement_comments")
      .insert(insertPayload)
      .select("id, announcement_id, parent_comment_id, commenter_name, comment_body, created_at")
      .single();

    if (
      insertResult.error &&
      insertResult.error.message.toLowerCase().includes("parent_comment_id")
    ) {
      const fallbackInsert = await adminSupabaseDynamic
        .from("announcement_comments")
        .insert({
          announcement_id: announcementId,
          commenter_auth_user_id: user?.id ?? null,
          commenter_name: commenterName,
          comment_body: commentBody,
        })
        .select("id, announcement_id, commenter_name, comment_body, created_at")
        .single();

      if (fallbackInsert.error) {
        return NextResponse.json({ error: fallbackInsert.error.message }, { status: 500 });
      }

      const fallbackComment = fallbackInsert.data as Record<string, unknown>;

      return NextResponse.json(
        {
          success: true,
          comment: {
            id: String(fallbackComment.id ?? ""),
            announcement_id: String(fallbackComment.announcement_id ?? ""),
            commenter_name: String(fallbackComment.commenter_name ?? ""),
            comment_body: String(fallbackComment.comment_body ?? ""),
            created_at: String(fallbackComment.created_at ?? ""),
            parent_comment_id: null,
          },
        },
        { status: 201 },
      );
    }

    if (insertResult.error) {
      return NextResponse.json({ error: insertResult.error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, comment: insertResult.data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to post comment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await requirePortalUser();
    if (!access.user) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = (await request.json()) as DeleteCommentBody;
    const commentId = body.commentId?.trim() ?? "";
    const announcementId = body.announcementId?.trim() ?? "";

    if (!commentId) {
      return NextResponse.json({ error: "commentId is required." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const adminSupabaseDynamic = adminSupabase as any;
    let deleteQuery = adminSupabaseDynamic.from("announcement_comments").delete().eq("id", commentId);

    if (announcementId) {
      deleteQuery = deleteQuery.eq("announcement_id", announcementId);
    }

    const { error } = await deleteQuery;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete comment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
