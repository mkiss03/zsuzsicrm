import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EditInvoiceForm from "./EditInvoiceForm";
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
  return { title: data ? `Szerkesztés – ${(data as { invoice_number: string }).invoice_number}` : "Számla szerkesztése" };
}

export default async function EditInvoicePage({ params }: Props) {
  const supabase = createClient();

  const [{ data: invoice }, { data: settingsRows }] = await Promise.all([
    supabase.from("invoices").select("*, client:clients(*)").eq("id", params.id).single(),
    supabase.from("settings").select("key, value"),
  ]);

  if (!invoice) notFound();

  if ((invoice as { status: string }).status !== "draft") {
    redirect(`/invoices/${params.id}`);
  }

  const settings: Record<string, string> = Object.fromEntries(
    ((settingsRows ?? []) as { key: string; value: string | null }[]).map(
      (s) => [s.key, s.value ?? ""],
    ),
  );

  return (
    <EditInvoiceForm
      invoice={invoice as unknown as Invoice & { client: Client }}
      settings={settings}
    />
  );
}
