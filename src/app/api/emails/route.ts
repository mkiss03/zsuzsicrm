import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendTemplatedEmail } from "@/lib/email/resend";
import { z } from "zod";

const sendSchema = z.object({
  client_id: z.string().uuid(),
  template_id: z.string().uuid(),
  booking_id: z.string().uuid().optional(),
  variables: z.record(z.string()),
});

export async function POST(request: Request) {
  const body = await request.json() as unknown;
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Érvénytelen adatok", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const [{ data: client }, { data: template }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", parsed.data.client_id).single(),
    supabase.from("email_templates").select("*").eq("id", parsed.data.template_id).single(),
  ]);

  if (!client) return NextResponse.json({ error: "Ügyfél nem található" }, { status: 404 });
  if (!template) return NextResponse.json({ error: "Sablon nem található" }, { status: 404 });
  if (!client.email) return NextResponse.json({ error: "Az ügyfélnek nincs email címe" }, { status: 400 });

  try {
    const result = await sendTemplatedEmail({
      to: client.email,
      template,
      variables: parsed.data.variables,
    });

    await supabase.from("email_logs").insert({
      client_id: parsed.data.client_id,
      template_id: parsed.data.template_id,
      booking_id: parsed.data.booking_id ?? null,
      subject: result.subject,
      body: result.body,
      status: "sent",
    });

    return NextResponse.json({ success: true, email_id: result.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ismeretlen hiba";
    await supabase.from("email_logs").insert({
      client_id: parsed.data.client_id,
      template_id: parsed.data.template_id,
      booking_id: parsed.data.booking_id ?? null,
      subject: template.subject,
      body: template.body,
      status: "failed",
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
