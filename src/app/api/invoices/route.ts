import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { invoiceSchema } from "@/lib/validators/invoice";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const clientId = searchParams.get("client_id");

  const supabase = createAdminClient();
  let query = supabase
    .from("invoices")
    .select("*, client:clients(id,first_name,last_name,client_code)", { count: "exact" })
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (clientId) query = query.eq("client_id", clientId);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count });
}

export async function POST(request: Request) {
  const body = await request.json() as unknown;
  const parsed = invoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Érvénytelen adatok", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { items, tax_rate, ...rest } = parsed.data;
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const tax_amount = Math.round((subtotal * tax_rate) / 100 * 100) / 100;
  const total = subtotal + tax_amount;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("invoices")
    .insert({ ...rest, items, tax_rate, subtotal, tax_amount, total })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
