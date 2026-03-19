"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../../../lib/supabase/client";

type ActivityLogRow = {
  id: string;
  action_type: string;
  actor_name: string;
  detail: string;
  created_at: string;
};

const PAGE_SIZE = 10;

function formatLogDateTime(value: string): string {
  return new Date(value).toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actionLabel(actionType: string): string {
  if (actionType === "comment_deleted") return "Comment Removed";
  if (actionType === "announcement_deleted") return "Announcement Deleted";
  if (actionType === "image_removed") return "Image Removed";
  return actionType.replace(/_/g, " ");
}

export function ActivityLogSection() {
  const supabase = useMemo(() => createClient(), []);
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    let isMounted = true;

    const loadLogs = async () => {
      setIsLoading(true);

      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, count } = await supabase
        .from("activity_logs")
        .select("id, action_type, actor_name, detail, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (isMounted) {
        setLogs((data ?? []) as ActivityLogRow[]);
        setTotalCount(count ?? 0);
        setIsLoading(false);
      }
    };

    void loadLogs();

    const channel = supabase
      .channel("activity-log-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_logs" },
        (payload) => {
          if (isMounted) {
            const newRow = payload.new as ActivityLogRow;
            setTotalCount((prev) => prev + 1);
            if (currentPage === 1) {
              setLogs((prev) => [newRow, ...prev].slice(0, PAGE_SIZE));
            }
          }
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [currentPage, supabase]);

  return (
    <section className="mt-6 rounded-2xl border border-[#e5e7eb] bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-[#111827]">Activity Log</h3>
        <span className="text-xs text-[#6b7280]">
          {totalCount > 0 ? `${totalCount} total event${totalCount !== 1 ? "s" : ""}` : "No events yet"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[#6b7280]">
            <tr>
              <th className="pb-2 font-medium">Date & Time</th>
              <th className="pb-2 font-medium">Admin</th>
              <th className="pb-2 font-medium">Action</th>
              <th className="pb-2 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody className="text-[#374151]">
            {isLoading ? (
              <tr className="border-t border-[#f0f2f4]">
                <td colSpan={4} className="py-3 text-[#6b7280]">
                  Loading activity log…
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr className="border-t border-[#f0f2f4]">
                <td colSpan={4} className="py-3 text-[#6b7280]">
                  No activity recorded yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-t border-[#f0f2f4]">
                  <td className="py-3 pr-4 text-xs text-[#6b7280] whitespace-nowrap">{formatLogDateTime(log.created_at)}</td>
                  <td className="py-3 pr-4 font-medium whitespace-nowrap">{log.actor_name}</td>
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-xs font-medium text-[#475569]">
                      {actionLabel(log.action_type)}
                    </span>
                  </td>
                  <td className="py-3 text-[#6b7280]">{log.detail}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#f0f2f4] pt-3">
        <p className="text-xs text-[#6b7280]">Page {currentPage} of {totalPages}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage <= 1 || isLoading}
            className="rounded-md border border-[#d1d5db] px-3 py-1.5 text-xs font-medium text-[#374151] hover:bg-[#f3f4f6] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage >= totalPages || isLoading}
            className="rounded-md border border-[#d1d5db] px-3 py-1.5 text-xs font-medium text-[#374151] hover:bg-[#f3f4f6] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
