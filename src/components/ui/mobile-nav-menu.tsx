"use client";

import { useState } from "react";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { NotificationBell } from "@/components/ui/notification-bell";

type MobileNavMenuProps = {
  links: { href: string; label: string }[];
  userEmail: string;
  userRole: string;
};

export function MobileNavMenu({ links, userEmail, userRole }: MobileNavMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="p-2 text-slate-600 hover:text-emerald-600 transition"
        aria-label={open ? "Close menu" : "Open menu"}
      >
        {open ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-16 border-b border-slate-200 bg-white shadow-lg z-50">
          <div className="flex flex-col px-4 py-3 space-y-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block px-3 py-2 text-sm font-medium text-slate-600 hover:text-emerald-600 hover:bg-slate-50 rounded-md transition"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="border-t border-slate-100 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-slate-500 truncate mr-3">{userEmail}</span>
            <div className="flex items-center gap-2 shrink-0">
              <NotificationBell userRole={userRole} />
              <SignOutButton />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
