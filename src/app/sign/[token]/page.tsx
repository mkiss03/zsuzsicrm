import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/server";
import { SignPageClient, NotFound, Expired } from "./SignPageClient";

interface Props {
  params: { token: string };
}

export const metadata: Metadata = {
  title: "Dokumentum aláírása | UtazóFotós",
  robots: { index: false, follow: false }, // Don't index sign pages
};

export default async function SignPage({ params }: Props) {
  const { token } = params;
  const supabase = createAdminClient();

  // Fetch contract with related booking data
  const { data: contract } = await supabase
    .from("booking_contracts")
    .select(`
      id, token, document_type, document_title, document_body,
      status, signed_name, signed_at, expires_at,
      booking:bookings (
        booking_code,
        client:clients ( first_name, last_name ),
        trip:trips ( name, departure_date, return_date )
      )
    `)
    .eq("token", token)
    .single();

  if (!contract) {
    return <NotFound />;
  }

  const expired = new Date(contract.expires_at) < new Date();

  // Lazily mark expired in DB
  if (expired && contract.status === "pending") {
    void supabase
      .from("booking_contracts")
      .update({ status: "expired" })
      .eq("id", contract.id);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <SignPageClient contract={contract as any} expired={expired} token={token} />;
}
