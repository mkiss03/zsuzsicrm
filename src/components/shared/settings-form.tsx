"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  settings: Record<string, string>;
}

// ─── Field group definitions ──────────────────────────────────────────────────

const GROUPS: {
  title: string;
  description?: string;
  fields: { key: string; label: string; type?: string; hint?: string }[];
}[] = [
  {
    title: "Iroda adatai",
    description: "Alapadatok, amelyek megjelennek a számlákon és az emailekben.",
    fields: [
      { key: "agency_name",       label: "Iroda neve (rövid)" },
      { key: "agency_legal_name", label: "Teljes cégnév (számlán)", hint: "pl. Tuza-Göncz Zsuzsanna e.U." },
      { key: "agency_email",      label: "Email cím",     type: "email" },
      { key: "agency_phone",      label: "Telefonszám" },
    ],
  },
  {
    title: "Cím",
    fields: [
      { key: "agency_street",  label: "Utca, házszám" },
      { key: "agency_zip",     label: "Irányítószám" },
      { key: "agency_city",    label: "Város" },
      { key: "agency_country", label: "Ország" },
    ],
  },
  {
    title: "Adóazonosítók",
    fields: [
      { key: "agency_tax_number", label: "Adószám / Steuernummer", hint: "Helyi adóhivatal által kiadott szám" },
      { key: "uid_nummer",        label: "UID / EU adószám", hint: "pl. ATU12345678" },
    ],
  },
  {
    title: "Bankszámla",
    description: "Ezek jelennek meg az előleg bekérő emailben és a számlákon.",
    fields: [
      { key: "iban",      label: "IBAN",       hint: "pl. AT60 1234 5678 9012 3456" },
      { key: "bic",       label: "BIC / SWIFT", hint: "pl. BKAUATWW" },
      { key: "bank_name", label: "Bank neve" },
    ],
  },
  {
    title: "Számla beállítások",
    fields: [
      { key: "invoice_prefix",      label: "Számlaszám előtag",        hint: "pl. RE, INV" },
      { key: "default_tax_rate",    label: "Alapértelmezett ÁFA (%)",  type: "number", hint: "Ausztria: 13% turizmus, 20% általános" },
      { key: "default_currency",    label: "Pénznem",                  hint: "pl. EUR" },
      { key: "invoice_footer_text", label: "Számla lábléc szöveg",     hint: "Megjelenik a számla alján" },
    ],
  },
  {
    title: "Rendszer beállítások",
    fields: [
      { key: "deposit_percentage", label: "Előleg mértéke (%)", type: "number", hint: "Foglaláskor automatikusan kiszámolt előleg" },
      { key: "vip_discount",       label: "VIP kedvezmény (%)", type: "number" },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function SettingsForm({ settings }: Props) {
  const [values, setValues] = useState<Record<string, string>>(settings);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  function set(key: string, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    const upserts = Object.entries(values).map(([key, value]) => ({ key, value }));
    const { error } = await supabase
      .from("settings")
      .upsert(upserts, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast.error("Mentési hiba", { description: error.message });
    } else {
      toast.success("Beállítások elmentve");
    }
  }

  return (
    <div className="max-w-2xl space-y-0">
      {GROUPS.map((group, gi) => (
        <div key={group.title}>
          {gi > 0 && <Separator className="my-8" />}

          <div className="mb-5">
            <h3 className="text-sm font-semibold text-zinc-900">{group.title}</h3>
            {group.description && (
              <p className="mt-0.5 text-xs text-zinc-500">{group.description}</p>
            )}
          </div>

          <div className="space-y-4">
            {group.fields.map(({ key, label, type = "text", hint }) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={key} className="text-sm font-medium text-zinc-700">
                  {label}
                </Label>
                <Input
                  id={key}
                  type={type}
                  value={values[key] ?? ""}
                  onChange={(e) => set(key, e.target.value)}
                  className="h-9"
                />
                {hint && <p className="text-xs text-zinc-400">{hint}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}

      <Separator className="my-8" />

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saving ? "Mentés…" : "Beállítások mentése"}
        </Button>
      </div>
    </div>
  );
}
