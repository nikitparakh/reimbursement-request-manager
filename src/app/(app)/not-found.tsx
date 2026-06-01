import Link from "next/link";
import { Frown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Scoped to the (app) group so a missing deep link (notFound()) renders inside
// the app chrome (NavBar + main) instead of the bare root not-found page.
export default function AppNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md border-border shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
            <Frown className="size-6 text-muted-foreground" aria-hidden />
          </div>
          <CardTitle className="text-xl">Page not found</CardTitle>
          <CardDescription>
            The page you are looking for does not exist, was moved, or you may not
            have access to it.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button asChild>
            <Link href="/">Go to dashboard</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
