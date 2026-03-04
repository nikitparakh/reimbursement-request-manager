export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2 flex-1">
          <div className="h-4 w-48 rounded bg-slate-200" />
          <div className="h-3 w-32 rounded bg-slate-100" />
        </div>
        <div className="h-6 w-20 rounded bg-slate-200" />
      </div>
      {lines > 1 && (
        <div className="mt-4 space-y-2">
          {Array.from({ length: lines - 1 }).map((_, i) => (
            <div key={i} className="h-3 rounded bg-slate-100" style={{ width: `${80 - i * 15}%` }} />
          ))}
        </div>
      )}
    </div>
  );
}

export function PageSkeleton({
  cardCount = 3,
  lines = 3,
}: {
  cardCount?: number;
  lines?: number;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2 animate-pulse">
        <div className="h-7 w-56 rounded bg-slate-200" />
        <div className="h-4 w-80 rounded bg-slate-100" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: cardCount }).map((_, i) => (
          <CardSkeleton key={i} lines={lines} />
        ))}
      </div>
    </div>
  );
}
