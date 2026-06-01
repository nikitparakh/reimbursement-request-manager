"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function DownloadPdfLink({ requestId }: { requestId: string }) {
  const [isDownloading, setIsDownloading] = useState(false);

  async function downloadPdf() {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/pdf`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(body.error ?? "Failed to download PDF. Please try again.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `reimbursement-${requestId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      type="button"
      title="Download PDF"
      onClick={() => void downloadPdf()}
      loading={isDownloading}
      disabled={isDownloading}
      aria-busy={isDownloading}
    >
      <Download aria-hidden />
      Download PDF
    </Button>
  );
}
