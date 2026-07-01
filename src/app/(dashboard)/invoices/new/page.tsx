"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addDays, format } from "date-fns";
import { ArrowLeft, Loader2, Plus, Search, Trash2, X, RefreshCw } from "lucide-react";
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
import type { Client, Booking, Trip, BookingParticipant } from "@/types";
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

// ─── Types ────────────────────────────────────────────────────────────────────

/** One custom extra line within a participant block (food, drinks, extra service…) */
interface ParticipantExtraItem {
  id: string;
  description: string;
  amount: number;
}

/** One participant with their own service price, discount and optional extra items */
interface ParticipantBlock {
  id: string;
  participant_id: string | null;
  name: string;
  /** Main service description (editable, default = trip name / "Szállás + Fotózás") */
  service_description: string;
  unit_price: number;
  discount_percentage: number;
  discount_amount: number;
  /** unit_price - discount_amount */
  final_price: number;
  advance_amount: number;
  extra_items: ParticipantExtraItem[];
}

/** Global shared items — transfers, common extras not tied to one person */
interface SharedLine {
  id: string;
  description: string;
  amount: number;
  is_discount: boolean;
}

const TODAY    = format(new Date(), "yyyy-MM-dd");
const DUE_DATE = format(addDays(new Date(), 14), "yyyy-MM-dd");

const TAX_OPTIONS = [
  { value: 20, label: "20% – Normalsatz (általános)" },
  { value: 13, label: "13% – Ermäßigt Tourismus (turisztika)" },
  { value: 0,  label: "0% – Steuerfrei (adómentes)" },
] as const;

const DEFAULT_SERVICE_LABEL = "Unterkunft + Fotografie / Szállás + Fotózás";

function mkBlock(name: string, unitPrice = 0, discPct = 0, depositAmt = 0, participantId: string | null = null): ParticipantBlock {
  const discAmt = Math.round(unitPrice * discPct / 100 * 100) / 100;
  return {
    id: crypto.randomUUID(),
    participant_id: participantId,
    name,
    service_description: DEFAULT_SERVICE_LABEL,
    unit_price: unitPrice,
    discount_percentage: discPct,
    discount_amount: discAmt,
    final_price: Math.max(unitPrice - discAmt, 0),
    advance_amount: depositAmt,
    extra_items: [],
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

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

  // Participant blocks — the heart of the new UI
  const [blocks, setBlocks]         = useState<ParticipantBlock[]>([]);
  // Shared lines (transfers, etc.) at the bottom
  const [sharedLines, setSharedLines] = useState<SharedLine[]>([
    { id: crypto.randomUUID(), description: "Transfers + Sonstige Kosten / Transzferek + Egyéb költségek", amount: 0, is_discount: false },
  ]);
  // Simple 4-field mode (legacy / no-participant fallback)
  const [mode, setMode]             = useState<"participant" | "simple">("participant");
  const [modeManuallySet, setModeManuallySet] = useState(false);
  const [simplePrices, setSimplePrices] = useState({ accommodation: 0, transfers: 0, discount: 0, advance: 0 });

  // ── Init ────────────────────────────────────────────────────────────────────

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

  // When client / booking changes: populate participant blocks
  useEffect(() => {
    if (!selectedClient) { setBlocks([]); return; }

    if (!selectedBooking) {
      setBlocks([mkBlock(`${selectedClient.last_name} ${selectedClient.first_name}`)]);
      if (!modeManuallySet) setMode("participant");
      return;
    }

    supabase
      .from("booking_participants")
      .select("*")
      .eq("booking_id", selectedBooking.id)
      .order("is_lead", { ascending: false })
      .then(({ data }) => {
        const dbParts = (data ?? []) as BookingParticipant[];
        const b = selectedBooking as Booking;
        const depositTotal = b.deposit_amount ?? 0;

        if (dbParts.length > 0) {
          const perAdv = Math.round(depositTotal / dbParts.length * 100) / 100;
          setBlocks(dbParts.map((p, i) => {
            const unitPrice = p.unit_price ?? (b.base_amount ? b.base_amount / dbParts.length : 0);
            const discPct   = p.discount_percentage ?? 0;
            const discAmt   = p.discount_amount ?? Math.round(unitPrice * discPct / 100 * 100) / 100;
            const advance   = i === dbParts.length - 1
              ? Math.round((depositTotal - perAdv * (dbParts.length - 1)) * 100) / 100
              : perAdv;
            return {
              id: crypto.randomUUID(),
              participant_id: p.id,
              name: p.name,
              service_description: DEFAULT_SERVICE_LABEL,
              unit_price: unitPrice,
              discount_percentage: discPct,
              discount_amount: discAmt,
              final_price: p.final_price ?? Math.max(unitPrice - discAmt, 0),
              advance_amount: advance,
              extra_items: [],
            };
          }));
        } else {
          // No named participants — single row from booking
          setBlocks([mkBlock(
            `${selectedClient.last_name} ${selectedClient.first_name}`,
            b.base_amount ?? b.final_amount ?? 0,
            b.discount_percentage ?? 0,
            depositTotal,
          )]);
        }
        setSimplePrices({
          accommodation: b.base_amount ?? b.final_amount ?? 0,
          transfers: 0,
          discount: b.discount_amount ?? 0,
          advance: depositTotal,
        });
        if (!modeManuallySet) setMode("participant");
      });
  }, [selectedBooking, selectedClient]);

  // ── Block helpers ─────────────────────────────────────────────────────────

  function updateBlock(id: string, patch: Partial<ParticipantBlock>) {
    setBlocks((prev) => prev.map((b) => b.id !== id ? b : { ...b, ...patch }));
  }

  function updateBlockDiscount(id: string, pct: number) {
    setBlocks((prev) => prev.map((b) => {
      if (b.id !== id) return b;
      const disc = Math.round(b.unit_price * pct / 100 * 100) / 100;
      return { ...b, discount_percentage: pct, discount_amount: disc, final_price: Math.max(b.unit_price - disc, 0) };
    }));
  }

  function updateBlockPrice(id: string, price: number) {
    setBlocks((prev) => prev.map((b) => {
      if (b.id !== id) return b;
      const disc = Math.round(price * b.discount_percentage / 100 * 100) / 100;
      return { ...b, unit_price: price, discount_amount: disc, final_price: Math.max(price - disc, 0) };
    }));
  }

  function addExtraItem(blockId: string) {
    setBlocks((prev) => prev.map((b) =>
      b.id !== blockId ? b : {
        ...b, extra_items: [...b.extra_items, { id: crypto.randomUUID(), description: "", amount: 0 }],
      }
    ));
  }

  function updateExtraItem(blockId: string, itemId: string, field: "description" | "amount", value: string | number) {
    setBlocks((prev) => prev.map((b) =>
      b.id !== blockId ? b : {
        ...b, extra_items: b.extra_items.map((e) => e.id !== itemId ? e : { ...e, [field]: value }),
      }
    ));
  }

  function removeExtraItem(blockId: string, itemId: string) {
    setBlocks((prev) => prev.map((b) =>
      b.id !== blockId ? b : { ...b, extra_items: b.extra_items.filter((e) => e.id !== itemId) }
    ));
  }

  function addBlock() {
    setBlocks((prev) => [...prev, mkBlock("")]);
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  // ── Totals ────────────────────────────────────────────────────────────────

  const participantTotal = blocks.reduce((s, b) =>
    s + b.final_price + b.extra_items.reduce((es, e) => es + e.amount, 0), 0);
  const sharedTotal = sharedLines.reduce((s, l) => s + (l.is_discount ? -Math.abs(l.amount) : l.amount), 0);
  const totalAdvance = blocks.reduce((s, b) => s + b.advance_amount, 0);
  const simpleSubtotal = simplePrices.accommodation + simplePrices.transfers - simplePrices.discount;

  const subtotal   = mode === "participant" ? participantTotal + sharedTotal : simpleSubtotal;
  const taxAmount  = subtotal * taxRate / 100;
  const total      = subtotal + taxAmount;
  const advanceAmt = mode === "participant" ? totalAdvance : simplePrices.advance;

  // ── Build items for PDF / save ────────────────────────────────────────────

  function buildItems() {
    if (mode === "simple") {
      const r = [];
      r.push({ description: "Unterkunft + Fotografie / Szállás + Fotózás", quantity: 1, unit_price: simplePrices.accommodation, total: simplePrices.accommodation, is_advance: false });
      r.push({ description: "Transfers + Sonstige Kosten / Transzferek + Egyéb költségek", quantity: 1, unit_price: simplePrices.transfers, total: simplePrices.transfers, is_advance: false });
      if (simplePrices.discount > 0) r.push({ description: "Rabatt / Kedvezmény", quantity: 1, unit_price: -simplePrices.discount, total: -simplePrices.discount, is_advance: false });
      if (simplePrices.advance > 0)  r.push({ description: "Anzahlung / Előleg", quantity: 1, unit_price: simplePrices.advance, total: simplePrices.advance, is_advance: true });
      return r;
    }

    const result = [];
    for (const b of blocks) {
      if (!b.name) continue;
      // Main service line
      result.push({
        description: `${b.service_description} – ${b.name}`,
        quantity: 1,
        unit_price: b.unit_price,
        total: b.unit_price,
        is_advance: false,
      });
      // Discount line (only if discount > 0)
      if (b.discount_amount > 0) {
        result.push({
          description: `Rabatt / Kedvezmény (${b.discount_percentage}%) – ${b.name}`,
          quantity: 1,
          unit_price: -b.discount_amount,
          total: -b.discount_amount,
          is_advance: false,
        });
      }
      // Extra items for this participant
      for (const e of b.extra_items) {
        if (!e.description && e.amount === 0) continue;
        result.push({
          description: `${e.description || "Egyéb"} – ${b.name}`,
          quantity: 1,
          unit_price: e.amount,
          total: e.amount,
          is_advance: false,
        });
      }
    }
    // Shared lines
    for (const l of sharedLines) {
      if (l.amount === 0 && !l.description) continue;
      const amt = l.is_discount ? -Math.abs(l.amount) : l.amount;
      result.push({ description: l.description || "Közös tétel", quantity: 1, unit_price: amt, total: amt, is_advance: false });
    }
    // Combined advance line
    if (totalAdvance > 0) {
      result.push({ description: "Anzahlung / Előleg", quantity: 1, unit_price: totalAdvance, total: totalAdvance, is_advance: true });
    }
    return result;
  }

  // ── PDF preview ───────────────────────────────────────────────────────────

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
        items,
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
      setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
    } catch (e) {
      console.error("PDF preview error:", e);
    } finally {
      setPreviewLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient, selectedBooking, issueDate, dueDate, serviceDate, taxRate, notes, agencySettings, eurHufRate, subtotal, taxAmount, total, blocks, sharedLines, simplePrices, mode]);

  useEffect(() => {
    previewDebRef.current = setTimeout(() => { void refreshPreview(); }, 700);
    return () => clearTimeout(previewDebRef.current);
  }, [refreshPreview]);

  // ── Save ──────────────────────────────────────────────────────────────────

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

          {/* Mode toggle */}
          <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white p-1.5">
            <button type="button"
              onClick={() => { setMode("participant"); setModeManuallySet(true); }}
              className={cn("flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors",
                mode === "participant" ? "bg-blue-600 text-white" : "text-zinc-500 hover:bg-zinc-50")}>
              Résztvevőnkénti bontás
            </button>
            <button type="button"
              onClick={() => { setMode("simple"); setModeManuallySet(true); }}
              className={cn("flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors",
                mode === "simple" ? "bg-blue-600 text-white" : "text-zinc-500 hover:bg-zinc-50")}>
              Egyszerű tételek
            </button>
          </div>

          {/* ── PARTICIPANT MODE ──────────────────────────────────────────── */}
          {mode === "participant" && (
            <div className="space-y-4">
              {blocks.map((block, bi) => {
                const blockTotal = block.final_price + block.extra_items.reduce((s, e) => s + e.amount, 0);
                return (
                  <div key={block.id} className="rounded-md border border-zinc-200 bg-white overflow-hidden">
                    {/* Participant header */}
                    <div className="flex items-center gap-3 bg-zinc-50 border-b border-zinc-200 px-4 py-2.5">
                      <span className="text-xs font-bold uppercase tracking-wide text-zinc-400 w-5 text-center">{bi + 1}.</span>
                      <Input
                        value={block.name}
                        onChange={(e) => updateBlock(block.id, { name: e.target.value })}
                        placeholder="Résztvevő neve"
                        className="flex-1 h-8 text-sm font-semibold bg-transparent border-0 shadow-none focus-visible:ring-0 px-0"
                      />
                      {blocks.length > 1 && (
                        <button type="button" onClick={() => removeBlock(block.id)} className="text-zinc-300 hover:text-red-500 p-1">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="p-4 space-y-3">
                      {/* Service description + price */}
                      <div className="grid grid-cols-[1fr_140px] gap-3 items-end">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-zinc-400 uppercase tracking-wide">Szolgáltatás megnevezése</Label>
                          <Input
                            value={block.service_description}
                            onChange={(e) => updateBlock(block.id, { service_description: e.target.value })}
                            placeholder="pl. Szállás + Fotózás"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-zinc-400 uppercase tracking-wide">Ár (€)</Label>
                          <div className="relative">
                            <Input type="number" min={0} value={block.unit_price}
                              onChange={(e) => updateBlockPrice(block.id, Number(e.target.value))}
                              className="h-8 text-sm text-right pr-7" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400">€</span>
                          </div>
                        </div>
                      </div>

                      {/* Discount */}
                      <div className="grid grid-cols-[1fr_140px_140px] gap-3 items-end">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-zinc-400 uppercase tracking-wide">Kedvezmény %</Label>
                          <div className="relative">
                            <Input type="number" min={0} max={100} value={block.discount_percentage}
                              onChange={(e) => updateBlockDiscount(block.id, Number(e.target.value))}
                              className="h-8 text-sm text-right pr-7" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400">%</span>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-zinc-400 uppercase tracking-wide">Kedvezmény összeg (€)</Label>
                          <p className="h-8 flex items-center justify-end text-sm font-medium text-red-600 pr-1">
                            {block.discount_amount > 0 ? `- ${fmtEur(block.discount_amount)}` : "—"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-zinc-400 uppercase tracking-wide">Fizetendő (€)</Label>
                          <p className="h-8 flex items-center justify-end text-sm font-semibold text-zinc-900 pr-1">
                            {fmtEur(block.final_price)}
                          </p>
                        </div>
                      </div>

                      {/* Extra items */}
                      {block.extra_items.length > 0 && (
                        <div className="rounded-md bg-zinc-50 border border-zinc-100 p-3 space-y-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Egyéb tételek</p>
                          {block.extra_items.map((e) => (
                            <div key={e.id} className="grid grid-cols-[1fr_120px_28px] gap-2 items-center">
                              <Input value={e.description}
                                onChange={(ev) => updateExtraItem(block.id, e.id, "description", ev.target.value)}
                                placeholder="pl. Vacsora, Belépő, Kirándulás…"
                                className="h-8 text-sm" />
                              <div className="relative">
                                <Input type="number" min={0} value={e.amount}
                                  onChange={(ev) => updateExtraItem(block.id, e.id, "amount", Number(ev.target.value))}
                                  className="h-8 text-sm text-right pr-7" />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400">€</span>
                              </div>
                              <button type="button" onClick={() => removeExtraItem(block.id, e.id)}
                                className="text-zinc-300 hover:text-red-500 p-1">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Advance + add item */}
                      <div className="flex items-center gap-4 pt-1">
                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                          onClick={() => addExtraItem(block.id)}>
                          <Plus className="mr-1 h-3 w-3" />
                          Tétel hozzáadása
                        </Button>
                        <div className="flex items-center gap-2 ml-auto">
                          <Label className="text-[10px] text-zinc-400 uppercase tracking-wide whitespace-nowrap">Előleg (€)</Label>
                          <div className="relative w-28">
                            <Input type="number" min={0} value={block.advance_amount}
                              onChange={(e) => updateBlock(block.id, { advance_amount: Number(e.target.value) })}
                              className="h-7 text-xs text-right pr-6" />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400">€</span>
                          </div>
                        </div>
                      </div>

                      {/* Block subtotal */}
                      <div className="flex justify-end border-t border-zinc-100 pt-2">
                        <span className="text-xs text-zinc-400 mr-2">Részösszeg:</span>
                        <span className="text-sm font-semibold text-zinc-800">{fmtEur(blockTotal)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add participant */}
              <Button type="button" variant="outline" className="w-full h-9 text-sm border-dashed" onClick={addBlock}>
                <Plus className="mr-2 h-4 w-4" />
                Résztvevő hozzáadása
              </Button>

              {/* Shared lines */}
              <div className="rounded-md border border-zinc-200 bg-white p-4 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Közös tételek</h4>
                {sharedLines.map((l) => (
                  <div key={l.id} className="grid grid-cols-[1fr_120px_140px_28px] gap-2 items-center">
                    <Input value={l.description}
                      onChange={(e) => setSharedLines((prev) => prev.map((s) => s.id === l.id ? { ...s, description: e.target.value } : s))}
                      placeholder="pl. Transzfer, Közös kirándulás…"
                      className="h-8 text-sm" />
                    <div className="relative">
                      <Input type="number" min={0} value={l.amount}
                        onChange={(e) => setSharedLines((prev) => prev.map((s) => s.id === l.id ? { ...s, amount: Number(e.target.value) } : s))}
                        className="h-8 text-sm text-right pr-7" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400">€</span>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <input type="checkbox" checked={l.is_discount}
                        onChange={(e) => setSharedLines((prev) => prev.map((s) => s.id === l.id ? { ...s, is_discount: e.target.checked } : s))} />
                      Kedvezmény (levonva)
                    </label>
                    <button type="button"
                      onClick={() => setSharedLines((prev) => prev.filter((s) => s.id !== l.id))}
                      className="text-zinc-300 hover:text-red-500 p-1">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                  onClick={() => setSharedLines((prev) => [...prev, { id: crypto.randomUUID(), description: "", amount: 0, is_discount: false }])}>
                  <Plus className="mr-1 h-3 w-3" />
                  Közös tétel
                </Button>
              </div>
            </div>
          )}

          {/* ── SIMPLE MODE ───────────────────────────────────────────────── */}
          {mode === "simple" && (
            <div className="rounded-md border border-zinc-200 bg-white p-5 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 border-b border-zinc-100 pb-1">Positionen / Tételek</h3>
              <div className="grid grid-cols-[1fr_130px_130px_110px] gap-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 px-1">
                <span>Leírás</span><span className="text-right">EUR</span><span className="text-right">HUF</span><span className="text-right">Összeg</span>
              </div>
              <div className="space-y-2">
                {(["accommodation", "transfers", "discount", "advance"] as const).map((key) => {
                  const labels: Record<string, string> = {
                    accommodation: "Unterkunft + Fotografie / Szállás + Fotózás",
                    transfers: "Transfers + Sonstige Kosten / Transzferek + Egyéb költségek",
                    discount: "Rabatt / Kedvezmény",
                    advance: "Anzahlung / Előleg",
                  };
                  const isDiscount = key === "discount";
                  const isAdvance  = key === "advance";
                  const rawVal = simplePrices[key];
                  return (
                    <div key={key} className={cn(
                      "grid grid-cols-[1fr_130px_130px_110px] gap-2 items-center rounded-md px-1 py-1",
                      isAdvance && "bg-amber-50 border border-amber-100",
                      isDiscount && "bg-red-50 border border-red-100",
                    )}>
                      <div>
                        <p className="text-sm font-medium text-zinc-800">{labels[key]}</p>
                        {isAdvance  && <p className="text-xs text-amber-600 mt-0.5">Nem számít bele a végösszegbe</p>}
                        {isDiscount && <p className="text-xs text-red-500 mt-0.5">Kedvezmény (levonva)</p>}
                      </div>
                      <div className="relative">
                        <Input type="number" min={0} step={0.01} value={rawVal}
                          onChange={(e) => setSimplePrices((p) => ({ ...p, [key]: Number(e.target.value) }))}
                          className="h-8 text-sm text-right pr-8" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-400">EUR</span>
                      </div>
                      <p className="text-sm text-right text-zinc-600 pr-1">
                        {fmtHuf(Math.abs(rawVal) * (isDiscount ? -1 : 1), eurHufRate)}
                      </p>
                      <p className={cn("text-sm font-medium text-right pr-1", isDiscount && "text-red-600", isAdvance && "text-amber-700")}>
                        {fmtEur(isDiscount ? -Math.abs(rawVal) : rawVal)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
              {mode === "participant" && (
                <>
                  <div className="grid grid-cols-3 text-sm">
                    <span className="text-zinc-500">Résztvevők összesen</span>
                    <span className="font-medium text-right">{fmtEur(participantTotal)}</span>
                    <span className="text-right text-zinc-400">{fmtHuf(participantTotal, eurHufRate)}</span>
                  </div>
                  {sharedTotal !== 0 && (
                    <div className="grid grid-cols-3 text-sm">
                      <span className="text-zinc-500">Közös tételek</span>
                      <span className="font-medium text-right">{fmtEur(sharedTotal)}</span>
                      <span className="text-right text-zinc-400">{fmtHuf(sharedTotal, eurHufRate)}</span>
                    </div>
                  )}
                </>
              )}
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
              {advanceAmt > 0 && (
                <div className="grid grid-cols-3 text-sm border-t border-amber-200 pt-2 text-amber-700">
                  <span>Előleg</span>
                  <span className="text-right">{fmtEur(-advanceAmt)}</span>
                  <span className="text-right text-xs">{fmtHuf(-advanceAmt, eurHufRate)}</span>
                </div>
              )}
              {advanceAmt > 0 && (
                <div className="grid grid-cols-3 text-sm font-semibold text-green-700">
                  <span>Még fizetendő</span>
                  <span className="text-right">{fmtEur(total - advanceAmt)}</span>
                  <span className="text-right text-xs font-normal text-zinc-400">{fmtHuf(total - advanceAmt, eurHufRate)}</span>
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
