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

// Scoped to the (app) group so unauthorized() inside an authed page renders
// inside the app chrome (NavBar + main) instead of the bare root page.
export default async function AppUnauthorized() {
  const session = await auth();
  const content = getUnauthorizedPageContent(Boolean(session?.user));

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md border-border shadow-sm">
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
