import { Archive } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type EmptyStateProps = {
  title: string;
  description?: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
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
