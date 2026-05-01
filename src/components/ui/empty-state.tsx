import { Archive } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type EmptyStateProps = {
  title: string;
  description?: string;
  variant?: "default" | "compact";
};

export function EmptyState({ title, description, variant = "default" }: EmptyStateProps) {
  if (variant === "compact") {
    return (
      <div className="py-8 text-center">
        <div
          aria-hidden
          className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground"
        >
          <Archive className="h-4 w-4" />
        </div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </div>
    );
  }

  return (
    <Card className="border-dashed border-muted-foreground/25 bg-muted/20 py-10 shadow-none">
      <CardHeader className="flex flex-col items-center space-y-0 px-6 pb-0 pt-6 text-center">
        <div
          aria-hidden
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
        >
          <Archive className="h-6 w-6" />
        </div>
        <CardTitle className="text-base font-medium text-foreground">{title}</CardTitle>
        {description ? (
          <CardDescription className="mt-2 max-w-sm">{description}</CardDescription>
        ) : null}
      </CardHeader>
    </Card>
  );
}
