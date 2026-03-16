import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

type CreateCommentBody = {
  announcementId?: string;
  commenterName?: string;
  commentBody?: string;
};

export async function GET() {
  try {
    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase
      .from("announcement_comments")
      .select("id, announcement_id, commenter_name, comment_body, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ comments: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load comments.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateCommentBody;
    const announcementId = body.announcementId?.trim() ?? "";
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

    const { error: insertError } = await adminSupabase.from("announcement_comments").insert({
      announcement_id: announcementId,
      commenter_auth_user_id: user?.id ?? null,
      commenter_name: commenterName,
      comment_body: commentBody,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to post comment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
