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

  useEffect(() => {
    if (isLoginPage) {
      return;
    }

    let isMounted = true;

    const verifyAdminAccess = async () => {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        router.replace("/admin");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("auth_user_id", sessionData.session.user.id)
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
    <main className="h-dvh overflow-hidden bg-[#f3f5f5] text-[#1f2937]">
      <div className="flex h-full w-full flex-col md:grid md:grid-cols-[260px_minmax(0,1fr)]">
        <div className="md:h-dvh md:sticky md:top-0 md:overflow-hidden">
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
