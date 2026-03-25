"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { type Column, SortableTable } from "@/components/ui/sortable-table";

export type RequestRow = {
  id: string;
  title: string;
  submittedBy: string;
  amount: number;
  status: string;
  date: string;
  dateMs: number;
};

const columns: Column<RequestRow>[] = [
  {
    key: "title",
    label: "Title",
    sortValue: (r) => r.title.toLowerCase(),
    render: (r) => (
      <Link
        href={`/user/requests/${r.id}`}
        className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
      >
        {r.title}
      </Link>
    ),
  },
  {
    key: "submittedBy",
    label: "Submitted By",
    sortValue: (r) => r.submittedBy.toLowerCase(),
    cellClassName: "text-slate-600",
    render: (r) => r.submittedBy,
  },
  {
    key: "amount",
    label: "Amount",
    sortValue: (r) => r.amount,
    cellClassName: "text-slate-700",
    render: (r) => `$${r.amount.toFixed(2)}`,
  },
  {
    key: "status",
    label: "Status",
    sortValue: (r) => r.status,
    render: (r) => <Badge status={r.status} />,
  },
  {
    key: "date",
    label: "Date",
    sortValue: (r) => r.dateMs,
    cellClassName: "text-slate-500",
    render: (r) => r.date,
  },
];

export function CoachTeamRequestsTable({ data }: { data: RequestRow[] }) {
  return <SortableTable columns={columns} data={data} rowKey={(r) => r.id} />;
}
