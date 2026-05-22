"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, LayoutGrid, List, Search, X } from "lucide-react";
import { toast } from "sonner";

import { useTrips, type TripListParams } from "@/hooks/useTrips";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { TripCard, TripCardSkeleton } from "@/components/trips/TripCard";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { TripStatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Plane } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Trip, TripStatus } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 24;
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => CURRENT_YEAR - 2 + i);

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all",        label: "Összes státusz" },
  { value: "planned",    label: "Tervezett" },
  { value: "advertised", label: "Hirdetve" },
  { value: "full",       label: "Telített" },
  { value: "ongoing",    label: "Folyamatban" },
  { value: "completed",  label: "Lezárt" },
  { value: "cancelled",  label: "Törölve" },
];

// ─── Table column definitions ─────────────────────────────────────────────────

const TABLE_COLUMNS: Column<Trip>[] = [
  {
    key: "trip_code",
    header: "Kód",
    className: "font-mono text-xs text-zinc-500 w-28",
    render: (v) => String(v),
  },
  {
    key: "name",
    header: "Név",
    sortable: true,
    render: (_, row) => (
      <Link
        href={`/trips/${row.id}`}
        className="font-medium text-zinc-900 hover:text-blue-600 hover:underline"
      >
        {row.name}
      </Link>
    ),
  },
  {
    key: "departure_date",
    header: "Dátum",
    sortable: true,
    render: (_, row) => (
      <span className="text-zinc-600">
        {formatDate(row.departure_date)} – {formatDate(row.return_date)}
      </span>
    ),
  },
  {
    key: "current_bookings",
    header: "Kapacitás",
    sortable: true,
    className: "w-36",
    render: (_, row) => {
      const pct = row.max_capacity > 0 ? (row.current_bookings / row.max_capacity) * 100 : 0;
      return (
        <div className="flex items-center gap-2">
          <Progress value={pct} className="h-1.5 flex-1" />
          <span className="text-xs text-zinc-500 whitespace-nowrap">
            {row.current_bookings}/{row.max_capacity}
          </span>
        </div>
      );
    },
  },
  {
    key: "status",
    header: "Státusz",
    render: (v) => <TripStatusBadge status={v as TripStatus} />,
  },
  {
    key: "total_revenue",
    header: "Bevétel",
    sortable: true,
    className: "text-right",
    render: (v) => (
      <span className="font-medium">{formatCurrency(v as number)}</span>
    ),
  },
  {
    key: "id",
    header: "",
    className: "w-10 text-right",
    render: (_, row) => (
      <div className="flex items-center gap-1 justify-end">
        <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
          <Link href={`/trips/${row.id}`}>Részletek</Link>
        </Button>
      </div>
    ),
  },
];

// ─── View toggle ──────────────────────────────────────────────────────────────

type ViewMode = "card" | "table";

function getInitialView(): ViewMode {
  if (typeof window === "undefined") return "card";
  return (localStorage.getItem("trips-view") as ViewMode) ?? "card";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TripsPage() {
  const { getTrips, loading } = useTrips();
  const supabase = createClient();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ViewMode>(getInitialView);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filters
  const [destination, setDestination] = useState("");
  const [debouncedDestination, setDebouncedDestination] = useState("");
  const [status, setStatus] = useState("all");
  const [year, setYear] = useState(String(CURRENT_YEAR));

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedDestination(destination), 300);
    return () => clearTimeout(debounceRef.current);
  }, [destination]);

  useEffect(() => { setPage(1); }, [debouncedDestination, status, year]);

  // Realtime subscription — refresh list when any trip's capacity changes
  useEffect(() => {
    const channel = supabase
      .channel("trips-capacity-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trips" },
        () => setRefreshKey((k) => k + 1),
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params: TripListParams = {
      page,
      pageSize: PAGE_SIZE,
      destination: debouncedDestination || undefined,
      status: status !== "all" ? (status as TripStatus) : null,
      year: year !== "all" ? Number(year) : null,
      sortBy: "departure_date",
      sortDirection: "desc",
    };
    void getTrips(params).then((res) => {
      if (res) { setTrips(res.data); setCount(res.count); }
    });
  }, [page, debouncedDestination, status, year, refreshKey]);
  useEffect(() => {
    localStorage.setItem("trips-view", view);
  }, [view]);

  const showEmpty = !loading && trips.length === 0;

  return (
    <div>
      <PageHeader
        title="Utazások"
        subtitle={`${count.toLocaleString("hu-HU")} út összesen`}
        actions={
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href="/trips/new">
              <Plus className="mr-2 h-4 w-4" />
              Új utazás
            </Link>
          </Button>
        }
      />

      {/* Filter + view toggle bar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {/* Destination search */}
        <div className="relative min-w-[180px] max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Úti cél keresése…"
            className="pl-9 h-9"
          />
          {destination && (
            <button
              onClick={() => setDestination("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Year filter */}
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="h-9 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Minden év</SelectItem>
            {YEAR_OPTIONS.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* View toggle — pushed right */}
        <div className="ml-auto flex items-center rounded-md border border-zinc-200 p-0.5">
          {(["card", "table"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "flex h-7 w-8 items-center justify-center rounded transition-colors",
                view === v
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-400 hover:text-zinc-700"
              )}
              aria-label={v === "card" ? "Kártya nézet" : "Tábla nézet"}
            >
              {v === "card" ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {view === "card" ? (
        <>
          {loading ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <TripCardSkeleton key={i} />
              ))}
            </div>
          ) : showEmpty ? (
            <EmptyState
              icon={Plane}
              title="Nincs találat"
              description="Próbálj más szűrőket, vagy hozz létre új utazást."
              action={
                <Button asChild className="bg-blue-600 hover:bg-blue-700">
                  <Link href="/trips/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Új utazás
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {trips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          )}

          {/* Card view pagination */}
          {count > PAGE_SIZE && !loading && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Előző
              </Button>
              <span className="text-sm text-zinc-500">
                {page} / {Math.ceil(count / PAGE_SIZE)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= Math.ceil(count / PAGE_SIZE)}
                onClick={() => setPage((p) => p + 1)}
              >
                Következő
              </Button>
            </div>
          )}
        </>
      ) : (
        <DataTable<Trip>
          columns={TABLE_COLUMNS}
          data={trips}
          loading={loading}
          keyField="id"
          onSort={(key, dir) => {
            /* sort handled server-side via filter state */
            void getTrips({
              page,
              pageSize: PAGE_SIZE,
              destination: debouncedDestination || undefined,
              status: status !== "all" ? (status as TripStatus) : null,
              year: year !== "all" ? Number(year) : null,
              sortBy: key as TripListParams["sortBy"],
              sortDirection: dir,
            }).then((res) => {
              if (res) { setTrips(res.data); setCount(res.count); }
            });
          }}
          pagination={{
            page,
            pageSize: PAGE_SIZE,
            total: count,
            onPageChange: setPage,
          }}
          emptyTitle="Nincs találat"
          emptyDescription="Próbálj más szűrőket, vagy hozz létre új utazást."
          emptyIcon={Plane}
        />
      )}
    </div>
  );
}
