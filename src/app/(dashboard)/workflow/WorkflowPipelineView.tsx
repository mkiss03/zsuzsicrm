"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow, parseISO } from "date-fns";
import { hu } from "date-fns/locale";
import { toast } from "sonner";
import {
  Send, FileSignature, Wallet, ShieldCheck, CreditCard,
  Mail, Loader2, Copy, ExternalLink, Inbox,
  MapPin, Plane, Star, BadgeCheck, ArrowRight,
  Search, X, Check, ChevronRight, Users, AlertCircle,
  CheckCircle2, SkipForward, Camera, FileText, HeartPulse,
  AlertTriangle, Clock, CircleCheck, ChevronDown, ChevronUp, PenLine,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button }        from "@/components/ui/button";
import { Badge }         from "@/components/ui/badge";
import { cn }            from "@/lib/utils";
import type {
  BookingContract, WorkflowStep, WorkflowStepKey, BookingStatus,
} from "@/types";

// ─── Step definitions ──────────────────────────────────────────────────────────

interface StepDef {
  key: WorkflowStepKey;
  title: string;
  shortTitle: string;
  desc: string;
  icon: React.ElementType;
  mode: "auto" | "manual";
  phase: 1 | 2 | 3 | 4 | 5;
  actionLabel?: string;
  emailTemplate?: string;
}

const ALL_STEPS: StepDef[] = [
  { key: "inquiry_received",     title: "Érdeklődés rögzítve",       shortTitle: "Érdeklődés",      desc: "A foglalás beérkezett a rendszerbe.",                        mode: "auto",   phase: 1, icon: Inbox },
  { key: "confirmation_sent",    title: "Visszaigazolás elküldve",    shortTitle: "Visszaigazolás",  desc: "Foglalási visszaigazolás elküldve az ügyfélnek.",             mode: "manual", phase: 1, icon: Mail,         actionLabel: "Visszaigazolás küldése",  emailTemplate: "booking_confirmation" },
  { key: "contract_send",        title: "Nyilatkozat elküldve",       shortTitle: "Nyilatkozat",     desc: "Foglalási nyilatkozat(ok) elküldve aláírásra.",              mode: "manual", phase: 2, icon: Send,         actionLabel: "Nyilatkozatok küldése" },
  { key: "contract_sign",        title: "Nyilatkozat aláírva",        shortTitle: "Aláírás",         desc: "Az ügyfél elektronikusan aláírta a nyilatkozatot.",          mode: "auto",   phase: 2, icon: FileSignature },
  { key: "deposit_request",      title: "Előleg bekérve",             shortTitle: "Előleg kérés",    desc: "Előlegfizetési felszólítás elküldve.",                       mode: "manual", phase: 3, icon: Wallet,       actionLabel: "Előleg email küldése",    emailTemplate: "deposit_request" },
  { key: "deposit_paid",         title: "Előleg befizetve",           shortTitle: "Előleg",          desc: "Az előleg összege beérkezett.",                              mode: "auto",   phase: 3, icon: BadgeCheck },
  { key: "docs_verify",          title: "Dokumentumok ellenőrizve",   shortTitle: "Dok. ellenőrzés", desc: "Útlevél, vízum, biztosítás rendben.",                        mode: "manual", phase: 3, icon: ShieldCheck,  actionLabel: "Megjelölés rendben" },
  { key: "full_payment_request", title: "Végösszeg bekérve",          shortTitle: "Végösszeg kérés", desc: "Végső fizetési emlékeztető elküldve.",                       mode: "manual", phase: 3, icon: CreditCard,   actionLabel: "Emlékeztető küldése",     emailTemplate: "reminder" },
  { key: "full_paid",            title: "Végösszeg befizetve",        shortTitle: "Végösszeg",       desc: "A teljes összeg beérkezett.",                                mode: "auto",   phase: 3, icon: BadgeCheck },
  { key: "pre_trip_send",        title: "Utazás előtti tájékoztató",  shortTitle: "Tájékoztató",     desc: "Menetrend, találkozási pont, poggyász-tanácsok elküldve.",   mode: "manual", phase: 4, icon: MapPin,       actionLabel: "Tájékoztató küldése",     emailTemplate: "pre_trip" },
  { key: "trip_started",         title: "Utazás megkezdve",           shortTitle: "Indulás",         desc: "Az utazócsoport elindult.",                                  mode: "auto",   phase: 5, icon: Plane },
  { key: "trip_completed",       title: "Utazás befejezve",           shortTitle: "Visszaérkezés",   desc: "Az utazás sikeresen véget ért.",                             mode: "auto",   phase: 5, icon: CheckCircle2 },
  { key: "followup_sent",        title: "Visszajelzés kérve",         shortTitle: "Follow-up",       desc: "Köszönő email és értékelési kérés elküldve.",                mode: "manual", phase: 5, icon: Star,         actionLabel: "Köszönő email küldése",   emailTemplate: "post_trip" },
];

// ─── Phase definitions ─────────────────────────────────────────────────────────

const PHASES = [
  { id: 1 as const, label: "Fogadás",     dot: "bg-slate-400",  text: "text-slate-600",  bg: "bg-slate-50",  border: "border-slate-200",  line: "bg-slate-300"  },
  { id: 2 as const, label: "Szerződés",   dot: "bg-blue-500",   text: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200",   line: "bg-blue-400"   },
  { id: 3 as const, label: "Fizetés",     dot: "bg-blue-600",   text: "text-blue-800",   bg: "bg-blue-50",   border: "border-blue-200",   line: "bg-blue-500"   },
  { id: 4 as const, label: "Előkészítés", dot: "bg-indigo-500", text: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200", line: "bg-indigo-400" },
  { id: 5 as const, label: "Utazás",      dot: "bg-emerald-500",text: "text-emerald-700",bg: "bg-emerald-50",border: "border-emerald-200",line: "bg-emerald-400"},
];

function phaseOf(key: WorkflowStepKey) {
  const phaseId = ALL_STEPS.find(s => s.key === key)?.phase ?? 1;
  return PHASES.find(p => p.id === phaseId)!;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface StepRowData {
  step_key: string;
  status: string;
  done_at: string | null;
  triggered_by: string | null;
}

export interface TripOption { id: string; name: string; }

export interface BookingPipelineRow {
  id: string;
  booking_code: string;
  status: BookingStatus;
  final_amount: number | null;
  created_at: string;
  departure_date: string | null;
  return_date: string | null;
  client_name: string;
  client_email: string | null;
  trip_name: string;
  trip_id: string;
  workflow_steps: StepRowData[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  try { return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: hu }); }
  catch { return ""; }
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("hu-HU", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function triggerLabel(t: string | null | undefined) {
  if (t === "auto")   return "automatikusan";
  if (t === "client") return "ügyfél által";
  return "admin";
}

function computeDoneSet(row: BookingPipelineRow) {
  const s = new Set(
    row.workflow_steps
      .filter(x => x.status === "done" || x.status === "skipped")
      .map(x => x.step_key)
  );
  s.add("inquiry_received");
  if (["deposit_paid", "fully_paid", "completed"].includes(row.status)) s.add("deposit_paid");
  if (["fully_paid", "completed"].includes(row.status)) s.add("full_paid");
  return s;
}

function computeProgress(row: BookingPipelineRow) {
  const done = computeDoneSet(row);
  return Math.round((ALL_STEPS.filter(s => done.has(s.key)).length / ALL_STEPS.length) * 100);
}

function computeNextManual(row: BookingPipelineRow) {
  const done = computeDoneSet(row);
  return ALL_STEPS.find(s =>
    s.mode === "manual" && !done.has(s.key) &&
    row.workflow_steps.find(w => w.step_key === s.key)?.status !== "skipped"
  );
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  interested: "Érdeklődő", booked: "Foglalt", deposit_paid: "Előleg fizetve",
  fully_paid: "Fizetve", completed: "Kész", cancelled: "Lemondva",
};

// ─── BookingListItem ───────────────────────────────────────────────────────────

function BookingListItem({ row, selected, onClick }: {
  row: BookingPipelineRow; selected: boolean; onClick: () => void;
}) {
  const pct  = computeProgress(row);
  const next = computeNextManual(row);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-3 border-b border-zinc-100 hover:bg-zinc-50/80 transition-all",
        selected && "bg-blue-50 border-l-[3px] border-l-blue-500"
      )}
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <span className="font-mono text-[10px] font-bold text-zinc-400">{row.booking_code}</span>
        <span className={cn(
          "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
          selected ? "bg-blue-100 text-blue-700" : "bg-zinc-100 text-zinc-500"
        )}>{pct}%</span>
      </div>
      <p className="text-sm font-semibold text-zinc-800 truncate leading-tight">{row.client_name}</p>
      <p className="text-xs text-zinc-400 truncate mb-2 mt-0.5">{row.trip_name}</p>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-zinc-100 overflow-hidden mb-2">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      {next ? (
        <div className="flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 w-fit">
          <ArrowRight className="h-2.5 w-2.5 shrink-0" />{next.actionLabel}
        </div>
      ) : (
        <div className="flex items-center gap-1 text-[10px] font-medium text-green-600">
          <CheckCircle2 className="h-2.5 w-2.5" />Minden lépés kész
        </div>
      )}
    </button>
  );
}

// ─── Animated horizontal timeline ─────────────────────────────────────────────

function AnimatedTimeline({ isStepDone, activeStepKey, expandedKey, onStepClick }: {
  isStepDone: (k: WorkflowStepKey) => boolean;
  activeStepKey: WorkflowStepKey | null;
  expandedKey: WorkflowStepKey | null;
  onStepClick: (k: WorkflowStepKey) => void;
}) {
  return (
    <div className="space-y-2 select-none">
      {/* Phase labels */}
      <div className="flex">
        {PHASES.map(phase => {
          const ps   = ALL_STEPS.filter(s => s.phase === phase.id);
          const done = ps.filter(s => isStepDone(s.key)).length;
          return (
            <div key={phase.id} className="text-center" style={{ flex: ps.length }}>
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-wider",
                done === ps.length ? phase.text : done > 0 ? "text-zinc-400" : "text-zinc-200"
              )}>{phase.label}</span>
            </div>
          );
        })}
      </div>

      {/* Circles + connectors */}
      <div className="flex items-center px-1">
        {ALL_STEPS.map((def, idx) => {
          const done     = isStepDone(def.key);
          const active   = def.key === activeStepKey;
          const isOpen   = def.key === expandedKey;
          const phase    = phaseOf(def.key);
          const Icon     = def.icon;

          return (
            <div key={def.key} className="flex items-center flex-1 last:flex-none">
              <button
                onClick={() => onStepClick(def.key)}
                title={def.title}
                className={cn(
                  "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 group z-10",
                  done   ? cn(phase.dot, "border-transparent text-white shadow-sm")
                  : active ? "border-blue-400 bg-blue-50 text-blue-600"
                  : isOpen ? "border-zinc-400 bg-zinc-100 text-zinc-600"
                  : "border-zinc-200 bg-white text-zinc-300 hover:border-zinc-300 hover:text-zinc-400"
                )}
              >
                {active && !done && (
                  <span className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-50" />
                )}
                {done ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                {/* Tooltip */}
                <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  <div className="whitespace-nowrap rounded-md bg-zinc-800 px-2 py-1 text-[10px] text-white shadow-lg">
                    {def.shortTitle}
                  </div>
                  <div className="mx-auto h-1.5 w-1.5 -mt-0.5 rotate-45 bg-zinc-800" />
                </div>
              </button>

              {/* Animated connector line */}
              {idx < ALL_STEPS.length - 1 && (
                <div className="relative mx-0.5 h-0.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                  <div className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-all duration-700",
                    done ? cn(phase.line, "w-full") : "w-0"
                  )} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Contract multi-send panel ─────────────────────────────────────────────────

const DOC_TYPES: { value: string; label: string; Icon: React.ElementType }[] = [
  { value: "travel_contract",    label: "Utazási szerződés és nyilatkozat", Icon: FileText     },
  { value: "health_declaration", label: "Egészségügyi nyilatkozat",         Icon: HeartPulse   },
  { value: "photo_consent",      label: "Fényképezési hozzájárulás",        Icon: Camera       },
];

function ContractMultiPanel({ bookingId, clientEmail, existingContracts, onDone, onClose }: {
  bookingId: string;
  clientEmail: string | null;
  existingContracts: BookingContract[];
  onDone: () => void;
  onClose: () => void;
}) {
  const [selected, setSelected]         = useState<string[]>(["travel_contract"]);
  const [expireDays, setExpireDays]     = useState(14);
  const [sendEmail, setSendEmail]       = useState(true);
  const [sending, setSending]           = useState(false);
  const [progress, setProgress]         = useState({ done: 0, total: 0 });
  const [showDocEditor, setShowDocEditor] = useState(false);
  const [docBodies, setDocBodies]       = useState<Record<string, string>>({});
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);

  const sentTypes = new Set(existingContracts.map(c => c.document_type));

  async function loadDocPreview(docType: string) {
    if (docBodies[docType] !== undefined) return; // already loaded
    setLoadingPreview(docType);
    try {
      const res = await fetch(`/api/contracts?booking_id=${bookingId}&document_type=${docType}`);
      if (res.ok) {
        const data = await res.json() as { body: string };
        setDocBodies(prev => ({ ...prev, [docType]: data.body }));
      } else {
        toast.error("Nem sikerült betölteni a sablont");
      }
    } catch {
      toast.error("Hálózati hiba");
    } finally {
      setLoadingPreview(null);
    }
  }

  async function handleToggleDocEditor() {
    const next = !showDocEditor;
    setShowDocEditor(next);
    if (next) {
      // Pre-load all selected (not-yet-sent) document types
      for (const docType of selected.filter(t => !sentTypes.has(t))) {
        void loadDocPreview(docType);
      }
    }
  }

  async function handleSend() {
    const toSend = selected.filter(t => !sentTypes.has(t));
    if (toSend.length === 0) { toast.error("Minden kiválasztott dokumentum már el lett küldve"); return; }
    setSending(true);
    setProgress({ done: 0, total: toSend.length });

    for (let i = 0; i < toSend.length; i++) {
      try {
        const payload: Record<string, unknown> = {
          booking_id: bookingId, document_type: toSend[i],
          send_email: sendEmail && !!clientEmail, expires_days: expireDays,
        };
        if (docBodies[toSend[i]!]) {
          payload.document_body = docBodies[toSend[i]!];
        }
        const res = await fetch("/api/contracts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { const d = await res.json() as { error?: string }; toast.error(d.error ?? "Hiba"); }
        setProgress(p => ({ ...p, done: p.done + 1 }));
        await new Promise(r => setTimeout(r, 350));
      } catch { toast.error(`Hiba: ${toSend[i]}`); }
    }

    setSending(false);
    toast.success(`${toSend.length} dokumentum elküldve ✓`);
    onDone();
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
            <FileSignature className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-800">Nyilatkozatok küldése</h3>
            <p className="text-xs text-zinc-400">Jelöld be a küldendő dokumentumokat</p>
          </div>
        </div>
        <button onClick={onClose} className="text-zinc-300 hover:text-zinc-500 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Doc type checkboxes */}
      <div className="space-y-2 mb-4">
        {DOC_TYPES.map(dt => {
          const alreadySent = sentTypes.has(dt.value);
          const isSelected  = selected.includes(dt.value);
          return (
            <label key={dt.value} className={cn(
              "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all",
              alreadySent ? "border-green-200 bg-green-50 cursor-default"
              : isSelected ? "border-violet-300 bg-white shadow-sm"
              : "border-zinc-200 bg-white hover:border-zinc-300"
            )}>
              <input
                type="checkbox"
                checked={alreadySent || isSelected}
                disabled={alreadySent}
                onChange={e => {
                  if (alreadySent) return;
                  setSelected(prev =>
                    e.target.checked ? [...prev, dt.value] : prev.filter(v => v !== dt.value)
                  );
                }}
                className="h-4 w-4 rounded border-blue-300 text-blue-600"
              />
              <dt.Icon className="h-4 w-4 shrink-0 text-zinc-400" />
              <span className="text-sm font-medium text-zinc-700 flex-1">{dt.label}</span>
              {alreadySent && <Badge variant="success" className="text-[10px]">✓ Elküldve</Badge>}
            </label>
          );
        })}
      </div>

      {/* Already sent contracts */}
      {existingContracts.length > 0 && (
        <div className="mb-4 space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Küldött dokumentumok</p>
          {existingContracts.map(c => (
            <div key={c.id} className="flex items-center justify-between rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2 text-xs">
              <span className="text-zinc-600 font-medium truncate max-w-[160px]">{c.document_title}</span>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant={c.status === "signed" ? "success" : c.status === "expired" ? "destructive" : "info"}
                  className="text-[9px] flex items-center gap-1"
                >
                  {c.status === "signed" ? <><CircleCheck className="h-2.5 w-2.5" />Aláírva</> : c.status === "expired" ? <><AlertTriangle className="h-2.5 w-2.5" />Lejárt</> : <><Clock className="h-2.5 w-2.5" />Vár</>}
                </Badge>
                <button
                  onClick={() => { void navigator.clipboard.writeText(`${window.location.origin}/sign/${c.token}`); toast.success("Link másolva"); }}
                  className="text-zinc-400 hover:text-zinc-600 transition-colors" title="Link másolása"
                ><Copy className="h-3 w-3" /></button>
                <a href={`/sign/${c.token}`} target="_blank" rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-700 transition-colors" title="Megnyitás">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Document editor toggle */}
      {selected.filter(t => !sentTypes.has(t)).length > 0 && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => void handleToggleDocEditor()}
            className="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            <span className="flex items-center gap-2">
              <PenLine className="h-3.5 w-3.5 text-zinc-400" />
              Dokumentum szövegének szerkesztése
            </span>
            {showDocEditor ? <ChevronUp className="h-3.5 w-3.5 text-zinc-400" /> : <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />}
          </button>

          {showDocEditor && (
            <div className="mt-2 space-y-3">
              {selected.filter(t => !sentTypes.has(t)).map(docType => {
                const dt   = DOC_TYPES.find(d => d.value === docType);
                const body = docBodies[docType];
                const isLoading = loadingPreview === docType;
                return (
                  <div key={docType} className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
                    <div className="flex items-center justify-between bg-zinc-50 border-b border-zinc-100 px-3 py-2">
                      <span className="text-xs font-medium text-zinc-600 flex items-center gap-1.5">
                        {dt && <dt.Icon className="h-3.5 w-3.5 text-zinc-400" />}
                        {dt?.label ?? docType}
                      </span>
                      {!body && !isLoading && (
                        <button
                          type="button"
                          onClick={() => void loadDocPreview(docType)}
                          className="text-[11px] text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          Sablon betöltése
                        </button>
                      )}
                      {isLoading && <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />}
                    </div>
                    {body !== undefined && (
                      <textarea
                        value={body}
                        onChange={e => setDocBodies(prev => ({ ...prev, [docType]: e.target.value }))}
                        rows={10}
                        className="w-full resize-y px-3 py-2 text-[11px] font-mono text-zinc-700 bg-white
                                   focus:outline-none focus:ring-1 focus:ring-blue-400 border-0"
                        placeholder="A dokumentum szövege…"
                      />
                    )}
                    {body === undefined && !isLoading && (
                      <p className="px-3 py-3 text-xs text-zinc-400 italic">
                        Kattintson a „Sablon betöltése" gombra az alapértelmezett szöveg szerkesztéséhez.
                      </p>
                    )}
                  </div>
                );
              })}
              <p className="text-[11px] text-zinc-400 flex items-start gap-1.5">
                <FileText className="h-3 w-3 shrink-0 mt-0.5" />
                A szerkesztett szöveg kerül a dokumentumba. Az eredeti sablon mindig visszatölthető.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Options */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Érvényesség:</span>
          <select
            value={expireDays}
            onChange={e => setExpireDays(Number(e.target.value))}
            className="text-xs border border-zinc-200 rounded-md px-2 py-1 bg-white"
          >
            <option value={7}>7 nap</option>
            <option value={14}>14 nap</option>
            <option value={30}>30 nap</option>
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={sendEmail && !!clientEmail}
            disabled={!clientEmail}
            onChange={e => setSendEmail(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-blue-600"
          />
          <span className={cn("text-xs", clientEmail ? "text-zinc-600" : "text-zinc-400")}>
            {clientEmail ? `Email: ${clientEmail}` : "Nincs email-cím"}
          </span>
        </label>
      </div>

      {/* Send progress */}
      {sending && progress.total > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>Küldés folyamatban…</span>
            <span>{progress.done}/{progress.total}</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-500"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>Mégse</Button>
        <Button
          size="sm"
          onClick={() => void handleSend()}
          disabled={sending || selected.filter(t => !sentTypes.has(t)).length === 0}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {sending
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Küldés…</>
            : <><Send className="mr-2 h-4 w-4" />Küldés</>}
        </Button>
      </div>
    </div>
  );
}

// ─── Email action panel ────────────────────────────────────────────────────────

function EmailActionPanel({ def, bookingId, isDone, onSent, onClose }: {
  def: StepDef; bookingId: string; isDone: boolean; onSent: () => void; onClose: () => void;
}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const phase = phaseOf(def.key);

  async function handleSend() {
    setLoading(true);
    try {
      const { data: booking } = await supabase
        .from("bookings")
        .select("booking_code, client:clients(email, first_name, last_name), trip:trips(name)")
        .eq("id", bookingId).single();
      const client = booking?.client as unknown as Record<string, string> | null;
      if (!client?.email) { toast.error("Az ügyfélnek nincs email-címe"); return; }

      const { data: template } = await supabase
        .from("email_templates").select("*")
        .eq("type", def.emailTemplate!).eq("is_default", true).single();
      if (!template) { toast.error(`Nincs "${def.emailTemplate}" sablon`); return; }

      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: client.email, template_id: template.id, booking_id: bookingId }),
      });
      if (!res.ok) { toast.error("Hiba az email küldésekor"); return; }

      await supabase.from("workflow_steps").upsert({
        booking_id: bookingId, step_key: def.key,
        status: "done", done_at: new Date().toISOString(), triggered_by: "admin",
      }, { onConflict: "booking_id,step_key" });

      toast.success("Email elküldve ✓");
      onSent();
      onClose();
    } catch { toast.error("Hálózati hiba"); }
    finally { setLoading(false); }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Mail className={cn("h-4 w-4", phase.text)} />
          <h3 className="text-sm font-semibold text-zinc-800">{def.title}</h3>
          {isDone && <Badge variant="success" className="text-[10px]">✓ Kész</Badge>}
        </div>
        <button onClick={onClose} className="text-zinc-300 hover:text-zinc-500 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-zinc-500 mb-3">{def.desc}</p>
      <div className="flex items-center gap-2 text-xs bg-white rounded-lg border border-zinc-200 px-3 py-2 mb-4">
        <Mail className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
        <span className="text-zinc-600">Sablon: <strong>{def.emailTemplate}</strong></span>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>Bezárás</Button>
        <Button size="sm" onClick={() => void handleSend()} disabled={loading}
          className="bg-blue-600 hover:bg-blue-700">
          {loading
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Küldés…</>
            : <><Send className="mr-2 h-4 w-4" />{isDone ? "Újraküldés" : def.actionLabel}</>}
        </Button>
      </div>
    </div>
  );
}

// ─── Manual action panel ───────────────────────────────────────────────────────

function ManualActionPanel({ def, bookingId, isDone, isSkipped, onDone, onClose }: {
  def: StepDef; bookingId: string; isDone: boolean; isSkipped: boolean;
  onDone: () => void; onClose: () => void;
}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function markDone() {
    setLoading(true);
    await supabase.from("workflow_steps").upsert({
      booking_id: bookingId, step_key: def.key,
      status: "done", done_at: new Date().toISOString(), triggered_by: "admin",
    }, { onConflict: "booking_id,step_key" });
    setLoading(false);
    toast.success(`${def.shortTitle} kész ✓`);
    onDone(); onClose();
  }

  async function markSkipped() {
    await supabase.from("workflow_steps").upsert({
      booking_id: bookingId, step_key: def.key,
      status: "skipped", done_at: new Date().toISOString(), triggered_by: "admin",
    }, { onConflict: "booking_id,step_key" });
    onDone(); onClose();
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-zinc-500" />
          <h3 className="text-sm font-semibold text-zinc-800">{def.title}</h3>
          {isDone    && <Badge variant="success" className="text-[10px]">✓ Kész</Badge>}
          {isSkipped && <Badge variant="secondary" className="text-[10px]">Kihagyva</Badge>}
        </div>
        <button onClick={onClose} className="text-zinc-300 hover:text-zinc-500 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-zinc-500 mb-4">{def.desc}</p>
      <div className="flex items-center justify-end gap-2">
        {!isDone && !isSkipped && (
          <button onClick={() => void markSkipped()}
            className="mr-auto text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
            Kihagyás
          </button>
        )}
        <Button variant="outline" size="sm" onClick={onClose}>Bezárás</Button>
        <Button size="sm" onClick={() => void markDone()} disabled={loading || isDone}>
          {loading
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />…</>
            : <><Check className="mr-2 h-4 w-4" />{def.actionLabel ?? "Megjelölés kész"}</>}
        </Button>
      </div>
    </div>
  );
}

// ─── Workflow detail (right panel) ────────────────────────────────────────────

function WorkflowDetail({ bookingRow }: { bookingRow: BookingPipelineRow }) {
  const supabase   = createClient();
  const [steps,     setSteps]     = useState<WorkflowStep[]>([]);
  const [contracts, setContracts] = useState<BookingContract[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState<WorkflowStepKey | null>(null);
  const initRef     = useRef(false);
  const autoOpenRef = useRef(false);

  const isStepDone = useCallback((key: WorkflowStepKey): boolean => {
    const now = new Date();
    const s = steps.find(x => x.step_key === key);
    if (s?.status === "done") return true;
    if (key === "inquiry_received") return true;
    if (key === "deposit_paid"   && ["deposit_paid","fully_paid","completed"].includes(bookingRow.status)) return true;
    if (key === "full_paid"      && ["fully_paid","completed"].includes(bookingRow.status)) return true;
    if (key === "contract_sign"  && contracts.some(c => c.status === "signed")) return true;
    if (key === "trip_started"   && bookingRow.departure_date && new Date(bookingRow.departure_date) < now) return true;
    if (key === "trip_completed" && bookingRow.return_date    && new Date(bookingRow.return_date)    < now) return true;
    return false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, contracts, bookingRow.status, bookingRow.departure_date, bookingRow.return_date]);

  const activeStepKey: WorkflowStepKey | null = ALL_STEPS.find(def =>
    def.mode === "manual" && !isStepDone(def.key) &&
    steps.find(s => s.step_key === def.key)?.status !== "skipped"
  )?.key ?? null;

  const load = useCallback(async () => {
    const [{ data: sd }, { data: cd }] = await Promise.all([
      supabase.from("workflow_steps").select("*").eq("booking_id", bookingRow.id).order("created_at"),
      supabase.from("booking_contracts").select("*").eq("booking_id", bookingRow.id).order("created_at"),
    ]);
    setSteps((sd ?? []) as WorkflowStep[]);
    setContracts((cd ?? []) as BookingContract[]);
    setLoading(false);
  }, [bookingRow.id]);

  useEffect(() => { void load(); }, [load]);

  // Auto-init inquiry_received
  useEffect(() => {
    if (loading || initRef.current) return;
    initRef.current = true;
    if (!steps.find(s => s.step_key === "inquiry_received")) {
      void supabase.from("workflow_steps").upsert({
        booking_id: bookingRow.id, step_key: "inquiry_received",
        status: "done", done_at: new Date().toISOString(), triggered_by: "auto",
      }, { onConflict: "booking_id,step_key" }).then(() => void load());
    }
  }, [loading, steps, bookingRow.id, load]);

  // Auto-open active step on first load
  useEffect(() => {
    if (!loading && activeStepKey && !autoOpenRef.current) {
      autoOpenRef.current = true;
      setExpanded(activeStepKey);
    }
  }, [loading, activeStepKey]);

  // Real-time
  useEffect(() => {
    const ch = supabase.channel(`wf:center:${bookingRow.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "workflow_steps",
        filter: `booking_id=eq.${bookingRow.id}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "booking_contracts",
        filter: `booking_id=eq.${bookingRow.id}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [bookingRow.id, load]);

  const doneCount = ALL_STEPS.filter(s => isStepDone(s.key)).length;
  const pct       = Math.round((doneCount / ALL_STEPS.length) * 100);

  function toggleExpand(key: WorkflowStepKey) {
    setExpanded(prev => prev === key ? null : key);
  }

  function renderPanel(def: StepDef) {
    if (def.key === "contract_send") {
      return (
        <ContractMultiPanel
          bookingId={bookingRow.id}
          clientEmail={bookingRow.client_email}
          existingContracts={contracts}
          onDone={() => void load()}
          onClose={() => setExpanded(null)}
        />
      );
    }
    if (def.emailTemplate) {
      return (
        <EmailActionPanel
          def={def}
          bookingId={bookingRow.id}
          isDone={isStepDone(def.key)}
          onSent={() => void load()}
          onClose={() => setExpanded(null)}
        />
      );
    }
    return (
      <ManualActionPanel
        def={def}
        bookingId={bookingRow.id}
        isDone={isStepDone(def.key)}
        isSkipped={steps.find(s => s.step_key === def.key)?.status === "skipped"}
        onDone={() => void load()}
        onClose={() => setExpanded(null)}
      />
    );
  }

  if (loading) return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-16 bg-zinc-100 rounded-xl" />
      <div className="h-14 bg-zinc-100 rounded-xl" />
      <div className="h-3 bg-zinc-100 rounded-full" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="h-8 w-8 rounded-full bg-zinc-100 shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 w-40 bg-zinc-100 rounded" />
            <div className="h-3 w-64 bg-zinc-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-zinc-100 px-6 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-zinc-900">{bookingRow.client_name}</h2>
              <span className="font-mono text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">
                {bookingRow.booking_code}
              </span>
              <Badge variant="outline" className="text-[11px]">
                {STATUS_LABELS[bookingRow.status] ?? bookingRow.status}
              </Badge>
            </div>
            <p className="text-sm text-zinc-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
              <Plane className="h-3.5 w-3.5 shrink-0" />
              <span>{bookingRow.trip_name}</span>
              {bookingRow.departure_date && (
                <>
                  <span className="text-zinc-200">·</span>
                  <span>{new Date(bookingRow.departure_date).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })}</span>
                </>
              )}
              {bookingRow.client_email && (
                <>
                  <span className="text-zinc-200">·</span>
                  <span className="text-zinc-400">{bookingRow.client_email}</span>
                </>
              )}
            </p>
          </div>
          <Link href={`/bookings/${bookingRow.id}`}>
            <Button variant="outline" size="sm" className="shrink-0">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />Megnyitás
            </Button>
          </Link>
        </div>
      </div>

      <div className="px-6 py-5 space-y-6">
        {/* Animated timeline */}
        <AnimatedTimeline
          isStepDone={isStepDone}
          activeStepKey={activeStepKey}
          expandedKey={expanded}
          onStepClick={toggleExpand}
        />

        {/* Overall progress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">{doneCount}/{ALL_STEPS.length} lépés kész</span>
            <span className="font-bold text-zinc-600">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          {/* Phase fraction labels */}
          <div className="flex">
            {PHASES.map(phase => {
              const ps   = ALL_STEPS.filter(s => s.phase === phase.id);
              const done = ps.filter(s => isStepDone(s.key)).length;
              return (
                <div key={phase.id} className="text-center" style={{ flex: ps.length }}>
                  <span className={cn("text-[9px]", done === ps.length ? phase.text : "text-zinc-300")}>
                    {done === ps.length ? <Check className="inline h-2.5 w-2.5" /> : `${done}/${ps.length}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step list */}
        <div className="space-y-px">
          {ALL_STEPS.map((def, idx) => {
            const done    = isStepDone(def.key);
            const step    = steps.find(s => s.step_key === def.key);
            const skipped = step?.status === "skipped";
            const active  = def.key === activeStepKey;
            const isOpen  = expanded === def.key;
            const phase   = phaseOf(def.key);
            const Icon    = def.icon;
            const prevPhase = idx > 0 ? ALL_STEPS[idx - 1]!.phase : null;

            return (
              <div key={def.key}>
                {/* Phase separator */}
                {prevPhase !== def.phase && (
                  <div className="flex items-center gap-2 pt-4 pb-1.5">
                    <div className={cn("h-1.5 w-1.5 rounded-full", phase.dot)} />
                    <span className={cn("text-[10px] font-bold uppercase tracking-widest", phase.text)}>
                      {phase.label}
                    </span>
                    <div className="flex-1 h-px bg-zinc-100" />
                  </div>
                )}

                {/* Step row */}
                <div className={cn(
                  "rounded-xl overflow-hidden transition-all duration-200",
                  isOpen && "ring-2 ring-offset-0",
                  isOpen && def.key === "contract_send" ? "ring-violet-200"
                    : isOpen && def.emailTemplate ? "ring-blue-200"
                    : isOpen ? "ring-zinc-200"
                    : "",
                )}>
                  <button
                    onClick={() => toggleExpand(def.key)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors",
                      active && !done ? "bg-blue-50/70 hover:bg-blue-50" : "hover:bg-zinc-50",
                      skipped && "opacity-60",
                    )}
                  >
                    {/* Icon circle */}
                    <div className={cn(
                      "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                      done    ? cn(phase.dot, "border-transparent text-white shadow-sm")
                      : active  ? "border-blue-400 bg-blue-50 text-blue-600"
                      : skipped ? "border-zinc-200 bg-white text-zinc-300"
                      : "border-zinc-200 bg-white text-zinc-400"
                    )}>
                      {active && !done && (
                        <span className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-30" />
                      )}
                      {done ? <Check className="h-3.5 w-3.5" />
                        : skipped ? <SkipForward className="h-3 w-3" />
                        : <Icon className="h-3.5 w-3.5" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn(
                          "text-sm font-medium",
                          done    ? "text-zinc-700"
                          : active  ? "text-blue-700 font-semibold"
                          : skipped ? "text-zinc-400 line-through"
                          : "text-zinc-500"
                        )}>{def.title}</span>
                        {active && !done && !skipped && (
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full animate-pulse">
                            Következő
                          </span>
                        )}
                        {def.mode === "auto" && !done && !skipped && (
                          <Badge variant="secondary" className="text-[9px] py-0 font-normal">auto</Badge>
                        )}
                      </div>
                      {done && step?.done_at && (
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {fmtDateTime(step.done_at)}
                          <span className="mx-1 text-zinc-200">·</span>
                          {triggerLabel(step.triggered_by)}
                          <span className="mx-1 text-zinc-200">·</span>
                          {timeAgo(step.done_at)}
                        </p>
                      )}
                      {/* Contract status chips */}
                      {def.key === "contract_send" && contracts.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {contracts.map(c => (
                            <span key={c.id} className={cn(
                              "inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium",
                              c.status === "signed"  ? "bg-green-50  border-green-200  text-green-700"
                              : c.status === "expired" ? "bg-red-50    border-red-200    text-red-600"
                              :                          "bg-blue-50   border-blue-200   text-blue-600"
                            )}>
                              {c.status === "signed" ? <CircleCheck className="h-3 w-3" /> : c.status === "expired" ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                              {c.document_title.replace(" és nyilatkozat", "").replace("Utazási s", "S")}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <ChevronRight className={cn(
                      "h-4 w-4 text-zinc-300 shrink-0 transition-transform duration-200",
                      isOpen && "rotate-90"
                    )} />
                  </button>

                  {/* Inline action panel */}
                  {isOpen && (
                    <div className="px-3 pb-3">{renderPanel(def)}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────

interface Props {
  initialBookings: BookingPipelineRow[];
  trips: TripOption[];
}

export function WorkflowPipelineView({ initialBookings, trips }: Props) {
  const supabase = createClient();
  const [bookings,   setBookings]   = useState(initialBookings);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search,     setSearch]     = useState("");
  const [tripFilter, setTripFilter] = useState("all");

  const refreshList = useCallback(async () => {
    const { data } = await supabase
      .from("bookings")
      .select(`
        id, booking_code, status, final_amount, created_at, trip_id,
        client:clients(first_name, last_name, email),
        trip:trips(id, name, departure_date, return_date),
        workflow_steps(step_key, status, done_at, triggered_by)
      `)
      .not("status", "eq", "cancelled")
      .order("created_at", { ascending: false });

    if (data) {
      setBookings(data.map(b => {
        const client = b.client as unknown as { first_name: string; last_name: string; email: string | null } | null;
        const trip   = b.trip   as unknown as { id: string; name: string; departure_date: string; return_date: string } | null;
        return {
          id:             b.id,
          booking_code:   b.booking_code,
          status:         b.status as BookingStatus,
          final_amount:   b.final_amount,
          created_at:     b.created_at,
          departure_date: trip?.departure_date ?? null,
          return_date:    trip?.return_date    ?? null,
          client_name:    client ? `${client.last_name} ${client.first_name}` : "—",
          client_email:   client?.email ?? null,
          trip_name:      trip?.name ?? "—",
          trip_id:        trip?.id ?? (b.trip_id as string),
          workflow_steps: (b.workflow_steps as StepRowData[]) ?? [],
        } satisfies BookingPipelineRow;
      }));
    }
  }, []);

  useEffect(() => {
    const ch = supabase.channel("pipeline:center:v1")
      .on("postgres_changes", { event: "*", schema: "public", table: "workflow_steps" },    () => void refreshList())
      .on("postgres_changes", { event: "*", schema: "public", table: "booking_contracts" }, () => void refreshList())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [refreshList]);

  const filtered = useMemo(() => {
    let r = bookings;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(b => b.client_name.toLowerCase().includes(q) || b.booking_code.toLowerCase().includes(q));
    }
    if (tripFilter !== "all") r = r.filter(b => b.trip_id === tripFilter);
    return r;
  }, [bookings, search, tripFilter]);

  const needsAction = useMemo(() => filtered.filter(b => !!computeNextManual(b)).length, [filtered]);
  const selectedRow = bookings.find(b => b.id === selectedId);

  return (
    <div className="flex h-[calc(100vh-7.5rem)] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      {/* LEFT PANEL */}
      <div className="w-72 shrink-0 flex flex-col border-r border-zinc-100 bg-zinc-50/40">
        {/* Filters */}
        <div className="p-3 space-y-2 border-b border-zinc-100 bg-white">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Ügyfél neve vagy kód…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
            />
            {search && (
              <button onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <select
            value={tripFilter}
            onChange={e => setTripFilter(e.target.value)}
            className="w-full py-1.5 px-2 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 text-zinc-700"
          >
            <option value="all">Összes utazás</option>
            {trips.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 px-3 py-2 border-b border-zinc-100 text-xs">
          <span className="text-zinc-500">
            <strong className="text-zinc-800">{filtered.length}</strong> foglalás
          </span>
          {needsAction > 0 && (
            <span className="flex items-center gap-1 text-amber-600 font-medium">
              <AlertCircle className="h-3 w-3" />{needsAction} vár lépésre
            </span>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-400">Nincs találat</div>
          ) : (
            filtered.map(b => (
              <BookingListItem
                key={b.id}
                row={b}
                selected={b.id === selectedId}
                onClick={() => setSelectedId(b.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex-1 overflow-hidden">
        {selectedRow ? (
          <WorkflowDetail key={selectedRow.id} bookingRow={selectedRow} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100">
              <Users className="h-8 w-8 text-zinc-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-500">Válassz egy foglalást</p>
              <p className="text-xs text-zinc-400 mt-1">Az interaktív workflow a bal listából indul</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
