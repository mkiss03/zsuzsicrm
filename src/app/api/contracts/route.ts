/**
 * POST /api/contracts
 *
 * Creates a booking_contract (e-signature request) for a booking.
 * Generates the contract document from a template, stores it in the DB,
 * optionally sends it to the client by email, and initializes the
 * workflow_steps rows for the booking if they don't already exist.
 *
 * Auth: requires a valid Supabase session (dashboard users only).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { format } from "date-fns";
import { hu } from "date-fns/locale";

// ─── Workflow step definitions (canonical order) ───────────────────────────

const WORKFLOW_STEP_KEYS = [
  "inquiry_received",
  "confirmation_sent",
  "contract_send",
  "contract_sign",
  "deposit_request",
  "deposit_paid",
  "docs_verify",
  "full_payment_request",
  "full_paid",
  "pre_trip_send",
  "trip_started",
  "trip_completed",
  "followup_sent",
] as const;

// ─── Request schema ────────────────────────────────────────────────────────

const bodySchema = z.object({
  booking_id:     z.string().uuid(),
  document_type:  z.enum(["travel_contract", "health_declaration", "photo_consent"]).default("travel_contract"),
  document_body:  z.string().min(20, "A dokumentum szövege túl rövid").optional(), // override
  send_email:     z.boolean().default(true),
  expires_days:   z.number().int().min(1).max(90).default(14),
});

// ─── Default contract templates ────────────────────────────────────────────

function buildContractBody(vars: Record<string, string>, type: string): string {
  if (type === "health_declaration") {
    return `EGÉSZSÉGÜGYI NYILATKOZAT

Utazás: ${vars.trip_name}
Indulás: ${vars.departure_date}
Visszaérkezés: ${vars.return_date}
Foglalási szám: ${vars.booking_code}
Vendég neve: ${vars.client_name}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Alulírott ${vars.client_name} kijelentem, hogy:

1. Egészségi állapotom az utazáson való részvételhez megfelelő.

2. Nem szenvedek olyan krónikus betegségben, amely az utazás biztonságát veszélyeztethetné, vagy különleges egészségügyi ellátást igényel.

3. Amennyiben olyan egészségügyi körülmény áll fenn, amelyről a szervezőt tájékoztatni kell (pl. allergia, mozgáskorlátozottság, gyógyszeres kezelés), azt külön jeleztem.

4. Tudomásul veszem, hogy az utazáson való részvétel saját felelősségemre történik.

5. Megfelelő utazási és egészségügyi biztosítással rendelkezem, vagy arról gondoskodni fogok az utazás előtt.`;
  }

  if (type === "photo_consent") {
    return `FÉNYKÉPEZÉSI HOZZÁJÁRULÁSI NYILATKOZAT

Utazás: ${vars.trip_name}
Foglalási szám: ${vars.booking_code}
Vendég neve: ${vars.client_name}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Alulírott ${vars.client_name} hozzájárulok az alábbiakhoz:

1. Az utazás során a szervező (UtazóFotós / Tuza-Göncz Zsuzsanna) által készített fényképeken és videókon szerepelhetek.

2. A felvételek felhasználhatók promóciós célokra, beleértve a weboldalt, közösségi média oldalakat (Instagram, Facebook) és egyéb marketing anyagokat.

3. A felvételekért külön díjazás nem jár, és azokat kereskedelmi célokra harmadik félnek nem értékesítik.

4. A hozzájárulást bármikor visszavonhatom írásban, a visszavonás előtt közzétett felvételeket érintő visszamenőleges érvénnyel azonban nem.`;
  }

  // Default: travel_contract
  return `UTAZÁSI SZERZŐDÉS – FOGLALÁSI NYILATKOZAT

Utazás: ${vars.trip_name}
Indulás: ${vars.departure_date}
Visszaérkezés: ${vars.return_date}
Foglalási szám: ${vars.booking_code}
Vendég neve: ${vars.client_name}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. AZ UTAZÁSI FELTÉTELEK ELFOGADÁSA

Alulírott ${vars.client_name} kijelentem, hogy a fenti utazásra vonatkozó foglalást megismertem, és az összes vonatkozó feltételt elfogadom. A szervező az UtazóFotós / Tuza-Göncz Zsuzsanna (a továbbiakban: Szervező).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. FIZETÉSI FELTÉTELEK

• Teljes ár:        ${vars.final_amount} Ft
• Előleg összege:   ${vars.deposit_amount} Ft
• Előleg határideje: ${vars.payment_deadline}
• Fennmaradó összeg: ${vars.remaining_amount} Ft

Kijelentem, hogy a fenti összegek megfizetéséről a megadott határidőkig gondoskodni fogok.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. SZEMÉLYES ADATOK ÉS ÚTLEVÉL

Megerősítem, hogy az általam megadott személyes adatok, különösen az útlevél-adatok, helyesek és érvényesek. Tudomásul veszem, hogy az útlevél érvényességéért, a szükséges vízumok és egészségügyi előírások teljesítéséért kizárólag én vagyok felelős.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. LEMONDÁSI FELTÉTELEK

• 60 napnál korábban: az előleg elvesztésével jár
• 30–60 nap között:  az utazási ár 30%-a
• 14–30 nap között:  az utazási ár 50%-a
• 14 napon belül:    az utazási ár 100%-a

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. FÉNYKÉPEZÉSI HOZZÁJÁRULÁS

Hozzájárulok, hogy az utazás során a Szervező által készített felvételeken szerepeljek, és azokat promóciós célokra (weboldal, közösségi média) felhasználja.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. ADATKEZELÉS (GDPR)

Személyes adataimat az utazás megszervezéséhez szükséges mértékben kezeli a Szervező, a hatályos GDPR szabályozással összhangban. Az adatokat harmadik félnek nem adja át, kivéve a szolgáltatás teljesítéséhez elengedhetetlen eseteket (pl. szállásfoglaló, fuvarozó).`;
}

const DOCUMENT_TITLES: Record<string, string> = {
  travel_contract:    "Utazási szerződés és foglalási nyilatkozat",
  health_declaration: "Egészségügyi nyilatkozat",
  photo_consent:      "Fényképezési hozzájárulási nyilatkozat",
};

// ─── GET handler — document body preview (no contract created) ────────────

export async function GET(request: Request): Promise<Response> {
  const authClient  = createClient();
  const adminClient = createAdminClient();

  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Hitelesítés szükséges" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const booking_id    = searchParams.get("booking_id");
  const document_type = searchParams.get("document_type") ?? "travel_contract";

  if (!booking_id) {
    return NextResponse.json({ error: "Hiányzó booking_id" }, { status: 400 });
  }

  const { data: booking } = await adminClient
    .from("bookings")
    .select("*, client:clients(*), trip:trips(*)")
    .eq("id", booking_id)
    .is("deleted_at", null)
    .single();

  if (!booking) {
    return NextResponse.json({ error: "Foglalás nem található" }, { status: 404 });
  }

  const client = booking.client as Record<string, unknown>;
  const trip   = booking.trip  as Record<string, unknown>;

  const fmtDate = (d: string | null) =>
    d ? format(new Date(d), "yyyy. MMMM d.", { locale: hu }) : "—";
  const fmtNum  = (n: number | null) =>
    n != null ? n.toLocaleString("hu-HU") : "—";

  const vars: Record<string, string> = {
    client_name:      `${client.last_name} ${client.first_name}`,
    trip_name:        String(trip.name),
    departure_date:   fmtDate(trip.departure_date as string | null),
    return_date:      fmtDate(trip.return_date as string | null),
    booking_code:     String(booking.booking_code),
    final_amount:     fmtNum(booking.final_amount as number | null),
    deposit_amount:   fmtNum(booking.deposit_amount as number | null),
    payment_deadline: fmtDate(booking.payment_deadline as string | null),
    remaining_amount: booking.final_amount != null && booking.deposit_amount != null
      ? fmtNum((booking.final_amount as number) - (booking.deposit_amount as number))
      : "—",
  };

  const body  = buildContractBody(vars, document_type);
  const title = DOCUMENT_TITLES[document_type] ?? "Nyilatkozat";

  return NextResponse.json({ body, title, vars });
}

// ─── POST handler ──────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const authClient  = createClient();
  const adminClient = createAdminClient();

  // Auth check
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Hitelesítés szükséges" }, { status: 401 });
  }

  // Parse + validate body
  let raw: unknown;
  try { raw = await request.json(); }
  catch { return NextResponse.json({ error: "Érvénytelen JSON" }, { status: 400 }); }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validációs hiba", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { booking_id, document_type, document_body, send_email, expires_days } = parsed.data;

  // ── Fetch booking + client + trip ──────────────────────────────────────
  const { data: booking } = await adminClient
    .from("bookings")
    .select("*, client:clients(*), trip:trips(*)")
    .eq("id", booking_id)
    .is("deleted_at", null)
    .single();

  if (!booking) {
    return NextResponse.json({ error: "Foglalás nem található" }, { status: 404 });
  }

  const client = booking.client as Record<string, unknown>;
  const trip   = booking.trip  as Record<string, unknown>;

  // Build template variables
  const fmtDate = (d: string | null) =>
    d ? format(new Date(d), "yyyy. MMMM d.", { locale: hu }) : "—";
  const fmtNum  = (n: number | null) =>
    n != null ? n.toLocaleString("hu-HU") : "—";

  const vars: Record<string, string> = {
    client_name:      `${client.last_name} ${client.first_name}`,
    trip_name:        String(trip.name),
    departure_date:   fmtDate(trip.departure_date as string | null),
    return_date:      fmtDate(trip.return_date as string | null),
    booking_code:     String(booking.booking_code),
    final_amount:     fmtNum(booking.final_amount as number | null),
    deposit_amount:   fmtNum(booking.deposit_amount as number | null),
    payment_deadline: fmtDate(booking.payment_deadline as string | null),
    remaining_amount: booking.final_amount != null && booking.deposit_amount != null
      ? fmtNum((booking.final_amount as number) - (booking.deposit_amount as number))
      : "—",
  };

  const body  = document_body ?? buildContractBody(vars, document_type);
  const title = DOCUMENT_TITLES[document_type] ?? "Nyilatkozat";
  const expiresAt = new Date(Date.now() + expires_days * 86_400_000).toISOString();

  // ── Create contract row ────────────────────────────────────────────────
  const { data: contract, error: insertErr } = await adminClient
    .from("booking_contracts")
    .insert({
      booking_id,
      document_type,
      document_title: title,
      document_body:  body,
      expires_at:     expiresAt,
    })
    .select()
    .single();

  if (insertErr || !contract) {
    console.error("[contracts] insert error:", insertErr);
    return NextResponse.json({ error: "Adatbázis hiba" }, { status: 500 });
  }

  // ── Init workflow steps for this booking (idempotent upsert) ──────────
  const stepInserts = WORKFLOW_STEP_KEYS.map((k) => ({
    booking_id,
    step_key: k,
    status: "pending",
  }));

  await adminClient
    .from("workflow_steps")
    .upsert(stepInserts, { onConflict: "booking_id,step_key", ignoreDuplicates: true });

  // Mark contract_send as done
  await adminClient
    .from("workflow_steps")
    .update({ status: "done", done_at: new Date().toISOString(), triggered_by: "admin", related_id: contract.id })
    .eq("booking_id", booking_id)
    .eq("step_key", "contract_send");

  // ── Optionally send email ──────────────────────────────────────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://crm.utazofotos.com";
  const signUrl = `${appUrl}/sign/${contract.token}`;

  let emailSentTo: string | null = null;

  if (send_email && client.email) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const from   = process.env.RESEND_FROM_EMAIL ?? "info@utazofotos.com";

    const emailHtml = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
  <div style="background:#2563eb;padding:24px 32px;border-radius:8px 8px 0 0">
    <p style="margin:0;color:#fff;font-size:20px;font-weight:600">UtazóFotós</p>
    <p style="margin:4px 0 0;color:#bfdbfe;font-size:13px">Utazásszervezés</p>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:32px;border-radius:0 0 8px 8px">
    <p style="font-size:16px;font-weight:600;margin:0 0 8px">${title}</p>
    <p style="color:#6b7280;margin:0 0 24px;font-size:14px">
      Kedves <strong>${vars.client_name}</strong>,<br><br>
      Kérjük, olvassa el az alábbi dokumentumot, majd erősítse meg digitális aláírásával.
      A folyamat mindössze 1–2 percet vesz igénybe.
    </p>

    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin-bottom:24px;font-size:13px;color:#374151">
      <strong>Utazás:</strong> ${vars.trip_name}<br>
      <strong>Időpont:</strong> ${vars.departure_date} – ${vars.return_date}<br>
      <strong>Foglalási szám:</strong> ${vars.booking_code}
    </div>

    <a href="${signUrl}"
       style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;
              border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">
      Dokumentum megtekintése és aláírása →
    </a>

    <p style="margin:24px 0 0;font-size:12px;color:#9ca3af">
      A link ${expires_days} napig érvényes (${fmtDate(expiresAt)}).<br>
      Ha nem Ön kapta ezt az üzenetet, kérjük, hagyja figyelmen kívül.
    </p>
  </div>
</div>`;

    try {
      await resend.emails.send({
        from,
        to: client.email as string,
        subject: `${title} – ${vars.booking_code} – ${vars.trip_name}`,
        html: emailHtml,
        text: `${title}\n\nKedves ${vars.client_name},\n\nKérjük, olvassa el és írja alá az alábbi linken:\n${signUrl}\n\nA link ${expires_days} napig érvényes.`,
      });
      emailSentTo = client.email as string;
    } catch (err) {
      console.error("[contracts] email error:", err);
      // Don't fail the whole request over an email error
    }

    // Record delivery
    await adminClient
      .from("booking_contracts")
      .update({ sent_at: new Date().toISOString(), email_sent_to: emailSentTo })
      .eq("id", contract.id);
  }

  return NextResponse.json(
    {
      contract: { ...contract, email_sent_to: emailSentTo },
      sign_url: signUrl,
    },
    { status: 201 },
  );
}
