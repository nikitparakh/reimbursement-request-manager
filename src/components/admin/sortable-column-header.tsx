"use client";

import type { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SortableColumnHeaderProps<TData> = {
  column: Column<TData, unknown>;
  title: string;
  className?: string;
};

export function SortableColumnHeader<TData>({
  column,
  title,
  className,
}: SortableColumnHeaderProps<TData>) {
  if (!column.getCanSort()) {
    return <span className={cn("font-medium text-muted-foreground", className)}>{title}</span>;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className={cn("-ml-3 h-8 hover:bg-accent", className)}
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {title}
      {column.getIsSorted() === "asc" ? (
        <ArrowUp className="ml-1 size-3.5" aria-hidden />
      ) : column.getIsSorted() === "desc" ? (
        <ArrowDown className="ml-1 size-3.5" aria-hidden />
      ) : (
        <ArrowUpDown className="ml-1 size-3.5 opacity-50" aria-hidden />
      )}
    </Button>
  );
}
