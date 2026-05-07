import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type DashboardTileMeta = { label: string; value: string };

export type DashboardTileProps = {
  href: string;
  prefetch?: boolean;
  icon: LucideIcon;
  iconClassName?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  /**
   * Labelled metadata pairs rendered as a definition list. Use for
   * structured breakdowns like district / school / program where the
   * label-to-value relationship matters more than free-form prose.
   */
  meta?: DashboardTileMeta[];
  badge?: ReactNode;
  footer?: ReactNode;
};

export function DashboardTile({
  href,
  prefetch,
  icon: Icon,
  iconClassName,
  eyebrow,
  title,
  description,
  meta,
  badge,
  footer,
}: DashboardTileProps) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className="group/tile block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="flex h-full flex-col border-border transition-colors group-hover/tile:border-primary/40">
        <CardContent className="flex flex-1 flex-col gap-4 pt-6">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
                iconClassName,
              )}
            >
              <Icon className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              {eyebrow ? (
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {eyebrow}
                </div>
              ) : null}
              <div className="font-heading text-base font-semibold leading-snug text-foreground">
                {title}
              </div>
              {description ? (
                <p className="text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>
            {badge ? <div className="shrink-0">{badge}</div> : null}
          </div>

          {meta && meta.length > 0 ? (
            <dl className="grid gap-1.5 text-sm">
              {meta.map((item) => (
                <div key={item.label} className="grid grid-cols-[6.5rem_1fr] gap-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className="min-w-0 truncate text-foreground">{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          {footer ? (
            <div className="mt-auto flex items-center justify-between pt-2 text-sm text-foreground">
              {footer}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
