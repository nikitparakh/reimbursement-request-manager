"use client";

import { type ReactNode, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReopening, setIsReopening] = useState(false);

  async function handleDelete() {
    if (!requestId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/requests/${requestId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete draft.");
        return;
      }
      toast.success("Draft deleted.");
      router.refresh();
    } catch {
      toast.error("Failed to delete draft.");
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
      if (!res.ok) {
        toast.error("Failed to reopen request.");
        return;
      }
      toast.success("Request reopened as draft.");
      router.refresh();
    } catch {
      toast.error("Failed to reopen request.");
    } finally {
      setIsReopening(false);
    }
  }

  function activateHeader(ev: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) {
    if ("key" in ev && ev.key !== "Enter" && ev.key !== " ") return;
    if ("target" in ev && (ev.target as HTMLElement).closest("button, a")) return;

    if (href) {
      router.push(href);
    } else {
      setOpen((o) => !o);
    }
  }

  const toolbar = (
    <div className="flex shrink-0 items-center gap-2 sm:gap-3">
      <span className="text-lg font-bold text-foreground">{requestedTotal}</span>
      {!isDraft && requestId ? (
        <Button variant="ghost" size="icon-xs" title="Download PDF" asChild>
          <a href={`/api/requests/${requestId}/pdf`} target="_blank" rel="noopener noreferrer">
            <Download className="size-4" />
          </a>
        </Button>
      ) : null}
      {detailHref ? (
        <Button variant="ghost" size="icon-xs" title="Open request" asChild>
          <a
            href={detailHref}
            onClick={(e) => {
              e.preventDefault();
              router.push(detailHref);
            }}
          >
            <ExternalLink className="size-4" />
          </a>
        </Button>
      ) : null}
      {isRejected && requestId ? (
        <Button
          variant="outline"
          size="xs"
          type="button"
          disabled={isReopening}
          className="border-border bg-muted text-foreground hover:bg-muted/80"
          title="Reopen as draft"
          onClick={(e) => {
            e.stopPropagation();
            void handleReopen();
          }}
        >
          {isReopening ? (
            <>
              <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden />
              Reopening…
            </>
          ) : (
            <>
              <RotateCcw className="mr-1 size-3.5" aria-hidden />
              Reopen
            </>
          )}
        </Button>
      ) : null}
      {isDraft && requestId && !confirmingDelete ? (
        <Button
          variant="ghost"
          size="icon-xs"
          type="button"
          title="Delete draft"
          aria-label="Delete draft"
          className="text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmingDelete(true);
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      ) : null}
      {!href ? (
        <ChevronDown
          className={`size-5 shrink-0 text-muted-foreground transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      ) : (
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      )}
    </div>
  );

  const headerInteractive = (
    <>
      <div
        role="button"
        tabIndex={0}
        className="flex w-full cursor-pointer items-start justify-between gap-4 rounded-md px-1 py-0.5 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
        onClick={activateHeader}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            activateHeader(e);
          }
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-foreground">{title}</h3>
            <StatusBadge status={status} />
          </div>
          {subtitle ? <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p> : null}
          <p className="mt-0.5 text-xs text-muted-foreground">{createdAt}</p>
        </div>
        {toolbar}
      </div>
      {confirmingDelete ? (
        <div
          role="presentation"
          className="mt-4 flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 sm:flex-row sm:items-center sm:justify-between"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <p className="text-sm font-medium text-destructive">
            Delete this draft? This cannot be undone.
          </p>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="destructive"
              size="sm"
              loading={isDeleting}
              disabled={isDeleting}
              onClick={() => void handleDelete()}
            >
              Delete
            </Button>
            <Button variant="ghost" size="sm" disabled={isDeleting} onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Card className="overflow-hidden">
        <CardHeader>{headerInteractive}</CardHeader>
      </Card>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={(v) => setOpen(v)}>
      <Card className="overflow-hidden">
        <CardHeader>{headerInteractive}</CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-6 border-border border-t p-6 pt-0">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
