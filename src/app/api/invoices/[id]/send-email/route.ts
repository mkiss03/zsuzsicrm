import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import React from "react";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "noreply@zsuzsitravel.hu";

function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

function bodyToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createAdminClient();
  const { templateId, recipientEmail } = (await req.json()) as {
    templateId?: string | null;
    recipientEmail?: string;
  };

  // ── Fetch invoice + client ──────────────────────────────────────────────────
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("*, client:clients(*)")
    .eq("id", params.id)
    .single();

  if (invErr || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // ── Fetch settings ──────────────────────────────────────────────────────────
  const { data: settingsRows } = await supabase.from("settings").select("key, value");
  const settings: Record<string, string> = Object.fromEntries(
    (settingsRows ?? []).map((s: { key: string; value: string | null }) => [s.key, s.value ?? ""]),
  );

  const eurHufRate = settings["eur_huf_rate"] ? Number(settings["eur_huf_rate"]) : 395;

  // ── Fetch template ──────────────────────────────────────────────────────────
  const { data: template } = templateId
    ? await supabase.from("email_templates").select("*").eq("id", templateId).single()
    : { data: null };

  // ── Build variable map ──────────────────────────────────────────────────────
  const client = invoice.client as Record<string, unknown>;
  const clientName = `${client.last_name ?? ""} ${client.first_name ?? ""}`.trim();

  function fmtEurStr(n: number | null | undefined): string {
    if (n == null) return "—";
    return `€ ${n.toFixed(2).replace(".", ",")}`;
  }

  const vars: Record<string, string> = {
    // Client
    client_name: clientName,
    ugyfel_neve: clientName,
    // Invoice
    invoice_number: invoice.invoice_number ?? "",
    szamla_szam: invoice.invoice_number ?? "",
    total: fmtEurStr(invoice.total),
    vegosszeg: fmtEurStr(invoice.total),
    subtotal: fmtEurStr(invoice.subtotal),
    netto: fmtEurStr(invoice.subtotal),
    tax_amount: fmtEurStr(invoice.tax_amount),
    afa: fmtEurStr(invoice.tax_amount),
    issue_date: invoice.issue_date ? invoice.issue_date.slice(0, 10) : "—",
    kiallitas_datum: invoice.issue_date ? invoice.issue_date.slice(0, 10) : "—",
    due_date: invoice.due_date ? invoice.due_date.slice(0, 10) : "—",
    fizetes_hatarido: invoice.due_date ? invoice.due_date.slice(0, 10) : "—",
    // Agency
    agency_name: settings["agency_name"] ?? "",
    iroda_neve: settings["agency_name"] ?? "",
    iban: settings["bank_account_number"] ?? "",
    bank_name: settings["bank_name"] ?? "",
  };

  // ── Compose subject + body ──────────────────────────────────────────────────
  const subject = template
    ? interpolate(template.subject as string, vars)
    : `Számla: ${invoice.invoice_number}`;
  const bodyText = template
    ? interpolate(template.body as string, vars)
    : `Mellékletben találja a(z) ${invoice.invoice_number} számú számláját.\n\nKöszönjük!`;

  // ── Generate PDF server-side ────────────────────────────────────────────────
  let pdfBuffer: Buffer | null = null;
  try {
    const [{ renderToBuffer }, { InvoicePDF }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/lib/invoice-pdf"),
    ]);
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
    // Non-fatal: send email without attachment if PDF fails
  }

  // ── Send via Resend ─────────────────────────────────────────────────────────
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
      html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6;max-width:600px">${bodyToHtml(bodyText)}</div>`,
      attachments: pdfBuffer
        ? [{ filename: `${invoice.invoice_number}.pdf`, content: pdfBuffer }]
        : undefined,
    });
    if (sendResult.error) {
      return NextResponse.json({ error: sendResult.error.message }, { status: 500 });
    }
  }

  // ── Log + update invoice ────────────────────────────────────────────────────
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

  return NextResponse.json({ success: true });
}
