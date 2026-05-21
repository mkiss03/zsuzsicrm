/**
 * Public trip listing endpoint — consumed by the utazofotos.com booking form.
 *
 * Returns trips that are actively advertised (status = 'advertised' or 'full')
 * with future departure dates. No authentication required.
 * CORS is restricted to the same allowed origins as /api/booking-form.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// ─── Allowed origins (keep in sync with booking-form route) ───────────────────

const STATIC_ALLOWED = [
  "https://utazofotos.com",
  "https://www.utazofotos.com",
];
if (process.env.CORS_EXTRA_ORIGIN) {
  STATIC_ALLOWED.push(process.env.CORS_EXTRA_ORIGIN);
}
const DEV_ORIGINS = ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (process.env.NODE_ENV !== "production" && DEV_ORIGINS.includes(origin)) return true;
  return STATIC_ALLOWED.includes(origin);
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = isAllowedOrigin(origin);
  return {
    "Access-Control-Allow-Origin":  allowed ? origin! : STATIC_ALLOWED[0]!,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age":       "86400",
    "Vary":                         "Origin",
  };
}

// ─── OPTIONS (preflight) ──────────────────────────────────────────────────────

export async function OPTIONS(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin)) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  const hdrs   = corsHeaders(origin);

  // Allow same-origin requests (no Origin header) from the CRM itself
  if (origin && !isAllowedOrigin(origin)) {
    return NextResponse.json({ success: false }, { status: 403, headers: hdrs });
  }

  const supabase = createAdminClient();
  const today    = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const { data, error } = await supabase
    .from("trips")
    .select(
      "id, trip_code, name, destination, departure_date, return_date, " +
      "base_price, max_capacity, current_bookings, status, description",
    )
    .in("status", ["advertised", "full"])
    .gte("departure_date", today)
    .is("deleted_at", null)
    .order("departure_date");

  if (error) {
    return NextResponse.json(
      { success: false, message: "Szerverhiba" },
      { status: 500, headers: hdrs },
    );
  }

  return NextResponse.json(
    { success: true, trips: data ?? [] },
    {
      status: 200,
      headers: {
        ...hdrs,
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    },
  );
}
