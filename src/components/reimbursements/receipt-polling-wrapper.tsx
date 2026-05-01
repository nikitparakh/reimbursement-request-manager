"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type ReceiptPollingWrapperProps = {
  requestId: string;
  hasProcessing: boolean;
  children: React.ReactNode;
};

export function ReceiptPollingWrapper({
  requestId,
  hasProcessing,
  children,
}: ReceiptPollingWrapperProps) {
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!hasProcessing) return;

    async function poll() {
      try {
        const res = await fetch(`/api/requests/${requestId}`, {
          cache: "no-store",
        });
        if (!res.ok) return;

        const payload = (await res.json()) as {
          receiptFiles?: Array<{ parseStatus: string }>;
        };
        const statuses =
          payload.receiptFiles?.map((f) => f.parseStatus) ?? [];
        const stillProcessing = statuses.some(
          (s) => s === "QUEUED" || s === "PROCESSING",
        );

        if (!stillProcessing) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          router.refresh();
        }
      } catch {
        // Network error — keep polling
      }
    }

    intervalRef.current = setInterval(poll, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [hasProcessing, requestId, router]);

  return (
    <div>
      {hasProcessing && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
          <div>
            <p className="font-medium text-foreground text-sm">
              Processing receipts...
            </p>
            <p className="text-muted-foreground text-xs">
              This usually takes 15–60 seconds. The page will update
              automatically.
            </p>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
