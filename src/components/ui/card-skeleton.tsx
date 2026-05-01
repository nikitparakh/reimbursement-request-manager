import { Skeleton } from "@/components/ui/skeleton"

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-6 w-20" />
      </div>
      {lines > 1 ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: lines - 1 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-3"
              style={{ width: `${80 - i * 15}%` }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
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
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: cardCount }).map((_, i) => (
          <CardSkeleton key={i} lines={lines} />
        ))}
      </div>
    </div>
  )
}
