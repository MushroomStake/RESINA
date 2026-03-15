"use client";

import Image from "next/image";
import Link from "next/link";
import { memo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type AdminSidebarPage = "dashboard" | "profile";

type AdminSidebarProps = {
  activePage: AdminSidebarPage;
};

function AdminSidebar({ activePage }: AdminSidebarProps) {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/admin");
  };

  const navClass = "block rounded-lg px-3 py-2 text-[#6b7280] hover:bg-white";
  const activeClass = "block rounded-lg bg-[#e9f7ec] px-3 py-2 font-medium text-[#2e9d5a]";

  return (
    <aside className="border-r border-[#e5e7eb] bg-[#f7f8f9] px-4 py-6 md:px-5">
      <div className="flex items-center gap-3">
        <Image src="/images/resina%20logo.png" alt="Resina logo" width={56} height={56} />
        <div>
          <p className="font-semibold text-[#111827]">RESINA</p>
          <p className="text-xs text-[#6b7280]">Sta. Rita, Olongapo</p>
        </div>
      </div>

      <nav className="mt-8 space-y-2 text-sm">
        {activePage === "dashboard" ? (
          <span className={activeClass}>Dashboard</span>
        ) : (
          <Link className={navClass} href="/admin/dashboard">
            Dashboard
          </Link>
        )}

        <span className={navClass}>Announcements</span>
        <span className={navClass}>History</span>

        {activePage === "profile" ? (
          <span className={activeClass}>Admin Profile</span>
        ) : (
          <Link className={navClass} href="/admin/profile">
            Admin Profile
          </Link>
        )}
      </nav>

      <button
        type="button"
        onClick={() => void handleLogout()}
        className="mt-10 w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-left text-sm text-[#ef4444] hover:bg-white"
      >
        Sign Out
      </button>
    </aside>
  );
}

export default memo(AdminSidebar);
