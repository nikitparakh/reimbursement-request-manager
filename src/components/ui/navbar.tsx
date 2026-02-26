import Link from "next/link";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";

type NavLink = { href: string; label: string };

const studentLinks: NavLink[] = [
  { href: "/student/requests/new", label: "New Request" },
];

const managerLinks: NavLink[] = [
  { href: "/student/requests/new", label: "New Request" },
  { href: "/manager/inbox", label: "Manager Inbox" },
];

const adminLinks: NavLink[] = [
  { href: "/manager/inbox", label: "Manager Inbox" },
  { href: "/admin/inbox", label: "Admin Inbox" },
  { href: "/admin/team-requests", label: "Team Requests" },
];

function getLinksForRole(role: string): NavLink[] {
  switch (role) {
    case "ADMIN":
      return adminLinks;
    case "MANAGER":
      return managerLinks;
    default:
      return studentLinks;
  }
}

export async function NavBar() {
  const session = await auth();

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
          <img src="/frogforce-shield.jpg" alt="Frog Force 503" className="h-10 w-auto" />
          <span className="text-lg font-bold text-emerald-600">Frog Force 503</span>
        </Link>

        {session?.user ? (
          <>
            <div className="flex items-center gap-6">
              {getLinksForRole(session.user.role).map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-slate-600 hover:text-emerald-600 transition"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-500">{session.user.email}</span>
              <SignOutButton />
            </div>
          </>
        ) : (
          <div className="flex items-center gap-4">
            <Link
              href="/sign-in"
              className="text-sm font-medium text-slate-600 hover:text-emerald-600 transition"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="text-sm font-medium bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 transition"
            >
              Create Account
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
