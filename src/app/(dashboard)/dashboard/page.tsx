import type { Metadata } from "next";
import Link from "next/link";
import {
  IconPlus,
  IconMail,
  IconFileInvoice,
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconChevronRight,
  IconChartBar,
  IconPlaneDeparture,
  IconCurrencyEuro,
  IconCalendarStats,
  IconUsersGroup,
} from "@tabler/icons-react";
import {
  addDays, differenceInCalendarDays, format,
  parseISO, startOfWeek, subMonths,
} from "date-fns";
import { hu } from "date-fns/locale";

import { createClient } from "@/lib/supabase/server";
import { MonthlyRevenueChart } from "@/components/dashboard/MonthlyRevenueChart";
import { DestinationsPieChart } from "@/components/dashboard/DestinationsPieChart";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TripStatus } from "@/types";
import type { MonthlyRevenueRow, DestinationStat } from "@/hooks/useReports";

export const metadata: Metadata = { title: "Irányítópult" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HU_MONTHS_SHORT = [
  "jan.", "feb.", "már.", "ápr.", "máj.", "jún.",
  "júl.", "aug.", "szep.", "okt.", "nov.", "dec.",
] as const;

function fmtEur(n: number) {
  return new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function trendPct(cur: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round((cur - prev) / prev * 100);
}

const TRIP_STATUS: Record<TripStatus, { label: string; variant: "muted" | "info" | "success" | "warning" | "default" | "destructive" }> = {
  planned:    { label: "Tervezett",   variant: "muted"       },
  advertised: { label: "Hirdetve",    variant: "info"        },
  full:       { label: "Telt ház",    variant: "success"     },
  ongoing:    { label: "Folyamatban", variant: "warning"     },
  completed:  { label: "Lezárt",      variant: "default"     },
  cancelled:  { label: "Törölve",     variant: "destructive" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase     = createClient();
  const today        = format(new Date(), "yyyy-MM-dd");
  const firstOfMonth = `${today.slice(0, 7)}-01`;
  const firstOfPrev  = format(subMonths(new Date(firstOfMonth), 1), "yyyy-MM-01");
  const endOfPrev    = format(new Date(new Date(firstOfMonth).getTime() - 1), "yyyy-MM-dd");
  const threeDays    = format(addDays(new Date(), 3), "yyyy-MM-dd");
  const sixtyDays    = format(addDays(new Date(), 60), "yyyy-MM-dd");
  const weekAgo      = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const yearStart    = format(subMonths(new Date(), 11), "yyyy-MM-01");
  const todayEnd     = `${today}T23:59:59`;

  const [
    { data: yearPays },
    { data: activeData },
    { count: totalClients },
    { count: newThisWeek },
    { data: nextTripData },
    { data: overdueItems },
    { data: soonDueItems },
    { data: expiringPass },
    { data: advertisedTrips },
    { data: upcomingTrips },
    { data: destBookings },
    { data: yearBookings },
  ] = await Promise.all([
    supabase.from("payments").select("amount,type,payment_date").gte("payment_date", firstOfPrev).order("payment_date"),
    supabase.from("bookings").select("status").is("deleted_at", null).not("status", "in", '("completed","cancelled")'),
    supabase.from("clients").select("*", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("clients").select("*", { count: "exact", head: true }).is("deleted_at", null).gte("created_at", weekAgo),
    supabase.from("trips").select("id,name,departure_date,max_capacity,current_bookings")
      .is("deleted_at", null).not("status", "in", '("completed","cancelled")')
      .gte("departure_date", today).order("departure_date").limit(1),
    supabase.from("bookings").select("id,booking_code,payment_deadline,client:clients(first_name,last_name)")
      .is("deleted_at", null).lt("payment_deadline", today)
      .not("status", "in", '("fully_paid","completed","cancelled")').order("payment_deadline").limit(6),
    supabase.from("bookings").select("id,booking_code,payment_deadline,client:clients(first_name,last_name)")
      .is("deleted_at", null).gte("payment_deadline", today).lte("payment_deadline", threeDays)
      .not("status", "in", '("fully_paid","completed","cancelled")').order("payment_deadline").limit(6),
    supabase.from("clients").select("id,first_name,last_name,passport_expiry")
      .is("deleted_at", null).gte("passport_expiry", today).lte("passport_expiry", sixtyDays).order("passport_expiry").limit(6),
    supabase.from("trips").select("id,name,max_capacity,current_bookings").eq("status", "advertised").is("deleted_at", null),
    supabase.from("trips").select("id,name,destination,departure_date,current_bookings,max_capacity,status")
      .is("deleted_at", null).not("status", "in", '("completed","cancelled")')
      .gte("departure_date", today).order("departure_date").limit(5),
    supabase.from("bookings").select("trip:trips!inner(destination)").is("deleted_at", null).not("status", "in", '("cancelled","interested")'),
    supabase.from("bookings").select("created_at").is("deleted_at", null).not("status", "in", '("cancelled","interested")').gte("created_at", yearStart),
  ]);

  // ── KPIs ─────────────────────────────────────────────────────────────────

  let cur = 0, prev = 0;
  for (const p of yearPays ?? []) {
    const d = p.payment_date.slice(0, 10);
    const a = p.type === "refund" ? -(p.amount as number) : (p.amount as number);
    if (d >= firstOfMonth) cur  += a;
    else if (d >= firstOfPrev && d <= endOfPrev) prev += a;
  }

  const trend        = trendPct(cur, prev);
  const activeCount  = (activeData ?? []).length;
  const awaitingCount = (activeData ?? []).filter((b) => b.status === "booked" || b.status === "deposit_paid").length;
  const nextTrip     = (nextTripData ?? [])[0] as { id: string; name: string; departure_date: string; max_capacity: number; current_bookings: number } | undefined;
  const nextDays     = nextTrip ? differenceInCalendarDays(parseISO(nextTrip.departure_date), new Date()) : null;
  const nextSpots    = nextTrip ? nextTrip.max_capacity - nextTrip.current_bookings : null;

  // ── Chart data ────────────────────────────────────────────────────────────

  const revMap: Record<string, number> = {};
  const bkgMap: Record<string, number> = {};
  for (let i = 11; i >= 0; i--) {
    const k = format(subMonths(new Date(), i), "yyyy-M");
    revMap[k] = 0; bkgMap[k] = 0;
  }
  for (const p of yearPays ?? []) {
    const d = new Date(p.payment_date as string);
    const k = `${d.getFullYear()}-${d.getMonth() + 1}`;
    if (k in revMap) revMap[k]! += p.type === "refund" ? -(p.amount as number) : (p.amount as number);
  }
  for (const b of yearBookings ?? []) {
    const d = new Date(b.created_at as string);
    const k = `${d.getFullYear()}-${d.getMonth() + 1}`;
    if (k in bkgMap) bkgMap[k]!++;
  }

  const chartData: MonthlyRevenueRow[] = Object.entries(revMap).map(([key, revenue]) => {
    const m = parseInt(key.split("-")[1] ?? "1", 10);
    return { month: m, monthLabel: HU_MONTHS_SHORT[m - 1]!, revenue: Math.round(revenue * 100) / 100, bookingCount: bkgMap[key] ?? 0 };
  });

  // ── Destinations ──────────────────────────────────────────────────────────

  const dCounts: Record<string, number> = {};
  for (const b of destBookings ?? []) {
    const d = (b.trip as unknown as { destination: string } | null)?.destination;
    if (d) dCounts[d] = (dCounts[d] ?? 0) + 1;
  }
  const totalDest = Object.values(dCounts).reduce((s, n) => s + n, 0);
  const destData: DestinationStat[] = Object.entries(dCounts).sort(([, a], [, b]) => b - a).slice(0, 5)
    .map(([destination, count]) => ({ destination, count, percentage: totalDest > 0 ? Math.round(count / totalDest * 100) : 0 }));

  // ── Low-cap trips ─────────────────────────────────────────────────────────

  const lowCap = (advertisedTrips ?? [])
    .filter((t) => { const tt = t as { max_capacity: number; current_bookings: number }; const s = tt.max_capacity - tt.current_bookings; return s >= 0 && s <= 3; })
    .slice(0, 5);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Havi bevétel"
          value={fmtEur(cur)}
          sub={prev > 0 ? `Előző: ${fmtEur(prev)}` : "Nincs előző havi adat"}
          trend={trend}
          accent="border-l-blue-500"
          iconBg="bg-blue-500/[0.08]"
          icon={<IconCurrencyEuro size={20} stroke={1.5} className="text-blue-500" />}
        />
        <KpiCard
          label="Aktív foglalások"
          value={activeCount.toLocaleString("hu-HU")}
          sub={awaitingCount > 0 ? `${awaitingCount} vár fizetésre` : "Minden rendben"}
          subWarn={awaitingCount > 0}
          accent="border-l-violet-500"
          iconBg="bg-violet-500/[0.08]"
          icon={<IconCalendarStats size={20} stroke={1.5} className="text-violet-500" />}
        />
        <KpiCard
          label="Következő utazás"
          value={nextTrip ? (nextTrip.name.length > 18 ? nextTrip.name.slice(0, 18) + "…" : nextTrip.name) : "—"}
          sub={nextDays !== null ? `${nextDays} nap · ${nextSpots} hely` : "Nincs közelgő utazás"}
          subDanger={(nextSpots ?? 99) < 3 && nextSpots !== null}
          accent="border-l-green-500"
          iconBg="bg-green-500/[0.08]"
          icon={<IconPlaneDeparture size={20} stroke={1.5} className="text-green-500" />}
        />
        <KpiCard
          label="Összes ügyfél"
          value={(totalClients ?? 0).toLocaleString("hu-HU")}
          sub={(newThisWeek ?? 0) > 0 ? `${newThisWeek} új a héten` : "Nincs új ügyfél a héten"}
          accent="border-l-orange-500"
          iconBg="bg-orange-500/[0.08]"
          icon={<IconUsersGroup size={20} stroke={1.5} className="text-orange-500" />}
        />
      </div>

      {/* ── Quick actions ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {[
          { href: "/clients/new",  icon: <IconPlus size={14} stroke={2} />,        label: "Új ügyfél"   },
          { href: "/bookings/new", icon: <IconPlus size={14} stroke={2} />,        label: "Új foglalás" },
          { href: "/trips/new",    icon: <IconPlus size={14} stroke={2} />,        label: "Új utazás"   },
          { href: "/emails/send",  icon: <IconMail size={14} stroke={1.5} />,      label: "Email"       },
          { href: "/invoices/new", icon: <IconFileInvoice size={14} stroke={1.5}/>,label: "Számla"      },
        ].map(({ href, icon, label }) => (
          <Link
            key={href}
            href={href}
            className="btn-interactive flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-[13px] font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
          >
            <span className="text-zinc-400">{icon}</span>
            {label}
          </Link>
        ))}
      </div>

      {/* ── Charts ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 rounded-md border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[14px] font-semibold text-zinc-900">Havi bevétel</h3>
              <p className="text-[12px] text-zinc-400 mt-0.5">Utolsó 12 hónap</p>
            </div>
            <Link href="/reports" className="text-[12px] text-blue-600 hover:underline">Riportok →</Link>
          </div>
          {chartData.some((d) => d.revenue > 0) ? (
            <MonthlyRevenueChart data={chartData} />
          ) : (
            <div className="flex h-[200px] flex-col items-center justify-center gap-2">
              <IconChartBar size={32} stroke={1} className="text-zinc-200" />
              <p className="text-[13px] text-zinc-400">Még nincs elég adat</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 rounded-md border border-zinc-200 bg-white p-5">
          <div className="mb-4">
            <h3 className="text-[14px] font-semibold text-zinc-900">Legnépszerűbb úticélok</h3>
            <p className="text-[12px] text-zinc-400 mt-0.5">Foglalások alapján</p>
          </div>
          {destData.length > 0 ? (
            <DestinationsPieChart data={destData} totalBookings={totalDest} />
          ) : (
            <div className="flex h-[200px] flex-col items-center justify-center gap-2">
              <IconChartBar size={32} stroke={1} className="text-zinc-200" />
              <p className="text-[13px] text-zinc-400">Nincs adat</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom panels ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ActionPanel
          overdue={(overdueItems ?? []) as BkRow[]}
          soonDue={(soonDueItems ?? []) as BkRow[]}
          passports={(expiringPass ?? []) as PassRow[]}
          lowCap={lowCap as CapRow[]}
        />
        <UpcomingPanel
          trips={(upcomingTrips ?? []) as TripRow[]}
        />
      </div>
    </div>
  );
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, trend, subWarn, subDanger, accent, iconBg, icon }: {
  label: string; value: string; sub: string;
  trend?: number | null; subWarn?: boolean; subDanger?: boolean;
  accent: string; iconBg: string; icon: React.ReactNode;
}) {
  return (
    <div className={cn(
      "card-hover rounded-md border border-zinc-200 bg-white p-5 border-l-4",
      accent
    )}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">{label}</p>
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-md", iconBg)}>
          {icon}
        </div>
      </div>
      <p className="text-[22px] font-semibold text-zinc-900 leading-none tabular-nums">{value}</p>
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span className={cn(
          "text-[12px]",
          subDanger ? "text-red-600 font-medium" :
          subWarn   ? "text-amber-600 font-medium" : "text-zinc-500"
        )}>
          {sub}
        </span>
        {trend != null && (
          <span className={cn(
            "inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold",
            trend > 0 ? "bg-green-50 text-green-700" : trend < 0 ? "bg-red-50 text-red-600" : "bg-zinc-100 text-zinc-500"
          )}>
            {trend > 0 ? <IconTrendingUp size={10} stroke={2} /> : trend < 0 ? <IconTrendingDown size={10} stroke={2} /> : <IconMinus size={10} stroke={2} />}
            {trend > 0 ? "+" : ""}{trend}%
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Action items ─────────────────────────────────────────────────────────────

type BkRow   = { id: string; booking_code: string; payment_deadline: string; client: unknown };
type PassRow = { id: string; first_name: string; last_name: string; passport_expiry: string };
type CapRow  = { id: string; name: string; max_capacity: number; current_bookings: number };

function ActionPanel({ overdue, soonDue, passports, lowCap }: {
  overdue: BkRow[]; soonDue: BkRow[]; passports: PassRow[]; lowCap: CapRow[];
}) {
  const hasAny = overdue.length + soonDue.length + passports.length + lowCap.length > 0;

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5">
      <h3 className="text-[14px] font-semibold text-zinc-900 mb-4">Teendők</h3>

      {!hasAny ? (
        <div className="flex h-24 flex-col items-center justify-center gap-1">
          <p className="text-[13px] font-medium text-zinc-500">Minden rendben</p>
          <p className="text-[12px] text-zinc-400">Nincs sürgős teendő</p>
        </div>
      ) : (
        <div className="space-y-4">
          {overdue.length > 0 && (
            <ActionSection label="AZONNALI">
              {overdue.map((b) => {
                const c = b.client as { first_name: string; last_name: string } | null;
                return <ActionRow key={b.id} dot="bg-red-500" text={`${c?.last_name ?? ""} ${c?.first_name ?? ""} — ${b.payment_deadline}`} href="/bookings" />;
              })}
            </ActionSection>
          )}
          {(soonDue.length > 0 || passports.length > 0) && (
            <ActionSection label="FIGYELMET IGÉNYEL">
              {soonDue.map((b) => {
                const c = b.client as { first_name: string; last_name: string } | null;
                return <ActionRow key={b.id} dot="bg-amber-400" text={`${c?.last_name ?? ""} ${c?.first_name ?? ""} — ${b.payment_deadline}`} href="/bookings" />;
              })}
              {passports.map((p) => {
                const d = differenceInCalendarDays(parseISO(p.passport_expiry), new Date());
                return <ActionRow key={p.id} dot="bg-amber-400" text={`${p.last_name} ${p.first_name} — útlevél: ${d} nap`} href="/clients" />;
              })}
            </ActionSection>
          )}
          {lowCap.length > 0 && (
            <ActionSection label="INFORMÁCIÓ">
              {lowCap.map((t) => {
                const tt = t as { id: string; name: string; max_capacity: number; current_bookings: number };
                return <ActionRow key={tt.id} dot="bg-blue-400" text={`${tt.name} — ${tt.max_capacity - tt.current_bookings} szabad hely`} href="/trips" />;
              })}
            </ActionSection>
          )}
        </div>
      )}

      <Link href="/notifications" className="mt-4 flex items-center gap-1 text-[12px] text-blue-600 hover:underline">
        Összes értesítés <IconChevronRight size={11} stroke={2} />
      </Link>
    </div>
  );
}

function ActionSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-micro text-zinc-400 uppercase tracking-[0.08em] mb-1.5">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function ActionRow({ dot, text, href }: { dot: string; text: string; href: string }) {
  return (
    <Link href={href} className="group flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-zinc-50 nav-item">
      <span className={cn("h-5 w-0.5 flex-shrink-0 rounded-full", dot)} />
      <span className="flex-1 text-[13px] text-zinc-700 truncate">{text}</span>
      <IconChevronRight size={12} stroke={2} className="text-zinc-300 opacity-0 group-hover:opacity-100 nav-item flex-shrink-0" />
    </Link>
  );
}

// ─── Upcoming trips ───────────────────────────────────────────────────────────

type TripRow = { id: string; name: string; destination: string; departure_date: string; current_bookings: number; max_capacity: number; status: string };

function UpcomingPanel({ trips }: { trips: TripRow[] }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5">
      <h3 className="text-[14px] font-semibold text-zinc-900 mb-4">Következő utazások</h3>

      {trips.length === 0 ? (
        <div className="flex h-24 flex-col items-center justify-center gap-1">
          <IconPlaneDeparture size={24} stroke={1} className="text-zinc-200" />
          <p className="text-[13px] text-zinc-400">Nincs közelgő utazás</p>
        </div>
      ) : (
        <div className="space-y-1">
          {trips.map((t) => {
            const pct      = t.max_capacity > 0 ? Math.round(t.current_bookings / t.max_capacity * 100) : 0;
            const days     = differenceInCalendarDays(parseISO(t.departure_date), new Date());
            const depLabel = format(parseISO(t.departure_date), "MMM d.", { locale: hu });
            const meta     = TRIP_STATUS[t.status as TripStatus] ?? TRIP_STATUS.planned;
            return (
              <Link key={t.id} href={`/trips/${t.id}`} className="group flex items-start gap-3 rounded-md p-2.5 nav-item hover:bg-zinc-50">
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-zinc-100 mt-0.5">
                  <IconPlaneDeparture size={13} stroke={1.5} className="text-zinc-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[13px] font-medium text-zinc-900 truncate">{t.name}</span>
                    <Badge variant={meta.variant} className="text-[10px] flex-shrink-0">{meta.label}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[12px] text-zinc-500">{depLabel}</span>
                    <span className="text-zinc-200">·</span>
                    <span className={cn("text-[12px]", days <= 7 ? "text-orange-600 font-medium" : "text-zinc-400")}>
                      {days === 0 ? "ma" : days === 1 ? "holnap" : `${days} nap`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={pct} className="h-1 flex-1" />
                    <span className="text-[11px] text-zinc-400 whitespace-nowrap">{t.current_bookings}/{t.max_capacity}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Link href="/trips" className="mt-4 flex items-center gap-1 text-[12px] text-blue-600 hover:underline">
        Összes utazás <IconChevronRight size={11} stroke={2} />
      </Link>
    </div>
  );
}
