"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.replace("/admin");
        return;
      }

      setEmail(data.session.user.email ?? null);
      setIsChecking(false);
    };

    void checkSession();
  }, [router]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/admin");
  };

  if (isChecking) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#f3f5f5]">
        <p className="text-[#4b5563]">Loading admin session...</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#f3f5f5] px-5 py-8 md:px-10">
      <div className="mx-auto max-w-5xl rounded-2xl bg-white p-6 shadow-sm md:p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0d3d73]">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-[#4b5563]">Signed in as {email ?? "admin"}</p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-[#d1d5db] px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#f9fafb]"
          >
            Log out
          </button>
        </div>

        <div className="mt-8 rounded-xl border border-dashed border-[#d1d5db] bg-[#fafafa] p-6 text-sm text-[#4b5563]">
          Supabase auth is now integrated. Next, we can connect this dashboard to your tables
          (users, flood readings, alerts, sensor status, etc.).
        </div>
      </div>
    </main>
  );
}
