"use client";

import { useEffect, useState } from "react";

type AdminSidebarPage = "dashboard" | "announcements" | "history" | "profile";

type AdminPageHeaderProps = {
  activePage: AdminSidebarPage;
};

const HEADER_CONTENT: Record<AdminSidebarPage, { eyebrow: string; title: string }> = {
  dashboard: {
    eyebrow: "Dashboard",
    title: "Real-time Monitoring",
  },
  announcements: {
    eyebrow: "Announcements",
    title: "Announcements",
  },
  history: {
    eyebrow: "Analytics",
    title: "Analytics Report",
  },
  profile: {
    eyebrow: "Profile",
    title: "Admin Profile",
  },
};

export function AdminPageHeader({ activePage }: AdminPageHeaderProps) {
  const [phNow, setPhNow] = useState(() => new Date());
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
    setPhNow(new Date());

    const timer = setInterval(() => {
      setPhNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const phTime = isHydrated
    ? phNow
        .toLocaleTimeString("en-PH", {
          timeZone: "Asia/Manila",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
        .replace(" ", "")
        .toUpperCase()
    : "--:--";

  const phDate = isHydrated
    ? phNow
        .toLocaleDateString("en-PH", {
          timeZone: "Asia/Manila",
          month: "short",
          day: "2-digit",
          year: "numeric",
        })
        .toUpperCase()
    : "--- --, ----";

  const content = HEADER_CONTENT[activePage];

  return (
    <header className="sticky top-0 z-30 flex flex-col items-start gap-3 border-b border-[#d5deea] bg-[rgba(243,245,245,0.94)] px-4 py-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-5 md:px-8">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-[#6b7280]">{content.eyebrow}</p>
        <h1 className="text-lg font-bold leading-tight text-[#111827] sm:text-xl md:text-[2.125rem] md:leading-none">{content.title}</h1>
      </div>
      <div className="flex w-full items-center justify-center gap-3 rounded-2xl border border-[#b7cde6] bg-[linear-gradient(135deg,#f7fbff_0%,#eaf3ff_100%)] px-4 py-2.5 text-[#2f4a67] shadow-[0_8px_20px_rgba(29,78,216,0.10)] sm:w-auto sm:justify-start sm:gap-4 sm:px-5 sm:py-3">
        <svg className="h-5 w-5 text-[#244e7a] sm:h-7 sm:w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
        </svg>
        <span className="text-lg font-extrabold tracking-wide text-[#1f3f61] sm:text-2xl">{phTime}</span>
        <span className="text-base text-[#7fa1c5] sm:text-lg">|</span>
        <span className="text-sm font-bold tracking-wide text-[#40658e] sm:text-lg">{phDate}</span>
      </div>
    </header>
  );
}