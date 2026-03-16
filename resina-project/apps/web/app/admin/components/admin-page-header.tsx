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
    eyebrow: "History",
    title: "History Records",
  },
  profile: {
    eyebrow: "Profile",
    title: "Admin Profile",
  },
};

export function AdminPageHeader({ activePage }: AdminPageHeaderProps) {
  const [phNow, setPhNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setPhNow(new Date());
    }, 30000);

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

  const phDate = phNow
    .toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
      month: "short",
      day: "2-digit",
      year: "numeric",
    })
    .toUpperCase();

  const content = HEADER_CONTENT[activePage];

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e7eb] px-5 py-6 md:px-8">
      <div>
        <p className="text-xs uppercase tracking-wide text-[#6b7280]">{content.eyebrow}</p>
        <h1 className="text-xl font-bold text-[#111827] md:text-[2.125rem] md:leading-none">{content.title}</h1>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-[#d9dde1] bg-[#f3f4f6] px-3 py-1.5 text-xs text-[#4b5563] shadow-sm">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
        </svg>
        <span className="font-semibold tracking-wide text-[#374151]">{phTime}</span>
        <span className="text-[#9ca3af]">|</span>
        <span className="tracking-wide text-[#6b7280]">{phDate}</span>
      </div>
    </header>
  );
}