import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

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
  const { data: profile } = await adminSupabase
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

export async function GET(request: NextRequest) {
  try {
    const access = await requirePortalUser();
    if (!access.user) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const announcementId = request.nextUrl.searchParams.get("announcementId")?.trim() ?? "";

    const adminSupabase = createAdminClient();
    let threadedQuery = adminSupabase
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

    let fallbackQuery = adminSupabase
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
      comments: (fallbackResult.data ?? []).map((row) => ({
        ...row,
        parent_comment_id: null,
      })),
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

    const adminSupabase = createAdminClient();

    const { data: announcement, error: announcementError } = await adminSupabase
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

    const insertResult = await adminSupabase
      .from("announcement_comments")
      .insert(insertPayload)
      .select("id, announcement_id, parent_comment_id, commenter_name, comment_body, created_at")
      .single();

    if (
      insertResult.error &&
      insertResult.error.message.toLowerCase().includes("parent_comment_id")
    ) {
      const fallbackInsert = await adminSupabase
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

      return NextResponse.json({ success: true, comment: { ...fallbackInsert.data, parent_comment_id: null } }, { status: 201 });
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
    let deleteQuery = adminSupabase.from("announcement_comments").delete().eq("id", commentId);

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
