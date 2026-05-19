"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Users, Plane, Filter, Search, Loader2, Send, CalendarClock, X } from "lucide-react";
import { addDays, format } from "date-fns";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
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
import type { EmailTemplate, EmailTemplateType, Client, Trip } from "@/types";

// ─── Type label ───────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<EmailTemplateType, string> = {
  confirmation:    "Visszaigazolás",
  deposit_request: "Előleg bekérő",
  reminder:        "Emlékeztető",
  pre_trip:        "Út előtti",
  post_trip:       "Út utáni",
  promotional:     "Promóció",
};

type RecipientMode = "single" | "trip" | "group";

// ─── Client combobox (same pattern as bookings) ───────────────────────────────

function ClientCombobox({
  selected,
  onSelect,
}: {
  selected: Client | null;
  onSelect: (c: Client | null) => void;
}) {
  const supabase = createClient();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debRef  = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    debRef.current = setTimeout(async () => {
      setBusy(true);
      const { data } = await supabase.from("clients").select("*")
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
        .is("deleted_at", null).limit(8);
      setResults((data ?? []) as Client[]);
      setOpen(true);
      setBusy(false);
    }, 300);
    return () => clearTimeout(debRef.current);
  }, [q]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      {selected ? (
        <div className="flex items-center gap-3 rounded-md border border-zinc-200 px-3 py-2.5 bg-zinc-50">
          <div className="flex-1">
            <p className="text-sm font-medium">{selected.last_name} {selected.first_name}</p>
            <p className="text-xs text-zinc-400">{selected.email}</p>
          </div>
          <button onClick={() => { onSelect(null); setQ(""); }} className="text-zinc-400 hover:text-zinc-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ügyfél keresése…" className="pl-9" />
            {busy && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-400" />}
          </div>
          {open && (
            <div className="absolute z-50 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg max-h-48 overflow-y-auto">
              {results.length === 0 ? (
                <p className="px-4 py-3 text-sm text-zinc-500">Nincs találat</p>
              ) : results.map((c) => (
                <button
                  key={c.id}
                  className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 text-left border-b border-zinc-100 last:border-0"
                  onClick={() => { onSelect(c); setQ(""); setOpen(false); }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{c.last_name} {c.first_name}</p>
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

// ─── Variable preview replacer ────────────────────────────────────────────────

function previewBody(text: string, client: Client | null, trip: Trip | null): string {
  if (!client && !trip) return text;
  const vars: Record<string, string> = {
    ugyfel_neve:         client ? `${client.last_name} ${client.first_name}` : "{{ugyfel_neve}}",
    ut_neve:             trip?.name ?? "{{ut_neve}}",
    iroda_neve:          "ZsuzsiTravel",
    client_name:         client ? `${client.last_name} ${client.first_name}` : "{{client_name}}",
    trip_name:           trip?.name ?? "{{trip_name}}",
    agency_name:         "ZsuzsiTravel",
  };
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmailSendPage() {
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [templates, setTemplates]         = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setTemplate]   = useState<EmailTemplate | null>(null);
  const [mode, setMode]                   = useState<RecipientMode>("single");
  const [selectedClient, setClient]       = useState<Client | null>(null);
  const [trips, setTrips]                 = useState<Trip[]>([]);
  const [selectedTrip, setTrip]           = useState<Trip | null>(null);
  const [tripParticipantCount, setTripParticipantCount] = useState(0);

  // Group mode filters
  const [groupDiscountLevel, setGroupDiscountLevel] = useState("all");
  const [groupMinTrips, setGroupMinTrips]           = useState("");
  const [groupSource, setGroupSource]               = useState("all");
  const [groupCount, setGroupCount]                 = useState<number | null>(null);
  const [groupIds, setGroupIds]                     = useState<string[]>([]);

  // Email fields
  const [subject, setSubject]           = useState("");
  const [body, setBody]                 = useState("");
  const [scheduled, setScheduled]       = useState(false);
  const [scheduledAt, setScheduledAt]   = useState(
    format(addDays(new Date(), 1), "yyyy-MM-dd") + "T09:00",
  );
  const [sending, setSending]           = useState(false);

  // Pre-fill from URL params (e.g. ?booking=xxx)
  const bookingId = searchParams.get("booking");

  useEffect(() => {
    // Load templates
    supabase.from("email_templates").select("*").order("type").then(({ data }) => {
      setTemplates((data ?? []) as EmailTemplate[]);
    });
    // Load trips for trip mode
    supabase.from("trips").select("*").not("status", "in", '("completed","cancelled")').is("deleted_at", null)
      .order("departure_date").then(({ data }) => setTrips((data ?? []) as Trip[]));
  }, []);

  // When template selected: pre-fill subject + body
  useEffect(() => {
    if (selectedTemplate) {
      setSubject(selectedTemplate.subject);
      setBody(selectedTemplate.body);
    }
  }, [selectedTemplate]);

  // Load trip participant count
  useEffect(() => {
    if (!selectedTrip) { setTripParticipantCount(0); return; }
    supabase.from("bookings").select("*", { count: "exact", head: true })
      .eq("trip_id", selectedTrip.id).is("deleted_at", null)
      .not("status", "in", '("cancelled","interested")')
      .then(({ count }) => setTripParticipantCount(count ?? 0));
  }, [selectedTrip]);

  // Build group recipient list when filters change
  useEffect(() => {
    if (mode !== "group") return;
    void buildGroupList();
  }, [mode, groupDiscountLevel, groupMinTrips, groupSource]);

  async function buildGroupList() {
    // Build the filtered query
    let q = supabase
      .from("clients")
      .select("id", { count: "exact" })  // count: "exact" returns total before any limit
      .is("deleted_at", null);
    if (groupDiscountLevel !== "all") q = q.eq("discount_level", Number(groupDiscountLevel));
    if (groupMinTrips) q = q.gte("trip_count", Number(groupMinTrips));
    if (groupSource !== "all") q = q.eq("source", groupSource);
    // Limit the IDs we'll actually send to (safety cap), but count is total
    const { data, count } = await q.limit(1000);
    setGroupIds(((data ?? []) as { id: string }[]).map((c) => c.id));
    setGroupCount(count ?? 0);
  }

  function getRecipientIds(): string[] {
    if (mode === "single") return selectedClient ? [selectedClient.id] : [];
    if (mode === "trip") {
      // We'll pass tripId to API and it will resolve participants
      return selectedTrip ? [`trip:${selectedTrip.id}`] : [];
    }
    return groupIds;
  }

  async function handleSend() {
    const recipientIds = getRecipientIds();
    if (recipientIds.length === 0) { toast.error("Válassz legalább egy címzettet!"); return; }
    if (!subject.trim() || !body.trim()) { toast.error("Tárgy és törzs szükséges!"); return; }

    setSending(true);

    // For trip mode: fetch participant client IDs first
    let clientIds = recipientIds;
    if (mode === "trip" && selectedTrip) {
      const { data: bks } = await supabase.from("bookings").select("client_id")
        .eq("trip_id", selectedTrip.id).is("deleted_at", null)
        .not("status", "in", '("cancelled","interested")');
      clientIds = ((bks ?? []) as { client_id: string }[]).map((b) => b.client_id);
    }

    if (clientIds.length === 0) { toast.error("Nincs értesítendő ügyfél"); setSending(false); return; }

    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId:    selectedTemplate?.id,
          clientIds,
          bookingId:     bookingId ?? undefined,
          customSubject: subject,
          customBody:    body,
        }),
      });
      const result = await res.json() as { sent: number; failed: number; success: boolean };
      if (result.success || result.sent > 0) {
        toast.success(`${result.sent} email sikeresen elküldve${result.failed > 0 ? ` (${result.failed} sikertelen)` : ""}`);
      } else {
        toast.error("Hiba az emailek küldése során");
      }
    } catch (err) {
      toast.error("Hálózati hiba");
    } finally {
      setSending(false);
    }
  }

  const recipientLabel = (() => {
    if (mode === "single") return selectedClient ? "1 személy" : "nincs kiválasztva";
    if (mode === "trip")   return selectedTrip ? `${tripParticipantCount} résztvevő` : "nincs kiválasztva";
    return groupCount != null ? `${groupCount} ügyfél` : "…";
  })();

  return (
    <div className="max-w-4xl grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

      {/* ── LEFT: Compose ─────────────────────────────────────────────── */}
      <div className="lg:col-span-2 space-y-5">

        {/* Template selector */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-zinc-700">1. Sablon kiválasztása</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {templates.map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => setTemplate(tmpl.id === selectedTemplate?.id ? null : tmpl)}
                className={cn(
                  "text-left rounded-md border p-3 transition-all",
                  selectedTemplate?.id === tmpl.id
                    ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-400"
                    : "border-zinc-200 hover:border-zinc-300",
                )}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  {tmpl.type && (
                    <Badge variant="muted" className="text-[10px]">
                      {TYPE_LABELS[tmpl.type]}
                    </Badge>
                  )}
                </div>
                <p className="font-medium text-sm text-zinc-900">{tmpl.name}</p>
                <p className="text-xs text-zinc-400 truncate">{tmpl.subject}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Recipient mode */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-zinc-700">2. Címzett kiválasztása</Label>

          {/* Mode toggle */}
          <div className="flex gap-1 rounded-md border border-zinc-200 p-0.5 w-fit">
            {([
              { value: "single", label: "Egyedi ügyfél",        icon: Users },
              { value: "trip",   label: "Utazás résztvevői",    icon: Plane },
              { value: "group",  label: "Szűrt csoport",        icon: Filter },
            ] as { value: RecipientMode; label: string; icon: typeof Users }[]).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors",
                  mode === value
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-500 hover:text-zinc-900",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Single mode */}
          {mode === "single" && (
            <ClientCombobox selected={selectedClient} onSelect={setClient} />
          )}

          {/* Trip mode */}
          {mode === "trip" && (
            <div className="space-y-2">
              <Select
                value={selectedTrip?.id ?? "none"}
                onValueChange={(v) => {
                  const found = trips.find((t) => t.id === v);
                  setTrip(found ?? null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Válassz utazást…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Válassz —</SelectItem>
                  {trips.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.current_bookings}/{t.max_capacity} fő)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTrip && (
                <p className="text-sm text-zinc-500">
                  Email küldése <strong>{tripParticipantCount}</strong> résztvevőnek
                </p>
              )}
            </div>
          )}

          {/* Group mode */}
          {mode === "group" && (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-zinc-500">Kedvezmény szint</Label>
                <Select value={groupDiscountLevel} onValueChange={setGroupDiscountLevel}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Összes</SelectItem>
                    <SelectItem value="0">Alap (0%)</SelectItem>
                    <SelectItem value="1">Bronz (5%)</SelectItem>
                    <SelectItem value="2">Ezüst (10%)</SelectItem>
                    <SelectItem value="3">Arany (15%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-zinc-500">Min. utazás szám</Label>
                <Input value={groupMinTrips} onChange={(e) => setGroupMinTrips(e.target.value)}
                  type="number" min={0} placeholder="pl. 3" className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-zinc-500">Forrás</Label>
                <Select value={groupSource} onValueChange={setGroupSource}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Összes</SelectItem>
                    <SelectItem value="messenger">Messenger</SelectItem>
                    <SelectItem value="website_form">Weboldal</SelectItem>
                    <SelectItem value="referral">Ajánlás</SelectItem>
                    <SelectItem value="other">Egyéb</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {groupCount !== null && (
                <p className="col-span-3 text-sm text-zinc-500">
                  A szűrőnek megfelelő ügyfelek száma: <strong>{groupCount}</strong>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Subject + body */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-zinc-700">3. Tartalom szerkesztése</Label>
          <div className="space-y-1.5">
            <Label className="text-sm text-zinc-600">Tárgy</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email tárgya" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm text-zinc-600">Üzenet</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={12}
              placeholder="Az email szövege…"
            />
          </div>
        </div>

        {/* Scheduled send */}
        <div className="rounded-md border border-zinc-200 p-4">
          <label className="flex items-center gap-2 cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={scheduled}
              onChange={(e) => setScheduled(e.target.checked)}
              className="rounded border-zinc-300 text-blue-600"
            />
            <span className="text-sm font-medium text-zinc-700">
              <CalendarClock className="inline h-4 w-4 mr-1" />
              Ütemezett küldés
            </span>
          </label>
          {scheduled && (
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-500">Küldés időpontja</Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="h-9 w-64"
                min={format(new Date(), "yyyy-MM-dd") + "T" + format(new Date(), "HH:mm")}
              />
              <p className="text-xs text-zinc-400">
                Az ütemezett küldéshez szükséges a cron job beállítása.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Summary + send button ──────────────────────────────── */}
      <div className="sticky top-6 space-y-4">
        {/* Preview of what recipient will receive */}
        {selectedTemplate && (
          <div className="rounded-md border border-zinc-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">
              Előnézet – amit a címzett kap
            </p>
            <p className="text-xs font-medium text-zinc-600 mb-2">
              Tárgy: {subject ? previewBody(subject, selectedClient, selectedTrip) : "—"}
            </p>
            <div className="text-xs text-zinc-600 whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed">
              {body ? previewBody(body, selectedClient, selectedTrip) : "(üres)"}
            </div>
          </div>
        )}

        {/* Send summary + button */}
        <div className="rounded-md border border-zinc-200 bg-white p-4 space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Sablon</span>
              <span className="font-medium text-zinc-900 text-right">
                {selectedTemplate?.name ?? "—"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Címzett</span>
              <span className="font-medium text-zinc-900">{recipientLabel}</span>
            </div>
            {scheduled && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Küldés</span>
                <span className="font-medium text-zinc-900">
                  {scheduledAt.replace("T", " ")}
                </span>
              </div>
            )}
          </div>

          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={handleSend}
            disabled={sending || getRecipientIds().length === 0 || !subject || !body}
          >
            {sending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {scheduled ? "Ütemez" : `Küldés (${recipientLabel})`}
          </Button>
        </div>
      </div>
    </div>
  );
}
