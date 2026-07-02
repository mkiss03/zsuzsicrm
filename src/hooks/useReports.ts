"use client";

import React, { useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toEur, fetchEurHufRate } from "@/lib/currency";
import type { TripStatus } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonthlyRevenueRow {
  month: number;
  monthLabel: string;
  revenue: number;
  bookingCount: number;
}

export interface RevenueCostsRow {
  month: number;
  monthLabel: string;
  year: number;
  revenue: number;
  costs: number;
  profit: number;
}

export interface TripProfitRow {
  id: string;
  name: string;
  destination: string;
  departure_date: string;
  status: TripStatus;
  revenue: number;
  costs: number;
  profit: number;
  margin: number;
  currentBookings: number;
  maxCapacity: number;
  occupancy: number;
}

export interface ClientStatsData {
  newByMonth: { month: number; monthLabel: string; count: number }[];
  sourceBreakdown: { source: string; label: string; count: number; percentage: number }[];
  retentionRate: number;
  totalNew: number;
  totalActive: number;
}

export interface TopClient {
  id: string;
  client_code: string;
  first_name: string;
  last_name: string;
  total_spent: number;
  trip_count: number;
  discount_level: number;
  is_vip: boolean;
}

export interface DestinationStat {
  destination: string;
  count: number;
  percentage: number;
}

export interface OccupancyRow {
  id: string;
  name: string;
  departure_date: string;
  current_bookings: number;
  max_capacity: number;
  occupancy: number;
  status: TripStatus;
}

export interface SeasonalRow {
  month: number;
  monthLabel: string;
  bookings: number;
}

export interface SummaryStats {
  totalRevenue: number;
  totalCosts: number;
  profit: number;
  avgBookingValue: number;
  bookingCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const HU_MONTHS_SHORT = [
  "jan.", "feb.", "már.", "ápr.", "máj.", "jún.",
  "júl.", "aug.", "szep.", "okt.", "nov.", "dec.",
] as const;

const SOURCE_LABELS: Record<string, string> = {
  messenger:    "Messenger",
  website_form: "Weboldal",
  referral:     "Ajánlás",
  other:        "Egyéb",
};

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const bom = "﻿";
  const csv = bom + [headers, ...rows]
    .map((row) => row.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useReports() {
  const supabase = createClient();

  // ── getRevenueByMonth ──────────────────────────────────────────────────────
  const getRevenueByMonth = useCallback(
    async (year: number): Promise<MonthlyRevenueRow[]> => {
      const start = `${year}-01-01`;
      const end   = `${year}-12-31T23:59:59`;

      const [{ data: payments }, { data: bookings }, eurHufRate] = await Promise.all([
        supabase
          .from("payments")
          .select("amount, type, payment_date, currency")
          .gte("payment_date", start)
          .lte("payment_date", end),
        supabase
          .from("bookings")
          .select("created_at")
          .is("deleted_at", null)
          .not("status", "in", '("cancelled","interested")')
          .gte("created_at", start)
          .lte("created_at", end),
        fetchEurHufRate(),
      ]);

      const rev: Record<number, number> = {};
      const bkg: Record<number, number> = {};
      for (let m = 1; m <= 12; m++) { rev[m] = 0; bkg[m] = 0; }

      for (const p of payments ?? []) {
        const m = new Date(p.payment_date).getMonth() + 1;
        const eur = toEur(p.amount, p.currency, eurHufRate);
        rev[m]! += p.type === "refund" ? -eur : eur;
      }
      for (const b of bookings ?? []) {
        const m = new Date(b.created_at).getMonth() + 1;
        bkg[m]!++;
      }

      return Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        monthLabel: HU_MONTHS_SHORT[i]!,
        revenue: Math.round((rev[i + 1]!) * 100) / 100,
        bookingCount: bkg[i + 1]!,
      }));
    },
    [],
  );

  // ── getRevenueVsCosts ──────────────────────────────────────────────────────
  const getRevenueVsCosts = useCallback(
    async (startDate: string, endDate: string): Promise<RevenueCostsRow[]> => {
      const [{ data: payments }, { data: costs }, eurHufRate] = await Promise.all([
        supabase
          .from("payments")
          .select("amount, type, payment_date, currency")
          .gte("payment_date", startDate)
          .lte("payment_date", endDate + "T23:59:59"),
        supabase
          .from("trip_costs")
          .select("amount, cost_date")
          .gte("cost_date", startDate)
          .lte("cost_date", endDate),
        fetchEurHufRate(),
      ]);

      const map: Record<string, { year: number; month: number; revenue: number; costs: number }> = {};

      for (const p of payments ?? []) {
        const d = new Date(p.payment_date);
        const k = `${d.getFullYear()}-${d.getMonth() + 1}`;
        if (!map[k]) map[k] = { year: d.getFullYear(), month: d.getMonth() + 1, revenue: 0, costs: 0 };
        const eur = toEur(p.amount, p.currency, eurHufRate);
        map[k]!.revenue += p.type === "refund" ? -eur : eur;
      }
      for (const c of costs ?? []) {
        if (!c.cost_date) continue;
        const d = new Date(c.cost_date);
        const k = `${d.getFullYear()}-${d.getMonth() + 1}`;
        if (!map[k]) map[k] = { year: d.getFullYear(), month: d.getMonth() + 1, revenue: 0, costs: 0 };
        map[k]!.costs += c.amount;
      }

      return Object.values(map)
        .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
        .map((row) => ({
          ...row,
          monthLabel: `${HU_MONTHS_SHORT[row.month - 1]!} ${row.year}`,
          revenue: Math.round(row.revenue * 100) / 100,
          costs: Math.round(row.costs * 100) / 100,
          profit: Math.round((row.revenue - row.costs) * 100) / 100,
        }));
    },
    [],
  );

  // ── getSummaryStats ────────────────────────────────────────────────────────
  const getSummaryStats = useCallback(
    async (startDate: string, endDate: string): Promise<SummaryStats> => {
      const [{ data: payments }, { data: costs }, { count: bookingCount }, eurHufRate] = await Promise.all([
        supabase
          .from("payments")
          .select("amount, type, currency")
          .gte("payment_date", startDate)
          .lte("payment_date", endDate + "T23:59:59"),
        supabase
          .from("trip_costs")
          .select("amount")
          .gte("cost_date", startDate)
          .lte("cost_date", endDate),
        supabase
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null)
          .not("status", "in", '("cancelled","interested")')
          .gte("created_at", startDate)
          .lte("created_at", endDate + "T23:59:59"),
        fetchEurHufRate(),
      ]);

      const totalRevenue = (payments ?? []).reduce(
        (s, p) => s + (p.type === "refund" ? -toEur(p.amount, p.currency, eurHufRate) : toEur(p.amount, p.currency, eurHufRate)),
        0,
      );
      const totalCosts = (costs ?? []).reduce((s, c) => s + c.amount, 0);
      const count = bookingCount ?? 0;

      return {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalCosts: Math.round(totalCosts * 100) / 100,
        profit: Math.round((totalRevenue - totalCosts) * 100) / 100,
        avgBookingValue: count > 0 ? Math.round(totalRevenue / count * 100) / 100 : 0,
        bookingCount: count,
      };
    },
    [],
  );

  // ── getTripProfitability ───────────────────────────────────────────────────
  const getTripProfitability = useCallback(
    async (startDate: string, endDate: string): Promise<TripProfitRow[]> => {
      const { data } = await supabase
        .from("trips")
        .select("id,name,destination,departure_date,status,total_revenue,total_costs,current_bookings,max_capacity")
        .is("deleted_at", null)
        .gte("departure_date", startDate)
        .lte("departure_date", endDate)
        .order("departure_date", { ascending: false });

      return (data ?? []).map((t) => {
        const revenue = Number(t.total_revenue) || 0;
        const costs = Number(t.total_costs) || 0;
        const profit = revenue - costs;
        return {
          id: t.id,
          name: t.name,
          destination: t.destination,
          departure_date: t.departure_date,
          status: t.status as TripStatus,
          revenue: Math.round(revenue * 100) / 100,
          costs: Math.round(costs * 100) / 100,
          profit: Math.round(profit * 100) / 100,
          margin: revenue > 0 ? Math.round(profit / revenue * 1000) / 10 : 0,
          currentBookings: t.current_bookings,
          maxCapacity: t.max_capacity,
          occupancy: t.max_capacity > 0
            ? Math.round(t.current_bookings / t.max_capacity * 100)
            : 0,
        };
      });
    },
    [],
  );

  // ── getClientStats ─────────────────────────────────────────────────────────
  const getClientStats = useCallback(
    async (startDate: string, endDate: string): Promise<ClientStatsData> => {
      const [{ data: newClients }, { data: allClients }] = await Promise.all([
        supabase
          .from("clients")
          .select("created_at, source")
          .is("deleted_at", null)
          .gte("created_at", startDate)
          .lte("created_at", endDate + "T23:59:59"),
        supabase
          .from("clients")
          .select("source, trip_count")
          .is("deleted_at", null),
      ]);

      // New by month
      const byMonth: Record<number, number> = {};
      for (let m = 1; m <= 12; m++) byMonth[m] = 0;
      for (const c of newClients ?? []) {
        const m = new Date(c.created_at).getMonth() + 1;
        byMonth[m]!++;
      }

      // Source breakdown (all time)
      const srcCounts: Record<string, number> = {};
      for (const c of allClients ?? []) {
        const s = (c.source as string | null) ?? "other";
        srcCounts[s] = (srcCounts[s] ?? 0) + 1;
      }
      const totalAll = (allClients ?? []).length;
      const sources = ["messenger", "website_form", "referral", "other"] as const;
      const sourceBreakdown = sources.map((s) => ({
        source: s,
        label: SOURCE_LABELS[s]!,
        count: srcCounts[s] ?? 0,
        percentage: totalAll > 0 ? Math.round((srcCounts[s] ?? 0) / totalAll * 100) : 0,
      }));

      // Retention: clients with >1 booking
      const returning = (allClients ?? []).filter((c) => (c.trip_count ?? 0) > 1).length;

      return {
        newByMonth: Array.from({ length: 12 }, (_, i) => ({
          month: i + 1,
          monthLabel: HU_MONTHS_SHORT[i]!,
          count: byMonth[i + 1]!,
        })),
        sourceBreakdown,
        retentionRate: totalAll > 0 ? Math.round(returning / totalAll * 100) : 0,
        totalNew: (newClients ?? []).length,
        totalActive: totalAll,
      };
    },
    [],
  );

  // ── getTopClients ──────────────────────────────────────────────────────────
  const getTopClients = useCallback(
    async (limit = 10): Promise<TopClient[]> => {
      const { data } = await supabase
        .from("clients")
        .select("id,client_code,first_name,last_name,total_spent,trip_count,discount_level,is_vip")
        .is("deleted_at", null)
        .order("total_spent", { ascending: false })
        .limit(limit);
      return (data ?? []) as TopClient[];
    },
    [],
  );

  // ── getDestinationStats ────────────────────────────────────────────────────
  const getDestinationStats = useCallback(async (): Promise<DestinationStat[]> => {
    const { data } = await supabase
      .from("bookings")
      .select("trip:trips!inner(destination)")
      .is("deleted_at", null)
      .not("status", "in", '("cancelled","interested")');

    const counts: Record<string, number> = {};
    for (const b of data ?? []) {
      const dest = (b.trip as unknown as { destination: string } | null)?.destination;
      if (dest) counts[dest] = (counts[dest] ?? 0) + 1;
    }

    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([destination, count]) => ({
        destination,
        count,
        percentage: total > 0 ? Math.round(count / total * 100) : 0,
      }));
  }, []);

  // ── getOccupancyRates ──────────────────────────────────────────────────────
  const getOccupancyRates = useCallback(async (): Promise<OccupancyRow[]> => {
    const { data } = await supabase
      .from("trips")
      .select("id,name,departure_date,current_bookings,max_capacity,status")
      .is("deleted_at", null)
      .not("status", "in", '("cancelled")')
      .order("departure_date", { ascending: false })
      .limit(20);

    return (data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      departure_date: t.departure_date,
      current_bookings: t.current_bookings,
      max_capacity: t.max_capacity,
      occupancy: t.max_capacity > 0
        ? Math.round(t.current_bookings / t.max_capacity * 100)
        : 0,
      status: t.status as TripStatus,
    }));
  }, []);

  // ── getSeasonalAnalysis ────────────────────────────────────────────────────
  const getSeasonalAnalysis = useCallback(async (): Promise<SeasonalRow[]> => {
    const { data } = await supabase
      .from("bookings")
      .select("trip:trips!inner(departure_date)")
      .is("deleted_at", null)
      .not("status", "in", '("cancelled","interested")');

    const byMonth: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) byMonth[m] = 0;

    for (const b of data ?? []) {
      const dep = (b.trip as unknown as { departure_date: string } | null)?.departure_date;
      if (dep) {
        const m = new Date(dep).getMonth() + 1;
        byMonth[m]!++;
      }
    }

    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      monthLabel: HU_MONTHS_SHORT[i]!,
      bookings: byMonth[i + 1]!,
    }));
  }, []);

  // ── exportClientsCSV ───────────────────────────────────────────────────────
  const exportClientsCSV = useCallback(async () => {
    const { data } = await supabase
      .from("clients")
      .select("client_code,last_name,first_name,email,phone,address_city,address_country,is_vip,trip_count,total_spent,discount_level,source,created_at")
      .is("deleted_at", null)
      .order("last_name");
    if (!data?.length) return;

    const DISCOUNT_LABELS: Record<number, string> = { 0: "Alap", 1: "Bronz 5%", 2: "Ezüst 10%", 3: "Arany 15%" };
    downloadCSV("ugyfelek", [
      "Kód","Vezéknév","Keresztnév","Email","Telefon","Város","Ország","VIP","Utak","Összes költ.","Kedvezmény","Forrás","Regisztrálva",
    ], data.map((c) => [
      c.client_code, c.last_name, c.first_name,
      c.email ?? "", c.phone ?? "", c.address_city ?? "", c.address_country,
      c.is_vip ? "Igen" : "Nem",
      String(c.trip_count), String(c.total_spent),
      DISCOUNT_LABELS[c.discount_level] ?? String(c.discount_level),
      SOURCE_LABELS[c.source ?? "other"] ?? String(c.source ?? ""),
      c.created_at.slice(0, 10),
    ]));
  }, []);

  // ── exportBookingsCSV ──────────────────────────────────────────────────────
  const exportBookingsCSV = useCallback(
    async (startDate?: string, endDate?: string) => {
      let q = supabase
        .from("bookings")
        .select("booking_code,status,final_amount,deposit_amount,payment_deadline,created_at,client:clients(last_name,first_name,email),trip:trips(name,departure_date)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (startDate) q = q.gte("created_at", startDate);
      if (endDate)   q = q.lte("created_at", endDate + "T23:59:59");

      const { data } = await q;
      if (!data?.length) return;

      const STATUS_LABELS: Record<string, string> = {
        interested: "Érdeklődő", booked: "Lefoglalt",
        deposit_paid: "Előleg fizetve", fully_paid: "Fizetve",
        completed: "Lezárt", cancelled: "Lemondva",
      };

      downloadCSV("foglalasok", [
        "Kód","Ügyfél","Utazás","Indulás","Végösszeg","Előleg","Határidő","Státusz","Létrehozva",
      ], data.map((b) => {
        const c = b.client as unknown as { last_name: string; first_name: string } | null;
        const t = b.trip as unknown as { name: string; departure_date: string } | null;
        return [
          b.booking_code,
          c ? `${c.last_name} ${c.first_name}` : "",
          t?.name ?? "", t?.departure_date ?? "",
          String(b.final_amount ?? ""), String(b.deposit_amount ?? ""),
          b.payment_deadline ?? "",
          STATUS_LABELS[b.status] ?? b.status,
          b.created_at.slice(0, 10),
        ];
      }));
    },
    [],
  );

  // ── exportRevenueCSV ───────────────────────────────────────────────────────
  const exportRevenueCSV = useCallback(
    async (startDate?: string, endDate?: string) => {
      let q = supabase
        .from("payments")
        .select("amount,type,currency,payment_date,notes,booking:bookings!inner(booking_code,client:clients(last_name,first_name),trip:trips(name))")
        .order("payment_date", { ascending: false });

      if (startDate) q = q.gte("payment_date", startDate);
      if (endDate)   q = q.lte("payment_date", endDate);

      const { data } = await q;
      if (!data?.length) return;

      const eurHufRate = await fetchEurHufRate();
      const TYPE_MAP: Record<string, string> = {
        deposit: "Előleg", full_payment: "Teljes", partial: "Részleges", refund: "Visszatérítés",
      };

      downloadCSV("bevetel", [
        "Dátum","Összeg (€)","Típus","Foglalás kód","Ügyfél","Utazás","Megjegyzés",
      ], data.map((p) => {
        const bk = p.booking as unknown as { booking_code: string; client: { last_name: string; first_name: string } | null; trip: { name: string } | null } | null;
        return [
          p.payment_date.slice(0, 10), String(toEur(p.amount, p.currency, eurHufRate)),
          TYPE_MAP[p.type] ?? p.type,
          bk?.booking_code ?? "",
          bk?.client ? `${bk.client.last_name} ${bk.client.first_name}` : "",
          bk?.trip?.name ?? "",
          p.notes ?? "",
        ];
      }));
    },
    [],
  );

  // ── generatePDFReport ──────────────────────────────────────────────────────
  const generatePDFReport = useCallback(
    async (startDate: string, endDate: string) => {
      const [revenueData, tripData, clientData, topClients] = await Promise.all([
        getRevenueVsCosts(startDate, endDate),
        getTripProfitability(startDate, endDate),
        getClientStats(startDate, endDate),
        getTopClients(10),
      ]);

      const [{ pdf }, { ReportPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/report-pdf"),
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const element = React.createElement(ReportPDF as any, {
        period: { startDate, endDate },
        revenue: revenueData,
        trips: tripData.slice(0, 15),
        clients: clientData,
        topClients,
      });
      const blob = await pdf(element as never).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `zsuzsicrm-riport-${startDate}-${endDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    [getRevenueVsCosts, getTripProfitability, getClientStats, getTopClients],
  );

  return {
    getRevenueByMonth,
    getRevenueVsCosts,
    getSummaryStats,
    getTripProfitability,
    getClientStats,
    getTopClients,
    getDestinationStats,
    getOccupancyRates,
    getSeasonalAnalysis,
    exportClientsCSV,
    exportBookingsCSV,
    exportRevenueCSV,
    generatePDFReport,
  };
}
