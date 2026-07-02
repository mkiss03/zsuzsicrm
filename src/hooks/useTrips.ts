"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Trip, TripStatus, TripCost, CostCategory, Booking, Client, Payment } from "@/types";
import type { TripFormValues } from "@/lib/validators/trip";

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface TripListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: TripStatus | null;
  year?: number | null;
  destination?: string | null;
  sortBy?: "departure_date" | "name" | "current_bookings" | "total_revenue" | "created_at";
  sortDirection?: "asc" | "desc";
}

export interface TripListResult {
  data: Trip[];
  count: number;
}

export interface TripStats {
  total: number;
  activeTrips: number;      // advertised + ongoing
  upcomingTrips: number;    // departure_date in the future
  totalRevenue: number;     // sum of total_revenue across all trips
}

export type Participant = Booking & {
  client: Pick<Client, "id" | "first_name" | "last_name" | "email" | "is_vip">;
  payments: Payment[];
};

export interface TripCostInput {
  description: string;
  amount: number;
  category: CostCategory | null;
  cost_date?: string | null;
}

export interface TripFinancials {
  expectedRevenue: number;
  depositTotal: number;
  fullPaymentTotal: number;
  profit: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTrips() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ismeretlen hiba");
      return null;
    } finally {
      setLoading(false);
    }
  }

  // ── getTrips ───────────────────────────────────────────────────────────────
  const getTrips = useCallback(
    (params: TripListParams = {}): Promise<TripListResult | null> => {
      const {
        page = 1,
        pageSize = 24,
        search,
        status,
        year,
        destination,
        sortBy = "departure_date",
        sortDirection = "desc",
      } = params;

      return run(async () => {
        let query = supabase
          .from("trips")
          .select("*", { count: "exact" })
          .is("deleted_at", null);

        if (search?.trim()) {
          const q = search.trim();
          query = query.or(`name.ilike.%${q}%,destination.ilike.%${q}%,trip_code.ilike.%${q}%`);
        }
        if (status) query = query.eq("status", status);
        if (year) {
          const start = `${year}-01-01`;
          const end   = `${year}-12-31`;
          query = query.gte("departure_date", start).lte("departure_date", end);
        }
        if (destination?.trim()) {
          query = query.ilike("destination", `%${destination.trim()}%`);
        }

        query = query.order(sortBy, { ascending: sortDirection === "asc" });
        const from = (page - 1) * pageSize;
        query = query.range(from, from + pageSize - 1);

        const { data, count, error: sbErr } = await query;
        if (sbErr) throw new Error(sbErr.message);
        return { data: (data ?? []) as Trip[], count: count ?? 0 };
      });
    },
    []
  );

  // ── getTripById ────────────────────────────────────────────────────────────
  const getTripById = useCallback((id: string): Promise<Trip | null> => {
    return run(async () => {
      const { data, error: sbErr } = await supabase
        .from("trips")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .single();
      if (sbErr) throw new Error(sbErr.message);
      return data as Trip;
    });
  }, []);

  // ── createTrip ─────────────────────────────────────────────────────────────
  const createTrip = useCallback((values: TripFormValues): Promise<Trip | null> => {
    return run(async () => {
      const { data, error: sbErr } = await supabase
        .from("trips")
        .insert({
          ...values,
          vip_price: values.vip_price ?? null,
          description: values.description || null,
          meeting_point: values.meeting_point || null,
          departure_time: values.departure_time || null,
        })
        .select()
        .single();
      if (sbErr) throw new Error(sbErr.message);
      return data as Trip;
    });
  }, []);

  // ── updateTrip ─────────────────────────────────────────────────────────────
  const updateTrip = useCallback((id: string, values: Partial<TripFormValues>): Promise<Trip | null> => {
    return run(async () => {
      const { data, error: sbErr } = await supabase
        .from("trips")
        .update({
          ...values,
          meeting_point: values.meeting_point || null,
          departure_time: values.departure_time || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();
      if (sbErr) throw new Error(sbErr.message);
      return data as Trip;
    });
  }, []);

  // ── updateTripStatus ───────────────────────────────────────────────────────
  const updateTripStatus = useCallback((id: string, status: TripStatus): Promise<boolean | null> => {
    return run(async () => {
      const { error: sbErr } = await supabase
        .from("trips")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (sbErr) throw new Error(sbErr.message);
      return true;
    });
  }, []);

  // ── deleteTrip (soft) ──────────────────────────────────────────────────────
  const deleteTrip = useCallback((id: string): Promise<boolean | null> => {
    return run(async () => {
      const { error: sbErr } = await supabase
        .from("trips")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (sbErr) throw new Error(sbErr.message);
      return true;
    });
  }, []);

  // ── getTripStats ───────────────────────────────────────────────────────────
  const getTripStats = useCallback((): Promise<TripStats | null> => {
    return run(async () => {
      const today = new Date().toISOString().slice(0, 10);

      const [totalRes, activeRes, upcomingRes, revenueRes] = await Promise.all([
        supabase.from("trips").select("*", { count: "exact", head: true }).is("deleted_at", null),
        supabase.from("trips").select("*", { count: "exact", head: true })
          .in("status", ["advertised", "ongoing"]).is("deleted_at", null),
        supabase.from("trips").select("*", { count: "exact", head: true })
          .gt("departure_date", today).is("deleted_at", null),
        supabase.from("trips").select("total_revenue").is("deleted_at", null),
      ]);

      const totalRevenue = (revenueRes.data as { total_revenue: number }[] | null)
        ?.reduce((sum, t) => sum + (t.total_revenue ?? 0), 0) ?? 0;

      return {
        total: totalRes.count ?? 0,
        activeTrips: activeRes.count ?? 0,
        upcomingTrips: upcomingRes.count ?? 0,
        totalRevenue,
      };
    });
  }, []);

  // ── getTripParticipants ────────────────────────────────────────────────────
  const getTripParticipants = useCallback((tripId: string): Promise<Participant[] | null> => {
    return run(async () => {
      const { data, error: sbErr } = await supabase
        .from("bookings")
        .select("*, client:clients(id, first_name, last_name, email, is_vip), payments(*)")
        .eq("trip_id", tripId)
        .is("deleted_at", null)
        .order("created_at");
      if (sbErr) throw new Error(sbErr.message);
      return (data ?? []) as unknown as Participant[];
    });
  }, []);

  // ── getTripFinancials ──────────────────────────────────────────────────────
  const getTripFinancials = useCallback((tripId: string): Promise<TripFinancials | null> => {
    return run(async () => {
      // Fetch trip for expected revenue calculation
      const { data: trip } = await supabase
        .from("trips")
        .select("max_capacity, base_price, total_revenue, total_costs")
        .eq("id", tripId)
        .single();

      if (!trip) throw new Error("Trip not found");

      // Fetch all payments for this trip's bookings
      const { data: payments } = await supabase
        .from("payments")
        .select("amount, type, booking:bookings!inner(trip_id)")
        .eq("booking.trip_id", tripId);

      const depositTotal = (payments ?? [])
        .filter((p: { type: string; amount: number }) => p.type === "deposit")
        .reduce((s: number, p: { amount: number }) => s + p.amount, 0);

      const fullTotal = (payments ?? [])
        .filter((p: { type: string; amount: number }) => ["full_payment", "partial"].includes(p.type))
        .reduce((s: number, p: { amount: number }) => s + p.amount, 0);

      return {
        expectedRevenue: (trip as { max_capacity: number; base_price: number }).max_capacity
          * (trip as { base_price: number }).base_price,
        depositTotal,
        fullPaymentTotal: fullTotal,
        profit: (trip as { total_revenue: number; total_costs: number }).total_revenue
          - (trip as { total_costs: number }).total_costs,
      };
    });
  }, []);

  // ── addTripCost ────────────────────────────────────────────────────────────
  const addTripCost = useCallback((tripId: string, data: TripCostInput): Promise<TripCost | null> => {
    return run(async () => {
      const { data: cost, error: sbErr } = await supabase
        .from("trip_costs")
        .insert({
          trip_id: tripId,
          description: data.description,
          amount: data.amount,
          category: data.category,
          cost_date: data.cost_date || null,
        })
        .select()
        .single();
      if (sbErr) throw new Error(sbErr.message);
      return cost as TripCost;
    });
  }, []);

  // ── deleteTripCost (hard delete — no deleted_at on this table) ─────────────
  const deleteTripCost = useCallback((id: string): Promise<boolean | null> => {
    return run(async () => {
      const { error: sbErr } = await supabase.from("trip_costs").delete().eq("id", id);
      if (sbErr) throw new Error(sbErr.message);
      return true;
    });
  }, []);

  return {
    loading,
    error,
    getTrips,
    getTripById,
    createTrip,
    updateTrip,
    updateTripStatus,
    deleteTrip,
    getTripStats,
    getTripParticipants,
    getTripFinancials,
    addTripCost,
    deleteTripCost,
  };
}
