"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addDays, format } from "date-fns";
import { ArrowLeft, Loader2, Search, RefreshCw, X } from "lucide-react";
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

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtEur(n: number): string {
  const sign = n < 0 ? "-" : "";
  const [int = "0", dec = "00"] = Math.abs(n).toFixed(2).split(".");
  return `${sign}€ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
}
function fmtHuf(n: number, rate: number): string {
  const huf = Math.round(n * rate);
  const sign = huf < 0 ? "-" : "";
  const parts = Math.abs(huf).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${parts} Ft`;
}

// ─── Client combobox ──────────────────────────────────────────────────────────

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
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ügyfél keresése név vagy email alapján" className="pl-9" />
            {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-400" />}
          </div>
          {open && (
            <div className="absolute z-50 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg max-h-56 overflow-y-auto">
              {results.length === 0 ? (
                <div className="px-4 py-3 text-sm text-zinc-500">Nincs találat.</div>
              ) : results.map((c) => (
                <button key={c.id} className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 text-left border-b border-zinc-100 last:border-0"
                  onClick={() => { onSelect(c); setQuery(""); setOpen(false); }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900">{c.last_name} {c.first_name}</p>
                    <p className="text-xs text-zinc-400">{c.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── State types ──────────────────────────────────────────────────────────────

interface SimpleState {
  accommodation_label: string;
  accommodation_price: number;
  accommodation_qty: number;
  transfers_label: string;
  transfers_amount: number;
  discount_percentage: number;
  surcharge_enabled: boolean;
  surcharge_label: string;
  surcharge_price: number;
  advance: number;
}

const DEFAULT_SIMPLE: SimpleState = {
  accommodation_label: "Unterkunft + Fotografie / Szállás + Fotózás",
  accommodation_price: 0,
  accommodation_qty: 1,
  transfers_label: "Transfers + Sonstige Kosten / Transzferek + Egyéb költségek",
  transfers_amount: 0,
  discount_percentage: 0,
  surcharge_enabled: false,
  surcharge_label: "Személyenkénti felár / Zuschlag pro Person",
  surcharge_price: 0,
  advance: 0,
};

const TODAY    = format(new Date(), "yyyy-MM-dd");
const DUE_DATE = format(addDays(new Date(), 14), "yyyy-MM-dd");

const TAX_OPTIONS = [
  { value: 20, label: "20% – Normalsatz (általános)" },
  { value: 13, label: "13% – Ermäßigt Tourismus (turisztika)" },
  { value: 0,  label: "0% – Steuerfrei (adómentes)" },
] as const;

// ─── EurInput helper ──────────────────────────────────────────────────────────

function EurInput({ value, onChange, disabled, className }: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className="relative">
      <Input type="number" min={0} step={0.01} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className={cn("h-9 text-sm text-right pr-8", className)} />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400">€</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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
  const [agencySettings, setAgencySettings]   = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl]           = useState<string | null>(null);
  const [previewLoading, setPreviewLoading]   = useState(false);
  const [submitting, setSubmitting]           = useState(false);

  const [simple, setSimple] = useState<SimpleState>(DEFAULT_SIMPLE);

  function patchSimple(patch: Partial<SimpleState>) {
    setSimple((prev) => ({ ...prev, ...patch }));
  }

  // ─── Computed ──────────────────────────────────────────────────────────────

  const accommodationTotal = Math.round(simple.accommodation_price * simple.accommodation_qty * 100) / 100;
  const discountAmount     = Math.round(accommodationTotal * simple.discount_percentage / 100 * 100) / 100;
  const surchargeTotal     = simple.surcharge_enabled
    ? Math.round(simple.surcharge_price * simple.accommodation_qty * 100) / 100
    : 0;
  const subtotal  = accommodationTotal + simple.transfers_amount - discountAmount + surchargeTotal;
  const taxAmount = Math.round(subtotal * taxRate / 100 * 100) / 100;
  const total     = subtotal + taxAmount;
  const remaining = Math.max(total - simple.advance, 0);

  // ─── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    void getAgencySettings().then((s) => {
      if (s) {
        const rec = s as unknown as Record<string, string>;
        setAgencySettings(rec);
        if (rec["invoice_default_notes"] && !notes) setNotes(rec["invoice_default_notes"]);
      }
    });
    fetch("/api/exchange-rate")
      .then((r) => r.json() as Promise<{ rate?: number }>)
      .then(({ rate }) => { if (rate && rate > 1) setEurHufRate(Math.round(rate)); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedClient) { setBookings([]); setSelectedBooking(null); return; }
    supabase.from("bookings").select("*, trip:trips(name)")
      .eq("client_id", selectedClient.id).is("deleted_at", null)
      .in("status", ["booked", "deposit_paid", "fully_paid"])
      .order("created_at", { ascending: false })
      .then(({ data }) => setBookings((data ?? []) as typeof bookings));
  }, [selectedClient]);

  // Populate from booking when selected
  useEffect(() => {
    if (!selectedBooking) return;
    const b = selectedBooking as Booking;
    const qty = b.party_size ?? 1;
    const baseTotal = b.base_amount ?? b.final_amount ?? 0;
    const perPerson = qty > 0 ? Math.round(baseTotal / qty * 100) / 100 : baseTotal;
    patchSimple({
      accommodation_price: perPerson,
      accommodation_qty: qty,
      discount_percentage: b.discount_percentage ?? 0,
      advance: b.deposit_amount ?? 0,
    });
  }, [selectedBooking]);

  // ─── Build items for PDF / save ────────────────────────────────────────────

  function buildItems() {
    const r = [];
    r.push({
      description: simple.accommodation_label,
      quantity: simple.accommodation_qty,
      unit_price: simple.accommodation_price,
      total: accommodationTotal,
      is_advance: false,
    });
    if (simple.transfers_amount > 0) {
      r.push({
        description: simple.transfers_label,
        quantity: 1,
        unit_price: simple.transfers_amount,
        total: simple.transfers_amount,
        is_advance: false,
      });
    }
    if (discountAmount > 0) {
      r.push({
        description: `Rabatt / Kedvezmény (${simple.discount_percentage}%)`,
        quantity: 1,
        unit_price: -discountAmount,
        total: -discountAmount,
        is_advance: false,
      });
    }
    if (simple.surcharge_enabled && surchargeTotal > 0) {
      r.push({
        description: simple.surcharge_label,
        quantity: simple.accommodation_qty,
        unit_price: simple.surcharge_price,
        total: surchargeTotal,
        is_advance: false,
      });
    }
    if (simple.advance > 0) {
      r.push({
        description: "Anzahlung / Előleg",
        quantity: 1,
        unit_price: simple.advance,
        total: simple.advance,
        is_advance: true,
      });
    }
    return r;
  }

  // ─── PDF preview ───────────────────────────────────────────────────────────

  const previewDebRef = useRef<ReturnType<typeof setTimeout>>();
  const refreshPreview = useCallback(async () => {
    if (!selectedClient) { setPreviewUrl(null); return; }
    setPreviewLoading(true);
    try {
      const [{ pdf }, { InvoicePDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/invoice-pdf"),
      ]);
      const items = buildItems();
      const invoiceData = {
        id: "preview",
        invoice_number: "RE-" + new Date().getFullYear() + "-XXXX",
        client_id: selectedClient.id,
        booking_id: selectedBooking?.id ?? null,
        status: "draft" as const,
        issue_date: issueDate,
        due_date: dueDate || null,
        service_date: serviceDate || null,
        items,
        subtotal: Math.round(subtotal * 100) / 100,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total: Math.round(total * 100) / 100,
        notes: notes || null,
        sent_at: null,
        paid_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const element = React.createElement(InvoicePDF, { invoice: invoiceData as never, client: selectedClient, settings: agencySettings, eurHufRate }) as any;
      const blob = await pdf(element).toBlob();
      setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
    } catch (e) {
      console.error("PDF preview error:", e);
    } finally {
      setPreviewLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient, selectedBooking, issueDate, dueDate, serviceDate, taxRate, notes, agencySettings, eurHufRate, simple, subtotal, taxAmount, total]);

  useEffect(() => {
    previewDebRef.current = setTimeout(() => { void refreshPreview(); }, 700);
    return () => clearTimeout(previewDebRef.current);
  }, [refreshPreview]);

  // ─── Save ──────────────────────────────────────────────────────────────────

  async function handleSave(sendIt: boolean) {
    if (!selectedClient) { toast.error("Válassz ügyfelet!"); return; }
    const items = buildItems();
    if (items.filter((i) => !i.is_advance).length === 0) { toast.error("Adj meg legalább egy tételt!"); return; }
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

  // ─────────────────────────────────────────────────────────────────────────

  // Column grid: [description flex | qty 60px | unit price 120px | total EUR 110px | HUF 100px]
  const COL = "grid-cols-[1fr_60px_120px_110px_100px]";

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
        {/* ── LEFT: Editor ───────────────────────────────────────────────── */}
        <div className="flex-[3] min-w-0 space-y-5">

          {/* Client + booking */}
          <div className="rounded-md border border-zinc-200 bg-white p-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 border-b border-zinc-100 pb-1">Rechnungsempfänger / Ügyfél</h3>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-zinc-700">Ügyfél <span className="text-red-500">*</span></Label>
              <ClientCombobox selected={selectedClient} onSelect={setSelectedClient} />
            </div>
            {selectedClient && bookings.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-zinc-700">Kapcsolódó foglalás (opcionális)</Label>
                <Select value={selectedBooking?.id ?? "none"}
                  onValueChange={(v) => setSelectedBooking(bookings.find((b) => b.id === v) ?? null)}>
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
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 border-b border-zinc-100 pb-1">Daten / Datumok</h3>
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
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 border-b border-zinc-100 pb-1">Wechselkurs / Árfolyam</h3>
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium text-zinc-700 whitespace-nowrap">1 EUR =</Label>
              <Input type="number" min={1} step={1} value={eurHufRate}
                onChange={(e) => setEurHufRate(Number(e.target.value) || 395)}
                className="w-32 text-right" />
              <span className="text-sm text-zinc-500">Ft</span>
              <span className="text-xs text-zinc-400 ml-2">(Automatikusan letöltve, felülírható)</span>
            </div>
          </div>

          {/* ── Line items ────────────────────────────────────────────────── */}
          <div className="rounded-md border border-zinc-200 bg-white p-5 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 border-b border-zinc-100 pb-2">Positionen / Tételek</h3>

            {/* Column headers */}
            <div className={cn("grid gap-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 px-1", COL)}>
              <span>Leírás</span>
              <span className="text-center">DB</span>
              <span className="text-right">Egységár</span>
              <span className="text-right">Összeg EUR</span>
              <span className="text-right">HUF</span>
            </div>

            {/* ── Row 1: Accommodation ── */}
            <div className={cn("grid gap-2 items-center rounded-md px-1 py-2", COL)}>
              <Input
                value={simple.accommodation_label}
                onChange={(e) => patchSimple({ accommodation_label: e.target.value })}
                className="h-9 text-sm"
              />
              <Input
                type="number" min={1} step={1}
                value={simple.accommodation_qty}
                onChange={(e) => patchSimple({ accommodation_qty: Math.max(1, Number(e.target.value)) })}
                className="h-9 text-sm text-center px-1"
              />
              <EurInput value={simple.accommodation_price} onChange={(v) => patchSimple({ accommodation_price: v })} />
              <p className="text-sm font-semibold text-right pr-1 text-zinc-900">{fmtEur(accommodationTotal)}</p>
              <p className="text-sm text-right text-zinc-400 pr-1">{fmtHuf(accommodationTotal, eurHufRate)}</p>
            </div>

            {/* ── Row 2: Transfers ── */}
            <div className={cn("grid gap-2 items-center rounded-md px-1 py-2", COL)}>
              <Input
                value={simple.transfers_label}
                onChange={(e) => patchSimple({ transfers_label: e.target.value })}
                className="h-9 text-sm"
              />
              <p className="text-sm text-center text-zinc-400">1</p>
              <EurInput value={simple.transfers_amount} onChange={(v) => patchSimple({ transfers_amount: v })} />
              <p className="text-sm font-semibold text-right pr-1 text-zinc-900">{fmtEur(simple.transfers_amount)}</p>
              <p className="text-sm text-right text-zinc-400 pr-1">{fmtHuf(simple.transfers_amount, eurHufRate)}</p>
            </div>

            {/* ── Row 3: Discount ── */}
            <div className={cn("grid gap-2 items-center rounded-md px-1 py-2 bg-red-50 border border-red-100", COL)}>
              <div>
                <p className="text-sm font-medium text-zinc-800">Rabatt / Kedvezmény</p>
                <p className="text-xs text-red-500 mt-0.5">Levonva az ár × DB alapján</p>
              </div>
              {/* DB column: show % input here */}
              <div className="relative">
                <Input
                  type="number" min={0} max={100} step={0.1}
                  value={simple.discount_percentage}
                  onChange={(e) => patchSimple({ discount_percentage: Number(e.target.value) })}
                  className="h-9 text-sm text-right pr-6"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400">%</span>
              </div>
              <p className="text-xs text-zinc-400 text-right pr-1 self-center">
                ({simple.discount_percentage}% × {fmtEur(accommodationTotal)})
              </p>
              <p className={cn("text-sm font-semibold text-right pr-1", discountAmount > 0 ? "text-red-600" : "text-zinc-400")}>
                {discountAmount > 0 ? `- ${fmtEur(discountAmount)}` : "—"}
              </p>
              <p className="text-sm text-right text-zinc-400 pr-1">
                {discountAmount > 0 ? fmtHuf(-discountAmount, eurHufRate) : "—"}
              </p>
            </div>

            {/* ── Row 4: Per-person surcharge (toggleable) ── */}
            <div className={cn(
              "grid gap-2 items-center rounded-md px-1 py-2 border transition-colors",
              simple.surcharge_enabled
                ? "bg-orange-50 border-orange-200"
                : "bg-zinc-50 border-zinc-100 opacity-60",
              COL,
            )}>
              <div className="flex items-start gap-2.5">
                {/* Toggle */}
                <button
                  type="button"
                  onClick={() => patchSimple({ surcharge_enabled: !simple.surcharge_enabled })}
                  className={cn(
                    "relative mt-0.5 flex-shrink-0 w-9 h-5 rounded-full transition-colors focus-visible:outline-none",
                    simple.surcharge_enabled ? "bg-orange-500" : "bg-zinc-300",
                  )}
                  aria-pressed={simple.surcharge_enabled}
                >
                  <span className={cn(
                    "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
                    simple.surcharge_enabled && "translate-x-4",
                  )} />
                </button>
                <div className="flex-1 min-w-0">
                  <Input
                    value={simple.surcharge_label}
                    onChange={(e) => patchSimple({ surcharge_label: e.target.value })}
                    disabled={!simple.surcharge_enabled}
                    className="h-9 text-sm disabled:opacity-50"
                    placeholder="pl. Személyenkénti felár"
                  />
                  {!simple.surcharge_enabled && (
                    <p className="text-xs text-zinc-400 mt-0.5">Kapcsold be a sor aktiválásához</p>
                  )}
                </div>
              </div>
              {/* DB: same qty as accommodation, read-only */}
              <p className={cn("text-sm text-center", simple.surcharge_enabled ? "text-zinc-700 font-medium" : "text-zinc-300")}>
                {simple.accommodation_qty}
              </p>
              <EurInput
                value={simple.surcharge_price}
                onChange={(v) => patchSimple({ surcharge_price: v })}
                disabled={!simple.surcharge_enabled}
                className="disabled:opacity-40"
              />
              <p className={cn("text-sm font-semibold text-right pr-1", simple.surcharge_enabled && surchargeTotal > 0 ? "text-orange-700" : "text-zinc-300")}>
                {simple.surcharge_enabled && surchargeTotal > 0 ? fmtEur(surchargeTotal) : "—"}
              </p>
              <p className="text-sm text-right text-zinc-400 pr-1">
                {simple.surcharge_enabled && surchargeTotal > 0 ? fmtHuf(surchargeTotal, eurHufRate) : "—"}
              </p>
            </div>

            {/* ── Row 5: Advance ── */}
            <div className="rounded-md px-1 py-2 space-y-2">
              <div className={cn("grid gap-2 items-center bg-amber-50 border border-amber-100 rounded-md px-1 py-2", COL)}>
                <div>
                  <p className="text-sm font-medium text-zinc-800">Anzahlung / Előleg</p>
                  <p className="text-xs text-amber-600 mt-0.5">Nem számít bele a végösszegbe</p>
                </div>
                <p className="text-sm text-center text-zinc-400">1</p>
                <EurInput value={simple.advance} onChange={(v) => patchSimple({ advance: v })} />
                <p className={cn("text-sm font-semibold text-right pr-1", simple.advance > 0 ? "text-amber-700" : "text-zinc-400")}>
                  {simple.advance > 0 ? fmtEur(simple.advance) : "—"}
                </p>
                <p className="text-sm text-right text-zinc-400 pr-1">
                  {simple.advance > 0 ? fmtHuf(simple.advance, eurHufRate) : "—"}
                </p>
              </div>
              {/* Remaining */}
              {simple.advance > 0 && (
                <div className={cn("grid gap-2 items-center rounded-md px-1 py-1.5 bg-green-50 border border-green-100", COL)}>
                  <p className="text-sm font-semibold text-green-800">Fennmaradó összeg / Restzahlung</p>
                  <span /><span />
                  <p className="text-sm font-bold text-right pr-1 text-green-700">{fmtEur(remaining)}</p>
                  <p className="text-sm text-right text-zinc-400 pr-1">{fmtHuf(remaining, eurHufRate)}</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Tax + totals ──────────────────────────────────────────────── */}
          <div className="rounded-md border border-zinc-200 bg-white p-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 border-b border-zinc-100 pb-1">Steuer / Adó</h3>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-zinc-700">MwSt.-Satz / ÁFA kulcs</Label>
              <Select value={String(taxRate)} onValueChange={(v) => setTaxRate(Number(v) as 20 | 13 | 0)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TAX_OPTIONS.map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md bg-zinc-50 border border-zinc-100 p-4 space-y-2">
              <div className="grid grid-cols-3 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 mb-1">
                <span /><span className="text-right">EUR</span><span className="text-right">HUF</span>
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
              {simple.advance > 0 && (
                <>
                  <div className="grid grid-cols-3 text-sm border-t border-amber-200 pt-2 text-amber-700">
                    <span>Előleg</span>
                    <span className="text-right">- {fmtEur(simple.advance)}</span>
                    <span className="text-right text-xs">{fmtHuf(-simple.advance, eurHufRate)}</span>
                  </div>
                  <div className="grid grid-cols-3 text-sm font-semibold text-green-700">
                    <span>Még fizetendő</span>
                    <span className="text-right">{fmtEur(remaining)}</span>
                    <span className="text-right text-xs font-normal text-zinc-400">{fmtHuf(remaining, eurHufRate)}</span>
                  </div>
                </>
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

        {/* ── RIGHT: PDF preview ─────────────────────────────────────────── */}
        <div className="flex-[2] sticky top-6 min-w-0">
          <div className="rounded-md border border-zinc-200 overflow-hidden" style={{ height: "calc(100vh - 160px)" }}>
            {!selectedClient ? (
              <div className="flex h-full flex-col items-center justify-center text-center p-8">
                <p className="text-sm text-zinc-400">Az előnézet megjelenik, amint ügyfelet választasz</p>
              </div>
            ) : previewLoading && !previewUrl ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
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
