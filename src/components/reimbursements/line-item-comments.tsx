"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type { SerializedLineItemComment } from "@/lib/reimbursements/serialize-receipts";

type LineItemCommentsProps = {
  requestId: string;
  lineItemId: string;
  comments: SerializedLineItemComment[];
  canComment?: boolean;
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function LineItemComments({
  requestId,
  lineItemId,
  comments: initialComments,
  canComment = false,
}: LineItemCommentsProps) {
  const [comments, setComments] = useState(initialComments);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  async function handlePost() {
    const trimmed = text.trim();
    if (!trimmed || posting) return;

    setPosting(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/line-items/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineItemId, text: trimmed }),
      });
      if (res.ok) {
        const created = (await res.json()) as SerializedLineItemComment;
        setComments((prev) => [...prev, created]);
        setText("");
        toast.success("Comment posted");
        setOpen(false);
      } else {
        toast.error("Failed to post comment");
      }
    } catch {
      toast.error("Failed to post comment");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="border-l-2 border-primary/40 bg-muted/40 px-4 py-3 space-y-2">
      {comments.length > 0 && (
        <div className="space-y-1.5">
          {comments.map((c) => (
            <div key={c.id} className="text-xs">
              <span className="font-medium text-foreground">{c.authorEmail}</span>
              <span className="text-muted-foreground ml-1.5">{timeAgo(c.createdAt)}</span>
              <p className="text-muted-foreground mt-0.5">{c.text}</p>
            </div>
          ))}
        </div>
      )}
      {canComment && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="xs">
              Add comment
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 gap-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write a comment…"
              maxLength={500}
              rows={3}
              className="resize-none text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="xs" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" size="xs" loading={posting} disabled={!text.trim()} onClick={() => void handlePost()}>
                Post
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

type CommentIconProps = Omit<React.ComponentProps<typeof Button>, "variant" | "size" | "children"> & {
  count: number;
};

export function CommentIcon({ count, className, type = "button", ...props }: CommentIconProps) {
  const showBadge = count > 0;

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      type={type}
      className={`relative shrink-0 ${className ?? ""}`}
      {...props}
    >
      <MessageCircle className="size-4" aria-hidden />
      {showBadge ? (
        <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-[3px] text-[9px] font-semibold tabular-nums text-primary-foreground">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Button>
  );
}
