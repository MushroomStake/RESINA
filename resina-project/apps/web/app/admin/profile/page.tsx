"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type Role = "admin" | "member";

type ProfileRow = {
  id: string;
  auth_user_id: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  full_name: string;
  email: string;
  role: Role;
  created_at: string;
};

type AddUserForm = {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  role: Role;
  password: string;
};

function buildFullName(last: string, first: string, middle: string): string {
  return [first.trim(), middle.trim(), last.trim()].filter(Boolean).join(" ");
}

function formatDateShort(date: Date): string {
  return date
    .toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
      month: "short",
      day: "2-digit",
      year: "numeric",
    })
    .toUpperCase();
}

export default function AdminProfilePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [isChecking, setIsChecking] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isDeletingUserId, setIsDeletingUserId] = useState<string | null>(null);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);

  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string>("");
  const [myRole, setMyRole] = useState<Role>("member");
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);

  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [position, setPosition] = useState<Role>("member");
  const [password, setPassword] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [phNow, setPhNow] = useState(() => new Date());

  const [addUserForm, setAddUserForm] = useState<AddUserForm>({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    role: "member",
    password: "",
  });

  const filteredProfiles = profiles.filter((entry) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return true;
    }

    return entry.full_name.toLowerCase().includes(q) || entry.email.toLowerCase().includes(q);
  });

  const loadProfiles = async (currentUserId: string, currentEmail: string) => {
    const { data: rows, error } = await supabase
      .from("profiles")
      .select("id, auth_user_id, first_name, middle_name, last_name, full_name, email, role, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      setProfileError(error.message);
      return;
    }

    const data = (rows ?? []) as ProfileRow[];

    const mine = data.find((entry) => entry.auth_user_id === currentUserId);

    if (!mine) {
      const fallbackFirst = currentEmail.split("@")[0] || "Admin";
      const fallbackLast = "User";
      const fullName = buildFullName(fallbackLast, fallbackFirst, "");

      const { error: insertError } = await supabase.from("profiles").insert({
        auth_user_id: currentUserId,
        first_name: fallbackFirst,
        middle_name: "",
        last_name: fallbackLast,
        full_name: fullName,
        email: currentEmail,
        role: "member",
      });

      if (insertError) {
        setProfileError(insertError.message);
      }

      const { data: reloadRows } = await supabase
        .from("profiles")
        .select("id, auth_user_id, first_name, middle_name, last_name, full_name, email, role, created_at")
        .order("created_at", { ascending: true });

      const reloaded = (reloadRows ?? []) as ProfileRow[];
      setProfiles(reloaded);

      const reloadedMine = reloaded.find((entry) => entry.auth_user_id === currentUserId);
      if (reloadedMine) {
        setFirstName(reloadedMine.first_name ?? "");
        setMiddleName(reloadedMine.middle_name ?? "");
        setLastName(reloadedMine.last_name ?? "");
        setPosition(reloadedMine.role);
        setMyRole(reloadedMine.role);
      }

      return;
    }

    setProfiles(data);
    setFirstName(mine.first_name ?? "");
    setMiddleName(mine.middle_name ?? "");
    setLastName(mine.last_name ?? "");
    setPosition(mine.role);
    setMyRole(mine.role);
  };

  useEffect(() => {
    const initialize = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session) {
        router.replace("/admin");
        return;
      }

      const currentUserId = session.user.id;
      const currentEmail = session.user.email ?? "";

      setSessionUserId(currentUserId);
      setSessionEmail(currentEmail);
      await loadProfiles(currentUserId, currentEmail);
      setIsChecking(false);
    };

    void initialize();
  }, [router, supabase]);

  useEffect(() => {
    const timer = setInterval(() => setPhNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const phTime = phNow
    .toLocaleTimeString("en-PH", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .replace(" ", "")
    .toUpperCase();

  const phDate = formatDateShort(phNow);

  const handleSaveProfile = async () => {
    if (!sessionUserId) {
      return;
    }

    setIsSaving(true);
    setProfileMessage(null);
    setProfileError(null);

    try {
      const fullName = buildFullName(lastName, firstName, middleName);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          first_name: firstName.trim(),
          middle_name: middleName.trim(),
          last_name: lastName.trim(),
          full_name: fullName,
          role: position,
        })
        .eq("auth_user_id", sessionUserId);

      if (updateError) {
        throw new Error(updateError.message);
      }

      if (password.trim()) {
        const { error: passwordError } = await supabase.auth.updateUser({
          password: password.trim(),
        });

        if (passwordError) {
          throw new Error(passwordError.message);
        }

        setPassword("");
      }

      await loadProfiles(sessionUserId, sessionEmail);
      setProfileMessage("Profile updated successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save profile.";
      setProfileError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePersonnel = async (row: ProfileRow) => {
    if (myRole !== "admin") {
      return;
    }

    if (!sessionUserId || row.auth_user_id === sessionUserId) {
      setProfileError("You cannot remove your own admin profile.");
      return;
    }

    setIsDeletingUserId(row.id);
    setProfileError(null);
    setProfileMessage(null);

    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: row.id, authUserId: row.auth_user_id }),
      });

      if (!res.ok) {
        const { error } = (await res.json()) as { error: string };
        throw new Error(error ?? "Failed to delete user.");
      }

      await loadProfiles(sessionUserId, sessionEmail);
      setProfileMessage("Personnel removed.");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Unable to remove user.");
    } finally {
      setIsDeletingUserId(null);
    }
  };

  const handleAddUser = async () => {
    if (myRole !== "admin" || !sessionUserId) {
      return;
    }

    const fullName = buildFullName(addUserForm.lastName, addUserForm.firstName, addUserForm.middleName);

    if (!fullName || !addUserForm.email.trim()) {
      setProfileError("First name, last name, and email are required.");
      return;
    }

    if (!addUserForm.password.trim() || addUserForm.password.trim().length < 6) {
      setProfileError("Password must be at least 6 characters.");
      return;
    }

    setIsAddingUser(true);
    setProfileError(null);
    setProfileMessage(null);

    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: addUserForm.firstName.trim(),
          middleName: addUserForm.middleName.trim(),
          lastName: addUserForm.lastName.trim(),
          email: addUserForm.email.trim().toLowerCase(),
          password: addUserForm.password.trim(),
          role: addUserForm.role,
        }),
      });

      if (!res.ok) {
        const { error } = (await res.json()) as { error: string };
        throw new Error(error ?? "Failed to create user.");
      }

      setIsAddUserModalOpen(false);
      setAddUserForm({ firstName: "", middleName: "", lastName: "", email: "", role: "member", password: "" });
      await loadProfiles(sessionUserId, sessionEmail);
      setProfileMessage("User account created. They can now log in.");
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Unable to add user.");
    } finally {
      setIsAddingUser(false);
    }
  };

  if (isChecking) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#f3f5f5]">
        <p className="text-[#4b5563]">Loading profile...</p>
      </main>
    );
  }

  return (
    <>
      <section className="px-5 py-6 md:px-8">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e7eb] pb-4">
            <h1 className="text-3xl font-bold text-[#1f2937]">Admin Profile</h1>
            <div className="flex items-center gap-2 rounded-xl border border-[#d9dde1] bg-[#f3f4f6] px-3 py-1.5 text-xs text-[#4b5563] shadow-sm">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
              </svg>
              <span className="font-semibold tracking-wide text-[#374151]">{phTime}</span>
              <span className="text-[#9ca3af]">|</span>
              <span className="tracking-wide text-[#6b7280]">{phDate}</span>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.15fr]">
            <section className="rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
              <div className="flex items-start gap-3 border-b border-[#e5e7eb] px-5 py-5">
                <span className="rounded-xl bg-[#f3f4f6] p-2 text-[#374151]">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 1.657-1.343 3-3 3s-3-1.343-3-3 1.343-3 3-3 3 1.343 3 3zm0 0v1.5A2.5 2.5 0 0014.5 15H18m-8.5-9l2-2 2 2m-2-2v5.5" />
                  </svg>
                </span>
                <div>
                  <h2 className="text-3xl font-bold text-[#1f2937]">Administrative Identity</h2>
                  <p className="text-sm text-[#6b7280]">Official contact information for the system administrator.</p>
                </div>
              </div>

              <div className="space-y-3 px-5 py-5">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Full Name</span>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First name"
                      className="rounded-lg border border-[#d1d5db] px-3 py-2 text-sm"
                    />
                    <input
                      value={middleName}
                      onChange={(e) => setMiddleName(e.target.value)}
                      placeholder="Middle"
                      className="rounded-lg border border-[#d1d5db] px-3 py-2 text-sm"
                    />
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last name"
                      className="rounded-lg border border-[#d1d5db] px-3 py-2 text-sm"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Login Email</span>
                  <input value={sessionEmail} disabled className="w-full rounded-lg border border-[#d1d5db] bg-[#f9fafb] px-3 py-2 text-sm text-[#6b7280]" />
                  <span className="mt-1 block text-xs text-[#9ca3af]">This email is used for emergency system recovery.</span>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Position</span>
                  <select
                    value={position}
                    onChange={(e) => setPosition(e.target.value as Role)}
                    disabled={myRole !== "admin"}
                    className="w-[180px] rounded-lg border border-[#d1d5db] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-[#f9fafb]"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Change Password</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="**************"
                    className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm"
                  />
                </label>

                {profileError ? <p className="text-sm text-[#b91c1c]">{profileError}</p> : null}
                {profileMessage ? <p className="text-sm text-[#15803d]">{profileMessage}</p> : null}

                <button
                  type="button"
                  onClick={() => void handleSaveProfile()}
                  disabled={isSaving}
                  className="mt-2 rounded-lg bg-[#4CAF50] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#3f9a43] disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-[#e5e7eb] bg-white shadow-sm">
              <div className="flex items-start justify-between gap-4 border-b border-[#e5e7eb] px-5 py-5">
                <div>
                  <h2 className="text-3xl font-bold text-[#1f2937]">List of Roles</h2>
                  <p className="text-sm text-[#6b7280]">Official roles for the system.</p>
                </div>
                {myRole === "admin" ? (
                  <button
                    type="button"
                    onClick={() => setIsAddUserModalOpen(true)}
                    className="rounded-lg bg-[#4CAF50] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#3f9a43]"
                  >
                    + Add User
                  </button>
                ) : null}
              </div>

              <div className="space-y-4 px-5 py-4">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search user"
                  className="w-full rounded-full border border-[#d1d5db] px-4 py-2 text-sm"
                />

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-[#6b7280]">
                      <tr>
                        <th className="pb-2 font-semibold">No.</th>
                        <th className="pb-2 font-semibold">NAME</th>
                        <th className="pb-2 font-semibold">ROLE</th>
                        {myRole === "admin" ? <th className="pb-2 font-semibold">Action</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProfiles.map((row, index) => (
                        <tr key={row.id} className="border-t border-[#f0f2f4]">
                          <td className="py-3">{index + 1}</td>
                          <td className="py-3 font-semibold">{row.full_name}</td>
                          <td className="py-3">
                            <span className={`rounded-md px-3 py-1 text-sm ${row.role === "admin" ? "bg-[#dbeafe] text-[#1e3a8a]" : "bg-[#f8f3d8] text-[#334155]"}`}>
                              {row.role === "admin" ? "Admin" : "Member"}
                            </span>
                          </td>
                          {myRole === "admin" ? (
                            <td className="py-3">
                              <button
                                type="button"
                                onClick={() => void handleDeletePersonnel(row)}
                                disabled={isDeletingUserId === row.id || row.auth_user_id === sessionUserId}
                                className="text-[#ef4444] hover:text-[#dc2626] disabled:cursor-not-allowed disabled:text-[#d1d5db]"
                              >
                                {isDeletingUserId === row.id ? "Removing..." : "Delete"}
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
      </section>

      {isAddUserModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
              <label>
                <span className="mb-1 block text-sm font-medium">Last Name</span>
                <input
                  value={addUserForm.lastName}
                  onChange={(e) => setAddUserForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  placeholder="e.g. Cruz"
                  className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm"
                />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">First Name</span>
                <input
                  value={addUserForm.firstName}
                  onChange={(e) => setAddUserForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  placeholder="e.g. Juan Carlos"
                  className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm"
                />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Middle Name (Optional)</span>
                <input
                  value={addUserForm.middleName}
                  onChange={(e) => setAddUserForm((prev) => ({ ...prev, middleName: e.target.value }))}
                  placeholder="e.g. C."
                  className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm"
                />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Position</span>
                <select
                  value={addUserForm.role}
                  onChange={(e) => setAddUserForm((prev) => ({ ...prev, role: e.target.value as Role }))}
                  className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </label>

              <label className="md:col-span-2">
                <span className="mb-1 block text-sm font-medium">Email</span>
                <input
                  type="email"
                  value={addUserForm.email}
                  onChange={(e) => setAddUserForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="name@email.com"
                  className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm"
                />
              </label>

              <label className="md:col-span-2">
                <span className="mb-1 block text-sm font-medium">Password</span>
                <input
                  type="password"
                  value={addUserForm.password}
                  onChange={(e) => setAddUserForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="**************"
                  className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs italic text-[#6b7280]">Note: The user can change their own password after account setup.</p>
              </label>
            </div>

            <div className="flex items-center justify-between border-t border-[#e5e7eb] px-6 py-4">
              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(false)}
                className="rounded-lg px-3 py-2 text-sm text-[#374151] hover:bg-[#f3f4f6]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleAddUser()}
                disabled={isAddingUser}
                className="rounded-lg bg-[#4CAF50] px-6 py-2 text-sm font-semibold text-white hover:bg-[#3f9a43] disabled:opacity-60"
              >
                {isAddingUser ? "Adding..." : "Add User"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
