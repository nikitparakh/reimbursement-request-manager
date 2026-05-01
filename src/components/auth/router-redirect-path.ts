/** next-auth sometimes returns absolute callback URLs; `useRouter` expects an in-app href. */
export function toAppRouterHref(urlLike: string | null | undefined, fallback: string) {
  const raw = typeof urlLike === "string" && urlLike.trim() !== "" ? urlLike : fallback;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  try {
    const parsed = new URL(raw);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
