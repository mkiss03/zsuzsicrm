"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Search, X, Loader2, Star, Info, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addDays, format } from "date-fns";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { bookingSchema, type BookingFormValues } from "@/lib/validators/booking";
import { useBookings } from "@/hooks/useBookings";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Client, Trip, ClientSource } from "@/types";

// ─── Discount helpers ─────────────────────────────────────────────────────────

const DISCOUNT_LEVELS = [
  { level: 0, label: "Alap",  pct: 0 },
  { level: 1, label: "Bronz", pct: 5 },
  { level: 2, label: "Ezüst", pct: 10 },
  { level: 3, label: "Arany", pct: 15 },
] as const;

function getDiscountPct(level: number): number {
  return DISCOUNT_LEVELS.find((d) => d.level === level)?.pct ?? 0;
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center mb-8">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md text-sm font-semibold border-2",
              i < current  ? "border-zinc-700 bg-zinc-700 text-white" :
              i === current ? "border-blue-600 bg-blue-600 text-white" :
                             "border-zinc-200 bg-white text-zinc-400",
            )}>
              {i < current ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={cn(
              "mt-1 text-xs",
              i === current ? "text-blue-600 font-medium" : "text-zinc-400",
            )}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={cn("flex-1 h-0.5 mx-2 mb-4", i < current ? "bg-zinc-600" : "bg-zinc-200")} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── STEP 1: Client selection ─────────────────────────────────────────────────

function Step1({
  selectedClient,
  onSelect,
}: {
  selectedClient: Client | null;
  onSelect: (c: Client | null) => void;
}) {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Client[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout>>();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    debRef.current = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("clients")
        .select("*")
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
        .is("deleted_at", null)
        .limit(8);
      setResults((data ?? []) as Client[]);
      setOpen(true);
      setSearching(false);
    }, 300);
    return () => clearTimeout(debRef.current);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const discountPct = selectedClient ? getDiscountPct(selectedClient.discount_level) : 0;
  const discountLabel = DISCOUNT_LEVELS.find((d) => d.level === selectedClient?.discount_level)?.label ?? "Alap";

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-zinc-900">Ügyfél kiválasztása</h2>

      {/* Combobox */}
      <div ref={wrapRef} className="relative">
        <Label className="text-sm font-medium text-zinc-700 mb-1.5 block">
          Keresés név vagy email alapján
        </Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); if (selectedClient) onSelect(null); }}
            placeholder="pl. Nagy Katalin vagy katalin@email.com"
            className="pl-9"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-400" />
          )}
        </div>

        {open && results.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg">
            {results.map((c) => (
              <button
                key={c.id}
                className="flex w-full items-start gap-3 px-4 py-3 hover:bg-zinc-50 text-left border-b border-zinc-100 last:border-0"
                onClick={() => { onSelect(c); setQuery(`${c.last_name} ${c.first_name}`); setOpen(false); }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-zinc-900">{c.last_name} {c.first_name}</span>
                    {c.is_vip && <Badge variant="warning" className="text-[10px] px-1">VIP</Badge>}
                  </div>
                  <span className="text-xs text-zinc-500">{c.email ?? "nincs email"} · {c.trip_count} utazás</span>
                </div>
                {c.discount_level > 0 && (
                  <Badge variant={["muted","info","warning","success"][c.discount_level] as never}>
                    {getDiscountPct(c.discount_level)}% kedv.
                  </Badge>
                )}
              </button>
            ))}
          </div>
        )}

        {open && !searching && results.length === 0 && query.trim() && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg px-4 py-3">
            <p className="text-sm text-zinc-500">Nincs találat.</p>
            <Link href="/clients/new" className="text-sm text-blue-600 hover:underline mt-1 block">
              + Új ügyfél létrehozása
            </Link>
          </div>
        )}
      </div>

      {/* Selected client card */}
      {selectedClient && (
        <div className="rounded-md border border-blue-200 bg-blue-50/40 p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-zinc-900">
                  {selectedClient.last_name} {selectedClient.first_name}
                </span>
                {selectedClient.is_vip && <Badge variant="warning">VIP</Badge>}
              </div>
              <p className="text-sm text-zinc-500">{selectedClient.email}</p>
              <p className="text-xs text-zinc-400 mt-1">{selectedClient.trip_count} korábbi utazás · {selectedClient.client_code}</p>
            </div>
            <button onClick={() => { onSelect(null); setQuery(""); }} className="text-zinc-400 hover:text-zinc-700">
              <X className="h-4 w-4" />
            </button>
          </div>
          {discountPct > 0 && (
            <div className="mt-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded px-3 py-2">
              <Star className="h-3.5 w-3.5 fill-amber-500" />
              Automatikus kedvezmény: <strong>{discountPct}% ({discountLabel} szint)</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── STEP 2: Trip selection ───────────────────────────────────────────────────

function Step2({
  selectedTrip,
  selectedClient,
  onSelect,
}: {
  selectedTrip: Trip | null;
  selectedClient: Client | null;
  onSelect: (t: Trip | null) => void;
}) {
  const supabase = createClient();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("trips")
      .select("*")
      .in("status", ["advertised", "planned"])
      .is("deleted_at", null)
      .order("departure_date")
      .then(({ data }) => {
        // Filter out fully booked
        setTrips(((data ?? []) as Trip[]).filter((t) => t.current_bookings < t.max_capacity));
        setLoading(false);
      });
  }, []);

  const basePrice = (t: Trip) =>
    selectedClient?.is_vip && t.vip_price ? t.vip_price : t.base_price;

  if (loading) return (
    <div className="space-y-3">
      {[0,1,2].map((i) => <div key={i} className="h-24 rounded-md border border-zinc-100 bg-zinc-50 animate-pulse" />)}
    </div>
  );

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-zinc-900">Utazás kiválasztása</h2>
      {trips.length === 0 ? (
        <p className="text-sm text-zinc-500 italic">Nincs elérhető utazás jelenleg.</p>
      ) : (
        <div className="grid gap-3">
          {trips.map((t) => {
            const isSelected = selectedTrip?.id === t.id;
            const available  = t.max_capacity - t.current_bookings;
            return (
              <button
                key={t.id}
                onClick={() => onSelect(isSelected ? null : t)}
                className={cn(
                  "text-left rounded-md border p-4 transition-all w-full",
                  isSelected
                    ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-400"
                    : "border-zinc-200 hover:border-zinc-300",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {isSelected && <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />}
                      <span className="font-semibold text-zinc-900 text-sm">{t.name}</span>
                      <span className="font-mono text-[10px] text-zinc-400">{t.trip_code}</span>
                    </div>
                    <p className="text-xs text-zinc-500">
                      {t.destination} · {formatDate(t.departure_date)} – {formatDate(t.return_date)}
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {available} szabad hely ({t.current_bookings}/{t.max_capacity})
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="font-semibold text-zinc-900">{formatCurrency(basePrice(t))}</p>
                    {selectedClient?.is_vip && t.vip_price && (
                      <Badge variant="warning" className="text-[10px] mt-1">VIP ár</Badge>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// ─── Participant row type ─────────────────────────────────────────────────────

interface ParticipantRow {
  key: string;
  client_id: string | null;
  name: string;
  is_lead: boolean;
  notes: string;
}

export default function NewBookingPage() {
  const router = useRouter();
  const { createBooking, loading } = useBookings();

  const [step, setStep]                     = useState(0);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedTrip, setSelectedTrip]     = useState<Trip | null>(null);
  const [savedBookingId, setSavedBookingId] = useState<string | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);

  // Participants state
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);

  // Pricing state
  const [manualEnabled, setManualEnabled]   = useState(false);
  const [manualType, setManualType]         = useState<"percent" | "amount">("percent");
  const [manualValue, setManualValue]       = useState(0);

  const partySize = Math.max(participants.length, 1);

  // Computed pricing (per-person base * party size)
  const perPersonPrice = (() => {
    if (!selectedTrip || !selectedClient) return 0;
    return selectedClient.is_vip && selectedTrip.vip_price
      ? selectedTrip.vip_price
      : selectedTrip.base_price;
  })();
  const baseAmount = perPersonPrice * partySize;

  const autoPct         = getDiscountPct(selectedClient?.discount_level ?? 0);
  const autoDiscount    = baseAmount * autoPct / 100;
  const manualDiscount  = manualEnabled
    ? manualType === "percent" ? baseAmount * manualValue / 100 : manualValue
    : 0;
  const totalDiscount   = autoDiscount + manualDiscount;
  const finalAmount     = Math.max(baseAmount - totalDiscount, 0);
  const depositAmount   = Math.round(finalAmount * 0.3);
  const defaultDeadline = format(addDays(new Date(), 14), "yyyy-MM-dd");

  const { control, register, getValues } = useForm({
    defaultValues: {
      source: "" as ClientSource | "",
      notes: "",
      payment_deadline: defaultDeadline,
      deposit_amount: depositAmount,
    },
  });

  // Initialize lead participant when client is selected
  function handleClientSelect(c: Client | null) {
    setSelectedClient(c);
    if (c) {
      setParticipants([{
        key: crypto.randomUUID(),
        client_id: c.id,
        name: `${c.last_name} ${c.first_name}`,
        is_lead: true,
        notes: "",
      }]);
    } else {
      setParticipants([]);
    }
  }

  function addParticipantRow() {
    setParticipants((prev) => [
      ...prev,
      { key: crypto.randomUUID(), client_id: null, name: "", is_lead: false, notes: "" },
    ]);
  }

  function removeParticipantRow(key: string) {
    setParticipants((prev) => prev.filter((p) => p.key !== key));
  }

  function updateParticipantRow(key: string, field: keyof ParticipantRow, value: string | boolean | null) {
    setParticipants((prev) =>
      prev.map((p) => (p.key === key ? { ...p, [field]: value } : p)),
    );
  }

  const steps = ["Ügyfél", "Utazás", "Árazás & Mentés"];

  function canProceed() {
    if (step === 0) return !!selectedClient;
    if (step === 1) return !!selectedTrip;
    return true;
  }

  async function handleSave() {
    if (!selectedClient || !selectedTrip) return;
    const formValues = getValues();
    const discountPct = autoPct + (manualEnabled && manualType === "percent" ? manualValue : 0);
    const validParticipants = participants.filter((p) => p.name.trim());
    const payload: BookingFormValues = {
      client_id: selectedClient.id,
      trip_id: selectedTrip.id,
      status: "booked",
      party_size: Math.max(validParticipants.length, 1),
      base_amount: baseAmount,
      discount_percentage: discountPct,
      discount_amount: Math.round(totalDiscount * 100) / 100,
      final_amount: Math.round(finalAmount * 100) / 100,
      deposit_amount: Number(formValues.deposit_amount) || depositAmount,
      payment_deadline: formValues.payment_deadline || defaultDeadline,
      source: (formValues.source || null) as ClientSource | null,
      notes: formValues.notes || undefined,
      participants: validParticipants.map((p) => ({
        client_id: p.client_id,
        name: p.name,
        is_lead: p.is_lead,
        notes: p.notes || null,
      })),
    };

    const booking = await createBooking(payload);
    if (booking) {
      setSavedBookingId(booking.id);
      setShowEmailDialog(true);
    } else {
      toast.error("Hiba a foglalás mentésekor");
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Új foglalás"
        actions={
          <Button variant="outline" asChild>
            <Link href="/bookings"><ArrowLeft className="mr-2 h-4 w-4" />Vissza</Link>
          </Button>
        }
      />

      <div className="rounded-md border border-zinc-200 bg-white p-6">
        <StepIndicator current={step} steps={steps} />

        {step === 0 && (
          <Step1 selectedClient={selectedClient} onSelect={handleClientSelect} />
        )}
        {step === 1 && (
          <Step2 selectedTrip={selectedTrip} selectedClient={selectedClient} onSelect={setSelectedTrip} />
        )}
        {step === 2 && selectedClient && selectedTrip && (
          <div className="space-y-5">
            <h2 className="text-base font-semibold text-zinc-900">Árazás & Részletek</h2>

            <div className="lg:grid lg:grid-cols-5 lg:gap-6">
              {/* Form */}
              <div className="lg:col-span-3 space-y-4">
                {/* Automatic discount info */}
                {autoPct > 0 && (
                  <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    <Info className="h-4 w-4 flex-shrink-0" />
                    Automatikus kedvezmény:{" "}
                    <strong>{autoPct}% ({DISCOUNT_LEVELS.find((d) => d.pct === autoPct)?.label} szint)</strong>
                  </div>
                )}

                {/* Participants */}
                <div className="rounded-md border border-zinc-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-zinc-700">
                      Résztvevők ({participants.length} fő)
                    </h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={addParticipantRow}
                    >
                      <UserPlus className="mr-1 h-3.5 w-3.5" />
                      Résztvevő hozzáadása
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {participants.map((p) => (
                      <div key={p.key} className="flex items-center gap-2">
                        <Input
                          value={p.name}
                          onChange={(e) => updateParticipantRow(p.key, "name", e.target.value)}
                          placeholder="Név"
                          className="flex-1 h-9"
                          disabled={p.is_lead}
                        />
                        {p.is_lead ? (
                          <Badge variant="muted" className="text-[10px] px-2 shrink-0">
                            Főfoglaló
                          </Badge>
                        ) : (
                          <button
                            type="button"
                            onClick={() => removeParticipantRow(p.key)}
                            className="text-zinc-400 hover:text-red-500 p-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {partySize > 1 && (
                    <p className="text-xs text-zinc-500">
                      Az ár {partySize} főre számolva: {partySize} × {formatCurrency(perPersonPrice)} = {formatCurrency(baseAmount)}
                    </p>
                  )}
                </div>

                {/* Manual discount toggle */}
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={manualEnabled}
                      onChange={(e) => setManualEnabled(e.target.checked)}
                      className="rounded border-zinc-300 text-blue-600"
                    />
                    <span className="text-sm font-medium text-zinc-700">Kézi kedvezmény hozzáadása</span>
                  </label>

                  {manualEnabled && (
                    <div className="mt-3 flex items-center gap-2">
                      <Select value={manualType} onValueChange={(v) => setManualType(v as "percent" | "amount")}>
                        <SelectTrigger className="w-28 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">%</SelectItem>
                          <SelectItem value="amount">Ft összeg</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={0}
                        value={manualValue}
                        onChange={(e) => setManualValue(Number(e.target.value))}
                        className="flex-1 h-9"
                        placeholder={manualType === "percent" ? "pl. 5" : "pl. 5000"}
                      />
                    </div>
                  )}
                </div>

                {/* Deposit */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-zinc-700">Előleg összege (Ft)</Label>
                  <Input
                    {...register("deposit_amount")}
                    type="number"
                    min={0}
                  />
                  <p className="text-xs text-zinc-400">Alapértelmezés: végösszeg 30%-a ({formatCurrency(depositAmount)})</p>
                </div>

                {/* Payment deadline */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-zinc-700">Fizetési határidő</Label>
                  <Input {...register("payment_deadline")} type="date" />
                </div>

                {/* Source */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-zinc-700">Forrás</Label>
                  <Controller
                    name="source"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Válassz…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="messenger">Messenger</SelectItem>
                          <SelectItem value="website_form">Weboldal</SelectItem>
                          <SelectItem value="referral">Ajánlás</SelectItem>
                          <SelectItem value="other">Egyéb</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-zinc-700">Megjegyzés</Label>
                  <Textarea {...register("notes")} rows={3} placeholder="Opcionális megjegyzés…" />
                </div>
              </div>

              {/* Sticky pricing summary */}
              <div className="mt-6 lg:mt-0 lg:col-span-2 lg:sticky lg:top-6 lg:h-fit">
                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">
                    Ár összefoglaló
                  </h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">
                      Alap ár{partySize > 1 ? ` (${partySize} fő)` : ""}
                    </span>
                    <span className="font-medium">{formatCurrency(baseAmount)}</span>
                  </div>
                  {autoDiscount > 0 && (
                    <div className="flex justify-between text-sm text-amber-700">
                      <span>Automatikus kedvezmény ({autoPct}%)</span>
                      <span>-{formatCurrency(autoDiscount)}</span>
                    </div>
                  )}
                  {manualEnabled && manualDiscount > 0 && (
                    <div className="flex justify-between text-sm text-amber-700">
                      <span>Kézi kedvezmény</span>
                      <span>-{formatCurrency(manualDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-semibold border-t border-zinc-200 pt-2">
                    <span>Végösszeg</span>
                    <span className="text-zinc-900">{formatCurrency(finalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-zinc-500">
                    <span>Előleg (30%)</span>
                    <span>{formatCurrency(depositAmount)}</span>
                  </div>
                  {partySize > 1 && (
                    <div className="flex justify-between text-sm text-zinc-500">
                      <span>Létszám</span>
                      <span>{partySize} fő</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-zinc-500">
                    <span>Ügyfél</span>
                    <span>{selectedClient.last_name} {selectedClient.first_name}</span>
                  </div>
                  <div className="flex justify-between text-sm text-zinc-500">
                    <span>Utazás</span>
                    <span className="truncate max-w-[120px] text-right">{selectedTrip.name}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-8 flex items-center justify-between border-t border-zinc-100 pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => step === 0 ? router.push("/bookings") : setStep((s) => s - 1)}
          >
            {step === 0 ? "Mégse" : "Vissza"}
          </Button>
          {step < 2 ? (
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={!canProceed()}
              onClick={() => setStep((s) => s + 1)}
            >
              Következő
            </Button>
          ) : (
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={loading}
              onClick={handleSave}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Foglalás mentése
            </Button>
          )}
        </div>
      </div>

      {/* Post-save email dialog */}
      <Dialog open={showEmailDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Visszaigazoló email</DialogTitle>
            <DialogDescription>
              Szeretnél visszaigazoló emailt küldeni az ügyfélnek?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2">
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => router.push(`/emails?booking=${savedBookingId}`)}
            >
              Igen, emailt küldök
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push(`/bookings/${savedBookingId}`)}
            >
              Nem, csak megtekintem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
