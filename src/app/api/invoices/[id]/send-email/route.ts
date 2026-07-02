import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import React from "react";
import { format, parseISO } from "date-fns";
import { hu } from "date-fns/locale";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "noreply@zsuzsitravel.hu";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtHU(d: string | null | undefined): string {
  if (!d) return "";
  try { return format(parseISO(d.slice(0, 10)), "yyyy. MMM d.", { locale: hu }); }
  catch { return d.slice(0, 10); }
}

function fmtEur(n: number | null | undefined): string {
  if (n == null) return "";
  return new Intl.NumberFormat("hu-HU", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function fmtEurStr(n: number | null | undefined): string {
  if (n == null) return "—";
  return `€ ${n.toFixed(2).replace(".", ",")}`;
}

function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

function bodyToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createAdminClient();
  const { templateId, recipientEmail } = (await req.json()) as {
    templateId?: string | null;
    recipientEmail?: string;
  };

  // ── 1. Fetch invoice + client ───────────────────────────────────────────────
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("*, client:clients(*)")
    .eq("id", params.id)
    .single();

  if (invErr || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const client = invoice.client as Record<string, unknown>;

  // ── 2. Fetch booking + trip if linked ──────────────────────────────────────
  let booking: Record<string, unknown> | null = null;
  let trip: Record<string, unknown> | null = null;

  if (invoice.booking_id) {
    const { data: bk } = await supabase
      .from("bookings")
      .select("*, trip:trips(*)")
      .eq("id", invoice.booking_id)
      .single();
    if (bk) {
      booking = bk as Record<string, unknown>;
      trip = (bk as { trip: Record<string, unknown> }).trip ?? null;
    }
  }

  // ── 3. Fetch settings ───────────────────────────────────────────────────────
  const { data: settingsRows } = await supabase.from("settings").select("key, value");
  const settings: Record<string, string> = Object.fromEntries(
    (settingsRows ?? []).map((s: { key: string; value: string | null }) => [s.key, s.value ?? ""]),
  );

  const eurHufRate = settings["eur_huf_rate"] ? Number(settings["eur_huf_rate"]) : 395;
  const agencyName = settings["agency_name"] ?? "ZsuzsiTravel";

  // ── 4. Fetch template ───────────────────────────────────────────────────────
  const { data: template } = templateId
    ? await supabase.from("email_templates").select("*").eq("id", templateId).single()
    : { data: null };

  // ── 5. Build full variable map (same as /api/send-email) ───────────────────
  const clientName = `${client.last_name ?? ""} ${client.first_name ?? ""}`.trim();

  const depositAmt  = (booking?.deposit_amount as number | null) ?? null;
  const finalAmt    = (booking?.final_amount   as number | null) ?? null;
  const remaining   = finalAmt != null && depositAmt != null
    ? Math.max(finalAmt - depositAmt, 0)
    : null;
  const maxCap  = (trip?.max_capacity     as number) ?? 0;
  const curBook = (trip?.current_bookings as number) ?? 0;
  const avail   = Math.max(maxCap - curBook, 0);

  const vars: Record<string, string> = {
    // ── Booking / trip variables (same keys as /api/send-email) ──────────────
    ugyfel_neve:           clientName,
    ut_neve:               (trip?.name          as string) ?? "",
    indulas_datum:         fmtHU(trip?.departure_date as string),
    visszaerkezes_datum:   fmtHU(trip?.return_date    as string),
    foglalas_kod:          (booking?.booking_code as string) ?? "",
    ar:                    fmtEur(finalAmt),
    elofizetes_osszege:    fmtEur(depositAmt),
    fizetes_hatarido:      fmtHU(booking?.payment_deadline as string),
    hatralevo_osszeg:      fmtEur(remaining),
    iban:                  settings["bank_account_number"] ?? settings["iban"] ?? "",
    szabad_helyek:         String(avail),
    program:               (trip?.description   as string) ?? "",
    iroda_neve:            agencyName,
    talalkozasi_pont:      settings["meeting_point"] ?? "",
    indulasi_ido:          settings["departure_time"] ?? "",
    // English aliases
    client_name:       clientName,
    trip_name:         (trip?.name as string) ?? "",
    departure_date:    fmtHU(trip?.departure_date as string),
    return_date:       fmtHU(trip?.return_date    as string),
    booking_code:      (booking?.booking_code as string) ?? "",
    final_amount:      fmtEur(finalAmt),
    deposit_amount:    fmtEur(depositAmt),
    payment_deadline:  fmtHU(booking?.payment_deadline as string),
    remaining_amount:  fmtEur(remaining),
    bank_account:      settings["bank_account_number"] ?? settings["iban"] ?? "",
    agency_name:       agencyName,
    meeting_point:     settings["meeting_point"] ?? "",
    departure_time:    settings["departure_time"] ?? "",
    promo_title:       "",
    promo_body:        "",
    booking_link:      `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/bookings/${booking?.id ?? ""}`,
    // ── Invoice-specific extras ──────────────────────────────────────────────
    invoice_number:    invoice.invoice_number ?? "",
    szamla_szam:       invoice.invoice_number ?? "",
    total:             fmtEurStr(invoice.total),
    vegosszeg:         fmtEurStr(invoice.total),
    subtotal:          fmtEurStr(invoice.subtotal),
    netto:             fmtEurStr(invoice.subtotal),
    tax_amount:        fmtEurStr(invoice.tax_amount),
    afa:               fmtEurStr(invoice.tax_amount),
    issue_date:        invoice.issue_date ? invoice.issue_date.slice(0, 10) : "—",
    kiallitas_datum:   invoice.issue_date ? invoice.issue_date.slice(0, 10) : "—",
    due_date:          invoice.due_date ? invoice.due_date.slice(0, 10) : "—",
    bank_name:         settings["bank_name"] ?? "",
  };

  // ── 6. Compose subject + body ───────────────────────────────────────────────
  const subject = template
    ? interpolate(template.subject as string, vars)
    : `Számla: ${invoice.invoice_number}`;
  const bodyText = template
    ? interpolate(template.body as string, vars)
    : `Mellékletben találja a(z) ${invoice.invoice_number} számú számláját.\n\nKöszönjük!`;

  // ── 7. Generate PDF server-side ─────────────────────────────────────────────
  let pdfBuffer: Buffer | null = null;
  try {
    // Fix fonts for server-side: register with absolute URL derived from request
    const host = req.headers.get("host") ?? "localhost:3000";
    const proto = process.env.NODE_ENV === "production" ? "https" : "http";
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;

    const [{ Font, renderToBuffer }, { InvoicePDF }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/lib/invoice-pdf"),
    ]);

    // Re-register fonts with the correct absolute URL
    Font.register({
      family: "Lato",
      fonts: [
        { src: `${baseUrl}/fonts/Lato-Regular.ttf`, fontWeight: 400 },
        { src: `${baseUrl}/fonts/Lato-Bold.ttf`,    fontWeight: 700 },
      ],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(InvoicePDF as any, {
      invoice,
      client: client as never,
      settings,
      eurHufRate,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdfBuffer = Buffer.from(await (renderToBuffer as any)(element));
  } catch (pdfErr) {
    console.error("PDF generation error:", pdfErr);
  }

  // ── 8. Send via Resend ──────────────────────────────────────────────────────
  const toEmail = recipientEmail || (client.email as string | null);
  if (!toEmail) {
    return NextResponse.json({ error: "No recipient email" }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && resendKey !== "re_xxxxxxxx") {
    const resend = new Resend(resendKey);
    const sendResult = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject,
      html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.7;max-width:600px;color:#333">${bodyToHtml(bodyText)}</div>`,
      attachments: pdfBuffer
        ? [{ filename: `${invoice.invoice_number}.pdf`, content: pdfBuffer }]
        : undefined,
    });
    if (sendResult.error) {
      return NextResponse.json({ error: sendResult.error.message }, { status: 500 });
    }
  } else {
    // Dev/placeholder key: still log but skip actual send
    console.log("RESEND_API_KEY not set — skipping send. Subject:", subject);
  }

  // ── 9. Log + update invoice ─────────────────────────────────────────────────
  await Promise.all([
    supabase.from("email_logs").insert({
      client_id: (client.id as string) ?? null,
      template_id: templateId ?? null,
      booking_id: invoice.booking_id ?? null,
      subject,
      body: bodyText,
      status: "sent",
    }),
    supabase.from("invoices").update({
      sent_at: new Date().toISOString(),
      status: "sent",
    }).eq("id", params.id),
  ]);

  return NextResponse.json({ success: true, pdfAttached: pdfBuffer !== null });
}
