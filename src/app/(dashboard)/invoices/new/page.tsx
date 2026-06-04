"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addDays, format } from "date-fns";
import { ArrowLeft, Loader2, Search, X, RefreshCw } from "lucide-react";
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
import type { Client, Booking, Trip } from "@/types";
import type { InvoiceFormValues } from "@/lib/validators/invoice";

// Formatters
function fmtEur(n: number): string {
  const sign = n < 0 ? "-" : "";
  const [int = "0", dec = "00"] = Math.abs(n).toFixed(2).split(".");
  return `${sign}\u20ac ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
}
function fmtHuf(n: number, rate: number): string {
  const huf = Math.round(n * rate);
  const sign = huf < 0 ? "-" : "";
  const parts = Math.abs(huf).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  return `${sign}${parts} Ft`;
}

// Client combobox
function ClientCombobox({ selected, onSelect }: {
  selected: Client | null;
  onSelect: (c: Client | null) => void;
}) {
  const supabase = createBrowserClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debRef  = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    debRef.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase.from("clients").select("*")
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
        .is("deleted_at", null).limit(8);
      setResults((data ?? []) as Client[]);
      setOpen(true);
      setSearching(false);
    }, 300);
    return () => clearTimeout(debRef.current);
  }, [query]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      {selected ? (
        <div className="flex items-center gap-3 rounded-md border border-zinc-200 px-3 py-2.5 bg-zinc-50">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-900">{selected.last_name} {selected.first_name}</p>
            <p className="text-xs text-zinc-500">{selected.email} · {selected.client_code}</p>
          </div>
          <button onClick={() => { onSelect(null); setQuery(""); }} className="text-zinc-400 hover:text-zinc-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ugyfel keresese nev vagy email alapjan" className="pl-9" />
            {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-400" />}
          </div>
          {open && (
            <div className="absolute z-50 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg max-h-56 overflow-y-auto">
              {results.length === 0 ? (
                <div className="px-4 py-3 text-sm text-zinc-500">
                  Nincs talalat. <Link href="/clients/new" className="text-blue-600 hover:underline">+ Uj ugyfel</Link>
                </div>
              ) : results.map((c) => (
                <button key={c.id} className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 text-left border-b border-zinc-100 last:border-0"
                  onClick={() => { onSelect(c); setQuery(""); setOpen(false); }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900">{c.last_name} {c.first_name}</p>
                    <p className="text-xs text-zinc-400">{c.email}</p>
                  </div>
                  {c.address_city && <span className="text-xs text-zinc-400">{c.address_city}</span>}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Hardcoded item definitions (bilingual DE/HU)
const FIXED_ITEMS = [
  { key: "accommodation", label: "Unterkunft + Fotografie / Szállás + Fotózás" },
  { key: "transfers",     label: "Transfers + Sonstige Kosten / Transzferek + Egyéb költségek" },
  { key: "discount",      label: "Rabatt / Kedvezmény",  isDiscount: true },
  { key: "advance",       label: "Anzahlung / Előleg",   isAdvance: true },
] as const;

type FixedItemKey = (typeof FIXED_ITEMS)[number]["key"];

const TODAY    = format(new Date(), "yyyy-MM-dd");
const DUE_DATE = format(addDays(new Date(), 14), "yyyy-MM-dd");

const TAX_OPTIONS = [
  { value: 20, label: "20% – Normalsatz (általános)" },
  { value: 13, label: "13% – Ermäßigt Tourismus (turisztika)" },
  { value: 0,  label: "0% – Steuerfrei (adómentes)" },
] as const;

export default function NewInvoicePage() {
  const router = useRouter();
  const supabase = createBrowserClient();
  const { createInvoice, getAgencySettings } = useInvoices();

  const [selectedClient, setSelectedClient]   = useState<Client | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<(Booking & { trip: Pick<Trip, "name"> }) | null>(null);
  const [bookings, setBookings]               = useState<(Booking & { trip: Pick<Trip, "name"> })[]>([]);
  const [issueDate, setIssueDate]             = useState(TODAY);
  const [dueDate, setDueDate]                 = useState(DUE_DATE);
  const [serviceDate, setServiceDate]         = useState("");
  const [taxRate, setTaxRate]                 = useState<20 | 13 | 0>(13);
  const [notes, setNotes]                     = useState("");
  const [eurHufRate, setEurHufRate]           = useState<number>(395);

  // EUR prices for each fixed item (keyed by FIXED_ITEMS[].key)
  const [prices, setPrices] = useState<Record<FixedItemKey, number>>({
    accommodation: 0,
    transfers: 0,
    discount: 0,
    advance: 0,
  });

  const [previewUrl, setPreviewUrl]         = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [agencySettings, setAgencySettings] = useState<Record<string, string>>({});
  const [submitting, setSubmitting]         = useState(false);

  // Fetch agency settings + live exchange rate on mount
  useEffect(() => {
    void getAgencySettings().then((s) => { if (s) setAgencySettings(s as unknown as Record<string, string>); });
    fetch("/api/exchange-rate")
      .then((r) => r.json() as Promise<{ rate?: number }>)
      .then(({ rate }) => { if (rate && rate > 1) setEurHufRate(Math.round(rate)); })
      .catch(() => {/* keep default 395 */});
  }, []);

  // Fetch bookings when client selected
  useEffect(() => {
    if (!selectedClient) { setBookings([]); setSelectedBooking(null); return; }
    supabase.from("bookings").select("*, trip:trips(name)")
      .eq("client_id", selectedClient.id).is("deleted_at", null)
      .in("status", ["booked", "deposit_paid", "fully_paid"])
      .order("created_at", { ascending: false })
      .then(({ data }) => setBookings((data ?? []) as typeof bookings));
  }, [selectedClient]);

  // Totals (excluding advance)
  const accommodationEur = prices.accommodation;
  const transfersEur     = prices.transfers;
  const discountEur      = -(Math.abs(prices.discount)); // always negative
  const advanceEur       = prices.advance;

  const subtotal  = accommodationEur + transfersEur + discountEur;
  const taxAmount = subtotal * taxRate / 100;
  const total     = subtotal + taxAmount;

  // Build items array for PDF/save
  function buildItems() {
    const result = [];
    if (prices.accommodation !== 0 || true) {
      result.push({
        description: FIXED_ITEMS[0].label,
        quantity: 1,
        unit_price: accommodationEur,
        total: accommodationEur,
        is_advance: false,
      });
    }
    if (prices.transfers !== 0 || true) {
      result.push({
        description: FIXED_ITEMS[1].label,
        quantity: 1,
        unit_price: transfersEur,
        total: transfersEur,
        is_advance: false,
      });
    }
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

  // Live PDF preview
  const previewDebRef = useRef<ReturnType<typeof setTimeout>>();
  const refreshPreview = useCallback(async () => {
    if (!selectedClient) { setPreviewUrl(null); return; }
    setPreviewLoading(true);
    try {
      const [{ pdf }, { InvoicePDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/invoice-pdf"),
      ]);
      const itemsForPreview = buildItems();
      const subtotalRnd  = Math.round(subtotal  * 100) / 100;
      const taxAmountRnd = Math.round(taxAmount * 100) / 100;
      const totalRnd     = Math.round(total     * 100) / 100;
      const invoiceData = {
        id: "preview",
        invoice_number: "RE-" + new Date().getFullYear() + "-XXXX",
        client_id: selectedClient.id,
        booking_id: selectedBooking?.id ?? null,
        status: "draft" as const,
        issue_date: issueDate,
        due_date: dueDate || null,
        service_date: serviceDate || null,
        items: itemsForPreview,
        subtotal: subtotalRnd,
        tax_rate: taxRate,
        tax_amount: taxAmountRnd,
        total: totalRnd,
        notes: notes || null,
        sent_at: null,
        paid_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const element = React.createElement(InvoicePDF, { invoice: invoiceData as never, client: selectedClient, settings: agencySettings, eurHufRate }) as any;
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
  }, [selectedClient, selectedBooking, issueDate, dueDate, serviceDate, taxRate, notes, agencySettings, prices, eurHufRate, subtotal, taxAmount, total]);

  useEffect(() => {
    previewDebRef.current = setTimeout(() => { void refreshPreview(); }, 700);
    return () => clearTimeout(previewDebRef.current);
  }, [refreshPreview]);

  async function handleSave(sendIt: boolean) {
    if (!selectedClient) { toast.error("Válassz ügyfelet!"); return; }
    const items = buildItems();
    if (items.filter((i) => !i.is_advance).length === 0) {
      toast.error("Adj meg legalább egy tételt!"); return;
    }

    const payload: InvoiceFormValues = {
      client_id:    selectedClient.id,
      booking_id:   selectedBooking?.id ?? null,
      status:       sendIt ? "sent" : "draft",
      issue_date:   issueDate,
      due_date:     dueDate || null,
      service_date: serviceDate || null,
      items,
      tax_rate:     taxRate,
      notes:        notes || undefined,
    };

    setSubmitting(true);
    const invoice = await createInvoice(payload);
    setSubmitting(false);
    if (invoice) {
      toast.success(sendIt ? "Számla kiállítva!" : "Piszkozat elmentve!");
      router.push(`/invoices/${invoice.id}`);
    } else {
      toast.error("Hiba a mentés során");
    }
  }

  return (
    <div>
      <PageHeader
        title="Új számla"
        subtitle="Számla szerkesztő valós idejű előnézettel"
        actions={
          <Button variant="outline" asChild>
            <Link href="/invoices"><ArrowLeft className="mr-2 h-4 w-4" />Vissza</Link>
          </Button>
        }
      />

      <div className="flex gap-6 items-start">
        {/* LEFT: Editor */}
        <div className="flex-[3] min-w-0 space-y-5">

          {/* Client + booking */}
          <div className="rounded-md border border-zinc-200 bg-white p-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 border-b border-zinc-100 pb-1">
              Rechnungsempfänger / Ügyfél
            </h3>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-zinc-700">Ügyfél <span className="text-red-500">*</span></Label>
              <ClientCombobox selected={selectedClient} onSelect={setSelectedClient} />
            </div>
            {selectedClient && bookings.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-zinc-700">Kapcsolódó foglalás (opcionális)</Label>
                <Select value={selectedBooking?.id ?? "none"}
                  onValueChange={(v) => { const found = bookings.find((b) => b.id === v); setSelectedBooking(found ?? null); }}>
                  <SelectTrigger><SelectValue placeholder="— Nincs kapcsolódó foglalás —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nincs kapcsolódó foglalás —</SelectItem>
                    {bookings.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.booking_code} – {b.trip?.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
              <span className="text-xs text-zinc-400 ml-2">(Automatikusan letöltve, de felülírhatod)</span>
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
              Mentés piszkozatként
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => handleSave(true)} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mentés és kiállítás
            </Button>
          </div>
        </div>

        {/* RIGHT: Live PDF preview */}
        <div className="flex-[2] sticky top-6 min-w-0">
          <div className="rounded-md border border-zinc-200 overflow-hidden" style={{ height: "calc(100vh - 160px)" }}>
            {!selectedClient ? (
              <div className="flex h-full flex-col items-center justify-center text-center p-8">
                <p className="text-sm text-zinc-400 mb-2">Az előnézet megjelenik,</p>
                <p className="text-xs text-zinc-400">amint ügyfelet választász</p>
              </div>
            ) : previewLoading && !previewUrl ? (
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
