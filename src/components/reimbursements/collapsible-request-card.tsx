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
  detailHref?: string;
  requestId?: string;
  isDraft?: boolean;
  isRejected?: boolean;
  children: ReactNode;
};

export function CollapsibleRequestCard({
  title,
  status,
  requestedTotal,
  createdAt,
  subtitle,
  href,
  detailHref,
  requestId,
  isDraft,
  isRejected,
  children,
}: CollapsibleRequestCardProps) {
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
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

  async function handleReopen() {
    if (!requestId) return;
    setIsReopening(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/reopen`, { method: "POST" });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setIsReopening(false);
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
        <div
          role="button"
          tabIndex={0}
          onClick={handleClick}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(); } }}
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
            {!isDraft && requestId && (
              <a
                href={`/api/requests/${requestId}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition"
                title="Download PDF"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </a>
            )}
            {detailHref && (
              <a
                href={detailHref}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  router.push(detailHref);
                }}
                className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition"
                title="Open request"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            )}
            {isRejected && requestId && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleReopen();
                }}
                disabled={isReopening}
                className="px-2.5 py-1 text-xs font-medium rounded text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition disabled:opacity-50 cursor-pointer"
                title="Reopen as draft"
              >
                {isReopening ? "Reopening..." : "Reopen"}
              </button>
            )}
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
        </div>
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
