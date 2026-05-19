import { notFound } from "next/navigation";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { ClientProfileView } from "./ProfileView";

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props) {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("clients")
    .select("first_name, last_name")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();
  if (!data) return { title: "Ügyfél" };
  return { title: `${data.last_name} ${data.first_name}` };
}

export default async function ClientProfilePage({ params }: Props) {
  const supabase = createServerClient();
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", params.id)
    .is("deleted_at", null)
    .single();

  if (!client) notFound();

  return <ClientProfileView client={client as never} />;
}
