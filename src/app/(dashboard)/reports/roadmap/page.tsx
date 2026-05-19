"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, Plus,
  ZoomIn, ZoomOut, ArrowLeft,
} from "lucide-react";
import { addDays, differenceInCalendarDays, format, getDaysInMonth, isToday, parseISO } from "date-fns";
import { hu } from "date-fns/locale";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { TripStatus } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

type ZoomLevel = "3months" | "6months" | "12months";

const ZOOM_CONFIG: Record<ZoomLevel, { label: string; months: number; pxPerDay: number }> = {
  "3months":  { label: "3 hónap",   months:  3, pxPerDay: 14 },
  "6months":  { label: "6 hónap",   months:  6, pxPerDay:  7 },
  "12months": { label: "12 hónap",  months: 12, pxPerDay:  3.5 },
};

const ZOOM_ORDER: ZoomLevel[] = ["3months", "6months", "12months"];

const MONTH_LABELS = [
  "Január","Február","Március","Április","Május","Június",
  "Július","Augusztus","Szeptember","Október","November","December",
] as const;

const MONTH_SHORT = [
  "jan","feb","már","ápr","máj","jún",
  "júl","aug","szep","okt","nov","dec",
] as const;

const STATUS_STYLE: Record<TripStatus, { bg: string; text: string; border: string; strikethrough?: boolean }> = {
  planned:    { bg: "bg-zinc-200",       text: "text-zinc-700",  border: "border-zinc-300" },
  advertised: { bg: "bg-blue-100",       text: "text-blue-900",  border: "border-blue-400" },
  full:       { bg: "bg-green-100",      text: "text-green-900", border: "border-green-500" },
  ongoing:    { bg: "bg-orange-100",     text: "text-orange-900",border: "border-orange-500" },
  completed:  { bg: "bg-zinc-100",       text: "text-zinc-400",  border: "border-zinc-200" },
  cancelled:  { bg: "bg-red-100",        text: "text-red-400",   border: "border-red-200",  strikethrough: true },
};

const STATUS_LABELS: Record<TripStatus, string> = {
  planned:    "Tervezett",
  advertised: "Hirdetve",
  full:       "Telt ház",
  ongoing:    "Folyamatban",
  completed:  "Lezárt",
  cancelled:  "Törölve",
};

const ROW_H = 48;    // px per trip row
const HEADER_H = 56; // px for month/day header
const GUTTER = 8;    // px gap between rows
const MIN_BAR_W = 12; // minimum bar width px

// ─── Types ────────────────────────────────────────────────────────────────────

interface TripRow {
  id: string;
  name: string;
  destination: string;
  departure_date: string;
  return_date: string;
  status: TripStatus;
  current_bookings: number;
  max_capacity: number;
}

interface Tooltip {
  trip: TripRow;
  x: number;
  y: number;
}

// ─── Date math helpers ────────────────────────────────────────────────────────

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  return Math.ceil((date.getTime() - start.getTime()) / 86400000) + 1;
}

function daysInYear(year: number): number {
  return new Date(year, 1, 29).getDate() === 29 ? 366 : 365;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RoadmapPage() {
  const router = useRouter();
  const supabase = createClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const todayRef     = useRef<HTMLDivElement>(null);

  const [year, setYear]     = useState(new Date().getFullYear());
  const [zoom, setZoom]     = useState<ZoomLevel>("12months");
  const [trips, setTrips]   = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const { pxPerDay } = ZOOM_CONFIG[zoom];
  const totalDays    = daysInYear(year);
  const totalWidth   = totalDays * pxPerDay;

  // Month layout: [{month (0-11), startDay (1-based), days}]
  const monthLayout = Array.from({ length: 12 }, (_, m) => {
    const d = getDaysInMonth(new Date(year, m));
    const start = new Date(year, m, 1);
    return { month: m, startDay: dayOfYear(start), days: d, label: MONTH_LABELS[m]!, short: MONTH_SHORT[m]! };
  });

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadTrips = useCallback(async () => {
    setLoading(true);
    const start = `${year}-01-01`;
    const end   = `${year}-12-31`;

    const { data, error } = await supabase
      .from("trips")
      .select("id,name,destination,departure_date,return_date,status,current_bookings,max_capacity")
      .is("deleted_at", null)
      .or(`departure_date.lte.${end},return_date.gte.${start}`)
      .order("departure_date");

    if (error) { toast.error("Hiba az utazások betöltésekor"); }
    setTrips((data ?? []) as TripRow[]);
    setLoading(false);
  }, [year]);

  useEffect(() => { void loadTrips(); }, [loadTrips]);

  // Scroll today into view when loaded
  useEffect(() => {
    if (!loading && year === new Date().getFullYear() && todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [loading, year]);

  // ── Coordinate helpers ──────────────────────────────────────────────────────
  function tripLeft(dep: string): number {
    const depDate = parseISO(dep);
    // Clamp to year boundaries
    const clampedDep = depDate.getFullYear() < year
      ? new Date(year, 0, 1)
      : depDate;
    return (dayOfYear(clampedDep) - 1) * pxPerDay;
  }

  function tripWidth(dep: string, ret: string): number {
    const depDate  = parseISO(dep);
    const retDate  = parseISO(ret);
    const yearStart = new Date(year, 0, 1);
    const yearEnd   = new Date(year, 11, 31);
    const clampedDep = depDate < yearStart ? yearStart : depDate;
    const clampedRet = retDate > yearEnd   ? yearEnd   : retDate;
    const days = differenceInCalendarDays(clampedRet, clampedDep) + 1;
    return Math.max(days * pxPerDay, MIN_BAR_W);
  }

  // Today marker
  const todayDate   = new Date();
  const todayLeft   = year === todayDate.getFullYear()
    ? (dayOfYear(todayDate) - 1) * pxPerDay
    : null;

  // ── Zoom controls ───────────────────────────────────────────────────────────
  function zoomIn() {
    const i = ZOOM_ORDER.indexOf(zoom);
    if (i > 0) setZoom(ZOOM_ORDER[i - 1]!);
  }
  function zoomOut() {
    const i = ZOOM_ORDER.indexOf(zoom);
    if (i < ZOOM_ORDER.length - 1) setZoom(ZOOM_ORDER[i + 1]!);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const canvasH = HEADER_H + trips.length * (ROW_H + GUTTER) + GUTTER;

  return (
    <div className="flex flex-col h-full">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="h-8 -ml-2">
            <Link href="/reports">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Vissza
            </Link>
          </Button>
          <span className="text-zinc-300">|</span>
          <h2 className="text-base font-semibold text-zinc-900">Naptár nézet</h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Year selector */}
          <div className="flex items-center rounded-md border border-zinc-200">
            <button
              onClick={() => setYear((y) => y - 1)}
              className="flex h-8 w-8 items-center justify-center text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[52px] text-center text-sm font-semibold text-zinc-900">{year}</span>
            <button
              onClick={() => setYear((y) => y + 1)}
              className="flex h-8 w-8 items-center justify-center text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Zoom */}
          <div className="flex items-center rounded-md border border-zinc-200 p-0.5">
            {ZOOM_ORDER.map((z) => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded transition-colors",
                  zoom === z ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900"
                )}
              >
                {ZOOM_CONFIG[z].label}
              </button>
            ))}
          </div>

          <Button className="h-8 bg-blue-600 hover:bg-blue-700" size="sm" asChild>
            <Link href="/trips/new">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Új utazás
            </Link>
          </Button>
        </div>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {(Object.entries(STATUS_STYLE) as [TripStatus, typeof STATUS_STYLE[TripStatus]][]).map(([status, style]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={cn("h-3 w-5 rounded-sm border", style.bg, style.border)} />
            <span className="text-xs text-zinc-500">{STATUS_LABELS[status]}</span>
          </div>
        ))}
      </div>

      {/* ── Timeline ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-auto rounded-md border border-zinc-200 bg-white">
          <div
            ref={containerRef}
            className="relative"
            style={{ width: totalWidth + 4, minHeight: canvasH }}
          >
            {/* ── Month headers ─────────────────────────────────────────── */}
            <div
              className="sticky top-0 z-20 bg-white border-b border-zinc-200"
              style={{ height: HEADER_H, width: totalWidth }}
            >
              {monthLayout.map(({ month, startDay, days, label, short }) => {
                const left = (startDay - 1) * pxPerDay;
                const width = days * pxPerDay;
                const showFull = width >= 60;

                return (
                  <div
                    key={month}
                    className="absolute top-0 bottom-0 border-r border-zinc-100 flex flex-col justify-end pb-1"
                    style={{ left, width }}
                  >
                    {/* Month background stripe (alternating) */}
                    {month % 2 === 0 && (
                      <div className="absolute inset-0 bg-zinc-50/50" />
                    )}

                    {/* Month label */}
                    <div className="relative px-2">
                      <span className={cn(
                        "text-xs font-medium text-zinc-600",
                        !showFull && "sr-only"
                      )}>
                        {showFull ? label : short}
                      </span>
                      {!showFull && (
                        <span className="text-[10px] font-medium text-zinc-600 block">{short}</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Today column header marker */}
              {todayLeft !== null && (
                <div
                  className="absolute top-0 w-0.5 bg-red-400 opacity-80 z-10"
                  style={{ left: todayLeft, height: HEADER_H }}
                />
              )}
            </div>

            {/* ── Month boundary lines (full height) ───────────────────── */}
            {monthLayout.map(({ month, startDay }) => {
              const left = (startDay - 1) * pxPerDay;
              if (month === 0) return null;
              return (
                <div
                  key={month}
                  className="absolute top-0 bottom-0 w-px bg-zinc-100 z-0"
                  style={{ left, top: HEADER_H }}
                />
              );
            })}

            {/* ── Today vertical line ───────────────────────────────────── */}
            {todayLeft !== null && (
              <div
                ref={todayRef}
                className="absolute w-0.5 bg-red-400/60 z-10 pointer-events-none"
                style={{ left: todayLeft, top: HEADER_H, bottom: 0 }}
              />
            )}

            {/* ── Trip bars ─────────────────────────────────────────────── */}
            {trips.map((trip, i) => {
              const style = STATUS_STYLE[trip.status] ?? STATUS_STYLE.planned;
              const left  = tripLeft(trip.departure_date);
              const width = tripWidth(trip.departure_date, trip.return_date);
              const top   = HEADER_H + GUTTER + i * (ROW_H + GUTTER);
              const occupancy = trip.max_capacity > 0
                ? Math.round(trip.current_bookings / trip.max_capacity * 100)
                : 0;

              // Alternating row background
              const showStripe = i % 2 === 0;

              return (
                <div key={trip.id}>
                  {/* Row background stripe */}
                  {showStripe && (
                    <div
                      className="absolute left-0 right-0 bg-zinc-50/40 pointer-events-none"
                      style={{ top, height: ROW_H }}
                    />
                  )}

                  {/* Trip bar */}
                  <div
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "absolute cursor-pointer rounded border select-none",
                      "hover:shadow-md hover:z-10 transition-shadow duration-100",
                      style.bg, style.border,
                    )}
                    style={{ left, width, top: top + 4, height: ROW_H - 8 }}
                    onClick={() => router.push(`/trips/${trip.id}`)}
                    onKeyDown={(e) => { if (e.key === "Enter") router.push(`/trips/${trip.id}`); }}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const containerRect = containerRef.current?.getBoundingClientRect();
                      if (!containerRect) return;
                      setTooltip({
                        trip,
                        x: rect.left - containerRect.left + width / 2,
                        y: top + ROW_H + 4,
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <div className="h-full px-2 flex flex-col justify-center overflow-hidden">
                      <span className={cn(
                        "text-xs font-medium leading-tight truncate",
                        style.text,
                        style.strikethrough && "line-through",
                      )}>
                        {width >= 80 ? trip.name : ""}
                      </span>
                      {width >= 80 && (
                        <span className={cn("text-[10px] leading-tight truncate", style.text, "opacity-70")}>
                          {trip.destination}
                        </span>
                      )}
                      {/* Occupancy mini bar at bottom */}
                      {width >= 60 && (
                        <div className="absolute bottom-1.5 left-2 right-2 h-0.5 bg-black/10 rounded">
                          <div
                            className="h-full bg-black/20 rounded"
                            style={{ width: `${occupancy}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Empty state */}
            {trips.length === 0 && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400"
                style={{ top: HEADER_H }}
              >
                <p className="text-sm">Nincs utazás {year}-ben</p>
                <Link href="/trips/new" className="mt-2 text-xs text-blue-600 hover:underline">
                  + Új utazás létrehozása
                </Link>
              </div>
            )}

            {/* ── Tooltip ───────────────────────────────────────────────── */}
            {tooltip && (
              <TripTooltip tooltip={tooltip} totalWidth={totalWidth} />
            )}
          </div>
        </div>
      )}

      {/* ── Row count footer ────────────────────────────────────────────── */}
      {!loading && (
        <p className="mt-3 text-xs text-zinc-400">
          {trips.length} utazás megjelenítve · {year}
        </p>
      )}
    </div>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function TripTooltip({ tooltip, totalWidth }: { tooltip: Tooltip; totalWidth: number }) {
  const { trip, x, y } = tooltip;
  const occupancy = trip.max_capacity > 0
    ? Math.round(trip.current_bookings / trip.max_capacity * 100)
    : 0;

  const depLabel = format(parseISO(trip.departure_date), "MMM d.", { locale: hu });
  const retLabel = format(parseISO(trip.return_date),   "MMM d.", { locale: hu });
  const nights   = differenceInCalendarDays(parseISO(trip.return_date), parseISO(trip.departure_date));

  // Keep tooltip inside viewport by clamping x
  const TIP_W = 220;
  const clampedX = Math.min(Math.max(x - TIP_W / 2, 4), totalWidth - TIP_W - 4);

  return (
    <div
      className="absolute z-30 pointer-events-none rounded-md border border-zinc-200 bg-white shadow-lg p-3 text-xs"
      style={{ left: clampedX, top: y + 4, width: TIP_W }}
    >
      <p className="font-semibold text-zinc-900 mb-1 truncate">{trip.name}</p>
      <p className="text-zinc-500 mb-2">{trip.destination}</p>
      <div className="space-y-1 text-zinc-600">
        <div className="flex justify-between">
          <span>Indulás</span>
          <span className="font-medium">{depLabel}</span>
        </div>
        <div className="flex justify-between">
          <span>Visszaérkezés</span>
          <span className="font-medium">{retLabel}</span>
        </div>
        <div className="flex justify-between">
          <span>Időtartam</span>
          <span className="font-medium">{nights} éj</span>
        </div>
        <div className="flex justify-between">
          <span>Résztvevők</span>
          <span className="font-medium">{trip.current_bookings}/{trip.max_capacity} ({occupancy}%)</span>
        </div>
        <div className="flex justify-between">
          <span>Státusz</span>
          <Badge
            variant={trip.status === "advertised" ? "info" : trip.status === "completed" ? "default" : "muted"}
            className="text-[10px]"
          >
            {STATUS_LABELS[trip.status]}
          </Badge>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-blue-600">Kattints a részletekhez</p>
    </div>
  );
}
