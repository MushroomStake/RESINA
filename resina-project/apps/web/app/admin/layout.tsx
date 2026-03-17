"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AdminPageHeader } from "./components/admin-page-header";
import AdminSidebar from "./components/admin-sidebar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Keep login page as-is; sidebar is only for protected admin pages.
  if (pathname === "/admin") {
    return <>{children}</>;
  }

  const activePage = pathname.startsWith("/admin/profile")
    ? "profile"
    : pathname.startsWith("/admin/history")
      ? "history"
    : pathname.startsWith("/admin/announcements")
      ? "announcements"
      : "dashboard";

  return (
    <main className="h-dvh overflow-hidden bg-[#f3f5f5] text-[#1f2937]">
      <div className="grid h-full w-full grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)]">
        <div className="h-dvh md:sticky md:top-0 md:overflow-hidden">
          <AdminSidebar activePage={activePage} />
        </div>
        <div className="min-w-0 overflow-y-auto">
          <AdminPageHeader activePage={activePage} />
          {children}
        </div>
      </div>
    </main>
  );
}
