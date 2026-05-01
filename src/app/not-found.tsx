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
import { cn } from "@/lib/utils";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className={cn("w-full max-w-md border-border shadow-sm")}>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
            <Frown className="size-6 text-muted-foreground" aria-hidden />
          </div>
          <CardTitle className="text-xl">Page not found</CardTitle>
          <CardDescription>
            The page you are looking for does not exist or may have been moved.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
