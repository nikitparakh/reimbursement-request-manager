import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

export function DownloadPdfLink({ requestId }: { requestId: string }) {
  return (
    <Button variant="ghost" size="xs" title="Download PDF" asChild>
      <a
        href={`/api/requests/${requestId}/pdf`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Download className="size-3.5" aria-hidden />
        PDF
      </a>
    </Button>
  );
}
