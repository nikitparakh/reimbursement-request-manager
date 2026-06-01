import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Standard "back to <list>" affordance for detail/leaf pages so users are never
 * stranded relying on the browser back button or the logo to return.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {label}
    </Link>
  );
}
