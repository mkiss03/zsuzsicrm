import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  const supabase = createAdminClient();
  let query = supabase
    .from("lookup_options")
    .select("*")
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });

  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    category?: unknown;
    value?: unknown;
    label?: unknown;
    color?: unknown;
    sort_order?: unknown;
  };

  const category = typeof body.category === "string" ? body.category.trim() : "";
  const value    = typeof body.value    === "string" ? body.value.trim()    : "";
  const label    = typeof body.label    === "string" ? body.label.trim()    : "";
  const color    = typeof body.color    === "string" ? body.color.trim()    : "";
  const sort_order = typeof body.sort_order === "number" ? body.sort_order : 999;

  if (!category || !value || !label) {
    return NextResponse.json(
      { error: "A category, value és label mező kötelező." },
      { status: 400 }
    );
  }

  // Validate that category and value contain only safe characters
  if (!/^[a-z_]+$/.test(category) || !/^[a-z0-9_]+$/.test(value)) {
    return NextResponse.json(
      { error: "A category és value csak kisbetűket és aláhúzást tartalmazhat." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("lookup_options")
    .insert({ category, value, label, color, sort_order, is_system: false })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Ez az érték ebben a kategóriában már létezik." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
