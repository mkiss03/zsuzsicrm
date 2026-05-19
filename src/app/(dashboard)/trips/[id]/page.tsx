import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TripDetailView } from "./TripDetailView";
import type { Trip } from "@/types";

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props) {
  const supabase = createClient();
  const { data } = await supabase
    .from("trips")
    .select("name, trip_code")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();
  if (!data) return { title: "Utazás" };
  return { title: `${(data as { name: string }).name}` };
}

export default async function TripDetailPage({ params }: Props) {
  const supabase = createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();

  if (!trip) notFound();

  return <TripDetailView trip={trip as unknown as Trip} />;
}
