import { Badge } from "@/components/ui/badge";

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
            <div className="relative pb-8">
              {idx < items.length - 1 ? (
                <span className="absolute left-3 top-6 -ml-px h-full w-0.5 bg-slate-200" />
              ) : null}
              <div className="relative flex items-start space-x-3">
                <div className="relative">
                  <div className="h-6 w-6 rounded-full bg-slate-100 border-2 border-white ring-2 ring-slate-200 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-slate-400" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge status={item.action} />
                    <span className="text-sm text-slate-500">by {item.actor}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {item.createdAt.toLocaleString()}
                  </p>
                  {item.comment ? (
                    <p className="mt-1 text-sm text-slate-600 bg-slate-50 rounded-md px-3 py-2">
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
