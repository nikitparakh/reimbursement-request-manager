"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  event: string;
  message: string;
  requestId: string | null;
  requestHref: string | null;
  read: boolean;
  createdAt: string;
};

function formatTime(iso: string, now: number) {
  const diff = now - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

async function fetchNotificationsData() {
  const res = await fetch("/api/notifications");
  if (!res.ok) return null;
  return res.json() as Promise<{ notifications: Notification[]; unreadCount: number }>;
}

export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    if (!open) {
      return;
    }

    async function poll() {
      const data = await fetchNotificationsData().catch(() => null);
      if (!cancelled && data) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    }

    const fetchInterval = setInterval(() => void poll(), 30_000);
    const timeInterval = setInterval(() => setNow(Date.now()), 60_000);

    void poll();

    return () => {
      cancelled = true;
      clearInterval(fetchInterval);
      clearInterval(timeInterval);
    };
  }, [open]);

  async function markAsRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    } catch {
      const data = await fetchNotificationsData().catch(() => null);
      if (data) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    }
  }

  function handleNotificationClick(n: Notification) {
    if (!n.read) void markAsRead(n.id);
    if (n.requestHref) {
      setOpen(false);
      router.push(n.requestHref);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full px-1 text-[10px] font-semibold"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-80 flex-col gap-0 overflow-hidden p-0">
        <div className="border-b px-4 py-3">
          <h3 className="text-foreground text-sm font-semibold">Notifications</h3>
        </div>
        <ScrollArea className="h-80">
          <div className="pr-3">
            {notifications.length === 0 ? (
              <p className="text-muted-foreground px-4 py-6 text-center text-sm">No notifications yet</p>
            ) : (
              notifications.map((n) => (
                <Button
                  key={n.id}
                  variant="ghost"
                  className={cn(
                    "h-auto min-h-0 w-full justify-start rounded-none border-b px-4 py-3 font-normal whitespace-normal",
                    !n.requestHref ? "cursor-default" : "",
                    n.read ? "opacity-60" : ""
                  )}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="flex w-full min-w-0 items-start gap-2 text-left">
                    {!n.read && <span className="bg-primary mt-1.5 h-2 w-2 shrink-0 rounded-full" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground text-sm leading-snug line-clamp-2">{n.message}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">{formatTime(n.createdAt, now)}</p>
                    </div>
                  </div>
                </Button>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
