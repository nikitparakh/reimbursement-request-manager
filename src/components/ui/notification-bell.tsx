"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle2, MessageSquare, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { formatRelativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/ui/empty-state";
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

const DAY_ORDER = ["Today", "Yesterday", "Earlier this week", "Older"] as const;

type DayGroup = (typeof DAY_ORDER)[number];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function calendarDaysDifference(now: Date, then: Date): number {
  return Math.round((startOfDay(now).getTime() - startOfDay(then).getTime()) / 86_400_000);
}

function getWeekStartMonday(reference: Date): Date {
  const x = startOfDay(new Date(reference));
  const dow = x.getDay();
  const delta = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + delta);
  return x;
}

function formatDayGroup(iso: string, nowMs: number): DayGroup {
  const then = new Date(iso);
  const now = new Date(nowMs);
  const diff = calendarDaysDifference(now, then);

  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";

  const weekStart = getWeekStartMonday(now);
  const thenStart = startOfDay(then);
  const todayStart = startOfDay(now);
  if (
    diff >= 2 &&
    diff < 7 &&
    thenStart.getTime() >= weekStart.getTime() &&
    thenStart.getTime() < todayStart.getTime()
  ) {
    return "Earlier this week";
  }

  return "Older";
}

function notificationVisual(message: string) {
  const m = message.toLowerCase();
  if (m.includes("approved"))
    return { Icon: CheckCircle2, iconClassName: "text-emerald-600" as const };
  if (m.includes("rejected")) return { Icon: XCircle, iconClassName: "text-destructive" as const };
  if (m.includes("comment"))
    return { Icon: MessageSquare, iconClassName: "text-muted-foreground" as const };
  return { Icon: Bell, iconClassName: "text-muted-foreground" as const };
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
  const [nowMs, setNowMs] = useState(() => Date.now());

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
    const timeInterval = setInterval(() => setNowMs(Date.now()), 60_000);

    void poll();

    return () => {
      cancelled = true;
      clearInterval(fetchInterval);
      clearInterval(timeInterval);
    };
  }, [open]);

  const grouped = useMemo(() => {
    const sorted = [...notifications].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const map = new Map<DayGroup, Notification[]>();
    for (const n of sorted) {
      const label = formatDayGroup(n.createdAt, nowMs);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(n);
    }
    return map;
  }, [notifications, nowMs]);

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
          <Bell className="size-5" aria-hidden />
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
          <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
        </div>
        <ScrollArea className="h-80">
          <div className="pr-3">
            {notifications.length === 0 ? (
              <EmptyState
                variant="compact"
                title="No notifications yet"
                description="You're all caught up."
              />
            ) : (
              DAY_ORDER.map((label) => {
                const items = grouped.get(label);
                if (!items?.length) return null;
                return (
                  <div key={label}>
                    <p className="bg-muted/50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    {items.map((n) => {
                      const { Icon, iconClassName } = notificationVisual(n.message);
                      return (
                        <Button
                          key={n.id}
                          variant="ghost"
                          className={cn(
                            "h-auto min-h-0 w-full justify-start rounded-none border-b px-4 py-3 font-normal whitespace-normal",
                            !n.requestHref ? "cursor-default" : "",
                            n.read ? "opacity-60" : "",
                          )}
                          onClick={() => handleNotificationClick(n)}
                        >
                          <div className="flex w-full min-w-0 items-start gap-2 text-left">
                            <Icon
                              aria-hidden
                              className={cn("mt-0.5 size-4 shrink-0", iconClassName)}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm leading-snug text-foreground line-clamp-2">
                                {n.message}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {formatRelativeTime(n.createdAt, "en-US", new Date(nowMs))}
                              </p>
                            </div>
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
