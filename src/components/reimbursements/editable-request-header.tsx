"use client";

import { useState, useRef, useCallback, useEffect } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
    [requestId],
  );

  const debouncedSave = useCallback(
    (fields: { title?: string; description?: string }) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => void save(fields), 600);
    },
    [save],
  );

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  return (
    <div className="space-y-3">
      <Input
        type="text"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          if (e.target.value.trim()) {
            debouncedSave({ title: e.target.value });
          }
        }}
        className="h-auto rounded-none border-0 border-b border-transparent bg-transparent px-1 py-0.5 text-2xl font-bold text-foreground shadow-none hover:border-border focus-visible:border-ring focus-visible:ring-0"
        placeholder="Request title"
      />
      <Textarea
        value={description}
        onChange={(e) => {
          setDescription(e.target.value);
          debouncedSave({ description: e.target.value });
        }}
        rows={2}
        className="min-h-0 resize-none border-transparent bg-transparent px-1 py-1 text-sm text-muted-foreground shadow-none hover:border-border focus-visible:border-ring focus-visible:ring-0 md:text-sm"
        placeholder="Add a description..."
      />
    </div>
  );
}
