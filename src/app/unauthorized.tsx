import Link from "next/link";
import { auth } from "@/auth";
import { getUnauthorizedPageContent } from "@/lib/ui-copy";

export default async function UnauthorizedPage() {
  const session = await auth();
  const content = getUnauthorizedPageContent(Boolean(session?.user));

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-bold text-slate-800">{content.title}</h1>
      <p className="text-slate-500">
        {content.description}
      </p>
      <Link
        href={content.actionHref}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition"
      >
        {content.actionLabel}
      </Link>
    </div>
  );
}
