"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconBell,
  IconBellRinging,
  IconBellOff,
  IconId,
  IconCreditCard,
  IconCalendarCheck,
  IconPlaneDeparture,
  IconAlertTriangle,
  IconAlertCircle,
} from "@tabler/icons-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";
import { formatDistanceToNow, parseISO } from "date-fns";
import { hu } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Notification, NotificationType } from "@/types";

// ─── Icon map ─────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<NotificationType, React.ElementType> = {
  passport_expiry:  IconId,
  payment_due:      IconCreditCard,
  new_booking:      IconCalendarCheck,
  trip_soon:        IconPlaneDeparture,
  low_capacity:     IconAlertTriangle,
  payment_overdue:  IconAlertCircle,
};

const TYPE_COLOR: Record<NotificationType, string> = {
  passport_expiry:  "text-amber-500 bg-amber-50",
  payment_due:      "text-blue-500 bg-blue-50",
  new_booking:      "text-green-500 bg-green-50",
  trip_soon:        "text-violet-500 bg-violet-50",
  low_capacity:     "text-orange-500 bg-orange-50",
  payment_overdue:  "text-red-500 bg-red-50",
};

const ROUTE: Record<string, string> = {
  client:  "/clients",
  booking: "/bookings",
  trip:    "/trips",
};

function timeAgo(iso: string) {
  try { return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: hu }); }
  catch { return ""; }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function NotificationsDropdown() {
  const router   = useRouter();
  const supabase = createClient();
  const [open, setOpen]  = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    void fetchAll();
    const ch = supabase.channel("notif-dropdown")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" },
        (p) => setItems((prev) => [p.new as Notification, ...prev])
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications" },
        (p) => setItems((prev) => prev.map((n) => n.id === (p.new as Notification).id ? (p.new as Notification) : n))
      )
      .subscribe();
    channelRef.current = ch;
    return () => { void supabase.removeChannel(ch); };
  }, []);

  async function fetchAll() {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setItems(data as Notification[]);
  }

  async function markRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  }

  async function markAllRead() {
    const ids = items.filter((n) => !n.is_read).map((n) => n.id);
    if (!ids.length) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", ids);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function handleClick(n: Notification) {
    await markRead(n.id);
    if (n.related_id && n.related_type) {
      const prefix = ROUTE[n.related_type];
      if (prefix) router.push(`${prefix}/${n.related_id}`);
    }
    setOpen(false);
  }

  const unread = items.filter((n) => !n.is_read).length;
  const badge  = unread > 9 ? "9+" : unread > 0 ? String(unread) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 nav-item"
          aria-label="Értesítések"
        >
          {unread > 0
            ? <IconBellRinging size={18} stroke={1.5} className="text-blue-600" />
            : <IconBell size={18} stroke={1.5} />}
          {badge && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-sm bg-red-500 px-0.5 text-[10px] font-semibold text-white leading-none animate-pulse-dot">
              {badge}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="notification-enter w-[380px] p-0 shadow-lg border-zinc-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <span className="text-[14px] font-semibold text-zinc-900">
            Értesítések
            {unread > 0 && (
              <span className="ml-2 rounded-sm bg-blue-100 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700">
                {unread}
              </span>
            )}
          </span>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="text-[12px] text-blue-600 hover:underline"
            >
              Mind olvasott
            </button>
          )}
        </div>

        {/* List */}
        <ScrollArea className="max-h-96">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <IconBellOff size={28} stroke={1} className="text-zinc-200" />
              <p className="text-[13px] text-zinc-400">Nincs értesítés</p>
            </div>
          ) : (
            <ul>
              {items.map((n) => {
                const Icon  = TYPE_ICON[n.type] ?? IconBell;
                const color = TYPE_COLOR[n.type] ?? "text-zinc-500 bg-zinc-100";
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => void handleClick(n)}
                      className={cn(
                        "relative flex w-full items-start gap-3 px-4 py-3 text-left nav-item",
                        !n.is_read ? "bg-blue-50/50" : "bg-white hover:bg-zinc-50"
                      )}
                    >
                      {!n.is_read && (
                        <span className="absolute left-1.5 top-4 h-1.5 w-1.5 rounded-full bg-blue-500" />
                      )}
                      <div className={cn(
                        "mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md",
                        color.split(" ").slice(1).join(" ")
                      )}>
                        <Icon size={15} stroke={1.5} className={color.split(" ")[0]} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn(
                          "text-[13px] leading-snug text-zinc-900",
                          !n.is_read && "font-medium"
                        )}>
                          {n.title}
                        </p>
                        <p className="mt-0.5 text-[12px] text-zinc-500 line-clamp-2">{n.message}</p>
                        <p className="mt-1 text-[11px] text-zinc-400">{timeAgo(n.created_at)}</p>
                      </div>
                    </button>
                    <div className="mx-4 border-t border-zinc-100 last:border-0" />
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-zinc-100 px-4 py-2">
          <button
            onClick={() => setOpen(false)}
            className="text-[12px] text-zinc-400"
          >
            Bezárás
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
