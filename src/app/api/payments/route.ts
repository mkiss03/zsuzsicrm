import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { paymentSchema } from "@/lib/validators/booking";
import { z } from "zod";

const postBody = paymentSchema.extend({ booking_id: z.string().uuid() });

export async function POST(request: Request) {
  const body = await request.json() as unknown;
  const parsed = postBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Érvénytelen adatok", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("payments")
    .insert(parsed.data)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update booking status based on payment type
  const { data: booking } = await supabase
    .from("bookings")
    .select("deposit_amount,final_amount")
    .eq("id", parsed.data.booking_id)
    .single();

  if (booking) {
    const { data: allPayments } = await supabase
      .from("payments")
      .select("amount,type")
      .eq("booking_id", parsed.data.booking_id);

    const totalPaid = (allPayments ?? []).reduce((sum, p) => {
      return p.type === "refund" ? sum - p.amount : sum + p.amount;
    }, 0);

    let newStatus: string | null = null;
    if (booking.final_amount != null && totalPaid >= booking.final_amount) {
      newStatus = "fully_paid";
    } else if (booking.deposit_amount != null && totalPaid >= booking.deposit_amount) {
      newStatus = "deposit_paid";
    }

    if (newStatus) {
      const updateData: Record<string, unknown> = { status: newStatus };
      if (newStatus === "deposit_paid") updateData.deposit_paid_at = new Date().toISOString();
      if (newStatus === "fully_paid") updateData.fully_paid_at = new Date().toISOString();
      await supabase.from("bookings").update(updateData).eq("id", parsed.data.booking_id);
    }
  }

  return NextResponse.json(data, { status: 201 });
}
