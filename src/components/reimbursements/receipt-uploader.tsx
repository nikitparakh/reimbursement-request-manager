"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  File,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type UploadedReceipt = {
  id: string;
  fileName: string;
};

type ReceiptUploaderProps = {
  requestId: string;
  existingReceipts?: UploadedReceipt[];
  hideExistingReceiptDeleteIds?: string[];
};

type UploadingFile = {
  key: string;
  fileName: string;
  status: "uploading" | "uploaded" | "failed";
  // Server-assigned receipt id, set once the POST resolves. Used to dedup the
  // optimistic chip against the refreshed server list by id (not fileName), so
  // an already-saved same-named receipt is never transiently hidden.
  receiptId?: string;
};

export function ReceiptUploader({
  requestId,
  existingReceipts = [],
  hideExistingReceiptDeleteIds = [],
}: ReceiptUploaderProps) {
  const [uploads, setUploads] = useState<UploadingFile[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const visibleUploads = uploads.filter(
    (upload) =>
      upload.status === "uploading" ||
      // Once the server row for this upload has landed in existingReceipts
      // (matched by its assigned id), drop the optimistic chip. Same-named
      // server receipts no longer hide an in-flight upload.
      !(upload.receiptId && existingReceipts.some((receipt) => receipt.id === upload.receiptId)),
  );

  async function deleteReceipt(receiptId: string) {
    setDeletedIds((prev) => new Set(prev).add(receiptId));
    try {
      const res = await fetch(`/api/requests/${requestId}/receipts/${receiptId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setDeletedIds((prev) => {
          const next = new Set(prev);
          next.delete(receiptId);
          return next;
        });
        toast.error("Failed to delete receipt.");
        return;
      }
      toast.success("Receipt removed");
      router.refresh();
    } catch {
      setDeletedIds((prev) => {
        const next = new Set(prev);
        next.delete(receiptId);
        return next;
      });
      toast.error("Failed to delete receipt.");
    }
  }

  function updateUpload(key: string, patch: Partial<UploadingFile>) {
    setUploads((prev) => prev.map((u) => (u.key === key ? { ...u, ...patch } : u)));
  }

  async function uploadFile(file: File) {
    const key = `${Date.now()}-${file.name}`;
    setUploads((prev) => [...prev, { key, fileName: file.name, status: "uploading" }]);

    const formData = new FormData();
    formData.append("files", file);

    try {
      const response = await fetch(`/api/requests/${requestId}/receipts`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        updateUpload(key, { status: "failed" });
        const text = await response.text();
        try {
          const payload = JSON.parse(text) as { error?: string };
          toast.error(payload.error ?? "Upload failed.");
        } catch {
          toast.error("Upload failed.");
        }
        return;
      }

      updateUpload(key, { status: "uploaded" });
      const payload = (await response.json().catch(() => null)) as {
        receipts?: { id: string }[];
      } | null;
      const receiptId = payload?.receipts?.[0]?.id;
      if (receiptId) {
        updateUpload(key, { receiptId });
      }
      toast.success("Receipt uploaded");
      router.refresh();
    } catch {
      updateUpload(key, { status: "failed" });
      toast.error("Upload failed. Please try again.");
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    for (const file of selected) {
      void uploadFile(file);
    }
  }

  const hiddenDeleteIds = new Set(hideExistingReceiptDeleteIds);
  // Hide server receipts that are still represented by an in-flight optimistic
  // chip (matched by the upload's assigned id), and ones the user just deleted.
  const optimisticReceiptIds = new Set(
    visibleUploads.map((u) => u.receiptId).filter((id): id is string => !!id),
  );
  const serverOnly = existingReceipts.filter(
    (r) => !optimisticReceiptIds.has(r.id) && !deletedIds.has(r.id),
  );

  return (
    <div className="space-y-4">
      {serverOnly.length > 0 || visibleUploads.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {serverOnly.map((receipt) => (
            <div
              key={receipt.id}
              className="inline-flex max-w-xs items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm"
            >
              <a
                href={`/api/receipts/${receipt.id}/download`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-w-0 items-center gap-2 transition-opacity hover:opacity-80"
              >
                <File className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate text-foreground">{receipt.fileName}</span>
                <Check className="size-4 shrink-0 text-primary" aria-hidden />
              </a>
              {!hiddenDeleteIds.has(receipt.id) ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      type="button"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${receipt.fileName}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete receipt</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently remove &quot;{receipt.fileName}&quot; from this request.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() => void deleteReceipt(receipt.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </div>
          ))}

          {visibleUploads.map((upload) => (
            <div
              key={upload.key}
              className="inline-flex max-w-xs items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm"
            >
              <File className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate text-foreground">{upload.fileName}</span>
              <UploadStatusIndicator status={upload.status} />
            </div>
          ))}
        </div>
      ) : null}

      <Card
        className="cursor-pointer border-2 border-dashed border-border transition-colors hover:border-primary hover:bg-primary/5 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
      >
        <CardContent className="flex flex-col items-center gap-1 py-6 text-center">
          <Upload className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium text-foreground">Add receipts</p>
          <p className="text-xs text-muted-foreground">PDF or images accepted</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function UploadStatusIndicator({ status }: { status: UploadingFile["status"] }) {
  if (status === "uploading") {
    return <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />;
  }
  if (status === "failed") {
    return <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden />;
  }
  return <Check className="size-4 shrink-0 text-primary" aria-hidden />;
}
