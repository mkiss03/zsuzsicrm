/**
 * Dry-run test endpoint for the booking-form API.
 * Only available in development (NODE_ENV !== "production").
 * Never writes to the database; returns exactly what the real endpoint
 * would do, including all validation and rate-limit checks.
 *
 * Usage:
 *   POST /api/booking-form/test
 *   Body: same JSON as /api/booking-form
 *
 * Extra query params:
 *   ?simulate=rate_limit   → act as if rate limit is hit
 *   ?simulate=trip_found   → pretend a matching trip exists (returns dummy data)
 *   ?simulate=new_client   → pretend the email is unknown (new client would be created)
 *   ?simulate=existing_client → pretend the email is already in the DB
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";

// ─── Guard ────────────────────────────────────────────────────────────────────

function isTestEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  // Allow explicit opt-in on staging via env var
  const key = process.env.BOOKING_FORM_TEST_KEY;
  return !!key;
}

// ─── Shared schema (same as main endpoint) ────────────────────────────────────

const formSchema = z.object({
  name:     z.string().min(2).max(100).trim(),
  email:    z.string().email().trim().toLowerCase(),
  phone:    z.string().min(6).max(20).trim(),
  trip:     z.string().min(2).max(200).trim(),
  message:  z.string().max(1000).trim().optional().default(""),
  honeypot: z.string().max(0).default(""),
});

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  if (!isTestEnabled()) {
    return NextResponse.json(
      { error: "Test endpoint not available in this environment" },
      { status: 404 },
    );
  }

  const { searchParams } = new URL(request.url);
  const simulate = searchParams.get("simulate") ?? "";

  // ── Simulate rate limit ───────────────────────────────────────────────────
  if (simulate === "rate_limit") {
    return NextResponse.json({
      dryRun:     true,
      would:      "return_429",
      retryAfter: 3600,
      message:    "Túl sok kérés, próbáld újra később",
    });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ dryRun: true, would: "return_400", error: "Invalid JSON" }, { status: 400 });
  }

  // ── Honeypot ──────────────────────────────────────────────────────────────
  const maybeHoneypot = (rawBody as Record<string, unknown>)?.honeypot;
  if (typeof maybeHoneypot === "string" && maybeHoneypot.trim() !== "") {
    return NextResponse.json({
      dryRun: true,
      would:  "return_422_silent_honeypot",
    });
  }

  // ── Validation ────────────────────────────────────────────────────────────
  const parsed = formSchema.safeParse(rawBody);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((iss) => ({
      field:   iss.path[0] as string,
      message: iss.message,
    }));
    return NextResponse.json({
      dryRun:  true,
      would:   "return_400_validation_errors",
      errors,
    }, { status: 400 });
  }

  const { name, email, phone, trip: tripName, message } = parsed.data;

  // ── Database simulation (read-only lookups) ───────────────────────────────
  const supabase = createAdminClient();

  // Check if client exists
  let clientStatus: "existing" | "would_create";
  let existingClientId: string | null = null;

  if (simulate === "existing_client") {
    clientStatus    = "existing";
    existingClientId = "simulated-existing-client-id";
  } else if (simulate === "new_client") {
    clientStatus = "would_create";
  } else {
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id, first_name, last_name")
      .ilike("email", email)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingClient) {
      clientStatus    = "existing";
      existingClientId = (existingClient as { id: string }).id;
    } else {
      clientStatus = "would_create";
    }
  }

  // Check if trip matches
  let tripStatus: "matched" | "no_match";
  let matchedTrip: { id: string; name: string; departure_date: string; max_capacity: number; current_bookings: number } | null = null;

  if (simulate === "trip_found") {
    tripStatus  = "matched";
    matchedTrip = {
      id:               "simulated-trip-id",
      name:             tripName,
      departure_date:   "2026-09-01",
      max_capacity:     12,
      current_bookings: 7,
    };
  } else {
    const { data: tripData } = await supabase
      .from("trips")
      .select("id, name, departure_date, max_capacity, current_bookings")
      .ilike("name", `%${tripName}%`)
      .not("status", "in", '("completed","cancelled")')
      .is("deleted_at", null)
      .order("departure_date")
      .limit(1)
      .maybeSingle();

    if (tripData) {
      tripStatus  = "matched";
      matchedTrip = tripData as unknown as typeof matchedTrip;
    } else {
      tripStatus = "no_match";
    }
  }

  // ── Rate limit read (no increment) ───────────────────────────────────────
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { data: rateRows } = await supabase
    .from("rate_limits")
    .select("count, window_start")
    .eq("ip", ip)
    .eq("endpoint", "booking-form")
    .gte("window_start", windowStart)
    .order("window_start", { ascending: false })
    .limit(1);

  const currentCount = ((rateRows ?? [])[0] as { count: number } | undefined)?.count ?? 0;

  // ── Compose result ────────────────────────────────────────────────────────
  return NextResponse.json({
    dryRun: true,
    would:  "return_200_success",

    input: { name, email, phone, trip: tripName, message },

    checks: {
      honeypot:   "passed",
      validation: "passed",
      rateLimit: {
        currentRequests: currentCount,
        limit:           5,
        wouldAllow:      currentCount < 5,
        note:            "This call did NOT increment the counter",
      },
    },

    client: clientStatus === "existing"
      ? { action: "use_existing", id: existingClientId }
      : {
          action: "would_create",
          parsedName: (() => {
            const parts = name.trim().split(/\s+/).filter(Boolean);
            return parts.length <= 1
              ? { last_name: parts[0] ?? "", first_name: parts[0] ?? "" }
              : { last_name: parts[0]!, first_name: parts.slice(1).join(" ") };
          })(),
          source: "website_form",
        },

    trip: tripStatus === "matched"
      ? {
          action: "linked",
          match:  matchedTrip,
          spotsRemaining: matchedTrip
            ? matchedTrip.max_capacity - matchedTrip.current_bookings
            : null,
        }
      : {
          action:  "no_match",
          tripNameStoredInNotes: tripName,
          bookingTripId: null,
          note: "trip_id will be NULL (requires migration 20260513000002)",
        },

    booking: {
      action:  "would_create",
      status:  "interested",
      source:  "website_form",
      notes:   [
        message ? `Üzenet: ${message}` : null,
        tripStatus === "no_match" ? `Kért utazás (nem egyeztetett): ${tripName}` : null,
      ].filter(Boolean).join("\n") || null,
    },

    notifications: [
      {
        type:    "new_booking",
        title:   "Új foglalás a weboldalról",
        message: `${name} jelentkezett: ${tripName}`,
      },
    ],

    emails: {
      confirmation: {
        to:     email,
        status: "would_send",
        templateType: "confirmation",
        note: "Uses is_default=true confirmation template; falls back to plain text",
      },
      ownerNotification: {
        to:     "(settings.notification_email or agency_email)",
        status: "would_send",
        subject: `Új weboldalas foglalás: ${name}`,
      },
    },
  });
}

/** Allow GET requests for easy browser/curl testing. */
export async function GET(request: Request): Promise<Response> {
  if (!isTestEnabled()) {
    return NextResponse.json(
      { error: "Test endpoint not available in this environment" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    endpoint:    "/api/booking-form/test",
    description: "Dry-run tester for the booking-form API",
    method:      "POST",
    queryParams: {
      simulate: ["rate_limit", "trip_found", "new_client", "existing_client"],
    },
    exampleBody: {
      name:     "Kiss Mariann",
      email:    "test@example.com",
      phone:    "+36301234567",
      trip:     "Toszkán körutazás",
      message:  "2 főre érdeklőd nék.",
      honeypot: "",
    },
    note: "No database writes are performed (rate limit counter is NOT incremented).",
  });
}
