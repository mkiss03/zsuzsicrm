import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BookingDetailView } from "./BookingDetailView";
import type { Booking, BookingParticipant, Client, Trip, Payment } from "@/types";

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props) {
  const supabase = createClient();
  const { data } = await supabase
    .from("bookings")
    .select("booking_code")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();
  return { title: data ? `Foglalás – ${(data as { booking_code: string }).booking_code}` : "Foglalás" };
}

export default async function BookingDetailPage({ params }: Props) {
  const supabase = createClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("*, client:clients(*), trip:trips(*), payments:payments(*), participants:booking_participants(*)")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();

  if (!booking) notFound();

  const b = booking as unknown as Booking & {
    client: Client;
    trip: Trip | null;
    payments: Payment[];
    participants: BookingParticipant[];
  };

  return (
    <BookingDetailView
      booking={{ ...b, participants: b.participants ?? [] }}
      initialPayments={b.payments ?? []}
    />
  );
}
