/**
 * Vercel Cron — runs daily at 08:00 UTC.
 * vercel.json:
 * { "crons": [{ "path": "/api/cron/notifications", "schedule": "0 8 * * *" }] }
 *
 * Secured with CRON_SECRET header  (Bearer token).
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { addDays, format } from "date-fns";

// Guard against duplicate notification inserts — only one of each type per
// entity per calendar day (UTC date, which at 08:00 UTC is the same Austrian date).
async function notificationExistsToday(
  supabase: ReturnType<typeof createAdminClient>,
  type: string,
  relatedId: string,
  relatedType: string,
): Promise<boolean> {
  const todayStart = format(new Date(), "yyyy-MM-dd") + "T00:00:00.000Z";
  const todayEnd   = format(new Date(), "yyyy-MM-dd") + "T23:59:59.999Z";

  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("type", type)
    .eq("related_id", relatedId)
    .eq("related_type", relatedType)
    .gte("created_at", todayStart)
    .lte("created_at", todayEnd);

  return (count ?? 0) > 0;
}

async function insertNotification(
  supabase: ReturnType<typeof createAdminClient>,
  type: string,
  title: string,
  message: string,
  relatedId: string,
  relatedType: string,
) {
  // Skip if already inserted today (idempotent)
  const exists = await notificationExistsToday(supabase, type, relatedId, relatedType);
  if (exists) return false;

  const { error } = await supabase.from("notifications").insert({
    type,
    title,
    message,
    related_id: relatedId,
    related_type: relatedType,
    is_read: false,
  });

  return !error;
}

type CountSummary = Record<string, number>;

export async function GET(request: Request): Promise<Response> {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  const expected   = `Bearer ${process.env.CRON_SECRET ?? ""}`;

  // Allow Vercel internal cron (x-vercel-cron header) OR valid bearer token
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  if (!isVercelCron && authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today    = format(new Date(), "yyyy-MM-dd");
  const summary: CountSummary = {
    passport_expiry:  0,
    payment_due:      0,
    payment_overdue:  0,
    trip_soon:        0,
    low_capacity:     0,
  };

  // ── 1. PASSPORT EXPIRY — 60-day warning ─────────────────────────────────────
  {
    const cutoff = format(addDays(new Date(), 60), "yyyy-MM-dd");
    const { data: clients } = await supabase
      .from("clients")
      .select("id, first_name, last_name, passport_expiry")
      .is("deleted_at", null)
      .gte("passport_expiry", today)         // not already expired
      .lte("passport_expiry", cutoff);       // expiring within 60 days

    for (const client of clients ?? []) {
      const c = client as {
        id: string;
        first_name: string;
        last_name: string;
        passport_expiry: string;
      };
      const daysLeft = Math.ceil(
        (new Date(c.passport_expiry).getTime() - Date.now()) / 86_400_000,
      );
      const inserted = await insertNotification(
        supabase,
        "passport_expiry",
        `${c.last_name} ${c.first_name} – útlevél lejár`,
        `Az útlevél ${daysLeft} napon belül lejár (${c.passport_expiry}).`,
        c.id,
        "client",
      );
      if (inserted) summary["passport_expiry"]!++;
    }
  }

  // ── 2. PAYMENT DUE — 3-day advance warning ───────────────────────────────────
  {
    const threeDays = format(addDays(new Date(), 3), "yyyy-MM-dd");
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, booking_code, payment_deadline, client:clients(first_name,last_name)")
      .eq("payment_deadline", threeDays)     // exactly 3 days from now
      .is("deleted_at", null)
      .not("status", "in", '("fully_paid","completed","cancelled")');

    for (const b of bookings ?? []) {
      type BkRow = { id: string; booking_code: string; payment_deadline: string; client: { first_name: string; last_name: string } | null };
      const bk = b as unknown as BkRow;
      const name = bk.client
        ? `${bk.client.last_name} ${bk.client.first_name}`
        : "Ismeretlen ügyfél";
      const inserted = await insertNotification(
        supabase,
        "payment_due",
        `Közelgő fizetési határidő – ${bk.booking_code}`,
        `${name} foglalásának fizetési határideje 3 nap múlva: ${bk.payment_deadline}.`,
        bk.id,
        "booking",
      );
      if (inserted) summary["payment_due"]!++;
    }
  }

  // ── 3. PAYMENT OVERDUE — any booking with deadline < today ───────────────────
  {
    const { data: overdueBookings } = await supabase
      .from("bookings")
      .select("id, booking_code, payment_deadline, client:clients(first_name,last_name)")
      .lt("payment_deadline", today)
      .is("deleted_at", null)
      .not("status", "in", '("fully_paid","completed","cancelled")');

    for (const b of overdueBookings ?? []) {
      type OBkRow = { id: string; booking_code: string; payment_deadline: string; client: { first_name: string; last_name: string } | null };
      const bk = b as unknown as OBkRow;
      const name = bk.client
        ? `${bk.client.last_name} ${bk.client.first_name}`
        : "Ismeretlen ügyfél";
      const daysOverdue = Math.ceil(
        (Date.now() - new Date(bk.payment_deadline).getTime()) / 86_400_000,
      );
      const inserted = await insertNotification(
        supabase,
        "payment_overdue",
        `Lejárt fizetési határidő – ${bk.booking_code}`,
        `${name} foglalása ${daysOverdue} napja lejárt határidővel rendelkezik.`,
        bk.id,
        "booking",
      );
      if (inserted) summary["payment_overdue"]!++;
    }
  }

  // ── 4. TRIP SOON — 14-day advance warning ────────────────────────────────────
  {
    const fourteenDays = format(addDays(new Date(), 14), "yyyy-MM-dd");
    const { data: trips } = await supabase
      .from("trips")
      .select("id, name, departure_date, current_bookings")
      .eq("departure_date", fourteenDays)
      .is("deleted_at", null)
      .not("status", "in", '("completed","cancelled")');

    for (const t of trips ?? []) {
      const trip = t as {
        id: string;
        name: string;
        departure_date: string;
        current_bookings: number;
      };
      const inserted = await insertNotification(
        supabase,
        "trip_soon",
        `Közelgő utazás – ${trip.name}`,
        `Az utazás 14 nap múlva indul (${trip.departure_date}). ${trip.current_bookings} résztvevő.`,
        trip.id,
        "trip",
      );
      if (inserted) summary["trip_soon"]!++;
    }
  }

  // ── 5. LOW CAPACITY — 2 or fewer spots remaining ────────────────────────────
  {
    const { data: fullishTrips } = await supabase
      .from("trips")
      .select("id, name, max_capacity, current_bookings")
      .eq("status", "advertised")
      .is("deleted_at", null);

    for (const t of fullishTrips ?? []) {
      const trip = t as {
        id: string;
        name: string;
        max_capacity: number;
        current_bookings: number;
      };
      const spotsLeft = trip.max_capacity - trip.current_bookings;
      if (spotsLeft > 2 || spotsLeft < 0) continue;

      const inserted = await insertNotification(
        supabase,
        "low_capacity",
        `Szinte telt ház – ${trip.name}`,
        `Csak ${spotsLeft} szabad hely maradt (${trip.current_bookings}/${trip.max_capacity} foglalt).`,
        trip.id,
        "trip",
      );
      if (inserted) summary["low_capacity"]!++;
    }
  }

  const total = Object.values(summary).reduce((s, n) => s + n, 0);
  return NextResponse.json({
    success: true,
    date: today,
    created: total,
    summary,
  });
}
