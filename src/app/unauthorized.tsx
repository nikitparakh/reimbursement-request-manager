import Link from "next/link";
import { Lock } from "lucide-react";

import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUnauthorizedPageContent } from "@/lib/ui-copy";
import { cn } from "@/lib/utils";

export default async function UnauthorizedPage() {
  const session = await auth();
  const content = getUnauthorizedPageContent(Boolean(session?.user));

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className={cn("w-full max-w-md border-border shadow-sm")}>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
            <Lock className="size-6 text-muted-foreground" aria-hidden />
          </div>
          <CardTitle className="text-xl">{content.title}</CardTitle>
          <CardDescription>{content.description}</CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button asChild>
            <Link href={content.actionHref}>{content.actionLabel}</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
