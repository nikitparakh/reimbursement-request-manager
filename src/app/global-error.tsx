"use client";

import "./globals.css";

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

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Card className={cn("w-full max-w-md border-border shadow-sm")}>
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
                <AlertTriangle className="size-6 text-destructive" aria-hidden />
              </div>
              <CardTitle className="text-xl">Application error</CardTitle>
              <CardDescription>
                {error.message || "Something went wrong loading the page."}
              </CardDescription>
            </CardHeader>
            {error.digest ? (
              <CardContent className="pt-0 text-center">
                <p className="text-xs text-muted-foreground">Error ID: {error.digest}</p>
              </CardContent>
            ) : null}
            <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button type="button" variant="default" onClick={reset}>
                Try again
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">Go home</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </body>
    </html>
  );
}
