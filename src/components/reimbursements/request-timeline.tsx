import { StatusTimeline } from "@/components/ui/status-timeline";

type TimelineItem = {
  id: string;
  action: string;
  actor: string;
  comment?: string | null;
  createdAt: Date;
};

export function RequestTimeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-900">Approval History</h3>
      <StatusTimeline items={items} />
    </div>
  );
}
