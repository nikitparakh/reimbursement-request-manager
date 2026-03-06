"use client";

import { useState } from "react";
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
      }
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="bg-slate-50 border-l-2 border-emerald-300 px-4 py-3 space-y-2">
      {comments.length > 0 && (
        <div className="space-y-1.5">
          {comments.map((c) => (
            <div key={c.id} className="text-xs">
              <span className="font-medium text-slate-700">{c.authorEmail}</span>
              <span className="text-slate-400 ml-1.5">{timeAgo(c.createdAt)}</span>
              <p className="text-slate-600 mt-0.5">{c.text}</p>
            </div>
          ))}
        </div>
      )}
      {canComment && (
        <div className="flex gap-2 items-start">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handlePost();
              }
            }}
            placeholder="Add a comment..."
            maxLength={500}
            className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={() => void handlePost()}
            disabled={!text.trim() || posting}
            className="px-2 py-1 text-xs font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {posting ? "..." : "Post"}
          </button>
        </div>
      )}
    </div>
  );
}

export function CommentIcon({ count }: { count: number }) {
  return (
    <span className="relative inline-flex items-center">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </span>
  );
}
