"use client";

import "./globals.css";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-background min-h-screen font-sans text-foreground antialiased">
        <h1>Application error</h1>
        <p>{error.message}</p>
        <Button type="button" variant="default" onClick={reset}>
          Try again
        </Button>
      </body>
    </html>
  );
}
