import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type DashboardSectionProps = {
  title: string;
  description?: string;
  /**
   * When `true`, the section is rendered without a heading bar — useful when
   * a single section is the only thing on the page and a label would just be
   * visual noise.
   */
  hideTitle?: boolean;
  className?: string;
  children: ReactNode;
};

export function DashboardSection({
  title,
  description,
  hideTitle,
  className,
  children,
}: DashboardSectionProps) {
  return (
    <section className={cn("space-y-3", className)} aria-labelledby={`section-${slugify(title)}`}>
      {hideTitle ? (
        <h2 id={`section-${slugify(title)}`} className="sr-only">
          {title}
        </h2>
      ) : (
        <div className="space-y-0.5">
          <h2
            id={`section-${slugify(title)}`}
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {title}
          </h2>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
