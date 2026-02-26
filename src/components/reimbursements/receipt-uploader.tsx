"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export function ReceiptUploader({ requestId }: { requestId: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function readErrorMessage(response: Response) {
    const text = await response.text();
    if (!text) return "Failed to upload receipts.";
    try {
      const payload = JSON.parse(text) as { error?: string };
      return payload.error ?? "Failed to upload receipts.";
    } catch {
      return text;
    }
  }

  async function waitForParsingCompletion() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const statusResponse = await fetch(`/api/requests/${requestId}`, { cache: "no-store" });
      if (!statusResponse.ok) continue;

      const payload = (await statusResponse.json()) as {
        receiptFiles?: Array<{ parseStatus: string }>;
      };
      const statuses = payload.receiptFiles?.map((item) => item.parseStatus) ?? [];
      if (statuses.length === 0) return;

      const hasPending = statuses.some(
        (status) => status === "QUEUED" || status === "PROCESSING"
      );
      if (hasPending) continue;

      router.refresh();
      if (statuses.some((status) => status === "FAILED")) {
        setMessage("Receipts processed, but at least one parse failed.");
        setIsError(true);
      } else {
        setMessage("Receipts parsed and totals recalculated.");
        setIsError(false);
      }
      return;
    }

    setMessage("Receipts uploaded. Parsing is still running, refresh shortly.");
    setIsError(false);
  }

  async function upload() {
    if (files.length === 0) {
      setMessage("Please select one or more files.");
      setIsError(true);
      return;
    }

    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }

    const response = await fetch(`/api/requests/${requestId}/receipts`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      setMessage(await readErrorMessage(response));
      setIsError(true);
      return;
    }
    setMessage("Receipts uploaded and queued for parsing.");
    setIsError(false);
    router.refresh();
    void waitForParsingCompletion();
  }

  return (
    <div className="space-y-4">
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-emerald-400 hover:bg-emerald-50/50 transition cursor-pointer"
      >
        <svg className="mx-auto h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
        </svg>
        <p className="mt-2 text-sm font-medium text-slate-700">
          Click to upload receipts
        </p>
        <p className="mt-1 text-xs text-slate-500">PDF or images accepted</p>
        {files.length > 0 ? (
          <p className="mt-2 text-sm text-emerald-600 font-medium">
            {files.length} file{files.length > 1 ? "s" : ""} selected
          </p>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,image/*"
          className="hidden"
          onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
        />
      </div>
      {files.length > 0 ? (
        <Button onClick={upload}>Upload {files.length} file{files.length > 1 ? "s" : ""}</Button>
      ) : null}
      {message ? (
        <Alert variant={isError ? "error" : "success"}>{message}</Alert>
      ) : null}
    </div>
  );
}
