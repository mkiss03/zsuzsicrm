import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InvoiceDetailView } from "./InvoiceDetailView";
import type { Invoice, Client } from "@/types";

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props) {
  const supabase = createClient();
  const { data } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("id", params.id)
    .single();
  return { title: data ? `Számla – ${(data as { invoice_number: string }).invoice_number}` : "Számla" };
}

export default async function InvoiceDetailPage({ params }: Props) {
  const supabase = createClient();

  const [{ data: invoice }, { data: settingsRows }] = await Promise.all([
    supabase.from("invoices").select("*, client:clients(*)").eq("id", params.id).single(),
    supabase.from("settings").select("key, value"),
  ]);

  if (!invoice) notFound();

  const settings: Record<string, string> = Object.fromEntries(
    ((settingsRows ?? []) as { key: string; value: string | null }[]).map(
      (s) => [s.key, s.value ?? ""],
    ),
  );

  return (
    <InvoiceDetailView
      invoice={invoice as unknown as Invoice & { client: Client }}
      settings={settings}
    />
  );
}
