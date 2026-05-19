"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { ClientForm } from "@/components/clients/ClientForm";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useClients } from "@/hooks/useClients";
import type { ClientFormValues } from "@/lib/validators/client";
import type { Client } from "@/types";

export default function EditClientPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { getClientById, updateClient, loading } = useClients();

  const [client, setClient] = useState<Client | null>(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    void getClientById(id).then((c) => {
      setClient(c);
      setFetchLoading(false);
    });
  }, [id]);

  async function handleSubmit(values: ClientFormValues) {
    setSubmitLoading(true);
    const updated = await updateClient(id, values);
    setSubmitLoading(false);

    if (updated) {
      toast.success("Ügyfél adatai sikeresen frissítve!");
      router.push(`/clients/${id}`);
    } else {
      toast.error("Hiba a mentés során. Kérjük, próbáld újra.");
    }
  }

  // Map Client → ClientFormValues default values
  function toFormValues(c: Client): Partial<ClientFormValues> {
    return {
      first_name:      c.first_name,
      last_name:       c.last_name,
      email:           c.email ?? "",
      phone:           c.phone ?? "",
      address_street:  c.address_street ?? "",
      address_city:    c.address_city ?? "",
      address_zip:     c.address_zip ?? "",
      address_country: c.address_country,
      birth_date:      c.birth_date ?? "",
      nationality:     c.nationality ?? "",
      passport_number: c.passport_number ?? "",
      passport_expiry: c.passport_expiry ?? "",
      source:          c.source ?? undefined,
      is_vip:          c.is_vip,
      notes:           c.notes ?? "",
      discount_level:  c.discount_level,
    };
  }

  if (fetchLoading) {
    return (
      <div className="max-w-5xl space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="rounded-md border border-zinc-200 p-6 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-zinc-500 mb-4">Az ügyfél nem található.</p>
        <Button asChild variant="outline">
          <Link href="/clients">Vissza az ügyfelekhez</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={`Szerkesztés – ${client.last_name} ${client.first_name}`}
        subtitle={client.client_code}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/clients/${id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Vissza
            </Link>
          </Button>
        }
      />

      <div className="rounded-md border border-zinc-200 bg-white p-6">
        <ClientForm
          defaultValues={toFormValues(client)}
          onSubmit={handleSubmit}
          onCancel={() => router.push(`/clients/${id}`)}
          isLoading={submitLoading || loading}
          submitLabel="Változtatások mentése"
        />
      </div>
    </div>
  );
}
