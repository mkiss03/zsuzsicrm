"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Client, ClientSource } from "@/types";
import type { ClientFormValues } from "@/lib/validators/client";

// ─── Parameter types ──────────────────────────────────────────────────────────

export interface ClientListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  source?: ClientSource | null;
  isVip?: boolean | null;
  discountLevel?: number | null;
  sortBy?: "last_name" | "first_name" | "created_at" | "trip_count" | "total_spent";
  sortDirection?: "asc" | "desc";
}

export interface ClientStats {
  total: number;
  vipCount: number;
  expiringPassports: number;   // expiry within 60 days
  avgTrips: number;
}

export interface ClientListResult {
  data: Client[];
  count: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useClients() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generic wrapper that handles loading + error state
  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ismeretlen hiba";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }

  // ── getClients ─────────────────────────────────────────────────────────────
  const getClients = useCallback(
    (params: ClientListParams = {}): Promise<ClientListResult | null> => {
      const {
        page = 1,
        pageSize = 20,
        search,
        source,
        isVip,
        discountLevel,
        sortBy = "created_at",
        sortDirection = "desc",
      } = params;

      return run(async () => {
        let query = supabase
          .from("clients")
          .select("*", { count: "exact" })
          .is("deleted_at", null);

        if (search?.trim()) {
          const q = search.trim();
          query = query.or(
            `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,client_code.ilike.%${q}%`
          );
        }

        if (source) query = query.eq("source", source);
        if (isVip !== null && isVip !== undefined) query = query.eq("is_vip", isVip);
        if (discountLevel !== null && discountLevel !== undefined) {
          query = query.eq("discount_level", discountLevel);
        }

        query = query.order(sortBy, { ascending: sortDirection === "asc" });

        const from = (page - 1) * pageSize;
        query = query.range(from, from + pageSize - 1);

        const { data, count, error: sbError } = await query;
        if (sbError) throw new Error(sbError.message);

        return { data: (data ?? []) as Client[], count: count ?? 0 };
      });
    },
    []
  );

  // ── searchClients (no pagination, used for CSV export) ────────────────────
  const searchClients = useCallback(
    (params: Omit<ClientListParams, "page" | "pageSize">): Promise<Client[] | null> => {
      const { search, source, isVip, discountLevel, sortBy = "last_name", sortDirection = "asc" } = params;

      return run(async () => {
        let query = supabase
          .from("clients")
          .select("*")
          .is("deleted_at", null)
          .order(sortBy, { ascending: sortDirection === "asc" });

        if (search?.trim()) {
          const q = search.trim();
          query = query.or(
            `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,client_code.ilike.%${q}%`
          );
        }
        if (source) query = query.eq("source", source);
        if (isVip !== null && isVip !== undefined) query = query.eq("is_vip", isVip);
        if (discountLevel !== null && discountLevel !== undefined) {
          query = query.eq("discount_level", discountLevel);
        }

        const { data, error: sbError } = await query;
        if (sbError) throw new Error(sbError.message);
        return (data ?? []) as Client[];
      });
    },
    []
  );

  // ── getClientById ──────────────────────────────────────────────────────────
  const getClientById = useCallback((id: string): Promise<Client | null> => {
    return run(async () => {
      const { data, error: sbError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .single();
      if (sbError) throw new Error(sbError.message);
      return data as Client;
    });
  }, []);

  // ── createClient ───────────────────────────────────────────────────────────
  const createClient_ = useCallback(
    (values: ClientFormValues): Promise<Client | null> => {
      return run(async () => {
        const payload = {
          ...values,
          email: values.email || null,
          phone: values.phone || null,
          birth_date: values.birth_date || null,
          passport_expiry: values.passport_expiry || null,
          passport_number: values.passport_number || null,
          nationality: values.nationality || null,
          source: values.source ?? null,
          notes: values.notes || null,
        };

        const { data, error: sbError } = await supabase
          .from("clients")
          .insert(payload)
          .select()
          .single();
        if (sbError) throw new Error(sbError.message);
        return data as Client;
      });
    },
    []
  );

  // ── updateClient ───────────────────────────────────────────────────────────
  const updateClient = useCallback(
    (id: string, values: Partial<ClientFormValues>): Promise<Client | null> => {
      return run(async () => {
        const payload = {
          ...values,
          email: values.email || null,
          phone: values.phone || null,
          birth_date: values.birth_date || null,
          passport_expiry: values.passport_expiry || null,
          passport_number: values.passport_number || null,
          nationality: values.nationality || null,
          source: values.source ?? null,
          notes: values.notes || null,
          updated_at: new Date().toISOString(),
        };

        const { data, error: sbError } = await supabase
          .from("clients")
          .update(payload)
          .eq("id", id)
          .select()
          .single();
        if (sbError) throw new Error(sbError.message);
        return data as Client;
      });
    },
    []
  );

  // ── deleteClient (soft delete) ─────────────────────────────────────────────
  const deleteClient = useCallback((id: string): Promise<boolean | null> => {
    return run(async () => {
      const { error: sbError } = await supabase
        .from("clients")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (sbError) throw new Error(sbError.message);
      return true;
    });
  }, []);

  // ── getClientStats ─────────────────────────────────────────────────────────
  const getClientStats = useCallback((): Promise<ClientStats | null> => {
    return run(async () => {
      const today = new Date().toISOString().slice(0, 10);
      const plus60 = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);

      const [totalRes, vipRes, expiringRes, tripsRes] = await Promise.all([
        supabase
          .from("clients")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null),
        supabase
          .from("clients")
          .select("*", { count: "exact", head: true })
          .eq("is_vip", true)
          .is("deleted_at", null),
        supabase
          .from("clients")
          .select("*", { count: "exact", head: true })
          .gte("passport_expiry", today)
          .lte("passport_expiry", plus60)
          .is("deleted_at", null),
        supabase
          .from("clients")
          .select("trip_count")
          .is("deleted_at", null),
      ]);

      const tripData = tripsRes.data as { trip_count: number }[] | null;
      const avgTrips =
        tripData && tripData.length > 0
          ? tripData.reduce((sum, c) => sum + (c.trip_count ?? 0), 0) / tripData.length
          : 0;

      return {
        total: totalRes.count ?? 0,
        vipCount: vipRes.count ?? 0,
        expiringPassports: expiringRes.count ?? 0,
        avgTrips,
      };
    });
  }, []);

  return {
    loading,
    error,
    getClients,
    searchClients,
    getClientById,
    createClient: createClient_,
    updateClient,
    deleteClient,
    getClientStats,
  };
}
