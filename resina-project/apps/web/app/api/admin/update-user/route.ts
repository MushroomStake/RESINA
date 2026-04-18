import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

type UpdateUserBody = {
  profileId?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  role?: string;
};

function buildFullName(first: string, middle: string, last: string): string {
  return [first.trim(), middle.trim(), last.trim()].filter(Boolean).join(" ");
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: callerProfile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("auth_user_id", user.id)
      .single();

    if (profileError || callerProfile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: admin role required" }, { status: 403 });
    }

    const body = (await request.json()) as UpdateUserBody;
    const {
      profileId = "",
      firstName = "",
      middleName = "",
      lastName = "",
      email = "",
      role = "member",
    } = body;

    if (!profileId || !firstName.trim() || !lastName.trim() || !email.trim()) {
      return NextResponse.json({ error: "profileId, first name, last name, and email are required." }, { status: 400 });
    }

    if (!["admin", "member"].includes(role)) {
      return NextResponse.json({ error: "Invalid role. Must be admin or member." }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const adminSupabaseDynamic = adminSupabase as any;
    const normalizedEmail = email.trim().toLowerCase();
    const fullName = buildFullName(firstName, middleName, lastName);

    const { data: existingProfile, error: loadError } = await adminSupabaseDynamic
      .from("profiles")
      .select("auth_user_id, email")
      .eq("id", profileId)
      .maybeSingle();

    if (loadError || !existingProfile) {
      return NextResponse.json({ error: loadError?.message ?? "Profile not found." }, { status: 404 });
    }

    // Keep auth email in sync with profile email if this row is linked to an auth user.
    if (existingProfile.auth_user_id && existingProfile.email !== normalizedEmail) {
      const { error: updateAuthError } = await adminSupabase.auth.admin.updateUserById(existingProfile.auth_user_id, {
        email: normalizedEmail,
      });

      if (updateAuthError) {
        return NextResponse.json({ error: `Failed to update auth email: ${updateAuthError.message}` }, { status: 500 });
      }
    }

    const { error: updateProfileError } = await adminSupabaseDynamic
      .from("profiles")
      .update({
        first_name: firstName.trim(),
        middle_name: middleName.trim(),
        last_name: lastName.trim(),
        full_name: fullName,
        email: normalizedEmail,
        role,
      })
      .eq("id", profileId);

    if (updateProfileError) {
      return NextResponse.json({ error: updateProfileError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
