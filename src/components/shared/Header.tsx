"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  IconSettings,
  IconLogout,
  IconChevronDown,
  IconMenu2,
  IconBell,
  IconClock,
  IconPlaneDeparture,
  IconAlertCircle,
  IconBellRinging,
  IconCircleCheck,
} from "@tabler/icons-react";
import Link from "next/link";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { NotificationsDropdown } from "@/components/shared/NotificationsDropdown";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";

// ─── Breadcrumb map ───────────────────────────────────────────────────────────

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Irányítópult",
  "/clients":   "Ügyfelek",
  "/trips":     "Utazások",
  "/bookings":  "Foglalások",
  "/invoices":  "Számlák",
  "/emails":    "E-mailek",
  "/reports":   "Riportok",
  "/settings":  "Beállítások",
};

function resolveTitle(path: string): { title: string; crumb: string | null } {
  if (PAGE_TITLES[path]) return { title: PAGE_TITLES[path]!, crumb: null };
  const prefix = Object.keys(PAGE_TITLES)
    .filter((k) => k !== "/dashboard")
    .find((k) => path.startsWith(k));
  if (prefix) {
    const isDetail = path.length > prefix.length + 1;
    return { title: isDetail ? "Részletek" : (PAGE_TITLES[prefix] ?? ""), crumb: isDetail ? (PAGE_TITLES[prefix] ?? null) : null };
  }
  return { title: "ZsuzsiCRM", crumb: null };
}

// ─── Greeting logic ───────────────────────────────────────────────────────────

function getGreeting(h: number): string {
  if (h >= 5  && h < 10) return "Jó reggelt, Zsuzsa!";
  if (h >= 10 && h < 12) return "Jó délelőttöt, Zsuzsa!";
  if (h >= 12 && h < 14) return "Jó napot, Zsuzsa!";
  if (h >= 14 && h < 18) return "Jó délutánt, Zsuzsa!";
  if (h >= 18 && h < 22) return "Jó estét, Zsuzsa!";
  return "Még dolgozol, Zsuzsa?";
}

// ─── User dropdown ────────────────────────────────────────────────────────────

function UserDropdown({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 transition-colors"
      >
        <UserAvatar size="sm" />
        <span className="hidden sm:block">Zsuzsa</span>
        <IconChevronDown
          size={13}
          stroke={2}
          className={cn("text-zinc-400 transition-transform duration-150", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="animate-slide-down absolute right-0 top-full mt-1 w-52 rounded-md border border-zinc-200 bg-white shadow-lg z-50">
          <div className="px-3 py-2.5 border-b border-zinc-100">
            <p className="text-[13px] font-medium text-zinc-900">Tuza-Göncz Zsuzsanna</p>
            <p className="text-[12px] text-zinc-400 mt-0.5 truncate">{user.email}</p>
          </div>
          <div className="py-1">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="nav-item flex items-center gap-2 px-3 py-2 text-[13px] text-zinc-700 hover:bg-zinc-50"
            >
              <IconSettings size={15} stroke={1.5} className="text-zinc-400" />
              Beállítások
            </Link>
            <button
              onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }}
              className="nav-item flex w-full items-center gap-2 px-3 py-2 text-[13px] text-zinc-700 hover:bg-zinc-50 hover:text-red-600"
            >
              <IconLogout size={15} stroke={1.5} className="text-zinc-400" />
              Kijelentkezés
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Greeting subtitle ────────────────────────────────────────────────────────

interface GreetingData {
  overdueCount: number;
  upcomingTrip: { name: string; daysUntil: number } | null;
  newBookingsToday: number;
}

function GreetingSubtitle({ data }: { data: GreetingData }) {
  const { overdueCount, upcomingTrip, newBookingsToday } = data;

  if (upcomingTrip && upcomingTrip.daysUntil <= 7) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-zinc-500 mt-1">
        <IconPlaneDeparture size={14} stroke={1.5} className="text-zinc-400" />
        {upcomingTrip.name} indulása{" "}
        <span className="font-medium text-zinc-700">{upcomingTrip.daysUntil} nap múlva</span>
      </p>
    );
  }
  if (overdueCount > 0) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-red-600 mt-1">
        <IconAlertCircle size={14} stroke={1.5} />
        <span className="font-medium">{overdueCount} ügyfélnél</span> lejárt a fizetési határidő
      </p>
    );
  }
  if (newBookingsToday > 0) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-zinc-500 mt-1">
        <IconBellRinging size={14} stroke={1.5} className="text-zinc-400" />
        Ma <span className="font-medium text-zinc-700">{newBookingsToday} új jelentkezés</span> érkezett
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-sm text-zinc-400 mt-1">
      <IconCircleCheck size={14} stroke={1.5} />
      Minden rendben, szép napot
    </p>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

export function Header({ user, onMobileMenuToggle }: { user: User; onMobileMenuToggle: () => void }) {
  const pathname   = usePathname();
  const supabase   = createClient();
  const isDashboard = pathname === "/dashboard";

  // Live clock (client-only to avoid hydration mismatch)
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // EUR/HUF rate badge
  const [eurHuf, setEurHuf] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/exchange-rate")
      .then((r) => r.ok ? r.json() : null)
      .then((d: { rate?: number } | null) => {
        if (d?.rate && d.rate > 1) setEurHuf(Math.round(d.rate));
      })
      .catch(() => undefined);
  }, []);

  // Greeting data — fetched only on /dashboard
  const [gdata, setGdata] = useState<GreetingData>({ overdueCount: 0, upcomingTrip: null, newBookingsToday: 0 });

  useEffect(() => {
    if (!isDashboard) return;
    const today    = new Date().toISOString().slice(0, 10);
    const sevenDays = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const todayStart = `${today}T00:00:00`;
    const todayEnd   = `${today}T23:59:59`;

    void Promise.all([
      supabase.from("bookings").select("*", { count: "exact", head: true })
        .is("deleted_at", null).lt("payment_deadline", today)
        .not("status", "in", '("fully_paid","completed","cancelled")'),
      supabase.from("trips").select("name,departure_date")
        .gte("departure_date", today).lte("departure_date", sevenDays)
        .not("status", "in", '("completed","cancelled")').is("deleted_at", null)
        .order("departure_date").limit(1),
      supabase.from("bookings").select("*", { count: "exact", head: true })
        .is("deleted_at", null).not("status", "in", '("cancelled","interested")')
        .gte("created_at", todayStart).lte("created_at", todayEnd),
    ]).then(([overdueRes, upcomingRes, newRes]) => {
      const t = (upcomingRes.data ?? [])[0] as { name: string; departure_date: string } | undefined;
      setGdata({
        overdueCount:     overdueRes.count ?? 0,
        upcomingTrip:     t ? { name: t.name, daysUntil: differenceInCalendarDays(parseISO(t.departure_date), new Date()) } : null,
        newBookingsToday: newRes.count ?? 0,
      });
    });
  }, [isDashboard]);

  const { title, crumb } = resolveTitle(pathname);

  const timeStr = now
    ? now.toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" })
    : "";
  const dateStr = now
    ? now.toLocaleDateString("hu-HU", { year: "numeric", month: "long", day: "numeric", weekday: "long" })
    : "";

  return (
    <header
      className={cn(
        "flex-shrink-0 border-b border-zinc-200 bg-white",
        isDashboard ? "px-4 sm:px-6 py-5" : "flex h-14 items-center justify-between px-4 sm:px-6"
      )}
    >
      {isDashboard ? (
        /* ── Dashboard hero mode ─── */
        <div className="flex items-start justify-between gap-4">
          {/* Greeting + subtitle */}
          <div className="greeting-fadein">
            {now && (
              <>
                <h1 className="text-page-title text-zinc-900">{getGreeting(now.getHours())}</h1>
                <GreetingSubtitle data={gdata} />
              </>
            )}
          </div>

          {/* Right: date + time + notifications + user */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {now && (
              <div className="hidden sm:block text-right">
                <p className="text-[13px] text-zinc-400 capitalize leading-tight">{dateStr}</p>
                <p className={cn(
                  "flex items-center justify-end gap-1 text-[13px] text-zinc-400 mt-0.5",
                  "font-[family-name:var(--font-geist-mono)]"
                )}>
                  <IconClock size={13} stroke={1.5} className="text-zinc-300" />
                  {timeStr}
                </p>
              </div>
            )}
            <NotificationsDropdown />
            <UserDropdown user={user} />
          </div>
        </div>
      ) : (
        /* ── Compact mode ─── */
        <>
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 transition-colors md:hidden flex-shrink-0"
              onClick={onMobileMenuToggle}
              aria-label="Navigáció"
            >
              <IconMenu2 size={18} stroke={1.5} />
            </button>
            <nav className="flex items-center gap-1.5 text-sm min-w-0">
              {crumb && (
                <>
                  <span className="text-zinc-400 hidden sm:block truncate">{crumb}</span>
                  <span className="text-zinc-200 hidden sm:block">/</span>
                </>
              )}
              <span className="font-medium text-zinc-900 truncate">{title}</span>
            </nav>
          </div>
          <div className="flex items-center gap-1">
            {eurHuf && (
              <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-500 mr-1">
                EUR/HUF&nbsp;<span className="text-zinc-800">{eurHuf}</span>
              </span>
            )}
            <NotificationsDropdown />
            <UserDropdown user={user} />
          </div>
        </>
      )}
    </header>
  );
}
