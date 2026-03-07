import Link from "next/link";

type PaginationControlsProps = {
  basePath: string;
  prevCursor: string | null;
  nextCursor: string | null;
};

export function PaginationControls({
  basePath,
  prevCursor,
  nextCursor,
}: PaginationControlsProps) {
  if (!prevCursor && !nextCursor) return null;

  return (
    <div className="flex items-center justify-between gap-2 pt-4">
      {prevCursor ? (
        <Link
          href={`${basePath}?cursor=${prevCursor}&dir=prev`}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Previous
        </Link>
      ) : (
        <span />
      )}
      {nextCursor ? (
        <Link
          href={`${basePath}?cursor=${nextCursor}`}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
        >
          Next
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
