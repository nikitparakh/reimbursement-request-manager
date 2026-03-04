"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type EditableRequestHeaderProps = {
  requestId: string;
  initialTitle: string;
  initialDescription: string | null;
};

export function EditableRequestHeader({
  requestId,
  initialTitle,
  initialDescription,
}: EditableRequestHeaderProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    async (fields: { title?: string; description?: string }) => {
      try {
        await fetch(`/api/requests/${requestId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fields),
        });
      } catch {
        // Silently ignore save errors — user can retry
      }
    },
    [requestId]
  );

  const debouncedSave = useCallback(
    (fields: { title?: string; description?: string }) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => void save(fields), 600);
    },
    [save]
  );

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          if (e.target.value.trim()) {
            debouncedSave({ title: e.target.value });
          }
        }}
        className="w-full text-2xl font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-emerald-500 focus:outline-none transition px-1 py-0.5"
        placeholder="Request title"
      />
      <textarea
        value={description}
        onChange={(e) => {
          setDescription(e.target.value);
          debouncedSave({ description: e.target.value });
        }}
        rows={2}
        className="w-full text-sm text-slate-600 bg-transparent border border-transparent rounded-md hover:border-slate-200 focus:border-emerald-500 focus:outline-none transition resize-none px-1 py-1"
        placeholder="Add a description..."
      />
    </div>
  );
}
