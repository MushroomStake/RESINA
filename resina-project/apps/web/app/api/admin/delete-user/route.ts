import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

type DeleteUserBody = {
  profileId?: string;
  authUserId?: string | null;
};

export async function DELETE(request: NextRequest) {
  try {
    // 1. Verify the caller is authenticated.
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify the caller is an admin.
    const { data: callerProfile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("auth_user_id", user.id)
      .single();

    if (profileError || callerProfile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: admin role required" }, { status: 403 });
    }

    // 3. Parse and validate request body.
    const body = (await request.json()) as DeleteUserBody;
    const { profileId, authUserId } = body;

    if (!profileId) {
      return NextResponse.json({ error: "profileId is required." }, { status: 400 });
    }

    // 4. Prevent self-deletion.
    if (authUserId && authUserId === user.id) {
      return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    // 5. Delete the Auth user first (if linked). This also cascades foreign-key references.
    if (authUserId) {
      const { error: deleteAuthError } = await adminSupabase.auth.admin.deleteUser(authUserId);
      if (deleteAuthError) {
        return NextResponse.json({ error: deleteAuthError.message }, { status: 500 });
      }
    }

    // 6. Delete the profiles row (handles unlinked profiles too).
    const { error: deleteProfileError } = await adminSupabase
      .from("profiles")
      .delete()
      .eq("id", profileId);

    if (deleteProfileError) {
      return NextResponse.json({ error: deleteProfileError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
