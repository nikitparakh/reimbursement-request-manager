import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

export function DownloadPdfLink({ requestId }: { requestId: string }) {
  return (
    <Button variant="outline" size="sm" title="Download PDF" asChild>
      <a
        href={`/api/requests/${requestId}/pdf`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Download aria-hidden />
        Download PDF
      </a>
    </Button>
  );
}
