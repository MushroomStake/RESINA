"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import StatusFeedbackModal from "../components/status-feedback-modal";
import { AdminPageSkeleton } from "../components/admin-skeleton";

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
  confirmEmail: string;
  role: Role;
  password: string;
};

type UpdateUserForm = {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  role: Role;
};

function buildFullName(first: string, middle: string, last: string): string {
  return [first.trim(), middle.trim(), last.trim()].filter(Boolean).join(" ");
}

export default function AdminProfilePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [isChecking, setIsChecking] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [isDeletingUserId, setIsDeletingUserId] = useState<string | null>(null);

  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isUpdateUserModalOpen, setIsUpdateUserModalOpen] = useState(false);
  const [isPositionConfirmOpen, setIsPositionConfirmOpen] = useState(false);
  const [isUpdatePositionConfirmOpen, setIsUpdatePositionConfirmOpen] = useState(false);
  const [pendingPosition, setPendingPosition] = useState<Role | null>(null);
  const [pendingUpdatePosition, setPendingUpdatePosition] = useState<Role | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ProfileRow | null>(null);
  const [updateTarget, setUpdateTarget] = useState<ProfileRow | null>(null);

  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string>("");
  const [myRole, setMyRole] = useState<Role>("member");
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);

  const [statusVisible, setStatusVisible] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusVariant, setStatusVariant] = useState<"success" | "error" | "info">("info");

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [position, setPosition] = useState<Role>("member");
  const [password, setPassword] = useState("");

  const [searchQuery, setSearchQuery] = useState("");

  const [addUserForm, setAddUserForm] = useState<AddUserForm>({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    confirmEmail: "",
    role: "member",
    password: "admin123",
  });

  const [updateUserForm, setUpdateUserForm] = useState<UpdateUserForm>({
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    role: "member",
  });

  const filteredProfiles = profiles.filter((entry) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return true;
    }

    return entry.full_name.toLowerCase().includes(q) || entry.email.toLowerCase().includes(q);
  });

  const adminCount = profiles.filter((entry) => entry.role === "admin").length;
  const isCurrentUserLastAdmin = myRole === "admin" && position === "admin" && adminCount <= 1;
  const isUpdateTargetLastAdmin =
    updateTarget?.role === "admin" && updateUserForm.role === "admin" && adminCount <= 1;

  const showStatus = (variant: "success" | "error" | "info", message: string) => {
    setStatusVariant(variant);
    setStatusMessage(message);
    setStatusVisible(true);
  };

  const loadProfiles = async (currentUserId: string, currentEmail: string) => {
    const { data: rows, error } = await supabase
      .from("profiles")
      .select("id, auth_user_id, first_name, middle_name, last_name, full_name, email, role, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      showStatus("error", error.message);
      return;
    }

    const data = (rows ?? []) as ProfileRow[];
    const mine = data.find((entry) => entry.auth_user_id === currentUserId);

    if (!mine) {
      const fallbackFirst = currentEmail.split("@")[0] || "Admin";
      const fallbackLast = "User";
      const fullName = buildFullName(fallbackFirst, "", fallbackLast);

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
        showStatus("error", insertError.message);
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

  const handleSaveProfile = async () => {
    if (!sessionUserId) {
      return;
    }

    setIsSaving(true);

    try {
      const fullName = buildFullName(firstName, middleName, lastName);

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
      showStatus("success", "Profile updated successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save profile.";
      showStatus("error", message);
    } finally {
      setIsSaving(false);
    }
  };

  const requestPositionChange = (nextRole: Role) => {
    if (isCurrentUserLastAdmin && nextRole === "member") {
      showStatus("error", "At least one admin is required.");
      return;
    }

    if (nextRole === position) {
      return;
    }

    setPendingPosition(nextRole);
    setIsPositionConfirmOpen(true);
  };

  const confirmPositionChange = () => {
    if (!pendingPosition) {
      setIsPositionConfirmOpen(false);
      return;
    }

    setPosition(pendingPosition);
    setPendingPosition(null);
    setIsPositionConfirmOpen(false);
  };

  const requestUpdatePositionChange = (nextRole: Role) => {
    if (isUpdateTargetLastAdmin && nextRole === "member") {
      showStatus("error", "At least one admin is required.");
      return;
    }

    if (nextRole === updateUserForm.role) {
      return;
    }

    setPendingUpdatePosition(nextRole);
    setIsUpdatePositionConfirmOpen(true);
  };

  const confirmUpdatePositionChange = () => {
    if (!pendingUpdatePosition) {
      setIsUpdatePositionConfirmOpen(false);
      return;
    }

    setUpdateUserForm((prev) => ({ ...prev, role: pendingUpdatePosition }));
    setPendingUpdatePosition(null);
    setIsUpdatePositionConfirmOpen(false);
  };

  const openDeleteConfirmation = (row: ProfileRow) => {
    if (myRole !== "admin") {
      return;
    }

    if (!sessionUserId || row.auth_user_id === sessionUserId) {
      showStatus("error", "You cannot remove your own admin profile.");
      return;
    }

    if (row.role === "admin" && adminCount <= 1) {
      showStatus("error", "At least one admin is required.");
      return;
    }

    setDeleteTarget(row);
  };

  const handleDeletePersonnel = async () => {
    if (!deleteTarget || !sessionUserId) {
      return;
    }

    setIsDeletingUserId(deleteTarget.id);

    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: deleteTarget.id, authUserId: deleteTarget.auth_user_id }),
      });

      if (!res.ok) {
        const { error } = (await res.json()) as { error: string };
        throw new Error(error ?? "Failed to delete user.");
      }

      await loadProfiles(sessionUserId, sessionEmail);
      setDeleteTarget(null);
      showStatus("success", "User removed successfully.");
    } catch (error) {
      showStatus("error", error instanceof Error ? error.message : "Unable to remove user.");
    } finally {
      setIsDeletingUserId(null);
    }
  };

  const openUpdatePersonnelModal = (row: ProfileRow) => {
    if (myRole !== "admin") {
      return;
    }

    setUpdateTarget(row);
    setUpdateUserForm({
      firstName: row.first_name ?? "",
      middleName: row.middle_name ?? "",
      lastName: row.last_name ?? "",
      email: row.email,
      role: row.role,
    });
    setIsUpdateUserModalOpen(true);
  };

  const handleUpdatePersonnel = async () => {
    if (!sessionUserId || myRole !== "admin" || !updateTarget) {
      return;
    }

    const fullName = buildFullName(updateUserForm.firstName, updateUserForm.middleName, updateUserForm.lastName);
    if (!fullName || !updateUserForm.email.trim()) {
      showStatus("error", "First name, last name, and email are required.");
      return;
    }

    setIsUpdatingUser(true);

    try {
      const res = await fetch("/api/admin/update-user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: updateTarget.id,
          firstName: updateUserForm.firstName.trim(),
          middleName: updateUserForm.middleName.trim(),
          lastName: updateUserForm.lastName.trim(),
          email: updateUserForm.email.trim().toLowerCase(),
          role: updateUserForm.role,
        }),
      });

      if (!res.ok) {
        const { error } = (await res.json()) as { error: string };
        throw new Error(error ?? "Failed to update user.");
      }

      await loadProfiles(sessionUserId, sessionEmail);
      setIsUpdateUserModalOpen(false);
      setUpdateTarget(null);
      showStatus("success", "User details updated.");
    } catch (error) {
      showStatus("error", error instanceof Error ? error.message : "Unable to update user.");
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleAddUser = async () => {
    if (myRole !== "admin" || !sessionUserId) {
      return;
    }

    const fullName = buildFullName(addUserForm.firstName, addUserForm.middleName, addUserForm.lastName);

    if (!fullName || !addUserForm.email.trim()) {
      showStatus("error", "First name, last name, and email are required.");
      return;
    }

    if (!addUserForm.confirmEmail.trim()) {
      showStatus("error", "Please confirm the invite email address.");
      return;
    }

    if (addUserForm.email.trim().toLowerCase() !== addUserForm.confirmEmail.trim().toLowerCase()) {
      showStatus("error", "Email and confirm email do not match.");
      return;
    }

    if (!addUserForm.password.trim() || addUserForm.password.trim().length < 6) {
      showStatus("error", "Default password must be at least 6 characters.");
      return;
    }

    setIsAddingUser(true);

    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          firstName: addUserForm.firstName.trim(),
          middleName: addUserForm.middleName.trim(),
          lastName: addUserForm.lastName.trim(),
          email: addUserForm.email.trim().toLowerCase(),
          confirmEmail: addUserForm.confirmEmail.trim().toLowerCase(),
          role: addUserForm.role,
          password: addUserForm.password.trim(),
        }),
      });

      if (!res.ok) {
        const { error } = (await res.json()) as { error: string };
        throw new Error(error ?? "Failed to send invite.");
      }

      setIsAddUserModalOpen(false);
      setAddUserForm({
        firstName: "",
        middleName: "",
        lastName: "",
        email: "",
        confirmEmail: "",
        role: "member",
        password: "admin123",
      });
      await loadProfiles(sessionUserId, sessionEmail);
      showStatus("success", "Invite sent successfully.");
    } catch (error) {
      showStatus("error", error instanceof Error ? error.message : "Unable to send invite.");
    } finally {
      setIsAddingUser(false);
    }
  };

  if (isChecking) {
    return <AdminPageSkeleton title="Loading profile..." blockCount={2} />;
  }

  return (
    <>
      <section className="px-5 py-6 md:px-8">
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
                <input
                  value={sessionEmail}
                  disabled
                  className="w-full rounded-lg border border-[#d1d5db] bg-[#f9fafb] px-3 py-2 text-sm text-[#6b7280]"
                />
                <span className="mt-1 block text-xs text-[#9ca3af]">This email is used for emergency system recovery.</span>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium">Position</span>
                <select
                  value={position}
                  onChange={(e) => requestPositionChange(e.target.value as Role)}
                  disabled={myRole !== "admin"}
                  className="w-[180px] rounded-lg border border-[#d1d5db] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-[#f9fafb]"
                >
                  <option value="admin">Admin</option>
                  <option value="member" disabled={isCurrentUserLastAdmin}>
                    Member
                  </option>
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
                  onClick={() => {
                    setIsAddUserModalOpen(true);
                  }}
                  className="rounded-lg bg-[#4CAF50] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#3f9a43]"
                >
                  Send Invites
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

              <div className="max-h-[420px] overflow-auto pr-1">
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
                          <span
                            className={`rounded-md px-3 py-1 text-sm ${
                              row.role === "admin" ? "bg-[#dbeafe] text-[#1e3a8a]" : "bg-[#f8f3d8] text-[#334155]"
                            }`}
                          >
                            {row.role === "admin" ? "Admin" : "Member"}
                          </span>
                        </td>
                        {myRole === "admin" ? (
                          <td className="py-3">
                            <button
                              type="button"
                              onClick={() => openUpdatePersonnelModal(row)}
                              className="text-[#2563eb] hover:text-[#1d4ed8]"
                            >
                              Update
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
                <span className="mb-1 block text-sm font-medium">First Name</span>
                <input
                  value={addUserForm.firstName}
                  onChange={(e) => setAddUserForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  placeholder="e.g. Juan Carlos"
                  className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm"
                />
              </label>
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
                <span className="mb-1 block text-sm font-medium">Confirm Email</span>
                <input
                  type="email"
                  value={addUserForm.confirmEmail}
                  onChange={(e) => setAddUserForm((prev) => ({ ...prev, confirmEmail: e.target.value }))}
                  placeholder="re-enter@email.com"
                  className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm"
                />
              </label>

              <label className="md:col-span-2">
                <span className="mb-1 block text-sm font-medium">Default Password</span>
                <input
                  type="text"
                  value={addUserForm.password}
                  onChange={(e) => setAddUserForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="admin123"
                  className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs italic text-[#6b7280]">This temporary password is set on the invited account.</p>
              </label>
            </div>

            <div className="flex items-center justify-between border-t border-[#e5e7eb] px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setIsAddUserModalOpen(false);
                }}
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
                {isAddingUser ? "Sending..." : "Send Invite"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isUpdateUserModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
            <div className="border-b border-[#e5e7eb] px-6 py-4">
              <h3 className="text-lg font-semibold text-[#111827]">Update Personnel</h3>
            </div>

            <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
              <label>
                <span className="mb-1 block text-sm font-medium">First Name</span>
                <input
                  value={updateUserForm.firstName}
                  onChange={(e) => setUpdateUserForm((prev) => ({ ...prev, firstName: e.target.value }))}
                  className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm"
                />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Last Name</span>
                <input
                  value={updateUserForm.lastName}
                  onChange={(e) => setUpdateUserForm((prev) => ({ ...prev, lastName: e.target.value }))}
                  className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm"
                />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Middle Name (Optional)</span>
                <input
                  value={updateUserForm.middleName}
                  onChange={(e) => setUpdateUserForm((prev) => ({ ...prev, middleName: e.target.value }))}
                  className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm"
                />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Position</span>
                <select
                  value={updateUserForm.role}
                  onChange={(e) => requestUpdatePositionChange(e.target.value as Role)}
                  className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm"
                >
                  <option value="admin">Admin</option>
                  <option value="member" disabled={isUpdateTargetLastAdmin}>
                    Member
                  </option>
                </select>
              </label>

              <label className="md:col-span-2">
                <span className="mb-1 block text-sm font-medium">Email</span>
                <input
                  type="email"
                  value={updateUserForm.email}
                  onChange={(e) => setUpdateUserForm((prev) => ({ ...prev, email: e.target.value }))}
                  className="w-full rounded-lg border border-[#d1d5db] px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="flex items-center justify-between border-t border-[#e5e7eb] px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  if (!updateTarget) {
                    return;
                  }

                  setIsUpdateUserModalOpen(false);
                  openDeleteConfirmation(updateTarget);
                }}
                disabled={
                  !updateTarget ||
                  updateTarget.auth_user_id === sessionUserId ||
                  (updateTarget.role === "admin" && adminCount <= 1)
                }
                className="rounded-lg bg-[#ef4444] px-6 py-2 text-sm font-semibold text-white hover:bg-[#dc2626] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Delete
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsUpdateUserModalOpen(false);
                    setUpdateTarget(null);
                  }}
                  className="rounded-lg px-3 py-2 text-sm text-[#374151] hover:bg-[#f3f4f6]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleUpdatePersonnel()}
                  disabled={isUpdatingUser}
                  className="rounded-lg bg-[#2563eb] px-6 py-2 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-60"
                >
                  {isUpdatingUser ? "Updating..." : "Update"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isPositionConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="border-b border-[#e5e7eb] px-6 py-4">
              <h3 className="text-lg font-semibold text-[#111827]">Confirm Position Change</h3>
            </div>

            <div className="px-6 py-5 text-sm text-[#374151]">
              Change position to <span className="font-semibold">{pendingPosition === "admin" ? "Admin" : "Member"}</span>?
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#e5e7eb] px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setPendingPosition(null);
                  setIsPositionConfirmOpen(false);
                }}
                className="rounded-lg px-3 py-2 text-sm text-[#374151] hover:bg-[#f3f4f6]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPositionChange}
                className="rounded-lg bg-[#2563eb] px-6 py-2 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isUpdatePositionConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="border-b border-[#e5e7eb] px-6 py-4">
              <h3 className="text-lg font-semibold text-[#111827]">Confirm Position Change</h3>
            </div>

            <div className="px-6 py-5 text-sm text-[#374151]">
              Change position to <span className="font-semibold">{pendingUpdatePosition === "admin" ? "Admin" : "Member"}</span>?
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#e5e7eb] px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setPendingUpdatePosition(null);
                  setIsUpdatePositionConfirmOpen(false);
                }}
                className="rounded-lg px-3 py-2 text-sm text-[#374151] hover:bg-[#f3f4f6]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmUpdatePositionChange}
                className="rounded-lg bg-[#2563eb] px-6 py-2 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="border-b border-[#e5e7eb] px-6 py-4">
              <h3 className="text-lg font-semibold text-[#111827]">Confirm Deletion</h3>
            </div>

            <div className="px-6 py-5 text-sm text-[#374151]">
              Are you sure you want to delete <span className="font-semibold">{deleteTarget.full_name}</span>? This action cannot be undone.
            </div>

            <div className="flex items-center justify-between border-t border-[#e5e7eb] px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                }}
                className="rounded-lg px-3 py-2 text-sm text-[#374151] hover:bg-[#f3f4f6]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeletePersonnel()}
                disabled={isDeletingUserId === deleteTarget.id}
                className="rounded-lg bg-[#ef4444] px-6 py-2 text-sm font-semibold text-white hover:bg-[#dc2626] disabled:opacity-60"
              >
                {isDeletingUserId === deleteTarget.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <StatusFeedbackModal
        visible={statusVisible}
        message={statusMessage}
        variant={statusVariant}
        onClose={() => {
          setStatusVisible(false);
          setStatusMessage("");
        }}
      />
    </>
  );
}
