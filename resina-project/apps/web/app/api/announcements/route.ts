import { NextResponse } from "next/server";
import { createAdminClient } from "../../../lib/supabase/admin";

type AnnouncementApiRow = {
  id: string;
  title: string;
  description: string;
  alert_level: "normal" | "warning" | "emergency";
  posted_by_name: string;
  created_at: string;
  announcement_media?: Array<{
    id: string;
    file_name: string;
    public_url: string;
    display_order: number;
  }>;
};

export async function GET() {
  try {
    const adminSupabase = createAdminClient();

    const { data, error } = await adminSupabase
      .from("announcements")
      .select("id, title, description, alert_level, posted_by_name, created_at, announcement_media(id, file_name, public_url, display_order)")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = ((data ?? []) as AnnouncementApiRow[]).map((entry) => ({
      ...entry,
      announcement_media: [...(entry.announcement_media ?? [])].sort(
        (a, b) => a.display_order - b.display_order,
      ),
    }));

    return NextResponse.json({ announcements: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load announcements.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
