import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const body = await request.json() as { ids?: string[]; all?: boolean };
  const supabase = createAdminClient();

  if (body.all) {
    await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
  } else if (body.ids?.length) {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .in("id", body.ids);
  }

  return NextResponse.json({ success: true });
}
