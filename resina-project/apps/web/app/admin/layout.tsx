"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { AdminPageHeader } from "./components/admin-page-header";
import AdminSidebar from "./components/admin-sidebar";

function hasPortalAccess(role: string | null | undefined): boolean {
  return role === "admin" || role === "member";
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/admin";
  const [isCheckingAccess, setIsCheckingAccess] = useState(!isLoginPage);
  const [hasAdminAccess, setHasAdminAccess] = useState(isLoginPage);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isLoginPage) {
      return;
    }

    let isMounted = true;

    const verifyAdminAccess = async () => {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.replace("/admin");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("auth_user_id", userData.user.id)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (!hasPortalAccess((profile?.role as string | undefined) ?? null)) {
        await supabase.auth.signOut();
        router.replace("/");
        return;
      }

      setHasAdminAccess(true);
      setIsCheckingAccess(false);
    };

    void verifyAdminAccess();

    return () => {
      isMounted = false;
    };
  }, [isLoginPage, router]);

  // Keep login page as-is; sidebar is only for protected admin pages.
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (isCheckingAccess || !hasAdminAccess) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#f3f5f5] text-sm text-[#6b7280]">
        Verifying admin access...
      </main>
    );
  }

  const activePage = pathname.startsWith("/admin/profile")
    ? "profile"
    : pathname.startsWith("/admin/history")
      ? "history"
    : pathname.startsWith("/admin/announcements")
      ? "announcements"
      : "dashboard";

  return (
    <main className="h-dvh w-full overflow-x-hidden overflow-y-hidden bg-[#f3f5f5] text-[#1f2937]">
      <div className="flex h-full w-full flex-col md:grid md:grid-cols-[260px_minmax(0,1fr)]">
        <div className="hidden md:block md:h-dvh md:sticky md:top-0 md:overflow-hidden">
          <AdminSidebar activePage={activePage} />
        </div>

        <div
          className={`fixed inset-0 z-40 bg-[rgba(15,23,42,0.45)] transition-opacity duration-200 md:hidden ${
            isSidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => setIsSidebarOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " " || event.key === "Escape") {
              event.preventDefault();
              setIsSidebarOpen(false);
            }
          }}
          role="button"
          aria-label="Close sidebar"
          tabIndex={0}
        />

        <aside
          id="admin-mobile-sidebar"
          className={`fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] border-r border-[#e5e7eb] bg-[#f7f8f9] shadow-xl transition-transform duration-300 md:hidden ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <AdminSidebar activePage={activePage} />
        </aside>

        <div className="min-w-0 w-full flex-1 overflow-x-hidden overflow-y-auto">
          <AdminPageHeader
            activePage={activePage}
            onMenuToggle={() => setIsSidebarOpen((prev) => !prev)}
            isMenuOpen={isSidebarOpen}
          />
          {children}
        </div>
      </div>
    </main>
  );
}
