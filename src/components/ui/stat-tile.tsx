import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatTileProps = {
  label: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  iconClassName?: string;
  href?: string;
  ariaLabel?: string;
};

export function StatTile({
  label,
  value,
  subtitle,
  icon: Icon,
  iconClassName,
  href,
  ariaLabel,
}: StatTileProps) {
  const card = (
    <Card
      className={cn(
        "h-full",
        href && "transition-colors group-hover/stat-tile:border-primary/40",
      )}
    >
      <CardContent className="relative pt-11 pb-4">
        <div
          className={cn(
            "absolute top-4 right-4 flex size-9 shrink-0 items-center justify-center rounded-md",
            iconClassName ?? "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="size-[1.125rem]" aria-hidden />
        </div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 pr-11 text-2xl font-bold text-foreground tabular-nums">
          {value}
        </p>
        {subtitle ? (
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </CardContent>
    </Card>
  );

  if (!href) {
    return card;
  }

  return (
    <Link
      href={href}
      aria-label={ariaLabel ?? `${label}: ${value}`}
      className="group/stat-tile block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {card}
    </Link>
  );
}
