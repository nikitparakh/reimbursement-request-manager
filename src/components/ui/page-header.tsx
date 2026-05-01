import type { ReactNode } from "react";

import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  badge?: ReactNode;
  action?: ReactNode;
};

export function PageHeader({ title, description, badge, action }: PageHeaderProps) {
  return (
    <Card
      className="gap-3 border-0 bg-transparent py-0 shadow-none ring-0"
      size="sm"
    >
      <CardHeader className="flex flex-col gap-3 rounded-none p-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1
              className={cn(
                "font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
              )}
            >
              {title}
            </h1>
            {badge}
          </div>
          {description ? (
            <CardDescription className="mt-1 text-sm">{description}</CardDescription>
          ) : null}
        </div>
        {action ? <CardAction className="justify-end sm:justify-self-end">{action}</CardAction> : null}
      </CardHeader>
    </Card>
  );
}
