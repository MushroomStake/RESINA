"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

type AdminSidebarPage = "dashboard" | "announcements" | "history" | "profile";

type AdminPageHeaderProps = {
  activePage: AdminSidebarPage;
  onMenuToggle?: () => void;
  isMenuOpen?: boolean;
};

type NotificationItem = {
  id: string;
  kind: "sensor" | "comment";
  title: string;
  message: string;
  createdAt: string;
  targetUrl: string;
};

type NotificationFilter = "all" | "unread" | "read";

const NOTIF_PAGE_SIZE = 6;
const NOTIF_SKELETON_COUNT = 4;

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

function formatNotificationDateTime(value: string): string {
  return new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "long",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function AdminPageHeader({ activePage, onMenuToggle, isMenuOpen = false }: AdminPageHeaderProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [phNow, setPhNow] = useState(() => new Date());
  const [isHydrated, setIsHydrated] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isNotifLoading, setIsNotifLoading] = useState(false);
  const [isNotifAnimatingIn, setIsNotifAnimatingIn] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readMap, setReadMap] = useState<Record<string, boolean>>({});
  const [notifFilter, setNotifFilter] = useState<NotificationFilter>("all");
  const [visibleNotifCount, setVisibleNotifCount] = useState(NOTIF_PAGE_SIZE);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const notifPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsHydrated(true);
    setPhNow(new Date());

    const timer = setInterval(() => {
      setPhNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isNotifOpen) {
      setIsNotifAnimatingIn(false);
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setIsNotifAnimatingIn(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isNotifOpen]);

  useEffect(() => {
    if (!isNotifOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (!notifPanelRef.current) {
        return;
      }

      if (!notifPanelRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isNotifOpen]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    try {
      const raw = window.localStorage.getItem(`resina-admin-notif-read:${currentUserId}`);
      if (!raw) {
        setReadMap({});
        return;
      }

      const parsed = JSON.parse(raw) as Record<string, boolean>;
      setReadMap(parsed ?? {});
    } catch {
      setReadMap({});
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    try {
      window.localStorage.setItem(`resina-admin-notif-read:${currentUserId}`, JSON.stringify(readMap));
    } catch {
      // Ignore storage errors in private mode.
    }
  }, [currentUserId, readMap]);

  useEffect(() => {
    let mounted = true;
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;

    const loadNotifications = async (silent = false) => {
      if (!silent) {
        setIsNotifLoading(true);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !mounted) {
        if (mounted) {
          setCurrentUserId(null);
          setNotifications([]);
          setIsNotifLoading(false);
        }
        return;
      }

      setCurrentUserId(user.id);

      const sensorResult = await supabase
        .from("sensor_readings")
        .select("id, water_level, status, created_at")
        .order("created_at", { ascending: false })
        .limit(8);

      const sensorNotifications: NotificationItem[] = (sensorResult.data ?? []).map((row) => {
        const reading = Number((row as { water_level?: number }).water_level ?? Number.NaN);
        const status = String((row as { status?: string }).status ?? "Unknown").trim();
        const createdAt = String((row as { created_at?: string }).created_at ?? "");
        const sensorId = String((row as { id?: string }).id ?? "");

        return {
          id: `sensor-${sensorId}`,
          kind: "sensor",
          title: "New sensor reading",
          message: Number.isNaN(reading)
            ? `Status updated (${status}).`
            : `Water level is ${reading.toFixed(2)} m (${status}).`,
          createdAt,
          targetUrl: `/admin/history?recordId=${encodeURIComponent(sensorId)}`,
        };
      });

      const ownAnnouncements = await supabase
        .from("announcements")
        .select("id, title")
        .eq("posted_by_auth_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(60);

      const announcementTitleById = new Map<string, string>();
      const ownAnnouncementIds = (ownAnnouncements.data ?? []).map((row) => {
        const id = String((row as { id?: string }).id ?? "");
        const title = String((row as { title?: string }).title ?? "").trim();
        if (id) {
          announcementTitleById.set(id, title || "Announcement");
        }
        return id;
      }).filter(Boolean);

      let commentNotifications: NotificationItem[] = [];

      if (ownAnnouncementIds.length > 0) {
        const commentsResult = await supabase
          .from("announcement_comments")
          .select("id, announcement_id, commenter_name, commenter_auth_user_id, created_at")
          .in("announcement_id", ownAnnouncementIds)
          .order("created_at", { ascending: false })
          .limit(200);

        const grouped = new Map<string, Array<{ id: string; commenterName: string; commenterAuthUserId: string | null; createdAt: string }>>();

        for (const row of commentsResult.data ?? []) {
          const announcementId = String((row as { announcement_id?: string }).announcement_id ?? "").trim();
          const commenterName = String((row as { commenter_name?: string }).commenter_name ?? "").trim();
          const commenterAuthUserId = ((row as { commenter_auth_user_id?: string | null }).commenter_auth_user_id ?? null);
          const createdAt = String((row as { created_at?: string }).created_at ?? "");
          const id = String((row as { id?: string }).id ?? "");

          if (!announcementId || !id || !createdAt) {
            continue;
          }

          if (commenterAuthUserId === user.id || commenterName.toLowerCase() === "brgy. sta. rita") {
            continue;
          }

          const list = grouped.get(announcementId) ?? [];
          list.push({ id, commenterName: commenterName || "Someone", commenterAuthUserId, createdAt });
          grouped.set(announcementId, list);
        }

        commentNotifications = Array.from(grouped.entries()).map(([announcementId, rows]) => {
          const sorted = [...rows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          const latest = sorted[0];
          const uniqueNames = Array.from(new Set(sorted.map((entry) => entry.commenterName).filter(Boolean)));
          const firstName = uniqueNames[0] ?? "Someone";
          const message = sorted.length <= 1 && uniqueNames.length === 1
            ? `${firstName} commented on this post.`
            : `${firstName}, and others commented on this post.`;

          return {
            id: `comment-${announcementId}-${latest.id}`,
            kind: "comment",
            title: announcementTitleById.get(announcementId) ?? "Announcement",
            message,
            createdAt: latest.createdAt,
            targetUrl: `/admin/announcements?announcementId=${encodeURIComponent(announcementId)}&openComments=1`,
          } satisfies NotificationItem;
        });
      }

      const merged = [...commentNotifications, ...sensorNotifications]
        .filter((entry) => entry.createdAt)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 20);

      if (mounted) {
        setNotifications(merged);
        setIsNotifLoading(false);
      }
    };

    const scheduleRealtimeRefresh = () => {
      if (refreshTimeout) {
        return;
      }

      refreshTimeout = setTimeout(() => {
        refreshTimeout = null;
        void loadNotifications(true);
      }, 700);
    };

    const realtimeChannel = supabase
      .channel(`admin-header-notifications-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sensor_readings" },
        () => {
          scheduleRealtimeRefresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "announcement_comments" },
        () => {
          scheduleRealtimeRefresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "announcements" },
        () => {
          scheduleRealtimeRefresh();
        },
      )
      .subscribe();

    void loadNotifications();
    const timer = setInterval(() => {
      void loadNotifications(true);
    }, 30000);

    return () => {
      mounted = false;
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      void supabase.removeChannel(realtimeChannel);
      clearInterval(timer);
    };
  }, [supabase]);

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
  const unreadCount = notifications.reduce((count, item) => count + (readMap[item.id] ? 0 : 1), 0);
  const filteredNotifications = notifications.filter((item) => {
    const isRead = Boolean(readMap[item.id]);
    if (notifFilter === "read") {
      return isRead;
    }
    if (notifFilter === "unread") {
      return !isRead;
    }
    return true;
  });
  const visibleNotifications = filteredNotifications.slice(0, visibleNotifCount);
  const hasMoreNotifications = visibleNotifCount < filteredNotifications.length;

  useEffect(() => {
    setVisibleNotifCount(NOTIF_PAGE_SIZE);
  }, [isNotifOpen, notifFilter]);

  const markNotification = (notificationId: string, isRead: boolean) => {
    setReadMap((prev) => ({
      ...prev,
      [notificationId]: isRead,
    }));
  };

  const handleNotificationClick = (item: NotificationItem) => {
    markNotification(item.id, true);
    setIsNotifOpen(false);
    router.push(item.targetUrl);
  };

  return (
    <header className="sticky top-0 z-50 flex flex-col items-start gap-4 border-b border-[#d5deea] bg-[rgba(243,245,245,0.98)] px-4 py-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:px-5 sm:py-5 md:px-8">
      <div className="flex w-full min-w-0 flex-1 items-start gap-3 sm:items-center">
        <button
          type="button"
          onClick={onMenuToggle}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#cbd5e1] bg-white text-[#1f3f61] shadow-sm transition hover:bg-[#f8fafc] md:hidden"
          aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {isMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-[#6b7280]">{content.eyebrow}</p>
          <h1 className="max-w-full break-words text-[1.55rem] font-bold leading-tight text-[#111827] sm:text-xl md:text-[2.125rem] md:leading-none">{content.title}</h1>
        </div>
      </div>

      <div className="relative flex w-full shrink-0 items-center justify-center gap-3 sm:w-auto sm:justify-start sm:gap-4" ref={notifPanelRef}>
        <button
          type="button"
          onClick={() => setIsNotifOpen((prev) => !prev)}
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#c9daef] bg-white text-[#244e7a] shadow-[0_10px_24px_rgba(36,78,122,0.16)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#f3f8ff]"
          aria-label="Open notifications"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
          </svg>
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#ef4444] px-1.5 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </button>

        <div className="flex items-center gap-3 rounded-2xl border border-[#b7cde6] bg-[linear-gradient(135deg,#f7fbff_0%,#eaf3ff_100%)] px-5 py-3 text-[#2f4a67] shadow-[0_10px_24px_rgba(29,78,216,0.12)] sm:gap-4 sm:px-6 sm:py-3.5">
          <svg className="h-6 w-6 text-[#244e7a] sm:h-8 sm:w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
          </svg>
          <span className="text-xl font-extrabold tracking-wide text-[#1f3f61] sm:text-[2rem]">{phTime}</span>
          <span className="text-lg text-[#7fa1c5] sm:text-xl">|</span>
          <span className="text-base font-bold tracking-wide text-[#40658e] sm:text-xl">{phDate}</span>
        </div>

        {isNotifOpen ? (
          <div
            className={`absolute right-0 top-[calc(100%+12px)] z-[70] w-[min(94vw,520px)] overflow-hidden rounded-2xl border border-[#d7e4f2] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.22)] transition-all duration-200 ease-out ${
              isNotifAnimatingIn ? "translate-y-0 scale-100 opacity-100" : "-translate-y-1 scale-[0.98] opacity-0"
            }`}
          >
            <div className="flex items-center justify-between border-b border-[#e8eef6] px-4 py-3">
              <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-[#33557b]">Notifications</h3>
              <button
                type="button"
                onClick={() => {
                  const next: Record<string, boolean> = {};
                  notifications.forEach((item) => {
                    next[item.id] = true;
                  });
                  setReadMap((prev) => ({ ...prev, ...next }));
                }}
                className="text-xs font-semibold text-[#2563eb] hover:text-[#1d4ed8]"
              >
                Mark all as read
              </button>
            </div>

            <div className="flex items-center gap-2 border-b border-[#e8eef6] bg-white px-4 py-2.5">
              <button
                type="button"
                onClick={() => setNotifFilter("all")}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  notifFilter === "all"
                    ? "border-[#93c5fd] bg-[#eff6ff] text-[#1d4ed8]"
                    : "border-[#dbe6f2] bg-white text-[#5b708c]"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setNotifFilter("unread")}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  notifFilter === "unread"
                    ? "border-[#93c5fd] bg-[#eff6ff] text-[#1d4ed8]"
                    : "border-[#dbe6f2] bg-white text-[#5b708c]"
                }`}
              >
                Not read yet
              </button>
              <button
                type="button"
                onClick={() => setNotifFilter("read")}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  notifFilter === "read"
                    ? "border-[#93c5fd] bg-[#eff6ff] text-[#1d4ed8]"
                    : "border-[#dbe6f2] bg-white text-[#5b708c]"
                }`}
              >
                Read
              </button>
            </div>

            <div className="max-h-[420px] overflow-y-auto bg-[#f8fbff] p-2">
              {isNotifLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: NOTIF_SKELETON_COUNT }).map((_, index) => (
                    <div
                      key={`notif-skeleton-${index}`}
                      className="rounded-xl border border-[#e5edf6] bg-white px-3 py-3"
                    >
                      <div className="mb-2 h-3 w-20 animate-pulse rounded bg-[#dbe7f4]" />
                      <div className="mb-2 h-4 w-[82%] animate-pulse rounded bg-[#dbe7f4]" />
                      <div className="mb-2 h-3 w-full animate-pulse rounded bg-[#e5edf6]" />
                      <div className="h-3 w-2/3 animate-pulse rounded bg-[#e5edf6]" />
                    </div>
                  ))}
                </div>
              ) : filteredNotifications.length === 0 ? (
                <p className="rounded-xl bg-white px-3 py-3 text-sm text-[#64748b]">No new notifications.</p>
              ) : (
                visibleNotifications.map((item) => {
                  const isRead = Boolean(readMap[item.id]);

                  return (
                    <div
                      key={item.id}
                      className={`mb-2 rounded-xl border px-3 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_20px_rgba(15,23,42,0.08)] ${isRead ? "border-[#e5edf6] bg-white" : "border-[#fecaca] bg-[#fff1f2]"}`}
                    >
                      <button type="button" onClick={() => handleNotificationClick(item)} className="w-full text-left">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#4b6b91]">{item.kind === "sensor" ? "Sensor" : "Comment"}</p>
                        <p className="mt-1 text-sm font-semibold text-[#102a45]">{item.title}</p>
                        <p className="mt-1 text-sm text-[#4b5563]">{item.message}</p>
                        <p className="mt-2 text-xs text-[#6b7280]">{formatNotificationDateTime(item.createdAt)}</p>
                      </button>

                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => markNotification(item.id, !isRead)}
                          className="text-xs font-semibold text-[#2563eb] hover:text-[#1d4ed8]"
                        >
                          Mark as {isRead ? "unread" : "read"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {!isNotifLoading && filteredNotifications.length > 0 ? (
              <div className="border-t border-[#e8eef6] bg-white px-4 py-2.5">
                {hasMoreNotifications ? (
                  <button
                    type="button"
                    onClick={() => setVisibleNotifCount((prev) => prev + NOTIF_PAGE_SIZE)}
                    className="w-full rounded-lg border border-[#d1deeb] px-3 py-1.5 text-xs font-semibold text-[#385980] hover:bg-[#f8fbff]"
                  >
                    Load more
                  </button>
                ) : (
                  <p className="text-center text-xs text-[#6b7280]">All notifications loaded</p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
