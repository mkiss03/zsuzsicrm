import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const body = (await request.json()) as {
    label?: unknown;
    color?: unknown;
    sort_order?: unknown;
  };

  const patch: Record<string, unknown> = {};
  if (typeof body.label === "string")      patch.label      = body.label.trim();
  if (typeof body.color === "string")      patch.color      = body.color.trim();
  if (typeof body.sort_order === "number") patch.sort_order = body.sort_order;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nincs frissítendő mező." }, { status: 400 });
  }
  if ("label" in patch && !patch.label) {
    return NextResponse.json({ error: "A label nem lehet üres." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("lookup_options")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: "Nem található." },  { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const supabase = createAdminClient();

  // Refuse to delete system-owned rows
  const { data: row, error: fetchErr } = await supabase
    .from("lookup_options")
    .select("is_system")
    .eq("id", id)
    .single();

  if (fetchErr || !row) return NextResponse.json({ error: "Nem található." }, { status: 404 });
  if (row.is_system) {
    return NextResponse.json(
      { error: "Rendszer-értéket nem lehet törölni." },
      { status: 403 }
    );
  }

  const { error } = await supabase
    .from("lookup_options")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
