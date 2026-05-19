/**
 * GET  /api/sign/[token]  — Public: fetch contract data for the sign page
 * POST /api/sign/[token]  — Public: submit client signature
 *
 * Both endpoints are PUBLIC (no auth). They use the service-role admin
 * client because the booking_contracts RLS policy only allows authenticated
 * dashboard users — the client signing from outside has no session.
 *
 * Security:
 *  - Token is a 32-byte hex string (256 bits of entropy), unguessable
 *  - Expired contracts are rejected with 410 Gone
 *  - Already-signed contracts are rejected with 409 Conflict
 *  - IP + User-Agent are recorded for the audit trail
 *  - Rate limiting is NOT applied here (the token itself is the secret)
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";

// ─── GET ───────────────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: { token: string } },
): Promise<Response> {
  const { token } = params;
  const supabase = createAdminClient();

  const { data: contract } = await supabase
    .from("booking_contracts")
    .select(`
      id, token, document_type, document_title, document_body,
      status, signed_name, signed_at, expires_at,
      booking:bookings (
        booking_code,
        client:clients ( first_name, last_name ),
        trip:trips ( name, departure_date, return_date )
      )
    `)
    .eq("token", token)
    .single();

  if (!contract) {
    return NextResponse.json({ error: "A link nem található" }, { status: 404 });
  }

  // Compute live expiry status (don't trust DB status alone)
  const expired = new Date(contract.expires_at) < new Date();

  return NextResponse.json({ contract, expired });
}

// ─── POST ──────────────────────────────────────────────────────────────────

const signSchema = z.object({
  signed_name:    z.string().min(2, "Legalább 2 karakter sz\u00fcks\u00e9ges").max(120).trim(),
  agreed_all:     z.boolean().refine((v) => v === true, "Az \u00f6sszes felt\u00e9tel elfogad\u00e1sa k\u00f6telez\u0151"),
  signature_data: z.string().max(300_000).optional().nullable(),  // base64 PNG
});

export async function POST(
  request: Request,
  { params }: { params: { token: string } },
): Promise<Response> {
  const { token } = params;
  const supabase = createAdminClient();

  // ── Fetch contract ───────────────────────────────────────────────────
  const { data: contract } = await supabase
    .from("booking_contracts")
    .select("id, booking_id, status, expires_at")
    .eq("token", token)
    .single();

  if (!contract) {
    return NextResponse.json({ error: "A link nem található" }, { status: 404 });
  }

  if (contract.status === "signed") {
    return NextResponse.json({ error: "Ezt a dokumentumot már aláírták" }, { status: 409 });
  }

  if (contract.status === "cancelled") {
    return NextResponse.json({ error: "Ez a link vissza lett vonva" }, { status: 410 });
  }

  if (new Date(contract.expires_at) < new Date()) {
    // Lazily mark as expired in DB (fire-and-forget)
    void supabase
      .from("booking_contracts")
      .update({ status: "expired" })
      .eq("id", contract.id);

    return NextResponse.json({ error: "Ez a link lejárt" }, { status: 410 });
  }

  // ── Validate signature data ──────────────────────────────────────────
  let raw: unknown;
  try { raw = await request.json(); }
  catch { return NextResponse.json({ error: "Érvénytelen kérés" }, { status: 400 }); }

  const parsed = signSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validációs hiba", details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  // ── Extract client IP ────────────────────────────────────────────────
  const xff = request.headers.get("x-forwarded-for");
  const ip  = xff ? xff.split(",")[0]!.trim() : (request.headers.get("x-real-ip") ?? "unknown");
  const ua  = request.headers.get("user-agent") ?? "";
  const now = new Date().toISOString();

  // ── Record signature ─────────────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from("booking_contracts")
    .update({
      status:         "signed",
      signed_name:    parsed.data.signed_name,
      signed_at:      now,
      signed_ip:      ip,
      signed_ua:      ua,
      signature_data: parsed.data.signature_data ?? null,
    })
    .eq("id", contract.id);

  if (updateErr) {
    console.error("[sign] update error:", updateErr);
    return NextResponse.json({ error: "Adatbázis hiba" }, { status: 500 });
  }

  // ── Auto-advance workflow ────────────────────────────────────────────
  // Mark contract_sign as done, flip deposit_request to pending (ready for admin)
  await supabase
    .from("workflow_steps")
    .upsert([
      {
        booking_id:   contract.booking_id,
        step_key:     "contract_sign",
        status:       "done",
        done_at:      now,
        triggered_by: "client",
        related_id:   contract.id,
      },
    ], { onConflict: "booking_id,step_key" });

  // ── Create in-app notification for the agency ────────────────────────
  await supabase
    .from("notifications")
    .insert({
      type:         "new_booking",
      title:        "Nyilatkozat aláírva",
      message:      `Egy ügyfél aláírta a foglalási nyilatkozatot (${contract.booking_id}).`,
      related_id:   contract.booking_id,
      related_type: "booking",
    });

  return NextResponse.json({ success: true, signed_at: now });
}
