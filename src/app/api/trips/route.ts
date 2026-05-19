import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { tripSchema } from "@/lib/validators/trip";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const page = Number(searchParams.get("page") ?? 1);
  const pageSize = Number(searchParams.get("pageSize") ?? 20);
  const from = (page - 1) * pageSize;

  const supabase = createAdminClient();
  let query = supabase
    .from("trips")
    .select("*", { count: "exact" })
    .is("deleted_at", null)
    .order("departure_date", { ascending: false })
    .range(from, from + pageSize - 1);

  if (status) query = query.eq("status", status);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, count, page, pageSize });
}

export async function POST(request: Request) {
  const body = await request.json() as unknown;
  const parsed = tripSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Érvénytelen adatok", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("trips")
    .insert(parsed.data)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
