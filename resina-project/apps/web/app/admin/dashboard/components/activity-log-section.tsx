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

  useEffect(() => {
    let isMounted = true;

    const loadLogs = async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("id, action_type, actor_name, detail, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      if (isMounted) {
        setLogs((data ?? []) as ActivityLogRow[]);
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
            setLogs((prev) => [newRow, ...prev].slice(0, 20));
          }
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  return (
    <section className="mt-6 rounded-2xl border border-[#e5e7eb] bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-[#111827]">Activity Log</h3>
        <span className="text-xs text-[#6b7280]">{logs.length > 0 ? `${logs.length} recent event${logs.length !== 1 ? "s" : ""}` : "No events yet"}</span>
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
    </section>
  );
}
