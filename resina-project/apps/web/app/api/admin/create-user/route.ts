import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

type CreateUserBody = {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  role?: string;
};

function buildFullName(last: string, first: string, middle: string): string {
  return [first.trim(), middle.trim(), last.trim()].filter(Boolean).join(" ");
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify the caller is authenticated via their session cookie.
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
    const body = (await request.json()) as CreateUserBody;
    const {
      firstName = "",
      middleName = "",
      lastName = "",
      email = "",
      password = "",
      role = "member",
    } = body;

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      return NextResponse.json(
        { error: "First name, last name, email, and password are required." },
        { status: 400 },
      );
    }

    if (password.trim().length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 },
      );
    }

    if (!["admin", "member"].includes(role)) {
      return NextResponse.json({ error: "Invalid role. Must be admin or member." }, { status: 400 });
    }

    // 4. Create the Auth user with the service-role client (bypasses sign-up restrictions).
    const adminSupabase = createAdminClient();
    const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: password.trim(),
      email_confirm: true, // pre-confirm so they can log in immediately
    });

    if (createError || !newUser.user) {
      return NextResponse.json(
        { error: createError?.message ?? "Failed to create Auth user." },
        { status: 400 },
      );
    }

    // 5. Insert the matching profiles row.
    const fullName = buildFullName(lastName, firstName, middleName);
    const { error: insertError } = await adminSupabase.from("profiles").insert({
      auth_user_id: newUser.user.id,
      first_name: firstName.trim(),
      middle_name: middleName.trim(),
      last_name: lastName.trim(),
      full_name: fullName,
      email: email.trim().toLowerCase(),
      role,
    });

    if (insertError) {
      // Rollback: delete the Auth user to keep state consistent.
      await adminSupabase.auth.admin.deleteUser(newUser.user.id);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ id: newUser.user.id, email: newUser.user.email });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
