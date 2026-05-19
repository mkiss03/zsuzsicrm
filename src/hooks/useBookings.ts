"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Booking, BookingStatus, Payment, PaymentType, ClientSource } from "@/types";
import type { BookingFormValues, PaymentFormValues } from "@/lib/validators/booking";

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface BookingListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: BookingStatus | null;
  tripId?: string | null;
  source?: ClientSource | null;
  fromDate?: string | null;
  toDate?: string | null;
  overdueOnly?: boolean;
  sortBy?: "created_at" | "payment_deadline" | "final_amount";
  sortDirection?: "asc" | "desc";
}

export type BookingRow = Booking & {
  client: { id: string; first_name: string; last_name: string; email: string | null; is_vip: boolean; discount_level: number } | null;
  trip: { id: string; name: string; destination: string; departure_date: string } | null;
};

export interface BookingStats {
  activeCount: number;
  awaitingPaymentCount: number;
  overdueCount: number;
  currentMonthRevenue: number;
}

export interface PaymentResult {
  payment: Payment;
  newStatus: BookingStatus;
  depositPaidAt: string | null;
  fullyPaidAt: string | null;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_ORDER: BookingStatus[] = [
  "interested", "booked", "deposit_paid", "fully_paid", "completed",
];

function deriveStatus(
  currentStatus: BookingStatus,
  finalAmount: number | null,
  payments: Payment[],
  newPaymentType: PaymentType,
): BookingStatus {
  if (currentStatus === "cancelled" || currentStatus === "completed") return currentStatus;

  const netPaid = payments.reduce(
    (sum, p) => (p.type === "refund" ? sum - p.amount : sum + p.amount),
    0,
  );
  const hasDeposit = payments.some((p) => p.type === "deposit");

  if (finalAmount != null && netPaid >= finalAmount) return "fully_paid";
  if (hasDeposit || newPaymentType === "deposit") return "deposit_paid";

  // At least one payment was made → bump to booked if still interested
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);
  return currentIdx < STATUS_ORDER.indexOf("booked") ? "booked" : currentStatus;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBookings() {
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

  // ── getBookings ────────────────────────────────────────────────────────────
  const getBookings = useCallback(
    (params: BookingListParams = {}): Promise<{ data: BookingRow[]; count: number } | null> => {
      const {
        page = 1,
        pageSize = 20,
        search,
        status,
        tripId,
        source,
        fromDate,
        toDate,
        overdueOnly,
        sortBy = "created_at",
        sortDirection = "desc",
      } = params;

      return run(async () => {
        const today = new Date().toISOString().slice(0, 10);

        let query = supabase
          .from("bookings")
          .select(
            `*,
            client:clients(id, first_name, last_name, email, is_vip, discount_level),
            trip:trips(id, name, destination, departure_date)`,
            { count: "exact" },
          )
          .is("deleted_at", null);

        if (search?.trim()) {
          // Search by booking code — client/trip search is done at application level
          query = query.ilike("booking_code", `%${search.trim()}%`);
        }
        if (status) query = query.eq("status", status);
        if (tripId) query = query.eq("trip_id", tripId);
        if (source) query = query.eq("source", source);
        if (fromDate) query = query.gte("created_at", fromDate);
        if (toDate) query = query.lte("created_at", toDate + "T23:59:59");
        if (overdueOnly) {
          query = query
            .lt("payment_deadline", today)
            .not("status", "in", '("fully_paid","completed","cancelled")');
        }

        query = query.order(sortBy, { ascending: sortDirection === "asc" });
        const from = (page - 1) * pageSize;
        query = query.range(from, from + pageSize - 1);

        const { data, count, error: sbErr } = await query;
        if (sbErr) throw new Error(sbErr.message);
        return { data: (data ?? []) as BookingRow[], count: count ?? 0 };
      });
    },
    [],
  );

  // ── searchBookings (all results, no pagination — for CSV export) ───────────
  const searchBookings = useCallback(
    (params: Omit<BookingListParams, "page" | "pageSize">): Promise<BookingRow[] | null> => {
      return run(async () => {
        const today = new Date().toISOString().slice(0, 10);
        let query = supabase
          .from("bookings")
          .select(
            `*, client:clients(id, first_name, last_name, email, is_vip, discount_level),
            trip:trips(id, name, destination, departure_date)`,
          )
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        if (params.status) query = query.eq("status", params.status);
        if (params.tripId) query = query.eq("trip_id", params.tripId);
        if (params.source) query = query.eq("source", params.source);
        if (params.fromDate) query = query.gte("created_at", params.fromDate);
        if (params.toDate) query = query.lte("created_at", params.toDate + "T23:59:59");
        if (params.overdueOnly) {
          query = query
            .lt("payment_deadline", today)
            .not("status", "in", '("fully_paid","completed","cancelled")');
        }

        const { data, error: sbErr } = await query;
        if (sbErr) throw new Error(sbErr.message);
        return (data ?? []) as BookingRow[];
      });
    },
    [],
  );

  // ── getBookingById ─────────────────────────────────────────────────────────
  const getBookingById = useCallback(
    (id: string): Promise<(Booking & { client: Record<string, unknown>; trip: Record<string, unknown> }) | null> => {
      return run(async () => {
        const { data, error: sbErr } = await supabase
          .from("bookings")
          .select(
            `*, client:clients(*), trip:trips(*), payments:payments(*)`,
          )
          .eq("id", id)
          .is("deleted_at", null)
          .single();
        if (sbErr) throw new Error(sbErr.message);
        return data as never;
      });
    },
    [],
  );

  // ── createBooking ──────────────────────────────────────────────────────────
  const createBooking = useCallback(
    (values: BookingFormValues): Promise<Booking | null> => {
      return run(async () => {
        const { data, error: sbErr } = await supabase
          .from("bookings")
          .insert({
            ...values,
            base_amount: values.base_amount ?? null,
            final_amount: values.final_amount ?? null,
            deposit_amount: values.deposit_amount ?? null,
            payment_deadline: values.payment_deadline ?? null,
            notes: values.notes || null,
            source: values.source ?? null,
          })
          .select()
          .single();
        if (sbErr) throw new Error(sbErr.message);
        const booking = data as Booking;

        // Fire new_booking notification — best-effort, never throw
        void (async () => {
          const [{ data: client }, { data: trip }] = await Promise.all([
            supabase
              .from("clients")
              .select("first_name, last_name")
              .eq("id", values.client_id)
              .single(),
            supabase
              .from("trips")
              .select("name")
              .eq("id", values.trip_id)
              .single(),
          ]);
          const clientName = client
            ? `${(client as { last_name: string }).last_name} ${(client as { first_name: string }).first_name}`
            : "Ismeretlen ügyfél";
          const tripName = trip ? (trip as { name: string }).name : "";
          await supabase.from("notifications").insert({
            type: "new_booking",
            title: `Új foglalás – ${clientName}`,
            message: `${tripName ? tripName + " utazásra " : ""}foglalás érkezett (${booking.booking_code}).`,
            related_id: booking.id,
            related_type: "booking",
            is_read: false,
          });
        })();

        return booking;
      });
    },
    [],
  );

  // ── updateBooking ──────────────────────────────────────────────────────────
  const updateBooking = useCallback(
    (id: string, values: Partial<BookingFormValues>): Promise<Booking | null> => {
      return run(async () => {
        const { data, error: sbErr } = await supabase
          .from("bookings")
          .update({ ...values, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select()
          .single();
        if (sbErr) throw new Error(sbErr.message);
        return data as Booking;
      });
    },
    [],
  );

  // ── updateBookingStatus ────────────────────────────────────────────────────
  const updateBookingStatus = useCallback(
    (id: string, status: BookingStatus): Promise<boolean | null> => {
      return run(async () => {
        const extra: Record<string, string> = { updated_at: new Date().toISOString() };
        if (status === "deposit_paid") extra.deposit_paid_at = new Date().toISOString();
        if (status === "fully_paid") extra.fully_paid_at = new Date().toISOString();

        const { error: sbErr } = await supabase
          .from("bookings")
          .update({ status, ...extra })
          .eq("id", id);
        if (sbErr) throw new Error(sbErr.message);
        return true;
      });
    },
    [],
  );

  // ── deleteBooking (soft) ───────────────────────────────────────────────────
  const deleteBooking = useCallback(
    (id: string): Promise<boolean | null> => {
      return run(async () => {
        const { error: sbErr } = await supabase
          .from("bookings")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", id);
        if (sbErr) throw new Error(sbErr.message);
        return true;
      });
    },
    [],
  );

  // ── addPayment ─────────────────────────────────────────────────────────────
  const addPayment = useCallback(
    (bookingId: string, values: PaymentFormValues): Promise<PaymentResult | null> => {
      return run(async () => {
        // Insert the payment
        const { data: newPayment, error: payErr } = await supabase
          .from("payments")
          .insert({
            booking_id: bookingId,
            amount: values.amount,
            type: values.type,
            payment_date: values.payment_date,
            notes: values.notes || null,
          })
          .select()
          .single();
        if (payErr) throw new Error(payErr.message);

        // Fetch booking state + all payments to recalculate status
        const [{ data: booking }, { data: allPayments }] = await Promise.all([
          supabase
            .from("bookings")
            .select("status, final_amount, deposit_paid_at, fully_paid_at")
            .eq("id", bookingId)
            .single(),
          supabase
            .from("payments")
            .select("*")
            .eq("booking_id", bookingId),
        ]);

        if (!booking) throw new Error("Booking not found");

        const newStatus = deriveStatus(
          booking.status as BookingStatus,
          booking.final_amount as number | null,
          (allPayments ?? []) as Payment[],
          values.type,
        );

        const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (newStatus !== booking.status) updatePayload.status = newStatus;
        if (values.type === "deposit" && !booking.deposit_paid_at) {
          updatePayload.deposit_paid_at = values.payment_date;
        }
        if (newStatus === "fully_paid" && !booking.fully_paid_at) {
          updatePayload.fully_paid_at = values.payment_date;
        }

        if (Object.keys(updatePayload).length > 1) {
          await supabase.from("bookings").update(updatePayload).eq("id", bookingId);
        }

        return {
          payment: newPayment as Payment,
          newStatus,
          depositPaidAt: (updatePayload.deposit_paid_at as string) ?? (booking.deposit_paid_at as string | null),
          fullyPaidAt: (updatePayload.fully_paid_at as string) ?? (booking.fully_paid_at as string | null),
        };
      });
    },
    [],
  );

  // ── deletePayment + recalculate status ────────────────────────────────────
  const deletePayment = useCallback(
    (paymentId: string, bookingId: string): Promise<{ newStatus: BookingStatus } | null> => {
      return run(async () => {
        await supabase.from("payments").delete().eq("id", paymentId);

        // Recalculate status from remaining payments
        const [{ data: booking }, { data: remaining }] = await Promise.all([
          supabase
            .from("bookings")
            .select("status, final_amount")
            .eq("id", bookingId)
            .single(),
          supabase.from("payments").select("*").eq("booking_id", bookingId),
        ]);

        if (!booking) throw new Error("Booking not found");

        const currentStatus = booking.status as BookingStatus;
        if (currentStatus === "cancelled" || currentStatus === "completed") {
          return { newStatus: currentStatus };
        }

        const payments = (remaining ?? []) as Payment[];
        const netPaid = payments.reduce(
          (s, p) => (p.type === "refund" ? s - p.amount : s + p.amount),
          0,
        );
        const hasDeposit = payments.some((p) => p.type === "deposit");

        let newStatus: BookingStatus = "interested";
        if (booking.final_amount != null && netPaid >= booking.final_amount) {
          newStatus = "fully_paid";
        } else if (hasDeposit) {
          newStatus = "deposit_paid";
        } else if (payments.length > 0) {
          newStatus = "booked";
        }

        // Clear timestamps if downgraded
        const clearPayload: Record<string, null> = {};
        const depositStatuses: BookingStatus[] = ["deposit_paid", "fully_paid", "completed"];
        const fullStatuses: BookingStatus[]    = ["fully_paid", "completed"];
        if (!depositStatuses.includes(newStatus)) clearPayload.deposit_paid_at = null;
        if (!fullStatuses.includes(newStatus))    clearPayload.fully_paid_at   = null;

        await supabase
          .from("bookings")
          .update({ status: newStatus, ...clearPayload, updated_at: new Date().toISOString() })
          .eq("id", bookingId);

        return { newStatus };
      });
    },
    [],
  );

  // ── getBookingStats ────────────────────────────────────────────────────────
  const getBookingStats = useCallback((): Promise<BookingStats | null> => {
    return run(async () => {
      const today = new Date().toISOString().slice(0, 10);
      const firstOfMonth = `${today.slice(0, 7)}-01`;

      const [activeRes, awaitingRes, overdueRes, revenueRes] = await Promise.all([
        supabase
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null)
          .not("status", "in", '("cancelled","completed")'),
        supabase
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null)
          .in("status", ["booked", "deposit_paid"]),
        supabase
          .from("bookings")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null)
          .lt("payment_deadline", today)
          .not("status", "in", '("fully_paid","completed","cancelled")'),
        supabase
          .from("payments")
          .select("amount")
          .gte("payment_date", firstOfMonth)
          .neq("type", "refund"),
      ]);

      const monthRevenue = (revenueRes.data ?? []).reduce(
        (s: number, p: { amount: number }) => s + (p.amount ?? 0),
        0,
      );

      return {
        activeCount: activeRes.count ?? 0,
        awaitingPaymentCount: awaitingRes.count ?? 0,
        overdueCount: overdueRes.count ?? 0,
        currentMonthRevenue: monthRevenue,
      };
    });
  }, []);

  return {
    loading,
    error,
    getBookings,
    searchBookings,
    getBookingById,
    createBooking,
    updateBooking,
    updateBookingStatus,
    deleteBooking,
    addPayment,
    deletePayment,
    getBookingStats,
  };
}
