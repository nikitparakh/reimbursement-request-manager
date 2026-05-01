"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";

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
};

export function ReceiptUploader({
  requestId,
  existingReceipts = [],
  hideExistingReceiptDeleteIds = [],
}: ReceiptUploaderProps) {
  const [uploads, setUploads] = useState<UploadingFile[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const visibleUploads = uploads.filter(
    (upload) => upload.status === "uploading" || !existingReceipts.some((receipt) => receipt.fileName === upload.fileName)
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
        setMessage("Failed to delete receipt.");
        setIsError(true);
        return;
      }
      router.refresh();
    } catch {
      setDeletedIds((prev) => {
        const next = new Set(prev);
        next.delete(receiptId);
        return next;
      });
      setMessage("Failed to delete receipt.");
      setIsError(true);
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
          setMessage(payload.error ?? "Upload failed.");
        } catch {
          setMessage("Upload failed.");
        }
        setIsError(true);
        return;
      }

      updateUpload(key, { status: "uploaded" });
      setMessage("");
      router.refresh();
    } catch {
      updateUpload(key, { status: "failed" });
      setMessage("Upload failed. Please try again.");
      setIsError(true);
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

  const uploadedFileNames = new Set(visibleUploads.map((u) => u.fileName));
  const hiddenDeleteIds = new Set(hideExistingReceiptDeleteIds);
  const serverOnly = existingReceipts.filter(
    (r) => !uploadedFileNames.has(r.fileName) && !deletedIds.has(r.id)
  );

  return (
    <div className="space-y-4">
        {(serverOnly.length > 0 || visibleUploads.length > 0) ? (
        <div className="flex flex-wrap gap-2">
          {serverOnly.map((receipt) => (
            <div
              key={receipt.id}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm max-w-xs"
            >
              <a
                href={`/api/receipts/${receipt.id}/download`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 hover:opacity-80 transition min-w-0"
              >
                <FileIcon />
                <span className="truncate text-slate-700">{receipt.fileName}</span>
                <CheckIcon />
              </a>
              {!hiddenDeleteIds.has(receipt.id) ? (
                <button
                  type="button"
                  onClick={() => void deleteReceipt(receipt.id)}
                  className="ml-1 shrink-0 text-slate-400 hover:text-red-500 transition"
                  aria-label={`Delete ${receipt.fileName}`}
                >
                  <DeleteIcon />
                </button>
              ) : null}
            </div>
          ))}

          {visibleUploads.map((upload) => (
            <div
              key={upload.key}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm max-w-xs"
            >
              <FileIcon />
              <span className="truncate text-slate-700">{upload.fileName}</span>
              <UploadStatusIndicator status={upload.status} />
            </div>
          ))}
        </div>
      ) : null}

      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-emerald-400 hover:bg-emerald-50/50 transition cursor-pointer"
      >
        <svg className="mx-auto h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        <p className="mt-1 text-sm font-medium text-slate-700">Add receipts</p>
        <p className="text-xs text-slate-500">PDF or images accepted</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {message ? (
        <Alert variant={isError ? "destructive" : "success"}>{message}</Alert>
      ) : null}
    </div>
  );
}

function FileIcon() {
  return (
    <svg className="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function UploadStatusIndicator({ status }: { status: UploadingFile["status"] }) {
  if (status === "uploading") {
    return (
      <svg className="h-4 w-4 animate-spin text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    );
  }
  if (status === "failed") {
    return (
      <svg className="h-4 w-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
    );
  }
  return <CheckIcon />;
}
