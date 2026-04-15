"use client";

import Image from "next/image";
import Link from "next/link";
import { memo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type AdminSidebarPage = "dashboard" | "announcements" | "history" | "profile";

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

  const navClass = "inline-flex items-center whitespace-nowrap rounded-lg px-3 py-2 text-[#6b7280] hover:bg-white";
  const activeClass = "inline-flex items-center whitespace-nowrap rounded-lg bg-[#e9f7ec] px-3 py-2 font-medium text-[#2e9d5a]";

  return (
    <aside className="flex h-full flex-col border-r border-[#e5e7eb] bg-[#f7f8f9] px-4 py-4 md:px-5 md:py-6">
      <div className="flex items-center gap-3">
        <Image src="/images/resina%20logo.png" alt="Resina logo" width={48} height={48} className="md:h-14 md:w-14" />
        <div>
          <p className="font-semibold text-[#111827]">RESINA</p>
          <p className="text-xs text-[#6b7280]">Sta. Rita, Olongapo</p>
        </div>
      </div>

      <nav className="mt-6 flex flex-col space-y-2 text-sm md:mt-8">
        {activePage === "dashboard" ? (
          <span className={activeClass}>Dashboard</span>
        ) : (
          <Link className={navClass} href="/admin/dashboard">
            Dashboard
          </Link>
        )}

        {activePage === "announcements" ? (
          <span className={activeClass}>Announcements</span>
        ) : (
          <Link className={navClass} href="/admin/announcements">
            Announcements
          </Link>
        )}
        {activePage === "history" ? (
          <span className={activeClass}>Analytics Report</span>
        ) : (
          <Link className={navClass} href="/admin/history">
            Analytics Report
          </Link>
        )}

        {activePage === "profile" ? (
          <span className={activeClass}>Admin Profile</span>
        ) : (
          <Link className={navClass} href="/admin/profile">
            Admin Profile
          </Link>
        )}
      </nav>

      <div className="mt-6 border-t border-[#e5e7eb] pt-4 md:mt-10">
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-left text-sm text-[#ef4444] hover:bg-white"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}

export default memo(AdminSidebar);
