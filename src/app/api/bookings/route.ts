import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { bookingSchema } from "@/lib/validators/booking";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const clientId = searchParams.get("client_id");
  const tripId = searchParams.get("trip_id");
  const page = Number(searchParams.get("page") ?? 1);
  const pageSize = Number(searchParams.get("pageSize") ?? 25);
  const from = (page - 1) * pageSize;

  const supabase = createAdminClient();
  let query = supabase
    .from("bookings")
    .select(
      "*, client:clients(id,first_name,last_name,email,client_code,is_vip), trip:trips(id,name,destination,departure_date)",
      { count: "exact" }
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (status) query = query.eq("status", status);
  if (clientId) query = query.eq("client_id", clientId);
  if (tripId) query = query.eq("trip_id", tripId);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, count, page, pageSize });
}

export async function POST(request: Request) {
  const body = await request.json() as unknown;
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Érvénytelen adatok", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bookings")
    .insert(parsed.data)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
