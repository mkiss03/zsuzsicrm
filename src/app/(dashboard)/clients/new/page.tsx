"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/PageHeader";
import { ClientForm } from "@/components/clients/ClientForm";
import { Button } from "@/components/ui/button";
import { useClients } from "@/hooks/useClients";
import type { ClientFormValues } from "@/lib/validators/client";

export default function NewClientPage() {
  const router = useRouter();
  const { createClient, loading } = useClients();
  const [submitLoading, setSubmitLoading] = useState(false);

  async function handleSubmit(values: ClientFormValues) {
    setSubmitLoading(true);
    const created = await createClient(values);
    setSubmitLoading(false);

    if (created) {
      toast.success("Ügyfél sikeresen létrehozva!");
      router.push(`/clients/${created.id}`);
    } else {
      toast.error("Hiba az ügyfél létrehozása során. Kérjük, próbáld újra.");
    }
  }

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Új ügyfél"
        subtitle="Töltsd ki az alábbi mezőket az ügyfél rögzítéséhez"
        actions={
          <Button variant="outline" asChild>
            <Link href="/clients">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Vissza
            </Link>
          </Button>
        }
      />

      <div className="rounded-md border border-zinc-200 bg-white p-6">
        <ClientForm
          onSubmit={handleSubmit}
          onCancel={() => router.push("/clients")}
          isLoading={submitLoading || loading}
          submitLabel="Ügyfél létrehozása"
        />
      </div>
    </div>
  );
}
