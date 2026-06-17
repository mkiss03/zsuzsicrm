import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("ping", {});

  if (error) {
    const { error: fallbackError } = await supabase
      .from("settings")
      .select("key")
      .limit(1);
    if (fallbackError) {
      return NextResponse.json({ ok: false, error: fallbackError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}
