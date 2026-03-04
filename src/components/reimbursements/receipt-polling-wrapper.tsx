"use client";

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
          (s) => s === "QUEUED" || s === "PROCESSING"
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
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <svg
            className="h-5 w-5 animate-spin text-amber-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800">
              Processing receipts...
            </p>
            <p className="text-xs text-amber-600">
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
