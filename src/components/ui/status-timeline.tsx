import { CircleDot } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

type TimelineEntry = {
  id: string;
  action: string;
  actor: string;
  comment?: string | null;
  createdAt: Date;
};

export function StatusTimeline({ items }: { items: TimelineEntry[] }) {
  if (items.length === 0) return null;

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {items.map((item, idx) => (
          <li key={item.id}>
            <div className={cn("relative pb-8", idx === items.length - 1 && "pb-0")}>
              {idx < items.length - 1 ? (
                <Separator
                  orientation="vertical"
                  decorative
                  className="absolute left-[11px] top-7 ml-px h-[calc(100%-0.75rem)] w-px shrink-0 bg-border"
                />
              ) : null}
              <div className="relative flex items-start gap-3">
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-background bg-muted shadow-sm ring-2 ring-border">
                  <CircleDot aria-hidden className="size-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={item.action} />
                    <span className="text-sm text-muted-foreground">by {item.actor}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.createdAt.toLocaleString()}</p>
                  {item.comment ? (
                    <p className="mt-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground">
                      {item.comment}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
