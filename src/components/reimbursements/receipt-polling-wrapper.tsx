"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type ReceiptPollingWrapperProps = {
  requestId: string;
  hasProcessing: boolean;
  children: React.ReactNode;
};

// Stop polling after this long so a stuck QUEUED/PROCESSING receipt never spins
// indefinitely (no server-side reaper exists yet).
const POLL_DEADLINE_MS = 120_000;

export function ReceiptPollingWrapper({
  requestId,
  hasProcessing,
  children,
}: ReceiptPollingWrapperProps) {
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    if (!hasProcessing) return;

    const deadline = Date.now() + POLL_DEADLINE_MS;
    // Clear any stale "still processing" banner from a previous session without
    // calling setState synchronously in the effect body (which would trigger a
    // cascading render).
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setStalled(false);
    });

    function stop() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    async function poll() {
      try {
        const res = await fetch(`/api/requests/${requestId}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          // Give up at the deadline even if status checks keep failing.
          if (Date.now() >= deadline) {
            stop();
            setStalled(true);
          }
          return;
        }

        const payload = (await res.json()) as {
          receiptFiles?: Array<{ parseStatus: string }>;
        };
        const statuses =
          payload.receiptFiles?.map((f) => f.parseStatus) ?? [];
        const hasFailed = statuses.some((s) => s === "FAILED");
        const stillProcessing = statuses.some(
          (s) => s === "QUEUED" || s === "PROCESSING",
        );

        // A FAILED receipt is terminal — stop polling and surface the error
        // distinctly rather than letting the spinner run forever.
        if (hasFailed && !stillProcessing) {
          stop();
          toast.error(
            "We couldn't read one or more receipts. Open the receipt to retry parsing.",
          );
          router.refresh();
          return;
        }

        if (!stillProcessing) {
          stop();
          router.refresh();
          return;
        }

        if (Date.now() >= deadline) {
          stop();
          setStalled(true);
        }
      } catch {
        // Network error — keep polling until the deadline.
        if (Date.now() >= deadline) {
          stop();
          setStalled(true);
        }
      }
    }

    intervalRef.current = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      stop();
    };
  }, [hasProcessing, requestId, router]);

  return (
    <div>
      {hasProcessing && !stalled && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
          <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
          <div>
            <p className="font-medium text-foreground text-sm">
              Processing receipts...
            </p>
            <p className="text-muted-foreground text-xs">
              This usually takes under a minute. The page will update
              automatically.
            </p>
          </div>
        </div>
      )}
      {hasProcessing && stalled && (
        <div
          className="mb-4 flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3"
          role="alert"
        >
          <AlertCircle className="size-5 text-destructive" aria-hidden />
          <div>
            <p className="font-medium text-foreground text-sm">
              Still processing receipts
            </p>
            <p className="text-muted-foreground text-xs">
              This is taking longer than expected. Refresh the page to check
              again.
            </p>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
