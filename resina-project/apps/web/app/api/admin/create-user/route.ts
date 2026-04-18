import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient as createServerSupabase } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

type CreateUserBody = {
  fullName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  email?: string;
  confirmEmail?: string;
  role?: string;
  password?: string;
};

function buildFullName(first: string, middle: string, last: string): string {
  return [first.trim(), middle.trim(), last.trim()].filter(Boolean).join(" ");
}

function generateStrongPassword(): string {
  // Generate a cryptographically secure random password
  // Format: 16 characters using base64 for better entropy and usability
  const buffer = randomBytes(12); // 12 bytes = 96 bits of entropy
  return buffer
    .toString("base64")
    .replace(/[+/=]/g, (char) => {
      // Replace URL-unsafe characters with safe alternatives
      const replacements: Record<string, string> = { "+": "0", "/": "1", "=": "2" };
      return replacements[char] || char;
    })
    .slice(0, 16); // Ensure consistent length
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
      confirmEmail = "",
      role = "member",
      fullName = "",
      password = "",
    } = body;

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      return NextResponse.json(
        { error: "First name, last name, and email are required." },
        { status: 400 },
      );
    }

    if (!["admin", "member"].includes(role)) {
      return NextResponse.json({ error: "Invalid role. Must be admin or member." }, { status: 400 });
    }

    if (password.trim() && password.trim().length < 6) {
      return NextResponse.json({ error: "Default password must be at least 6 characters." }, { status: 400 });
    }

    const normalizedFullName = fullName.trim() || buildFullName(firstName, middleName, lastName);
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedConfirmEmail = confirmEmail.trim().toLowerCase();
    // Use provided password or generate a strong random one
    const defaultPassword = password.trim() || generateStrongPassword();
    const adminLink = `${request.nextUrl.origin}/admin`;

    if (!normalizedConfirmEmail) {
      return NextResponse.json({ error: "Confirm email is required." }, { status: 400 });
    }

    if (normalizedEmail !== normalizedConfirmEmail) {
      return NextResponse.json({ error: "Email and confirm email do not match." }, { status: 400 });
    }

    // 4. Send an invite email with metadata and admin redirect.
    const adminSupabase = createAdminClient();
    const { data: inviteResult, error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(normalizedEmail, {
      redirectTo: adminLink,
      data: {
        full_name: normalizedFullName,
        position: role,
        admin_link: adminLink,
      },
    });

    if (inviteError || !inviteResult.user) {
      return NextResponse.json(
        { error: inviteError?.message ?? "Failed to send invitation." },
        { status: 400 },
      );
    }

    const invitedUserId = inviteResult.user.id;
    if (!invitedUserId) {
      return NextResponse.json({ error: "Invite succeeded but user id was missing." }, { status: 500 });
    }

    // 5. Assign an actual temporary password and confirm the email so the user can log in immediately.
    const { error: setPasswordError } = await adminSupabase.auth.admin.updateUserById(invitedUserId, {
      password: defaultPassword,
      email_confirm: true,
      user_metadata: {
        full_name: normalizedFullName,
        position: role,
        admin_link: adminLink,
      },
    });

    if (setPasswordError) {
      return NextResponse.json(
        { error: `Invite sent but failed to set temporary password: ${setPasswordError.message}` },
        { status: 500 },
      );
    }

    const adminSupabaseDynamic = adminSupabase as any;

    // 6. Insert or update matching profiles row using explicit flow for clearer error handling.
    const { data: existingProfile, error: selectError } = await adminSupabaseDynamic
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (selectError) {
      return NextResponse.json(
        { error: `Failed to check existing profile: ${selectError.message}` },
        { status: 500 },
      );
    }

    if (existingProfile?.id) {
      const { error: updateError } = await adminSupabaseDynamic
        .from("profiles")
        .update({
          auth_user_id: invitedUserId,
          first_name: firstName.trim(),
          middle_name: middleName.trim(),
          last_name: lastName.trim(),
          full_name: normalizedFullName,
          role,
        })
        .eq("id", existingProfile.id);

      if (updateError) {
        return NextResponse.json(
          { error: `Failed to update existing profile: ${updateError.message}` },
          { status: 500 },
        );
      }
    } else {
      const { error: insertError } = await adminSupabaseDynamic.from("profiles").insert({
        auth_user_id: invitedUserId,
        first_name: firstName.trim(),
        middle_name: middleName.trim(),
        last_name: lastName.trim(),
        full_name: normalizedFullName,
        email: normalizedEmail,
        role,
      });

      if (insertError) {
        return NextResponse.json(
          { error: `Failed to insert profile: ${insertError.message}` },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      id: invitedUserId,
      email: inviteResult.user.email,
      message: "Invite sent.",
      temporaryPassword: defaultPassword,
      metadata: {
        fullName: normalizedFullName,
        position: role,
        link: adminLink,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
