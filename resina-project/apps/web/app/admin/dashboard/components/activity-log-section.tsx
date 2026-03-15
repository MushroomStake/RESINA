"use client";

export function ActivityLogSection() {
  return (
    <section className="mt-6 rounded-2xl border border-[#e5e7eb] bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-[#111827]">Activity Log</h3>
        <span className="text-xs text-[#6b7280]">Standby mode</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[#6b7280]">
            <tr>
              <th className="pb-2 font-medium">Date & Time</th>
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody className="text-[#374151]">
            <tr className="border-t border-[#f0f2f4]">
              <td className="py-3">Standby</td>
              <td className="py-3">System</td>
              <td className="py-3">Activity log module is ready for live events.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
