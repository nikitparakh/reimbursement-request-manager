import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { getCachedAccessContext } from "@/lib/access";
import { getNavigationLinks } from "@/lib/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { NotificationBell } from "@/components/ui/notification-bell";
import { MobileNavMenu } from "@/components/ui/mobile-nav-menu";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";

export async function NavBar() {
  const session = await auth();
  const access = session?.user ? await getCachedAccessContext(session.user.id) : null;
  const links = access ? getNavigationLinks(access) : [];

  return (
    <nav className="bg-background sticky top-0 z-50 border-b shadow-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 transition hover:opacity-80">
          <Image
            src="/novi-logo.png"
            alt="Novi Community School District"
            width={131}
            height={40}
            className="h-10 w-auto"
          />
        </Link>

        {session?.user ? (
          <>
            <div className="hidden min-w-0 flex-1 items-center justify-end gap-6 sm:flex">
              <NavigationMenu viewport={false} className="max-w-max">
                <NavigationMenuList className="flex-wrap justify-end gap-1">
                  {links.map((link) => (
                    <NavigationMenuItem key={link.href}>
                      <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                        <Link href={link.href} prefetch={link.prefetch}>
                          {link.label}
                        </Link>
                      </NavigationMenuLink>
                    </NavigationMenuItem>
                  ))}
                </NavigationMenuList>
              </NavigationMenu>
              <div className="flex shrink-0 items-center gap-3">
                <NotificationBell />
                <span className="text-muted-foreground hidden text-sm md:inline">{session.user.email}</span>
                <SignOutButton />
              </div>
            </div>
            <MobileNavMenu links={links} userEmail={session.user.email!} />
          </>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="text-muted-foreground hover:text-primary text-sm font-medium transition"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition"
            >
              Create Account
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
