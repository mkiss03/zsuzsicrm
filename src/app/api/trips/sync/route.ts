/**
 * Website → CRM trip synchronisation
 *
 * GET  /api/trips/sync           — one-time bulk import of all active trips
 *                                  from the website's Supabase project.
 *                                  Protected by Bearer TRIPS_SYNC_SECRET.
 *
 * POST /api/trips/sync           — Supabase Database Webhook receiver.
 *                                  Configure on the website project:
 *                                    Table:  departures  (INSERT, UPDATE, DELETE)
 *                                    Table:  destinations (UPDATE, DELETE)
 *                                  Protected by Bearer TRIPS_SYNC_SECRET.
 *
 * Required env vars (add to Vercel project settings):
 *   TRIPS_SYNC_SECRET          — random secret shared with the webhook config
 *   WEBSITE_SUPABASE_URL       — website's Supabase project URL
 *   WEBSITE_SUPABASE_SERVICE_KEY — website's service role key (server-side only)
 */

import { NextResponse }                from "next/server";
import { createClient as rawClient }   from "@supabase/supabase-js";
import { createAdminClient }           from "@/lib/supabase/server";

// ─── Auth ─────────────────────────────────────────────────────────────────────

function authorized(req: Request): boolean {
  const secret = process.env.TRIPS_SYNC_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// ─── Website Supabase client ──────────────────────────────────────────────────

function websiteSupabase() {
  const url = process.env.WEBSITE_SUPABASE_URL;
  const key = process.env.WEBSITE_SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("WEBSITE_SUPABASE_URL / WEBSITE_SUPABASE_SERVICE_KEY not set");
  return rawClient(url, key);
}

// ─── Field helpers ────────────────────────────────────────────────────────────

/** Map website departure status enum → CRM TripStatus */
function mapStatus(s: string | null | undefined): string {
  switch ((s ?? "").toLowerCase()) {
    case "full":
    case "sold_out":
    case "megtelt":
      return "full";
    case "cancelled":
    case "canceled":
    case "törölve":
    case "lemondva":
      return "cancelled";
    case "completed":
    case "done":
    case "befejezett":
      return "completed";
    default:
      return "advertised";
  }
}

/** Strip non-numeric chars and parse to a decimal number */
function parsePrice(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = Number(raw.replace(/[^\d.]/g, ""));
  return isNaN(n) || n < 0 ? 0 : n;
}

/** Add N days to an ISO date string, return ISO date string */
function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Validate that a string looks like an ISO date (YYYY-MM-DD) */
function isValidDate(s: string | null | undefined): s is string {
  if (!s) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

interface WebsiteDestination {
  id: string;
  title: string;
  region: string | null;
  excerpt: string | null;
  published: boolean;
}

interface WebsiteDeparture {
  id: string;
  destination_id: string;
  date_iso: string | null;
  duration_days: number | null;
  price_from: string | null;
  max_people: number | null;
  status: string | null;
  note: string | null;
}

function buildCrmTrip(
  dep: WebsiteDeparture,
  dest: WebsiteDestination,
): Record<string, unknown> {
  const departureDate = isValidDate(dep.date_iso) ? dep.date_iso : null;
  const returnDate = departureDate
    ? addDays(departureDate, Math.max(dep.duration_days ?? 1, 1))
    : null;

  return {
    external_id:              dep.id,
    external_destination_id:  dep.destination_id,
    external_source:          "website",
    name:                     dest.title || "Névtelen utazás",
    destination:              dest.region  || "Nincs megadva",
    description:              dest.excerpt ?? null,
    departure_date:           departureDate ?? new Date().toISOString().slice(0, 10),
    return_date:              returnDate    ?? new Date().toISOString().slice(0, 10),
    base_price:               parsePrice(dep.price_from),
    max_capacity:             dep.max_people && dep.max_people > 0 ? dep.max_people : 20,
    status:                   mapStatus(dep.status),
  };
}

// ─── Upsert helper (find-then-insert/update to avoid partial-index issues) ────

type CrmClient = ReturnType<typeof createAdminClient>;

async function upsertTripFromWebsite(
  crm: CrmClient,
  tripData: Record<string, unknown>,
): Promise<{ action: "inserted" | "updated" | "error"; error?: string }> {
  const { data: existing } = await crm
    .from("trips")
    .select("id")
    .eq("external_id", tripData.external_id as string)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    const { error } = await crm
      .from("trips")
      .update(tripData)
      .eq("id", (existing as { id: string }).id);
    return error ? { action: "error", error: error.message } : { action: "updated" };
  } else {
    const { error } = await crm.from("trips").insert(tripData);
    return error ? { action: "error", error: error.message } : { action: "inserted" };
  }
}

// ─── GET — bulk import ────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let website: ReturnType<typeof websiteSupabase>;
  try {
    website = websiteSupabase();
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 },
    );
  }

  // Fetch all published destinations
  const { data: destinations, error: destErr } = await website
    .from("destinations")
    .select("id, title, region, excerpt, published")
    .eq("published", true);

  if (destErr) {
    return NextResponse.json({ error: destErr.message }, { status: 500 });
  }

  // Fetch all non-cancelled, future departures
  const today = new Date().toISOString().slice(0, 10);
  const { data: departures, error: depErr } = await website
    .from("departures")
    .select("id, destination_id, date_iso, duration_days, price_from, max_people, status, note")
    .not("status", "eq", "cancelled")
    .gte("date_iso", today);

  if (depErr) {
    return NextResponse.json({ error: depErr.message }, { status: 500 });
  }

  const destMap = new Map<string, WebsiteDestination>(
    (destinations ?? []).map((d) => [
      (d as WebsiteDestination).id,
      d as WebsiteDestination,
    ]),
  );

  const crm = createAdminClient();
  let inserted = 0, updated = 0, errors = 0;

  for (const dep of departures ?? []) {
    const d = dep as WebsiteDeparture;
    const dest = destMap.get(d.destination_id);
    if (!dest) continue;                        // orphaned departure — skip

    const result = await upsertTripFromWebsite(crm, buildCrmTrip(d, dest));
    if (result.action === "inserted") inserted++;
    else if (result.action === "updated") updated++;
    else errors++;
  }

  return NextResponse.json({ success: true, inserted, updated, errors });
}

// ─── POST — webhook receiver ──────────────────────────────────────────────────

interface WebhookPayload {
  type:       "INSERT" | "UPDATE" | "DELETE";
  table:      string;
  schema:     string;
  record:     Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
}

export async function POST(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = await request.json() as WebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, table, record, old_record } = payload;
  const crm = createAdminClient();

  // ── departures table ───────────────────────────────────────────────────────
  if (table === "departures") {
    if (type === "DELETE") {
      const externalId = (old_record?.id ?? record?.id) as string | undefined;
      if (externalId) {
        await crm
          .from("trips")
          .update({ deleted_at: new Date().toISOString() })
          .eq("external_id", externalId)
          .is("deleted_at", null);
      }
      return NextResponse.json({ success: true, action: "deleted" });
    }

    if ((type === "INSERT" || type === "UPDATE") && record) {
      const dep = record as unknown as WebsiteDeparture;

      // Fetch the destination from the website Supabase
      let website: ReturnType<typeof websiteSupabase>;
      try {
        website = websiteSupabase();
      } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
      }

      const { data: destData } = await website
        .from("destinations")
        .select("id, title, region, excerpt, published")
        .eq("id", dep.destination_id)
        .maybeSingle();

      if (!destData) {
        return NextResponse.json(
          { success: false, error: "Destination not found" },
          { status: 404 },
        );
      }

      const dest = destData as WebsiteDestination;

      // If destination is unpublished, soft-delete the CRM trip
      if (!dest.published) {
        await crm
          .from("trips")
          .update({ deleted_at: new Date().toISOString() })
          .eq("external_id", dep.id)
          .is("deleted_at", null);
        return NextResponse.json({ success: true, action: "hidden (destination unpublished)" });
      }

      const result = await upsertTripFromWebsite(crm, buildCrmTrip(dep, dest));
      return result.action === "error"
        ? NextResponse.json({ success: false, error: result.error }, { status: 500 })
        : NextResponse.json({ success: true, action: result.action });
    }
  }

  // ── destinations table ─────────────────────────────────────────────────────
  if (table === "destinations") {
    if (type === "DELETE" && old_record) {
      // Soft-delete all CRM trips for this destination
      await crm
        .from("trips")
        .update({ deleted_at: new Date().toISOString() })
        .eq("external_destination_id", old_record.id as string)
        .eq("external_source", "website")
        .is("deleted_at", null);
      return NextResponse.json({ success: true, action: "destination deleted" });
    }

    if (type === "UPDATE" && record) {
      const dest = record as unknown as WebsiteDestination;
      // Update name / destination / description on all matching CRM trips
      await crm
        .from("trips")
        .update({
          name:        dest.title        || "Névtelen utazás",
          destination: dest.region       || "Nincs megadva",
          description: dest.excerpt      ?? null,
        })
        .eq("external_destination_id", dest.id)
        .eq("external_source", "website")
        .is("deleted_at", null);

      // If destination is unpublished, hide all its trips
      if (!dest.published) {
        await crm
          .from("trips")
          .update({ deleted_at: new Date().toISOString() })
          .eq("external_destination_id", dest.id)
          .eq("external_source", "website")
          .is("deleted_at", null);
      }

      return NextResponse.json({ success: true, action: "destination updated" });
    }
  }

  return NextResponse.json({ success: true, action: "noop" });
}
