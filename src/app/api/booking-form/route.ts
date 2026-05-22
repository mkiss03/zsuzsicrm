/**
 * Public API endpoint consumed by the utazofotos.com website booking form.
 *
 * Security layers (in order of evaluation):
 *   1. CORS origin check
 *   2. Honeypot field (silent 422 if filled)
 *   3. Zod input validation (400 with per-field errors)
 *   4. IP rate limiting via Supabase rate_limits table (429 with Retry-After)
 *   5. Actual processing (client upsert → booking → notification → emails)
 *
 * Zero lost bookings: all emails are fire-and-forget; email failures never
 * prevent the booking from being created or the 200 from being returned.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { sendTemplatedEmail } from "@/lib/email/resend";
import type { Booking, Client, EmailTemplate, Trip } from "@/types";

// ─── Configuration ─────────────────────────────────────────────────────────

const ENDPOINT       = "booking-form";
const RATE_LIMIT     = 5;           // max requests per window
const WINDOW_SECONDS = 60 * 60;     // 1-hour window

/** Origins allowed to POST to this endpoint. */
const STATIC_ALLOWED = [
  "https://utazofotos.com",
  "https://www.utazofotos.com",
];

if (process.env.CORS_EXTRA_ORIGIN) {
  STATIC_ALLOWED.push(process.env.CORS_EXTRA_ORIGIN);
}

// Localhost always allowed; removed from prod via CORS check (not stripped here
// so devs can test locally).
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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age":       "86400",
    "Vary":                         "Origin",
  };
}

// ─── Input schema ──────────────────────────────────────────────────────────

const formSchema = z.object({
  name:     z.string().min(2, "Legalább 2 karakter").max(100, "Legfeljebb 100 karakter").trim(),
  email:    z.string().email("Érvényes email cím szükséges").trim().toLowerCase(),
  phone:    z.string().min(6, "Legalább 6 karakter").max(20, "Legfeljebb 20 karakter").trim(),
  trip:     z.string().min(2, "Legalább 2 karakter").max(200).trim(),
  trip_id:  z.string().uuid().optional(),
  message:  z.string().max(1000, "Legfeljebb 1000 karakter").trim().optional().default(""),
  honeypot: z.string().max(0, "").default(""),   // must be empty
});

// ─── IP extraction ─────────────────────────────────────────────────────────

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// ─── Rate limiting ─────────────────────────────────────────────────────────

interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

async function checkRateLimit(
  supabase: ReturnType<typeof createAdminClient>,
  ip: string,
): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString();

  // Clean up expired windows (fire-and-forget)
  void supabase
    .from("rate_limits")
    .delete()
    .eq("endpoint", ENDPOINT)
    .lt("window_start", windowStart);

  // Fetch current window for this IP
  const { data: rows } = await supabase
    .from("rate_limits")
    .select("id, count, window_start")
    .eq("ip", ip)
    .eq("endpoint", ENDPOINT)
    .gte("window_start", windowStart)
    .order("window_start", { ascending: false })
    .limit(1);

  const record = (rows ?? [])[0] as { id: string; count: number; window_start: string } | undefined;

  if (record && record.count >= RATE_LIMIT) {
    const windowExpiry = new Date(record.window_start).getTime() + WINDOW_SECONDS * 1000;
    const retryAfter   = Math.max(1, Math.ceil((windowExpiry - Date.now()) / 1000));
    return { allowed: false, retryAfter };
  }

  if (record) {
    await supabase
      .from("rate_limits")
      .update({ count: record.count + 1 })
      .eq("id", record.id);
  } else {
    await supabase
      .from("rate_limits")
      .insert({ ip, endpoint: ENDPOINT, count: 1 });
  }

  return { allowed: true };
}

// ─── Name parser ───────────────────────────────────────────────────────────

function parseName(fullName: string): { first_name: string; last_name: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: "Ismeretlen", last_name: "" };
  if (parts.length === 1) return { first_name: parts[0]!, last_name: parts[0]! };
  // Hungarian convention: family name comes first
  const last_name  = parts[0]!;
  const first_name = parts.slice(1).join(" ");
  return { first_name, last_name };
}

// ─── Variable replacement ──────────────────────────────────────────────────

function replaceVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`);
}

function bodyToHtml(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/_(.*?)_/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
}

// ─── OPTIONS handler (CORS preflight) ─────────────────────────────────────

export async function OPTIONS(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

// ─── POST handler ──────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  const hdrs   = corsHeaders(origin);

  // ── CORS check ─────────────────────────────────────────────────────────
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json({ success: false }, { status: 403, headers: hdrs });
  }

  // ── Parse body ─────────────────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Érvénytelen kérés" },
      { status: 400, headers: hdrs },
    );
  }

  // ── STEP 1: Honeypot check (silent — bots get no info) ─────────────────
  const maybeHoneypot = (rawBody as Record<string, unknown>)?.honeypot;
  if (typeof maybeHoneypot === "string" && maybeHoneypot.trim() !== "") {
    return NextResponse.json({ success: false }, { status: 422, headers: hdrs });
  }

  // ── STEP 2: Validate fields ─────────────────────────────────────────────
  const parsed = formSchema.safeParse(rawBody);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((iss) => ({
      field:   iss.path[0] as string,
      message: iss.message,
    }));
    return NextResponse.json(
      { success: false, errors },
      { status: 400, headers: hdrs },
    );
  }

  const { name, email, phone, trip: tripName, trip_id: tripId, message } = parsed.data;

  // ── Rate limiting (after honeypot/validation to avoid unnecessary DB hits)
  const ip  = getClientIp(request);
  const supabase = createAdminClient();

  const rateResult = await checkRateLimit(supabase, ip);
  if (!rateResult.allowed) {
    return NextResponse.json(
      { success: false, message: "Túl sok kérés, próbáld újra később" },
      {
        status: 429,
        headers: {
          ...hdrs,
          "Retry-After": String(rateResult.retryAfter ?? 3600),
        },
      },
    );
  }

  try {
    // ── Load settings ─────────────────────────────────────────────────────
    const { data: settingsRows } = await supabase
      .from("settings")
      .select("key, value");
    const settings: Record<string, string> = Object.fromEntries(
      (settingsRows ?? []).map((s: { key: string; value: string | null }) => [s.key, s.value ?? ""]),
    );
    const agencyName     = settings["agency_name"]          ?? "ZsuzsiTravel";
    const notifyEmail    = settings["notification_email"]    || settings["agency_email"] || null;
    const fromEmail      = process.env.RESEND_FROM_EMAIL    ?? `noreply@zsuzsitravel.hu`;

    // ── STEP 3: Client upsert ─────────────────────────────────────────────
    let client: Client;

    const { data: existingClient } = await supabase
      .from("clients")
      .select("*")
      .ilike("email", email)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingClient) {
      client = existingClient as Client;
    } else {
      const { first_name, last_name } = parseName(name);
      const { data: newClient, error: clientErr } = await supabase
        .from("clients")
        .insert({
          first_name,
          last_name,
          email,
          phone,
          source: "website_form",
        })
        .select()
        .single();

      if (clientErr || !newClient) {
        throw new Error(`Client creation failed: ${clientErr?.message ?? "unknown"}`);
      }
      client = newClient as Client;
    }

    // ── STEP 4: Trip lookup ────────────────────────────────────────────────
    let matchedTrip: Trip | null = null;

    if (tripId) {
      // Exact ID match — sent by the booking form dropdown
      const { data: tripById } = await supabase
        .from("trips")
        .select("*")
        .eq("id", tripId)
        .is("deleted_at", null)
        .maybeSingle();
      matchedTrip = (tripById as Trip | null) ?? null;
    }

    if (!matchedTrip) {
      // Fallback: fuzzy name search (backward-compat with plain-text forms)
      const { data: tripData } = await supabase
        .from("trips")
        .select("*")
        .ilike("name", `%${tripName}%`)
        .not("status", "in", '("completed","cancelled")')
        .is("deleted_at", null)
        .order("departure_date")
        .limit(1)
        .maybeSingle();
      matchedTrip = (tripData as Trip | null) ?? null;
    }
    // ── STEP 4a: Capacity check ───────────────────────────────────────────────
    if (matchedTrip && (matchedTrip.status === "full" || matchedTrip.current_bookings >= matchedTrip.max_capacity)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Ez az utazás sajnos már megtelt. Kérjük, hívjon minket vagy válasszon másik utazást!",
        },
        { status: 409, headers: hdrs },
      );
    }
    // ── STEP 4b: Create booking ────────────────────────────────────────────
    const notesParts = [
      message ? `Üzenet: ${message}` : null,
      !matchedTrip ? `Kért utazás (nem egyeztetett): ${tripName}` : null,
    ].filter(Boolean);

    const bookingPayload: Record<string, unknown> = {
      client_id: client.id,
      trip_id:   matchedTrip?.id ?? null,
      status:    "interested",
      source:    "website_form",
      notes:     notesParts.length > 0 ? notesParts.join("\n") : null,
    };

    const { data: newBooking, error: bookingErr } = await supabase
      .from("bookings")
      .insert(bookingPayload)
      .select()
      .single();

    if (bookingErr || !newBooking) {
      throw new Error(`Booking creation failed: ${bookingErr?.message ?? "unknown"}`);
    }
    const booking = newBooking as Booking;

    // ── STEP 5: Notification ───────────────────────────────────────────────
    await supabase.from("notifications").insert({
      type:         "new_booking",
      title:        "Új foglalás a weboldalról",
      message:      `${name} jelentkezett: ${tripName}`,
      related_id:   booking.id,
      related_type: "booking",
      is_read:      false,
    });

    // ── STEP 6: Confirmation email to client ───────────────────────────────
    // Fire-and-forget: email failure must never block the 200 response.
    void (async () => {
      try {
        if (!client.email) return;
        if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === "re_xxxxxxxxxxxxxxxxxxxxxxxx") return;

        // Try to find a 'confirmation' template
        const { data: tmpl } = await supabase
          .from("email_templates")
          .select("*")
          .eq("type", "confirmation")
          .eq("is_default", true)
          .maybeSingle();

        const template = tmpl as EmailTemplate | null;

        if (template) {
          const vars: Record<string, string> = {
            client_name:       `${client.last_name} ${client.first_name}`,
            ugyfel_neve:       `${client.last_name} ${client.first_name}`,
            trip_name:         matchedTrip?.name ?? tripName,
            ut_neve:           matchedTrip?.name ?? tripName,
            departure_date:    matchedTrip?.departure_date ?? "",
            indulas_datum:     matchedTrip?.departure_date ?? "",
            return_date:       matchedTrip?.return_date ?? "",
            booking_code:      booking.booking_code,
            foglalas_kod:      booking.booking_code,
            agency_name:       agencyName,
            iroda_neve:        agencyName,
          };
          await sendTemplatedEmail({ to: client.email, template, variables: vars });
        } else {
          // Fallback: plain confirmation email
          const { Resend } = await import("resend");
          const r = new Resend(process.env.RESEND_API_KEY);
          await r.emails.send({
            from:    `${agencyName} <${fromEmail}>`,
            to:      client.email,
            subject: `Foglalásod visszaigazolása – ${matchedTrip?.name ?? tripName}`,
            text: [
              `Kedves ${client.first_name}!`,
              "",
              "Köszönjük a jelentkezésedet.",
              "",
              `Kért utazás: ${matchedTrip?.name ?? tripName}`,
              `Foglalás kód: ${booking.booking_code}`,
              "",
              "Hamarosan felvesszük veled a kapcsolatot a részletek egyeztetéséhez.",
              "",
              `Üdvözlettel,`,
              agencyName,
            ].join("\n"),
          });
        }
      } catch (emailErr) {
        console.error("[booking-form] confirmation email failed:", emailErr);
      }
    })();

    // ── STEP 7: Notification email to owner ────────────────────────────────
    void (async () => {
      try {
        if (!notifyEmail) return;
        if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === "re_xxxxxxxxxxxxxxxxxxxxxxxx") return;

        const { Resend } = await import("resend");
        const r = new Resend(process.env.RESEND_API_KEY);

        const ts = new Date().toLocaleString("hu-HU", {
          timeZone: "Europe/Vienna",
          year: "numeric", month: "short", day: "numeric",
          hour: "2-digit", minute: "2-digit",
        });

        const textBody = [
          `Új foglalási érdeklődés érkezett a weboldalról.`,
          ``,
          `── Részletek ──────────────────────────────────`,
          `Név:          ${name}`,
          `Email:        ${email}`,
          `Telefon:      ${phone}`,
          `Kért utazás:  ${tripName}`,
          matchedTrip ? `Párosított út: ${matchedTrip.name} (${matchedTrip.departure_date})` : `Párosított út: (nem találtam egyezést)`,
          message ? `Üzenet:       ${message}` : null,
          ``,
          `── CRM hivatkozások ────────────────────────────`,
          `Ügyfél: ${process.env.NEXT_PUBLIC_APP_URL ?? ""}/clients/${client.id}`,
          `Foglalás: ${process.env.NEXT_PUBLIC_APP_URL ?? ""}/bookings/${booking.id}`,
          ``,
          `Időpont: ${ts}`,
          `IP: ${ip}`,
        ].filter((l) => l !== null).join("\n");

        const htmlBody = textBody
          .replace(/── (.*?) ──+/g, "<h3>$1</h3>")
          .replace(/\n/g, "<br>")
          .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');

        await r.emails.send({
          from:    `${agencyName} CRM <${fromEmail}>`,
          to:      notifyEmail,
          subject: `Új weboldalas foglalás: ${name}`,
          text:    textBody,
          html:    `<pre style="font-family:monospace;font-size:14px">${htmlBody}</pre>`,
        });
      } catch (ownerEmailErr) {
        console.error("[booking-form] owner notification email failed:", ownerEmailErr);
      }
    })();

    // ── All done ─────────────────────────────────────────────────────────
    return NextResponse.json(
      {
        success: true,
        message: "Köszönjük a jelentkezést!",
        bookingCode: booking.booking_code,
      },
      { status: 200, headers: hdrs },
    );

  } catch (err) {
    console.error("[booking-form] unhandled error:", err);
    return NextResponse.json(
      { success: false, message: "Szerver hiba" },
      { status: 500, headers: hdrs },
    );
  }
}
