"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, type TooltipProps,
} from "recharts";
import {
  Download, Loader2, TrendingUp, TrendingDown,
  CalendarRange, Map, BarChart2,
} from "lucide-react";
import { format, subMonths, startOfYear, endOfYear } from "date-fns";
import { toast } from "sonner";

import { useReports } from "@/hooks/useReports";
import type {
  RevenueCostsRow, TripProfitRow, ClientStatsData,
  TopClient, OccupancyRow, SeasonalRow, SummaryStats,
} from "@/hooks/useReports";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { TripStatus } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = {
  revenue: "#3b82f6",
  costs:   "#f87171",
  profit:  "#10b981",
  clients: "#8b5cf6",
};

const SOURCE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899"] as const;
const DESTINATION_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"] as const;

const YEAR_NOW = new Date().getFullYear();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtEur(n: number): string {
  return new Intl.NumberFormat("de-AT", {
    style: "currency", currency: "EUR", maximumFractionDigits: 0,
  }).format(n);
}

function Placeholder() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

// ─── Date range quick-select ──────────────────────────────────────────────────

const QUICK_RANGES = [
  { label: "Ezen a héten",    key: "week" },
  { label: "Ezen a hónapban", key: "month" },
  { label: "Idén",            key: "year" },
  { label: "Egyéni",          key: "custom" },
] as const;

type QuickRange = (typeof QUICK_RANGES)[number]["key"];

function getRange(quick: QuickRange, customFrom: string, customTo: string): { from: string; to: string } {
  const today = format(new Date(), "yyyy-MM-dd");
  const y = new Date().getFullYear();
  const m = new Date().getMonth() + 1;
  if (quick === "week") {
    const d = new Date();
    const day = d.getDay() === 0 ? 6 : d.getDay() - 1; // Mon=0
    const mon = new Date(d);
    mon.setDate(d.getDate() - day);
    return { from: format(mon, "yyyy-MM-dd"), to: today };
  }
  if (quick === "month") {
    return { from: `${y}-${String(m).padStart(2, "0")}-01`, to: today };
  }
  if (quick === "year") {
    return { from: `${y}-01-01`, to: today };
  }
  return { from: customFrom, to: customTo };
}

// ─── Shared chart tooltips ────────────────────────────────────────────────────

function RevenueTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 shadow-sm text-xs space-y-1">
      <p className="font-semibold text-zinc-900">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {fmtEur(p.value as number)}
        </p>
      ))}
    </div>
  );
}

// ─── Tab 1: Financial report ──────────────────────────────────────────────────

function FinancialTab() {
  const { getRevenueVsCosts, getSummaryStats, getTripProfitability } = useReports();

  const [quick, setQuick]       = useState<QuickRange>("year");
  const [customFrom, setCustomFrom] = useState(format(subMonths(new Date(), 3), "yyyy-MM-dd"));
  const [customTo, setCustomTo]     = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading]   = useState(true);
  const [stats, setStats]       = useState<SummaryStats | null>(null);
  const [revenue, setRevenue]   = useState<RevenueCostsRow[]>([]);
  const [trips, setTrips]       = useState<TripProfitRow[]>([]);
  const [sortKey, setSortKey]   = useState<keyof TripProfitRow>("profit");
  const [sortDir, setSortDir]   = useState<"asc" | "desc">("desc");

  const { from, to } = getRange(quick, customFrom, customTo);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, r, t] = await Promise.all([
      getSummaryStats(from, to),
      getRevenueVsCosts(from, to),
      getTripProfitability(from, to),
    ]);
    if (s) setStats(s);
    setRevenue(r ?? []);
    setTrips(t ?? []);
    setLoading(false);
  }, [from, to]);

  useEffect(() => { void load(); }, [load]);

  function toggleSort(key: keyof TripProfitRow) {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const sortedTrips = [...trips].sort((a, b) => {
    const av = a[sortKey] as number | string;
    const bv = b[sortKey] as number | string;
    const cmp = typeof av === "string" ? av.localeCompare(String(bv)) : (av as number) - (bv as number);
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <div className="space-y-6">
      {/* Date range selector */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-zinc-200 p-0.5">
          {QUICK_RANGES.map(({ label, key }) => (
            <button
              key={key}
              onClick={() => setQuick(key)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded transition-colors",
                quick === key ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {quick === "custom" && (
          <>
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-8 w-36 text-sm" />
            <span className="text-zinc-400 text-sm">–</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} min={customFrom} className="h-8 w-36 text-sm" />
          </>
        )}
      </div>

      {loading ? <Placeholder /> : (
        <>
          {/* Summary KPI cards */}
          {stats && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                { label: "Bevétel",          value: fmtEur(stats.totalRevenue),    color: "text-blue-600" },
                { label: "Kiadás",           value: fmtEur(stats.totalCosts),      color: "text-red-500" },
                { label: "Nyereség",         value: fmtEur(stats.profit),          color: stats.profit >= 0 ? "text-green-600" : "text-red-500" },
                { label: "Átlag fogl. érték", value: fmtEur(stats.avgBookingValue), color: "text-zinc-700" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-md border border-zinc-200 bg-white p-4">
                  <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">{label}</p>
                  <p className={cn("text-xl font-bold", color)}>{value}</p>
                  {label === "Nyereség" && stats.totalRevenue > 0 && (
                    <p className="text-xs text-zinc-400 mt-1">
                      {(stats.profit / stats.totalRevenue * 100).toFixed(1)}% margó
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Revenue vs Costs line chart */}
          {revenue.length > 0 && (
            <div className="rounded-md border border-zinc-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-zinc-900 mb-4">Bevétel vs. kiadás</h3>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={revenue} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.revenue} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={CHART_COLORS.revenue} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.costs} stopOpacity={0.12} />
                      <stop offset="95%" stopColor={CHART_COLORS.costs} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f4f4f5" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} width={48} />
                  <Tooltip content={<RevenueTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
                  <Area type="monotone" dataKey="revenue" name="Bevétel" stroke={CHART_COLORS.revenue} fill="url(#gradRev)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="costs"   name="Kiadás"  stroke={CHART_COLORS.costs}   fill="url(#gradCost)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Trip profitability table */}
          {sortedTrips.length > 0 && (
            <div className="rounded-md border border-zinc-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-200">
                <h3 className="text-sm font-semibold text-zinc-900">Utazások nyereségessége</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Utazás</th>
                    <SortHead label="Bevétel"   k="revenue"  current={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortHead label="Kiadás"    k="costs"    current={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortHead label="Nyereség"  k="profit"   current={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortHead label="Margó"     k="margin"   current={sortKey} dir={sortDir} onSort={toggleSort} />
                    <SortHead label="Telít."    k="occupancy" current={sortKey} dir={sortDir} onSort={toggleSort} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {sortedTrips.map((t) => (
                    <tr key={t.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <Link href={`/trips/${t.id}`} className="font-medium text-zinc-900 hover:text-blue-600 hover:underline">
                          {t.name}
                        </Link>
                        <p className="text-xs text-zinc-400">{t.destination}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-700">{fmtEur(t.revenue)}</td>
                      <td className="px-4 py-3 text-right text-zinc-700">{fmtEur(t.costs)}</td>
                      <td className={cn("px-4 py-3 text-right font-medium", t.profit >= 0 ? "text-green-600" : "text-red-500")}>
                        {fmtEur(t.profit)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn(
                          "text-xs font-semibold px-1.5 py-0.5 rounded",
                          t.margin >= 30 ? "bg-green-100 text-green-700"
                            : t.margin >= 10 ? "bg-amber-100 text-amber-700"
                            : t.margin >= 0 ? "bg-zinc-100 text-zinc-600"
                            : "bg-red-100 text-red-600"
                        )}>
                          {t.margin.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Progress value={t.occupancy} className="h-1.5 w-16" />
                          <span className="text-xs text-zinc-500 whitespace-nowrap">
                            {t.currentBookings}/{t.maxCapacity}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Tab 2: Client report ─────────────────────────────────────────────────────

function ClientTab() {
  const { getClientStats, getTopClients } = useReports();

  const [loading, setLoading]     = useState(true);
  const [stats, setStats]         = useState<ClientStatsData | null>(null);
  const [topClients, setTopClients] = useState<TopClient[]>([]);
  const [quick, setQuick]         = useState<QuickRange>("year");
  const [customFrom, setCustomFrom] = useState(format(subMonths(new Date(), 12), "yyyy-MM-dd"));
  const [customTo, setCustomTo]     = useState(format(new Date(), "yyyy-MM-dd"));

  const { from, to } = getRange(quick, customFrom, customTo);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, t] = await Promise.all([getClientStats(from, to), getTopClients(10)]);
    if (s) setStats(s);
    setTopClients(t ?? []);
    setLoading(false);
  }, [from, to]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-zinc-200 p-0.5">
          {QUICK_RANGES.map(({ label, key }) => (
            <button key={key} onClick={() => setQuick(key)}
              className={cn("px-3 py-1.5 text-xs font-medium rounded transition-colors",
                quick === key ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900"
              )}>
              {label}
            </button>
          ))}
        </div>
        {quick === "custom" && (
          <>
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-8 w-36 text-sm" />
            <span className="text-zinc-400 text-sm">–</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} min={customFrom} className="h-8 w-36 text-sm" />
          </>
        )}
      </div>

      {loading ? <Placeholder /> : stats && (
        <>
          {/* Retention metric */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <div className="rounded-md border border-zinc-200 bg-white p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Új ügyfelek</p>
              <p className="text-2xl font-bold text-zinc-900">{stats.totalNew}</p>
              <p className="text-xs text-zinc-400 mt-1">a kiválasztott periódusban</p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-white p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Összes aktív ügyfél</p>
              <p className="text-2xl font-bold text-zinc-900">{stats.totalActive}</p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-white p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Visszatérő ügyfelek</p>
              <p className="text-2xl font-bold text-purple-600">{stats.retentionRate}%</p>
              <p className="text-xs text-zinc-400 mt-1">egynél több utazással</p>
            </div>
          </div>

          {/* New clients per month bar chart */}
          <div className="rounded-md border border-zinc-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-zinc-900 mb-4">Új ügyfelek havonta</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.newByMonth} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f4f4f5" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 shadow-sm text-xs">
                        <p className="font-semibold text-zinc-900">{label}</p>
                        <p style={{ color: CHART_COLORS.clients }}>{payload[0]?.value} új ügyfél</p>
                      </div>
                    );
                  }}
                  cursor={{ fill: "#f8fafc" }}
                />
                <Bar dataKey="count" name="Új ügyfél" fill={CHART_COLORS.clients} radius={[3, 3, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Source donut */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-zinc-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-zinc-900 mb-4">Ügyfélszerzés forrása</h3>
              <div className="relative">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={stats.sourceBreakdown}
                      dataKey="count"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={75}
                      paddingAngle={2}
                      startAngle={90}
                      endAngle={-270}
                    >
                      {stats.sourceBreakdown.map((_, i) => (
                        <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} stroke="white" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]!.payload as { label: string; count: number; percentage: number };
                        return (
                          <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 shadow-sm text-xs">
                            <p className="font-semibold text-zinc-900">{d.label}</p>
                            <p className="text-zinc-600">{d.count} ügyfél · {d.percentage}%</p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-bold text-zinc-900">{stats.totalActive}</span>
                  <span className="text-[10px] text-zinc-400">ügyfél</span>
                </div>
              </div>
              <div className="mt-2 space-y-1.5">
                {stats.sourceBreakdown.map((s, i) => (
                  <div key={s.source} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ backgroundColor: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                    <span className="flex-1 text-xs text-zinc-700">{s.label}</span>
                    <span className="text-xs font-medium text-zinc-500">{s.count} ({s.percentage}%)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 10 clients */}
            <div className="rounded-md border border-zinc-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-200">
                <h3 className="text-sm font-semibold text-zinc-900">Top 10 ügyfél</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-xs font-medium text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Ügyfél</th>
                    <th className="px-3 py-2 text-right">Utak</th>
                    <th className="px-3 py-2 text-right">Összes költ.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {topClients.map((c, i) => (
                    <tr key={c.id} className="hover:bg-zinc-50">
                      <td className="px-3 py-2 text-zinc-400 text-xs">{i + 1}</td>
                      <td className="px-3 py-2">
                        <Link href={`/clients/${c.id}`} className="font-medium text-zinc-900 hover:text-blue-600 hover:underline text-xs">
                          {c.last_name} {c.first_name}
                        </Link>
                        {c.is_vip && <Badge variant="warning" className="ml-1 text-[9px] px-1">VIP</Badge>}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-zinc-600">{c.trip_count}</td>
                      <td className="px-3 py-2 text-right text-xs font-semibold text-zinc-900">
                        {fmtEur(c.total_spent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab 3: Trip report ───────────────────────────────────────────────────────

function TripTab() {
  const { getOccupancyRates, getSeasonalAnalysis, getDestinationStats } = useReports();

  const [loading, setLoading]       = useState(true);
  const [occupancy, setOccupancy]   = useState<OccupancyRow[]>([]);
  const [seasonal, setSeasonal]     = useState<SeasonalRow[]>([]);
  const [dests, setDests]           = useState<{ destination: string; count: number; percentage: number }[]>([]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const [occ, sea, ds] = await Promise.all([
        getOccupancyRates(),
        getSeasonalAnalysis(),
        getDestinationStats(),
      ]);
      setOccupancy(occ ?? []);
      setSeasonal(sea ?? []);
      setDests(ds ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <Placeholder />;

  return (
    <div className="space-y-6">
      {/* Occupancy horizontal bar chart */}
      <div className="rounded-md border border-zinc-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-zinc-900 mb-4">Utazások telítettsége</h3>
        <div className="space-y-3">
          {occupancy.map((t) => (
            <div key={t.id}>
              <div className="flex items-center justify-between mb-1">
                <Link href={`/trips/${t.id}`} className="text-sm text-zinc-900 hover:text-blue-600 hover:underline truncate max-w-xs">
                  {t.name}
                </Link>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className="text-xs text-zinc-500">{t.current_bookings}/{t.max_capacity}</span>
                  <span className={cn(
                    "text-xs font-semibold",
                    t.occupancy >= 90 ? "text-green-600" : t.occupancy >= 60 ? "text-amber-600" : "text-zinc-500"
                  )}>
                    {t.occupancy}%
                  </span>
                </div>
              </div>
              <Progress
                value={t.occupancy}
                className="h-2"
              />
            </div>
          ))}
          {occupancy.length === 0 && (
            <p className="text-sm text-zinc-400 text-center py-6">Nincs adat</p>
          )}
        </div>
      </div>

      {/* Seasonal analysis + destinations side by side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Seasonal: bookings by departure month */}
        <div className="rounded-md border border-zinc-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-zinc-900 mb-4">Szezonális elemzés</h3>
          <p className="text-xs text-zinc-400 mb-3">Foglalások indulási hónaponként</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={seasonal} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="0" vertical={false} stroke="#f4f4f5" />
              <XAxis dataKey="monthLabel" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 shadow-sm text-xs">
                      <p className="font-semibold text-zinc-900">{label}</p>
                      <p className="text-blue-600">{payload[0]?.value} foglalás</p>
                    </div>
                  );
                }}
                cursor={{ fill: "#f8fafc" }}
              />
              <Bar dataKey="bookings" fill={CHART_COLORS.revenue} radius={[3, 3, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Most popular destinations */}
        <div className="rounded-md border border-zinc-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-zinc-900 mb-4">Legnépszerűbb úticélok</h3>
          <div className="relative">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={dests} dataKey="count" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2} startAngle={90} endAngle={-270}>
                  {dests.map((_, i) => <Cell key={i} fill={DESTINATION_COLORS[i % DESTINATION_COLORS.length]} stroke="white" strokeWidth={2} />)}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]!.payload as { destination: string; count: number; percentage: number };
                    return (
                      <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 shadow-sm text-xs">
                        <p className="font-semibold">{d.destination}</p>
                        <p className="text-zinc-600">{d.count} foglalás · {d.percentage}%</p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1.5">
            {dests.map((d, i) => (
              <div key={d.destination} className="flex items-center gap-2">
                <span className="h-2 w-2 flex-shrink-0 rounded-sm" style={{ backgroundColor: DESTINATION_COLORS[i % DESTINATION_COLORS.length] }} />
                <span className="flex-1 text-xs text-zinc-700 truncate">{d.destination}</span>
                <span className="text-xs text-zinc-500">{d.count} ({d.percentage}%)</span>
              </div>
            ))}
            {dests.length === 0 && <p className="text-xs text-zinc-400 text-center py-2">Nincs adat</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 4: Export ────────────────────────────────────────────────────────────

function ExportTab() {
  const { exportClientsCSV, exportBookingsCSV, exportRevenueCSV, generatePDFReport } = useReports();

  const [busy, setBusy]   = useState<string | null>(null);
  const [from, setFrom]   = useState(format(startOfYear(new Date()), "yyyy-MM-dd"));
  const [to, setTo]       = useState(format(endOfYear(new Date()), "yyyy-MM-dd"));

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
      toast.success("Letöltés elindítva");
    } catch {
      toast.error("Hiba a letöltés során");
    } finally {
      setBusy(null);
    }
  }

  const exports = [
    {
      key:   "clients",
      title: "Ügyfelek listája",
      desc:  "Minden ügyfél adatai – kód, név, email, utak, VIP",
      format: "CSV",
      fn:    () => exportClientsCSV(),
    },
    {
      key:   "bookings",
      title: "Foglalások",
      desc:  "Dátumra szűrt foglalások – ügyfél, utazás, összeg, státusz",
      format: "CSV",
      fn:    () => exportBookingsCSV(from, to),
    },
    {
      key:   "revenue",
      title: "Bevételek",
      desc:  "Befizetések tételes listája – dátum, összeg, típus, ügyfél",
      format: "CSV",
      fn:    () => exportRevenueCSV(from, to),
    },
    {
      key:   "pdf",
      title: "Teljes pénzügyi riport",
      desc:  "PDF – bevétel/kiadás, utazások nyereségesége, top ügyfelek",
      format: "PDF",
      fn:    () => generatePDFReport(from, to),
    },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Date range for filtered exports */}
      <div className="rounded-md border border-zinc-200 bg-white p-5 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-900">Dátum szűrő (foglalások és bevételek exporthoz)</h3>
        <div className="flex items-center gap-3">
          <div className="space-y-1 flex-1">
            <label className="text-xs text-zinc-500">Kezdő dátum</label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1 flex-1">
            <label className="text-xs text-zinc-500">Záró dátum</label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} min={from} className="h-9" />
          </div>
        </div>
      </div>

      {/* Export options */}
      <div className="space-y-3">
        {exports.map(({ key, title, desc, format: fmt, fn }) => (
          <div key={key} className="flex items-center justify-between rounded-md border border-zinc-200 bg-white p-4 gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-medium text-zinc-900">{title}</span>
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded",
                  fmt === "PDF" ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"
                )}>
                  {fmt}
                </span>
              </div>
              <p className="text-xs text-zinc-500">{desc}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={!!busy}
              onClick={() => run(key, fn)}
              className="flex-shrink-0 h-8"
            >
              {busy === key
                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                : <Download className="mr-1.5 h-3.5 w-3.5" />}
              Letöltés
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Shared sort header ───────────────────────────────────────────────────────

function SortHead<T>({
  label, k, current, dir, onSort,
}: {
  label: string;
  k: keyof T;
  current: keyof T;
  dir: "asc" | "desc";
  onSort: (k: keyof T) => void;
}) {
  const active = current === k;
  return (
    <th
      className="px-4 py-3 text-right cursor-pointer select-none hover:text-zinc-900 transition-colors"
      onClick={() => onSort(k)}
    >
      <span className="flex items-center justify-end gap-1">
        {label}
        {active && (dir === "desc" ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />)}
      </span>
    </th>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Riportok</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Pénzügyek, ügyfelek és utazások elemzése</p>
        </div>
        <Link href="/reports/roadmap">
          <Button variant="outline" size="sm">
            <CalendarRange className="mr-2 h-4 w-4" />
            Naptár nézet
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="financial">
        <TabsList className="mb-6">
          <TabsTrigger value="financial">
            <BarChart2 className="mr-1.5 h-3.5 w-3.5" />
            Pénzügyi riport
          </TabsTrigger>
          <TabsTrigger value="clients">
            <TrendingUp className="mr-1.5 h-3.5 w-3.5" />
            Ügyfél riport
          </TabsTrigger>
          <TabsTrigger value="trips">
            <Map className="mr-1.5 h-3.5 w-3.5" />
            Utazás riport
          </TabsTrigger>
          <TabsTrigger value="export">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export
          </TabsTrigger>
        </TabsList>

        <TabsContent value="financial"><FinancialTab /></TabsContent>
        <TabsContent value="clients"><ClientTab /></TabsContent>
        <TabsContent value="trips"><TripTab /></TabsContent>
        <TabsContent value="export"><ExportTab /></TabsContent>
      </Tabs>
    </div>
  );
}
