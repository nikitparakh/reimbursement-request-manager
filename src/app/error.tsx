"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className={cn("w-full max-w-md border-border shadow-sm")}>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
            <AlertTriangle className="size-6 text-muted-foreground" aria-hidden />
          </div>
          <CardTitle className="text-xl">Something went wrong</CardTitle>
          <CardDescription>
            An unexpected error occurred. You can try again or return home.
          </CardDescription>
        </CardHeader>
        {error.digest ? (
          <CardContent className="pt-0 text-center">
            <p className="text-xs text-muted-foreground">Error ID: {error.digest}</p>
          </CardContent>
        ) : null}
        <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button type="button" onClick={reset}>
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Go home</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
