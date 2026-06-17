"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Loader2, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";

import { useInvoices } from "@/hooks/useInvoices";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Client, Invoice, InvoiceItem } from "@/types";
import type { InvoiceFormValues } from "@/lib/validators/invoice";

function fmtEur(n: number): string {
  const sign = n < 0 ? "-" : "";
  const parts = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}€ ${parts}`;
}

function fmtHuf(n: number, rate: number): string {
  const huf = Math.round(n * rate);
  const sign = huf < 0 ? "-" : "";
  const parts = Math.abs(huf).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${parts} Ft`;
}

const FIXED_ITEMS = [
  { key: "accommodation", label: "Unterkunft + Fotografie / Szállás + Fotózás" },
  { key: "transfers",     label: "Transfers + Sonstige Kosten / Transzferek + Egyéb költségek" },
  { key: "discount",      label: "Rabatt / Kedvezmény",  isDiscount: true },
  { key: "advance",       label: "Anzahlung / Előleg",   isAdvance: true },
] as const;

type FixedItemKey = (typeof FIXED_ITEMS)[number]["key"];

const TAX_OPTIONS = [
  { value: 20, label: "20% – Normalsatz (általános)" },
  { value: 13, label: "13% – Ermäßigt Tourismus (turisztika)" },
  { value: 0,  label: "0% – Steuerfrei (adómentes)" },
] as const;

interface EditInvoiceFormProps {
  invoice: Invoice & { client: Client };
  settings: Record<string, string>;
}

export default function EditInvoiceForm({ invoice, settings: initialSettings }: EditInvoiceFormProps) {
  const router = useRouter();
  const { updateInvoice } = useInvoices();

  const items = (invoice.items ?? []) as InvoiceItem[];
  const findItem = (desc: string) => items.find((i) => i.description === desc);

  const [issueDate, setIssueDate]     = useState(invoice.issue_date ?? format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate]         = useState(invoice.due_date ?? "");
  const [serviceDate, setServiceDate] = useState(invoice.service_date ?? "");
  const [taxRate, setTaxRate]         = useState<20 | 13 | 0>((invoice.tax_rate ?? 13) as 20 | 13 | 0);
  const [notes, setNotes]             = useState(invoice.notes ?? "");
  const [eurHufRate, setEurHufRate]   = useState<number>(395);

  const [prices, setPrices] = useState<Record<FixedItemKey, number>>(() => {
    const accom = findItem(FIXED_ITEMS[0].label);
    const trans = findItem(FIXED_ITEMS[1].label);
    const disc  = findItem(FIXED_ITEMS[2].label);
    const adv   = findItem(FIXED_ITEMS[3].label);
    return {
      accommodation: accom?.unit_price ?? 0,
      transfers: trans?.unit_price ?? 0,
      discount: disc ? Math.abs(disc.unit_price) : 0,
      advance: adv?.unit_price ?? 0,
    };
  });

  const [previewUrl, setPreviewUrl]         = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [agencySettings, setAgencySettings] = useState<Record<string, string>>(initialSettings);
  const [submitting, setSubmitting]         = useState(false);
  const previewDebRef = useRef<ReturnType<typeof setTimeout>>();
  const client = invoice.client;

  useEffect(() => {
    fetch("/api/exchange-rate")
      .then((r) => r.json() as Promise<{ rate?: number }>)
      .then(({ rate }) => { if (rate && rate > 1) setEurHufRate(Math.round(rate)); })
      .catch(() => {});
  }, []);

  const accommodationEur = prices.accommodation;
  const transfersEur     = prices.transfers;
  const discountEur      = -(Math.abs(prices.discount));
  const advanceEur       = prices.advance;

  const subtotal  = accommodationEur + transfersEur + discountEur;
  const taxAmount = subtotal * taxRate / 100;
  const total     = subtotal + taxAmount;

  function buildItems() {
    const result = [];
    result.push({
      description: FIXED_ITEMS[0].label,
      quantity: 1,
      unit_price: accommodationEur,
      total: accommodationEur,
      is_advance: false,
    });
    result.push({
      description: FIXED_ITEMS[1].label,
      quantity: 1,
      unit_price: transfersEur,
      total: transfersEur,
      is_advance: false,
    });
    if (prices.discount !== 0) {
      result.push({
        description: FIXED_ITEMS[2].label,
        quantity: 1,
        unit_price: discountEur,
        total: discountEur,
        is_advance: false,
      });
    }
    if (prices.advance !== 0) {
      result.push({
        description: FIXED_ITEMS[3].label,
        quantity: 1,
        unit_price: advanceEur,
        total: advanceEur,
        is_advance: true,
      });
    }
    return result;
  }

  const refreshPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const [{ pdf }, invoicePdfModule] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/invoice-pdf"),
      ]);
      const { InvoicePDF, ensureFonts } = invoicePdfModule;
      ensureFonts();
      const itemsForPreview = buildItems();
      const invoiceData = {
        ...invoice,
        issue_date: issueDate,
        due_date: dueDate || null,
        service_date: serviceDate || null,
        items: itemsForPreview,
        subtotal: Math.round(subtotal * 100) / 100,
        tax_rate: taxRate,
        tax_amount: Math.round(taxAmount * 100) / 100,
        total: Math.round(total * 100) / 100,
        notes: notes || null,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const element = React.createElement(InvoicePDF, { invoice: invoiceData as never, client, settings: agencySettings, eurHufRate }) as any;
      const blob = await pdf(element).toBlob();
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      console.error("PDF preview error:", e);
    } finally {
      setPreviewLoading(false);
    }
  }, [issueDate, dueDate, serviceDate, taxRate, notes, agencySettings, prices, eurHufRate, subtotal, taxAmount, total]);

  useEffect(() => {
    previewDebRef.current = setTimeout(() => { void refreshPreview(); }, 700);
    return () => clearTimeout(previewDebRef.current);
  }, [refreshPreview]);

  async function handleSave(sendIt: boolean) {
    const builtItems = buildItems();
    if (builtItems.filter((i) => !i.is_advance).length === 0) {
      toast.error("Adj meg legalább egy tételt!"); return;
    }

    const payload: Partial<InvoiceFormValues> = {
      status:       sendIt ? "sent" : "draft",
      issue_date:   issueDate,
      due_date:     dueDate || null,
      service_date: serviceDate || null,
      items:        builtItems,
      tax_rate:     taxRate,
      notes:        notes || undefined,
    };

    setSubmitting(true);
    const updated = await updateInvoice(invoice.id, payload);
    setSubmitting(false);
    if (updated) {
      toast.success(sendIt ? "Számla véglegesítve és kiállítva!" : "Piszkozat frissítve!");
      router.push(`/invoices/${invoice.id}`);
    } else {
      toast.error("Hiba a mentés során");
    }
  }

  return (
    <div>
      <PageHeader
        title={`${invoice.invoice_number} szerkesztése`}
        subtitle="Piszkozat szerkesztő valós idejű előnézettel"
        actions={
          <Button variant="outline" asChild>
            <Link href={`/invoices/${invoice.id}`}><ArrowLeft className="mr-2 h-4 w-4" />Vissza</Link>
          </Button>
        }
      />

      <div className="flex gap-6 items-start">
        {/* LEFT: Editor */}
        <div className="flex-[3] min-w-0 space-y-5">

          {/* Client (read-only) */}
          <div className="rounded-md border border-zinc-200 bg-white p-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 border-b border-zinc-100 pb-1">
              Rechnungsempfänger / Ügyfél
            </h3>
            <div className="flex items-center gap-3 rounded-md border border-zinc-200 px-3 py-2.5 bg-zinc-50">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900">{client.last_name} {client.first_name}</p>
                <p className="text-xs text-zinc-500">{client.email} · {client.client_code}</p>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="rounded-md border border-zinc-200 bg-white p-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 border-b border-zinc-100 pb-1">
              Daten / Datumok
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-zinc-700">Rechnungsdatum <span className="text-red-500">*</span></Label>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-zinc-700">Zahlungsziel</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} min={issueDate} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-zinc-700">Lieferdatum</Label>
                <Input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Exchange rate */}
          <div className="rounded-md border border-zinc-200 bg-white p-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 border-b border-zinc-100 pb-1">
              Wechselkurs / Árfolyam
            </h3>
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium text-zinc-700 whitespace-nowrap">1 EUR =</Label>
              <Input
                type="number"
                min={1}
                step={1}
                value={eurHufRate}
                onChange={(e) => setEurHufRate(Number(e.target.value) || 395)}
                className="w-32 text-right"
              />
              <span className="text-sm text-zinc-500">Ft</span>
            </div>
          </div>

          {/* Fixed line items */}
          <div className="rounded-md border border-zinc-200 bg-white p-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 border-b border-zinc-100 pb-1">
              Positionen / Tételek
            </h3>
            <div className="grid grid-cols-[1fr_130px_130px_110px] gap-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 px-1">
              <span>Beschreibung / Leírás</span>
              <span className="text-right">Ár (EUR)</span>
              <span className="text-right">Ár (HUF)</span>
              <span className="text-right">Összeg (EUR)</span>
            </div>
            <div className="space-y-2">
              {FIXED_ITEMS.map((item) => {
                const rawVal = prices[item.key];
                const isDiscount = item.key === "discount";
                const isAdvance  = item.key === "advance";
                return (
                  <div key={item.key} className={cn(
                    "grid grid-cols-[1fr_130px_130px_110px] gap-2 items-center rounded-md px-1 py-1",
                    isAdvance  && "bg-amber-50 border border-amber-100",
                    isDiscount && "bg-red-50 border border-red-100",
                  )}>
                    <div>
                      <p className="text-sm font-medium text-zinc-800">{item.label}</p>
                      {isAdvance  && <p className="text-xs text-amber-600 mt-0.5">Nem számít bele a végösszegbe</p>}
                      {isDiscount && <p className="text-xs text-red-500 mt-0.5">Kedvezmény (levonva)</p>}
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={rawVal}
                        onChange={(e) => setPrices((p) => ({ ...p, [item.key]: Number(e.target.value) }))}
                        className="h-8 text-sm text-right pr-8"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400">EUR</span>
                    </div>
                    <p className="text-sm text-right text-zinc-600 pr-1">
                      {fmtHuf(Math.abs(rawVal) * (isDiscount ? -1 : 1), eurHufRate)}
                    </p>
                    <p className={cn("text-sm font-medium text-right pr-1", isDiscount && "text-red-600", isAdvance && "text-amber-700")}>
                      {fmtEur(isDiscount ? -(Math.abs(rawVal)) : rawVal)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tax + totals */}
          <div className="rounded-md border border-zinc-200 bg-white p-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 border-b border-zinc-100 pb-1">
              Steuer / Adó
            </h3>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-zinc-700">MwSt.-Satz / ÁFA kulcs</Label>
              <Select value={String(taxRate)} onValueChange={(v) => setTaxRate(Number(v) as 20 | 13 | 0)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TAX_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md bg-zinc-50 border border-zinc-100 p-4 space-y-2">
              <div className="grid grid-cols-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 mb-1">
                <span></span><span className="text-right">EUR</span><span className="text-right">HUF</span>
              </div>
              <div className="grid grid-cols-3 text-sm">
                <span className="text-zinc-500">Nettobetrag</span>
                <span className="font-medium text-right">{fmtEur(subtotal)}</span>
                <span className="text-right text-zinc-400">{fmtHuf(subtotal, eurHufRate)}</span>
              </div>
              <div className="grid grid-cols-3 text-sm">
                <span className="text-zinc-500">MwSt. {taxRate}%</span>
                <span className="font-medium text-right">{fmtEur(taxAmount)}</span>
                <span className="text-right text-zinc-400">{fmtHuf(taxAmount, eurHufRate)}</span>
              </div>
              <div className="grid grid-cols-3 text-base font-semibold border-t border-zinc-200 pt-2">
                <span>Gesamtbetrag</span>
                <span className="text-blue-700 text-right">{fmtEur(total)}</span>
                <span className="text-blue-500 text-right text-sm">{fmtHuf(total, eurHufRate)}</span>
              </div>
              {prices.advance !== 0 && (
                <div className="grid grid-cols-3 text-sm border-t border-amber-200 pt-2 text-amber-700">
                  <span>Előleg</span>
                  <span className="text-right">{fmtEur(-prices.advance)}</span>
                  <span className="text-right text-xs">{fmtHuf(-prices.advance, eurHufRate)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-md border border-zinc-200 bg-white p-5 space-y-1.5">
            <Label className="text-sm font-medium text-zinc-700">Zahlungshinweis / Megjegyzés</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Bitte überweisen Sie den Betrag innerhalb von 14 Tagen..." />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 justify-end py-2">
            <Button variant="outline" onClick={() => void refreshPreview()} disabled={previewLoading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", previewLoading && "animate-spin")} />
              Előnézet frissítése
            </Button>
            <Button variant="outline" onClick={() => handleSave(false)} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Piszkozat mentése
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => handleSave(true)} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Véglegesítés és kiállítás
            </Button>
          </div>
        </div>

        {/* RIGHT: Live PDF preview */}
        <div className="flex-[2] sticky top-6 min-w-0">
          <div className="rounded-md border border-zinc-200 overflow-hidden" style={{ height: "calc(100vh - 160px)" }}>
            {previewLoading && !previewUrl ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                  <p className="text-xs text-zinc-400">PDF előnézet generálása...</p>
                </div>
              </div>
            ) : previewUrl ? (
              <iframe key={previewUrl} src={previewUrl} className="w-full h-full border-0" title="Számla előnézet" />
            ) : null}
            {previewLoading && previewUrl && (
              <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
