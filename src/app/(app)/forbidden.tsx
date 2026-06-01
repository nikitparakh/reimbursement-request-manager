import Link from "next/link";
import { ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Scoped to the (app) group so forbidden() inside an authed page renders inside
// the app chrome (NavBar + main) instead of the bare root forbidden page.
export default function AppForbidden() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="w-full max-w-md border-border shadow-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
            <ShieldOff className="size-6 text-destructive" aria-hidden />
          </div>
          <CardTitle className="text-xl">Forbidden</CardTitle>
          <CardDescription>
            You do not have permission to access this page.
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
