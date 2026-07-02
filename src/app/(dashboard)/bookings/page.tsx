"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Download,
  CalendarCheck,
  Clock,
  AlertCircle,
  TrendingUp,
  Eye,
  Trash2,
  MoreHorizontal,
  Search,
  X,
  Wallet,
} from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";
import { toast } from "sonner";

import { useBookings, type BookingListParams, type BookingRow, type PaymentResult } from "@/hooks/useBookings";
import { PaymentForm } from "@/components/bookings/PaymentForm";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsCard } from "@/components/shared/StatsCard";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { BookingStatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { BookingStatus, ClientSource, Trip } from "@/types";
import type { BookingStats } from "@/hooks/useBookings";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const SOURCE_LABELS: Record<ClientSource, string> = {
  messenger: "Messenger", website_form: "Weboldal",
  referral: "Ajánlás", other: "Egyéb",
};

// ─── Deadline cell ────────────────────────────────────────────────────────────

function DeadlineCell({ deadline }: { deadline: string | null }) {
  if (!deadline) return <span className="text-zinc-400">—</span>;
  const days = differenceInDays(parseISO(deadline), new Date());
  return (
    <span className={cn(
      "text-sm",
      days < 0    ? "text-red-600 font-bold" :
      days <= 3   ? "text-amber-600 font-medium" :
                    "text-zinc-700",
    )}>
      {formatDate(deadline)}
      {days < 0 && <span className="ml-1 text-xs font-normal">({Math.abs(days)} napja lejárt)</span>}
      {days >= 0 && days <= 3 && <span className="ml-1 text-xs font-normal">({days} nap)</span>}
    </span>
  );
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(rows: BookingRow[], paidByBooking: Record<string, number>) {
  const headers = ["Kód","Ügyfél","Utazás","Státusz","Alap ár","Kedvezmény","Végösszeg","Befizetett összeg","Fennmaradó összeg","Előleg fizetve","Határidő","Forrás","Létrehozva"];
  const data = rows.map((b) => {
    const paid = paidByBooking[b.id] ?? 0;
    const remaining = b.final_amount != null ? Math.max(b.final_amount - paid, 0) : "";
    return [
      b.booking_code,
      b.client ? `${b.client.last_name} ${b.client.first_name}` : "",
      b.trip?.name ?? "",
      b.status,
      String(b.base_amount ?? ""),
      String(b.discount_amount ?? ""),
      String(b.final_amount ?? ""),
      String(paid),
      String(remaining),
      b.deposit_paid_at ? "Igen" : "Nem",
      b.payment_deadline ?? "",
      b.source ? SOURCE_LABELS[b.source] : "",
      b.created_at.slice(0, 10),
    ];
  });
  const csv = "﻿" + [headers, ...data]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `foglalasok-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── Stats row ────────────────────────────────────────────────────────────────

function StatsRow({ stats }: { stats: BookingStats | null }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        {[0,1,2,3].map((i) => (
          <div key={i} className="rounded-md border border-zinc-200 p-5">
            <Skeleton className="h-4 w-24 mb-3" /><Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
      <StatsCard title="Aktív foglalások" value={stats.activeCount} icon={CalendarCheck} />
      <StatsCard title="Fizetésre vár" value={stats.awaitingPaymentCount} icon={Clock} />
      <StatsCard
        title="Lejárt határidő"
        value={stats.overdueCount}
        icon={AlertCircle}
        className={stats.overdueCount > 0 ? "border-red-200 bg-red-50/30" : ""}
      />
      <StatsCard title="Havi bevétel" value={formatCurrency(stats.currentMonthRevenue, "EUR")} icon={TrendingUp} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { getBookings, searchBookings, deleteBooking, getBookingStats, loading } = useBookings();

  const [bookings, setBookings]     = useState<BookingRow[]>([]);
  const [count, setCount]           = useState(0);
  const [page, setPage]             = useState(1);
  const [stats, setStats]           = useState<BookingStats | null>(null);
  const [trips, setTrips]           = useState<Pick<Trip, "id" | "name">[]>([]);
  const [exporting, setExporting]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BookingRow | null>(null);
  const [paymentTarget, setPaymentTarget]     = useState<BookingRow | null>(null);
  const [paymentRemaining, setPaymentRemaining] = useState(0);

  // Filters
  const [search, setSearch]               = useState("");
  const [debouncedSearch, setDebounced]   = useState("");
  const [status, setStatus]               = useState("all");
  const [tripFilter, setTripFilter]       = useState("all");
  const [source, setSource]               = useState("all");
  const [fromDate, setFromDate]           = useState("");
  const [toDate, setToDate]               = useState("");
  const [overdueOnly, setOverdueOnly]     = useState(false);

  const debRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    debRef.current = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(debRef.current);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, status, tripFilter, source, fromDate, toDate, overdueOnly]);

  useEffect(() => {
    const p: BookingListParams = {
      page, pageSize: PAGE_SIZE,
      search: debouncedSearch || undefined,
      status: status !== "all" ? (status as BookingStatus) : null,
      tripId: tripFilter !== "all" ? tripFilter : null,
      source: source !== "all" ? (source as ClientSource) : null,
      fromDate: fromDate || null,
      toDate: toDate || null,
      overdueOnly,
    };
    void getBookings(p).then((res) => {
      if (res) { setBookings(res.data); setCount(res.count); }
    });
  }, [page, debouncedSearch, status, tripFilter, source, fromDate, toDate, overdueOnly]);

  useEffect(() => {
    void getBookingStats().then((s) => { if (s) setStats(s); });
    // Fetch active trips for filter
    supabase.from("trips").select("id, name").is("deleted_at", null)
      .in("status", ["advertised", "ongoing", "planned"])
      .order("departure_date", { ascending: false })
      .then(({ data }) => setTrips(data ?? []));
  }, []);

  async function openQuickPayment(row: BookingRow) {
    setPaymentTarget(row);
    const { data } = await supabase
      .from("payments")
      .select("amount, type")
      .eq("booking_id", row.id);
    const totalPaid = (data ?? []).reduce(
      (s: number, p: { amount: number; type: string }) => (p.type === "refund" ? s - p.amount : s + p.amount),
      0,
    );
    const remaining = row.final_amount != null ? Math.max(row.final_amount - totalPaid, 0) : 0;
    setPaymentRemaining(remaining);
  }

  function handleQuickPaymentAdded(result: PaymentResult) {
    if (!paymentTarget) return;
    setBookings((prev) =>
      prev.map((b) =>
        b.id === paymentTarget.id
          ? {
              ...b,
              status: result.newStatus,
              deposit_paid_at: result.depositPaidAt ?? b.deposit_paid_at,
              fully_paid_at: result.fullyPaidAt ?? b.fully_paid_at,
            }
          : b,
      ),
    );
    setPaymentTarget(null);
    toast.success("Fizetés sikeresen rögzítve");
    void getBookingStats().then((s) => { if (s) setStats(s); });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const ok = await deleteBooking(deleteTarget.id);
    if (ok) {
      toast.success("Foglalás törölve");
      setBookings((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      setCount((n) => n - 1);
    } else toast.error("Hiba a törlés során");
    setDeleteTarget(null);
  }

  async function handleExport() {
    setExporting(true);
    const all = await searchBookings({
      status: status !== "all" ? (status as BookingStatus) : null,
      tripId: tripFilter !== "all" ? tripFilter : null,
      source: source !== "all" ? (source as ClientSource) : null,
      fromDate: fromDate || null,
      toDate: toDate || null,
      overdueOnly,
    });
    if (all && all.length > 0) {
      const { data: pays } = await supabase
        .from("payments")
        .select("booking_id, amount, type")
        .in("booking_id", all.map((b) => b.id));
      const paidByBooking: Record<string, number> = {};
      for (const p of (pays ?? []) as { booking_id: string; amount: number; type: string }[]) {
        paidByBooking[p.booking_id] = (paidByBooking[p.booking_id] ?? 0) +
          (p.type === "refund" ? -p.amount : p.amount);
      }
      exportCSV(all, paidByBooking);
    } else {
      toast.info("Nincs exportálható adat");
    }
    setExporting(false);
  }

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: Column<BookingRow>[] = [
    {
      key: "booking_code", header: "Kód",
      className: "font-mono text-xs text-zinc-500 w-28",
      render: (v) => String(v),
    },
    {
      key: "client", header: "Ügyfél",
      render: (_, row) => row.client ? (
        <Link href={`/clients/${row.client.id}`} className="font-medium text-zinc-900 hover:text-blue-600 hover:underline">
          {row.client.last_name} {row.client.first_name}
        </Link>
      ) : <span className="text-zinc-400">—</span>,
    },
    {
      key: "trip", header: "Utazás",
      render: (_, row) => row.trip ? (
        <Link href={`/trips/${row.trip.id}`} className="text-zinc-700 hover:text-blue-600 hover:underline">
          {row.trip.name}
        </Link>
      ) : <span className="text-zinc-400">—</span>,
    },
    {
      key: "status", header: "Státusz",
      render: (v) => <BookingStatusBadge status={v as BookingStatus} />,
    },
    {
      key: "final_amount", header: "Végösszeg", className: "text-right",
      render: (v) => <span className="font-medium">{formatCurrency(v as number | null, "EUR")}</span>,
    },
    {
      key: "deposit_paid_at", header: "Előleg",
      className: "text-center",
      render: (v) => v ? (
        <span className="text-green-600 font-bold">✓</span>
      ) : (
        <span className="text-red-400">✗</span>
      ),
    },
    {
      key: "payment_deadline", header: "Határidő",
      render: (v) => <DeadlineCell deadline={v as string | null} />,
    },
    {
      key: "source", header: "Forrás",
      render: (v) => v ? <Badge variant="muted">{SOURCE_LABELS[v as ClientSource]}</Badge> : <span className="text-zinc-400">—</span>,
    },
    {
      key: "id", header: "", className: "w-10 text-right",
      render: (_, row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => router.push(`/bookings/${row.id}`)}>
              <Eye className="mr-2 h-4 w-4" />Megtekint
            </DropdownMenuItem>
            {row.status !== "cancelled" && row.status !== "completed" && (
              <DropdownMenuItem onClick={() => void openQuickPayment(row)}>
                <Wallet className="mr-2 h-4 w-4" />Fizetés rögzítése
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
              onClick={() => setDeleteTarget(row)}
            >
              <Trash2 className="mr-2 h-4 w-4" />Töröl
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Foglalások"
        subtitle={`${count.toLocaleString("hu-HU")} foglalás összesen`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              <Download className="mr-2 h-4 w-4" />
              {exporting ? "Exportálás…" : "CSV"}
            </Button>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href="/bookings/new">
                <Plus className="mr-2 h-4 w-4" />Új foglalás
              </Link>
            </Button>
          </div>
        }
      />

      <StatsRow stats={stats} />

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Kód keresése…" className="pl-9 h-9" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Összes státusz</SelectItem>
            <SelectItem value="interested">Érdeklődő</SelectItem>
            <SelectItem value="booked">Foglalt</SelectItem>
            <SelectItem value="deposit_paid">Előleg fizetve</SelectItem>
            <SelectItem value="fully_paid">Kifizetve</SelectItem>
            <SelectItem value="completed">Teljesített</SelectItem>
            <SelectItem value="cancelled">Lemondva</SelectItem>
          </SelectContent>
        </Select>

        <Select value={tripFilter} onValueChange={setTripFilter}>
          <SelectTrigger className="h-9 w-48">
            <SelectValue placeholder="Összes utazás" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Összes utazás</SelectItem>
            {trips.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Összes forrás</SelectItem>
            <SelectItem value="messenger">Messenger</SelectItem>
            <SelectItem value="website_form">Weboldal</SelectItem>
            <SelectItem value="referral">Ajánlás</SelectItem>
            <SelectItem value="other">Egyéb</SelectItem>
          </SelectContent>
        </Select>

        <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
          className="h-9 w-36" placeholder="Tól" />
        <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
          className="h-9 w-36" placeholder="Ig" />

        <button
          onClick={() => setOverdueOnly((v) => !v)}
          className={cn(
            "flex h-9 items-center gap-2 rounded-md border px-3 text-sm transition-colors",
            overdueOnly
              ? "border-red-300 bg-red-50 text-red-700"
              : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50",
          )}
        >
          {overdueOnly && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
          )}
          Lejárt határidő
        </button>
      </div>

      <DataTable<BookingRow>
        columns={columns}
        data={bookings}
        loading={loading}
        keyField="id"
        pagination={{ page, pageSize: PAGE_SIZE, total: count, onPageChange: setPage }}
        emptyTitle="Nincs foglalás"
        emptyDescription="Hozz létre új foglalást az 'Új foglalás' gombbal."
        emptyIcon={CalendarCheck}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        variant="danger"
        title="Foglalás törlése"
        description={deleteTarget ? `Biztosan törlöd a(z) ${deleteTarget.booking_code} foglalást?` : ""}
        confirmLabel="Törlés"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {paymentTarget && (
        <PaymentForm
          open={!!paymentTarget}
          bookingId={paymentTarget.id}
          remainingBalance={paymentRemaining}
          onSuccess={handleQuickPaymentAdded}
          onCancel={() => setPaymentTarget(null)}
        />
      )}
    </div>
  );
}
