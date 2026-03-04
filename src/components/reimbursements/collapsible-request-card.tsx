"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type CollapsibleRequestCardProps = {
  title: string;
  status: string;
  requestedTotal: string;
  createdAt: string;
  subtitle?: string;
  href?: string;
  requestId?: string;
  isDraft?: boolean;
  children: ReactNode;
};

export function CollapsibleRequestCard({
  title,
  status,
  requestedTotal,
  createdAt,
  subtitle,
  href,
  requestId,
  isDraft,
  children,
}: CollapsibleRequestCardProps) {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!requestId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/requests/${requestId}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setIsDeleting(false);
      setConfirmingDelete(false);
    }
  }

  function handleClick() {
    if (href) {
      router.push(href);
    } else {
      setOpen((prev) => !prev);
    }
  }

  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          onClick={handleClick}
          className="w-full flex items-center justify-between text-left cursor-pointer"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900 truncate">{title}</h3>
              <Badge status={status} />
            </div>
            {subtitle ? (
              <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
            ) : null}
            <p className="text-xs text-slate-400 mt-0.5">{createdAt}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <span className="text-lg font-bold text-slate-900">{requestedTotal}</span>
            {isDraft && requestId && !confirmingDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmingDelete(true);
                }}
                className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                title="Delete draft"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </button>
            )}
            {href ? (
              <svg
                className="h-5 w-5 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            ) : (
              <svg
                className={`h-5 w-5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            )}
          </div>
        </button>
      </CardHeader>
      {confirmingDelete && (
        <div className="flex items-center justify-between px-4 py-2 bg-red-50 border-t border-red-100" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm text-red-600 font-medium">Delete this draft? This cannot be undone.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 cursor-pointer"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {!href && open ? <CardContent className="space-y-6">{children}</CardContent> : null}
    </Card>
  );
}
