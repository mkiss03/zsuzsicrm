import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { format, parseISO } from "date-fns";
import { hu } from "date-fns/locale";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "noreply@zsuzsitravel.hu";

// ─── Variable catalogue ───────────────────────────────────────────────────────
// All supported variable names in both Hungarian and English alias forms.

type VarMap = Record<string, string>;

function formatHU(d: string | null | undefined): string {
  if (!d) return "";
  try {
    return format(parseISO(d.slice(0, 10)), "yyyy. MMM d.", { locale: hu });
  } catch {
    return d.slice(0, 10);
  }
}

function formatEur(n: number | null | undefined): string {
  if (n == null) return "";
  return new Intl.NumberFormat("hu-HU", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function buildVariables(
  client: Record<string, unknown>,
  booking: Record<string, unknown> | null,
  trip: Record<string, unknown> | null,
  settings: VarMap,
): VarMap {
  const clientName = `${client.last_name ?? ""} ${client.first_name ?? ""}`.trim();

  const depositAmt   = (booking?.deposit_amount as number | null) ?? null;
  const finalAmt     = (booking?.final_amount   as number | null) ?? null;
  const remaining    = finalAmt != null && depositAmt != null
    ? Math.max(finalAmt - depositAmt, 0)
    : null;

  const maxCap  = (trip?.max_capacity         as number) ?? 0;
  const curBook = (trip?.current_bookings     as number) ?? 0;
  const avail   = Math.max(maxCap - curBook, 0);

  const agencyName = settings["agency_name"] ?? "ZsuzsiTravel";

  // Hungarian variable names (spec)
  const hunVars: VarMap = {
    ugyfel_neve:           clientName,
    ut_neve:               (trip?.name         as string) ?? "",
    indulas_datum:         formatHU(trip?.departure_date as string),
    visszaerkezes_datum:   formatHU(trip?.return_date    as string),
    foglalas_kod:          (booking?.booking_code as string) ?? "",
    ar:                    formatEur(finalAmt),
    elofizetes_osszege:    formatEur(depositAmt),
    fizetes_hatarido:      formatHU(booking?.payment_deadline as string),
    hatralevo_osszeg:      formatEur(remaining),
    iban:                  settings["iban"]    ?? "",
    szabad_helyek:         String(avail),
    program:               (trip?.description  as string) ?? "",
    iroda_neve:            agencyName,
    talalkozasi_pont:      (trip?.meeting_point as string) ?? "",
    indulasi_ido:          (trip?.departure_time as string) ?? "",
  };

  // English aliases (existing seed templates)
  const engVars: VarMap = {
    client_name:       clientName,
    trip_name:         hunVars["ut_neve"] ?? "",
    departure_date:    hunVars["indulas_datum"] ?? "",
    return_date:       hunVars["visszaerkezes_datum"] ?? "",
    booking_code:      hunVars["foglalas_kod"] ?? "",
    final_amount:      hunVars["ar"] ?? "",
    deposit_amount:    hunVars["elofizetes_osszege"] ?? "",
    payment_deadline:  hunVars["fizetes_hatarido"] ?? "",
    remaining_amount:  hunVars["hatralevo_osszeg"] ?? "",
    bank_account:      hunVars["iban"] ?? "",
    agency_name:       agencyName,
    meeting_point:     hunVars["talalkozasi_pont"] ?? "",
    departure_time:    hunVars["indulasi_ido"] ?? "",
    promo_title:       "",
    promo_body:        "",
    booking_link:      `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/bookings/${booking?.id ?? ""}`,
  };

  return { ...hunVars, ...engVars };
}

function replaceVars(text: string, vars: VarMap): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

function bodyToHtml(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/_(.*?)_/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\n/g, "<br>");
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      templateId?: string;
      clientId?: string;
      bookingId?: string | null;
      tripId?: string | null;
      customSubject?: string;
      customBody?: string;
      testMode?: boolean;
      testEmail?: string;
      // Batch send
      clientIds?: string[];
    };

    const supabase = createAdminClient();

    // ── Load settings ─────────────────────────────────────────────────────────
    const { data: settingsRows } = await supabase
      .from("settings")
      .select("key, value");
    const settings: VarMap = Object.fromEntries(
      (settingsRows ?? []).map((s: { key: string; value: string | null }) => [s.key, s.value ?? ""]),
    );
    const agencyName = settings["agency_name"] ?? "ZsuzsiTravel";

    // ── Load template ─────────────────────────────────────────────────────────
    let templateSubject = body.customSubject ?? "";
    let templateBody    = body.customBody    ?? "";
    let templateId: string | null = body.templateId ?? null;

    if (templateId && !body.customSubject && !body.customBody) {
      const { data: tmpl, error: tmplErr } = await supabase
        .from("email_templates")
        .select("*")
        .eq("id", templateId)
        .single();
      if (tmplErr || !tmpl) {
        return NextResponse.json({ error: "Sablon nem található" }, { status: 404 });
      }
      templateSubject = (tmpl as { subject: string }).subject;
      templateBody    = (tmpl as { body: string }).body;
    }

    if (!templateSubject || !templateBody) {
      return NextResponse.json({ error: "Hiányzó tárgy vagy törzs" }, { status: 400 });
    }

    // ── Resolve recipient list ─────────────────────────────────────────────────
    const recipientIds = body.clientIds ?? (body.clientId ? [body.clientId] : []);
    if (recipientIds.length === 0) {
      return NextResponse.json({ error: "Nincs megadva ügyfél" }, { status: 400 });
    }

    const results: { clientId: string; success: boolean; error?: string }[] = [];

    for (const clientId of recipientIds) {
      try {
        // Load client
        const { data: client, error: clientErr } = await supabase
          .from("clients")
          .select("*")
          .eq("id", clientId)
          .single();
        if (clientErr || !client || !(client as { email?: string }).email) {
          results.push({ clientId, success: false, error: "Ügyfél nem található vagy nincs email" });
          continue;
        }

        const clientEmail = body.testMode ? (body.testEmail ?? (client as { email: string }).email) : (client as { email: string }).email;

        // Load booking + trip if provided
        let booking: Record<string, unknown> | null = null;
        let trip: Record<string, unknown> | null = null;
        if (body.bookingId) {
          const { data: bk } = await supabase
            .from("bookings")
            .select("*, trip:trips(*)")
            .eq("id", body.bookingId)
            .single();
          booking = bk as Record<string, unknown>;
          trip    = (bk as { trip: Record<string, unknown> } | null)?.trip ?? null;
        } else if (body.tripId) {
          const { data: bk } = await supabase
            .from("bookings")
            .select("*, trip:trips(*)")
            .eq("trip_id", body.tripId)
            .eq("client_id", clientId)
            .is("deleted_at", null)
            .neq("status", "cancelled")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
          if (bk) {
            booking = bk as Record<string, unknown>;
            trip    = (bk as { trip: Record<string, unknown> } | null)?.trip ?? null;
          } else {
            const { data: t } = await supabase.from("trips").select("*").eq("id", body.tripId).single();
            trip = t as Record<string, unknown> | null;
          }
        }

        // Build variable map
        const vars = buildVariables(
          client as Record<string, unknown>,
          booking,
          trip,
          settings,
        );

        // Replace variables
        const finalSubject = replaceVars(templateSubject, vars);
        const finalText    = replaceVars(templateBody, vars);
        const finalHtml    = bodyToHtml(finalText);

        // Send via Resend (skip if no API key configured)
        let emailStatus: "sent" | "failed" = "sent";
        let resendId: string | undefined;

        if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "re_xxxxxxxx") {
          const resend = new Resend(process.env.RESEND_API_KEY);
          const { data: emailData, error: emailErr } = await resend.emails.send({
            from: `${agencyName} <${FROM_EMAIL}>`,
            to: clientEmail,
            subject: finalSubject,
            text: finalText,
            html: finalHtml,
          });
          if (emailErr) {
            emailStatus = "failed";
          } else {
            resendId = emailData?.id;
          }
        }

        // Log the email
        if (!body.testMode) {
          await supabase.from("email_logs").insert({
            client_id:   clientId,
            template_id: templateId,
            booking_id:  body.bookingId ?? null,
            subject:     finalSubject,
            body:        finalText,
            status:      emailStatus,
          });
        }

        results.push({ clientId, success: emailStatus === "sent" });
      } catch (err) {
        results.push({
          clientId,
          success: false,
          error: err instanceof Error ? err.message : "Ismeretlen hiba",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount    = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: failCount === 0,
      sent: successCount,
      failed: failCount,
      results,
    });
  } catch (err) {
    console.error("[send-email]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Szerver hiba" },
      { status: 500 },
    );
  }
}
