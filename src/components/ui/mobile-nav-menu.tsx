"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { NotificationBell } from "@/components/ui/notification-bell";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

type MobileNavMenuProps = {
  links: { href: string; label: string; prefetch?: boolean }[];
  userEmail: string;
};

export function MobileNavMenu({ links, userEmail }: MobileNavMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="sm:hidden" aria-label="Open menu">
          <Menu className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-72 flex-col gap-0 p-0">
        <SheetHeader className="border-b px-4 py-3 text-left">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-0.5 px-2 pb-2 pt-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={link.prefetch}
              onClick={() => setOpen(false)}
              className="hover:bg-accent rounded-md px-3 py-2 text-sm font-medium transition"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <Separator />
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm">{userEmail}</span>
          <div className="flex shrink-0 items-center gap-2">
            <NotificationBell />
            <SignOutButton />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
