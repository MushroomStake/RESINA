type AdminPageSkeletonProps = {
  title?: string;
  blockCount?: number;
};

export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-[#e5edf7] ${className}`.trim()} />;
}

export function AdminPageSkeleton({ title = "Loading...", blockCount = 2 }: AdminPageSkeletonProps) {
  return (
    <section className="p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="rounded-2xl border border-[#dbe6f3] bg-white p-5">
          <p className="text-sm font-medium text-[#6b7280]">{title}</p>
          <div className="mt-4 space-y-3">
            <SkeletonLine className="h-4 w-52" />
            <SkeletonLine className="h-4 w-72" />
          </div>
        </div>

        {Array.from({ length: blockCount }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-[#dbe6f3] bg-white p-5">
            <div className="space-y-3">
              <SkeletonLine className="h-4 w-40" />
              <SkeletonLine className="h-20 w-full" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}