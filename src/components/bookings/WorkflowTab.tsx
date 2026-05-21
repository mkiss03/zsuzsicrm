"use client";

/**
 * WorkflowTab — 11-step booking lifecycle manager
 *
 * PHASES:
 *  1. Fogadás        → inquiry_received, confirmation_sent
 *  2. Fizetés        → deposit_request, deposit_paid, docs_verify, full_payment_request, full_paid
 *  3. Előkészítés    → pre_trip_send
 *  4. Utazás         → trip_started, trip_completed, followup_sent
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2, Circle, Send,
  Wallet, ShieldCheck, CreditCard, Mail, Loader2,
  SkipForward, Inbox,
  MapPin, Plane, Star, BadgeCheck, ArrowRight,
  MessageSquare,
} from "lucide-react";
import { parseISO, formatDistanceToNow } from "date-fns";
import { hu } from "date-fns/locale";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

import { cn } from "@/lib/utils";
import type {
  WorkflowStep, WorkflowStepKey, BookingStatus,
} from "@/types";

// ─── Step definitions ──────────────────────────────────────────────────────────

interface StepDef {
  key: WorkflowStepKey;
  title: string;
  desc: string;
  icon: typeof Circle;
  mode: "auto" | "manual";
  phase: 1 | 2 | 3 | 4;
  actionLabel?: string;
  emailTemplate?: string;
}

const ALL_STEPS: StepDef[] = [
  { key: "inquiry_received",     title: "Érdeklődés rögzítve",       desc: "A foglalás beérkezett a rendszerbe.",                             mode: "auto",   phase: 1, icon: Inbox },
  { key: "confirmation_sent",    title: "Visszaigazolás elküldve",    desc: "Visszaigazolás elküldve — minden tudnivaló és fájl csatolva.",   mode: "manual", phase: 1, icon: Mail,       actionLabel: "Visszaigazolás küldése", emailTemplate: "booking_confirmation" },
  { key: "deposit_request",      title: "Előleg bekérve",             desc: "Előlegfizetési felszólítás elküldve.",                           mode: "manual", phase: 2, icon: Wallet,     actionLabel: "Előleg email küldése",   emailTemplate: "deposit_request" },
  { key: "deposit_paid",         title: "Előleg befizetve",           desc: "Az előleg összege beérkezett.",                                  mode: "auto",   phase: 2, icon: BadgeCheck },
  { key: "docs_verify",          title: "Dokumentumok ellenőrizve",   desc: "Útlevél, vízum, biztosítás rendben.",                            mode: "manual", phase: 2, icon: ShieldCheck, actionLabel: "Megjelölés rendben" },
  { key: "full_payment_request", title: "Végösszeg bekérve",          desc: "Végső fizetési emlékeztető elküldve.",                           mode: "manual", phase: 2, icon: CreditCard,  actionLabel: "Emlékeztető küldése",    emailTemplate: "reminder" },
  { key: "full_paid",            title: "Végösszeg befizetve",        desc: "A teljes összeg beérkezett.",                                    mode: "auto",   phase: 2, icon: BadgeCheck },
  { key: "pre_trip_send",        title: "Utazás előtti tájékoztató",  desc: "Menetrend, találkozási pont, poggyász-tanácsok elküldve.",        mode: "manual", phase: 3, icon: MapPin,     actionLabel: "Tájékoztató küldése",    emailTemplate: "pre_trip" },
  { key: "trip_started",         title: "Utazás megkezdve",           desc: "Az utazócsoport elindult.",                                      mode: "auto",   phase: 4, icon: Plane },
  { key: "trip_completed",       title: "Utazás befejezve",           desc: "Az utazás sikeresen véget ért.",                                 mode: "auto",   phase: 4, icon: CheckCircle2 },
  { key: "followup_sent",        title: "Visszajelzés kérve",         desc: "Köszönő email és értékelési kérés elküldve.",                    mode: "manual", phase: 4, icon: Star,       actionLabel: "Köszönő email küldése",  emailTemplate: "followup" },
];

// ─── Phase definitions ─────────────────────────────────────────────────────────

const PHASES = [
  { id: 1 as const, label: "Fogadás",     dotColor: "bg-blue-500",   textColor: "text-blue-700",   bgColor: "bg-blue-50",   borderColor: "border-blue-400"   },
  { id: 2 as const, label: "Fizetés",     dotColor: "bg-amber-500",  textColor: "text-amber-700",  bgColor: "bg-amber-50",  borderColor: "border-amber-400"  },
  { id: 3 as const, label: "Előkészítés", dotColor: "bg-orange-500", textColor: "text-orange-700", bgColor: "bg-orange-50", borderColor: "border-orange-400" },
  { id: 4 as const, label: "Utazás",      dotColor: "bg-green-500",  textColor: "text-green-700",  bgColor: "bg-green-50",  borderColor: "border-green-400"  },
];

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
  if (!t) return "";
  if (t === "auto")   return "automatikusan";
  if (t === "client") return "ügyfél által";
  return "admin";
}

// ─── Email Send Dialog ─────────────────────────────────────────────────────────

interface EmailDialogProps {
  open: boolean;
  stepDef: StepDef | null;
  bookingId: string;
  onClose: () => void;
  onSent: (stepKey: WorkflowStepKey) => void;
}

function EmailSendDialog({ open, stepDef, bookingId, onClose, onSent }: EmailDialogProps) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleSend() {
    if (!stepDef?.emailTemplate) return;
    setLoading(true);
    try {
      const { data: booking } = await supabase
        .from("bookings")
        .select("booking_code, client:clients(email, first_name, last_name), trip:trips(name)")
        .eq("id", bookingId).single();
      const client = booking?.client as unknown as Record<string, string> | null;
      if (!client?.email) { toast.error("Az ügyfélnek nincs email-címe"); setLoading(false); return; }

      const { data: template } = await supabase
        .from("email_templates").select("*")
        .eq("type", stepDef.emailTemplate).eq("is_default", true).single();
      if (!template) { toast.error(`Nincs alapértelmezett "${stepDef.emailTemplate}" sablon`); setLoading(false); return; }

      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: client.email, template_id: template.id, booking_id: bookingId }),
      });
      if (!res.ok) { toast.error("Hiba az email küldése során"); setLoading(false); return; }

      await supabase.from("workflow_steps").upsert({
        booking_id: bookingId, step_key: stepDef.key, status: "done",
        done_at: new Date().toISOString(), triggered_by: "admin",
      }, { onConflict: "booking_id,step_key" });

      toast.success("Email elküldve ✓");
      onSent(stepDef.key);
      onClose();
    } catch { toast.error("Hálózati hiba"); }
    finally { setLoading(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />{stepDef?.title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-zinc-600 py-2">
          Az ehhez a lépéshez tartozó alapértelmezett email sablon{" "}
          (<code className="text-xs bg-zinc-100 px-1 rounded">{stepDef?.emailTemplate}</code>)
          kerül kiküldésre az ügyfélnek.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Mégse</Button>
          <Button onClick={() => void handleSend()} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Küldés…</> : <><Send className="mr-2 h-4 w-4" />Küldés</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Phase Progress Bar ────────────────────────────────────────────────────────

interface PhaseBarProps {
  isStepDone: (key: WorkflowStepKey) => boolean;
}

function PhaseBar({ isStepDone }: PhaseBarProps) {
  return (
    <div className="flex items-stretch gap-0 rounded-xl overflow-hidden border border-zinc-200 mb-6 shadow-sm">
      {PHASES.map((phase, idx) => {
        const phaseSteps = ALL_STEPS.filter((s) => s.phase === phase.id);
        const doneCount = phaseSteps.filter((s) => isStepDone(s.key)).length;
        const total = phaseSteps.length;
        const complete = doneCount === total;
        const partial  = doneCount > 0 && !complete;

        return (
          <div key={phase.id} className={cn(
            "flex-1 flex flex-col items-center justify-center gap-1 py-3 px-2 text-center transition-all relative",
            complete ? cn(phase.bgColor, "border-b-2", phase.borderColor)
              : partial ? "bg-zinc-50 border-b-2 border-zinc-300"
              : "bg-white border-b-2 border-transparent",
            idx < PHASES.length - 1 && "border-r border-zinc-100",
          )}>
            <div className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold mx-auto transition-colors",
              complete ? cn(phase.dotColor, "text-white shadow-sm")
                : partial ? "bg-zinc-300 text-white"
                : "bg-zinc-100 text-zinc-400"
            )}>
              {complete ? "✓" : phase.id}
            </div>
            <span className={cn(
              "text-[10px] font-semibold leading-tight",
              complete ? phase.textColor : partial ? "text-zinc-500" : "text-zinc-300"
            )}>{phase.label}</span>
            <div className="flex items-center gap-0.5">
              {phaseSteps.map((s) => (
                <div key={s.key} className={cn(
                  "h-1 w-1 rounded-full transition-colors",
                  isStepDone(s.key) ? phase.dotColor : "bg-zinc-200"
                )} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Single Step Row ───────────────────────────────────────────────────────────

interface StepRowProps {
  def: StepDef;
  step: WorkflowStep | undefined;
  isDone: boolean;
  isActive: boolean;
  isLast: boolean;
  phaseColor: typeof PHASES[0];
  onAction: (def: StepDef) => void;
  onSkip: (key: WorkflowStepKey) => void;
}

function StepRow({ def, step, isDone, isActive, isLast, phaseColor, onAction, onSkip }: StepRowProps) {
  const skipped = step?.status === "skipped";
  const Icon = def.icon;

  return (
    <div className="flex gap-4">
      {/* Left: connector + circle */}
      <div className="flex flex-col items-center shrink-0 w-9">
        <div className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all duration-300 z-10 bg-white",
          isDone    ? "border-green-400 bg-green-50  text-green-600"
          : skipped ? "border-zinc-200  bg-zinc-50   text-zinc-300"
          : isActive ? "border-blue-400 bg-blue-50 text-blue-600"
          : "border-zinc-200 text-zinc-300"
        )}>
          {isActive && (
            <span className="absolute inset-0 rounded-full border-2 border-blue-300 animate-ping opacity-50" />
          )}
          {isDone    ? <CheckCircle2 className="h-5 w-5" />
           : skipped ? <SkipForward  className="h-4 w-4" />
           : <Icon className="h-4 w-4" />}
        </div>
        {!isLast && (
          <div className={cn(
            "w-0.5 flex-1 mt-1 min-h-[2rem] transition-colors",
            isDone ? "bg-green-200" : "bg-zinc-100"
          )} />
        )}
      </div>

      {/* Content */}
      <div className={cn("flex-1 min-w-0 pb-5", isLast && "pb-1")}>
        {/* Title row */}
        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
          <span className={cn(
            "text-sm font-semibold",
            isDone ? "text-zinc-900"
              : skipped ? "text-zinc-400 line-through"
              : isActive ? "text-blue-700"
              : "text-zinc-500"
          )}>{def.title}</span>

          {def.mode === "auto" && !isDone && !skipped && (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 rounded-full font-normal">automatikus</Badge>
          )}
          {isDone && (
            <Badge variant="success" className="text-[9px] px-1.5 py-0 rounded-full">✓ Kész</Badge>
          )}
          {skipped && (
            <Badge variant="muted" className="text-[9px] px-1.5 py-0 rounded-full">Kihagyva</Badge>
          )}
          {isActive && !isDone && !skipped && (
            <Badge className="text-[9px] px-1.5 py-0 rounded-full bg-blue-600 text-white border-0">
              ● Szükséges
            </Badge>
          )}
        </div>

        {/* Description */}
        <p className="text-xs text-zinc-400 mb-1.5 leading-relaxed">{def.desc}</p>

        {/* Done metadata */}
        {isDone && step?.done_at && (
          <p className="text-[11px] text-zinc-400 mb-1.5 flex items-center gap-1">
            <span>{fmtDateTime(step.done_at)}</span>
            <span className="text-zinc-200">·</span>
            <span>{triggerLabel(step.triggered_by)}</span>
            <span className="text-zinc-200">·</span>
            <span className="text-zinc-300">{timeAgo(step.done_at)}</span>
          </p>
        )}

        {/* Action buttons */}
        {!isDone && !skipped && def.mode === "manual" && (
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Button
              size="sm"
              className={cn(
                "h-7 text-xs gap-1",
                isActive ? "bg-blue-600 hover:bg-blue-700 shadow-sm" : "bg-zinc-700 hover:bg-zinc-900"
              )}
              onClick={() => onAction(def)}
            >
              <ArrowRight className="h-3 w-3" />{def.actionLabel}
            </Button>
            <button
              onClick={() => onSkip(def.key)}
              className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors px-1"
            >
              Kihagyás
            </button>
          </div>
        )}

        {/* Re-send for done manual steps */}
        {isDone && def.mode === "manual" && def.key !== "docs_verify" && def.key !== "inquiry_received" && (
          <button
            onClick={() => onAction(def)}
            className="mt-0.5 flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <MessageSquare className="h-3 w-3" />Újraküldés
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main WorkflowTab ──────────────────────────────────────────────────────────

export interface WorkflowTabProps {
  bookingId: string;
  bookingStatus: BookingStatus;
  clientEmail: string | null;
  tripDepartureDate?: string | null;
  tripReturnDate?: string | null;
}

export function WorkflowTab({
  bookingId,
  bookingStatus,
  clientEmail,
  tripDepartureDate,
  tripReturnDate,
}: WorkflowTabProps) {
  const supabase = createClient();

  const [steps,       setSteps]       = useState<WorkflowStep[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [emailDialog, setEmailDialog] = useState<StepDef | null>(null);
  const initRef = useRef(false);

  const now = new Date();

  // ── isDone helper ─────────────────────────────────────────────────────
  const isStepDone = useCallback((key: WorkflowStepKey): boolean => {
    const s = steps.find((x) => x.step_key === key);
    if (s?.status === "done") return true;
    if (key === "inquiry_received") return true;
    if (key === "deposit_paid"   && ["deposit_paid","fully_paid","completed"].includes(bookingStatus)) return true;
    if (key === "full_paid"      && ["fully_paid","completed"].includes(bookingStatus)) return true;
    if (key === "trip_started"   && tripDepartureDate && new Date(tripDepartureDate) < now) return true;
    if (key === "trip_completed" && tripReturnDate    && new Date(tripReturnDate)    < now) return true;
    return false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, bookingStatus, tripDepartureDate, tripReturnDate]);

  // First pending manual step → "active" (pulsing)
  const activeStepKey: WorkflowStepKey | null = ALL_STEPS.find((def) =>
    def.mode === "manual" &&
    !isStepDone(def.key) &&
    steps.find((s) => s.step_key === def.key)?.status !== "skipped"
  )?.key ?? null;

  // ── Load ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const { data: stepsData } = await supabase
      .from("workflow_steps").select("*").eq("booking_id", bookingId).order("created_at");
    setSteps((stepsData ?? []) as WorkflowStep[]);
    setLoading(false);
  }, [bookingId]);

  useEffect(() => { void load(); }, [load]);

  // ── Auto-init inquiry_received on first open ──────────────────────────
  useEffect(() => {
    if (loading || initRef.current) return;
    initRef.current = true;
    if (!steps.find((s) => s.step_key === "inquiry_received")) {
      void supabase.from("workflow_steps").upsert({
        booking_id: bookingId, step_key: "inquiry_received",
        status: "done", done_at: new Date().toISOString(), triggered_by: "auto",
      }, { onConflict: "booking_id,step_key" }).then(() => void load());
    }
  }, [loading, steps, bookingId, load]);

  // ── Auto-sync payment / date based steps ─────────────────────────────
  useEffect(() => {
    if (loading) return;
    const checks: { key: WorkflowStepKey; cond: boolean }[] = [
      { key: "deposit_paid",   cond: ["deposit_paid","fully_paid","completed"].includes(bookingStatus) },
      { key: "full_paid",      cond: ["fully_paid","completed"].includes(bookingStatus) },
      { key: "trip_started",   cond: !!(tripDepartureDate && new Date(tripDepartureDate) < now) },
      { key: "trip_completed", cond: !!(tripReturnDate    && new Date(tripReturnDate)    < now) },
    ];
    for (const { key, cond } of checks) {
      if (!cond) continue;
      if (steps.find((s) => s.step_key === key)?.status === "done") continue;
      void supabase.from("workflow_steps").upsert({
        booking_id: bookingId, step_key: key, status: "done",
        done_at: new Date().toISOString(), triggered_by: "auto",
      }, { onConflict: "booking_id,step_key" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingStatus, loading]);

  // ── Real-time subscription ────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase.channel(`wf:${bookingId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "workflow_steps", filter: `booking_id=eq.${bookingId}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [bookingId, load]);

  // ── Handlers ─────────────────────────────────────────────────────────
  function handleAction(def: StepDef) {
    if (def.key === "docs_verify") { void markDone(def.key); return; }
    if (def.emailTemplate)         { setEmailDialog(def); return; }
  }

  async function markDone(key: WorkflowStepKey, triggeredBy = "admin") {
    await supabase.from("workflow_steps").upsert({
      booking_id: bookingId, step_key: key, status: "done",
      done_at: new Date().toISOString(), triggered_by: triggeredBy,
    }, { onConflict: "booking_id,step_key" });
    toast.success("Lépés befejezve ✓");
    void load();
  }

  async function handleSkip(key: WorkflowStepKey) {
    await supabase.from("workflow_steps").upsert({
      booking_id: bookingId, step_key: key, status: "skipped",
      done_at: new Date().toISOString(), triggered_by: "admin",
    }, { onConflict: "booking_id,step_key" });
    toast.info("Lépés kihagyva");
    void load();
  }

  function handleEmailSent(key: WorkflowStepKey) {
    void load();
  }

  // ── Progress ──────────────────────────────────────────────────────────
  const totalDone = ALL_STEPS.filter((s) => isStepDone(s.key)).length;
  const pct = Math.round((totalDone / ALL_STEPS.length) * 100);

  // ── Skeleton ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-3 pt-2">
        <Skeleton className="h-16 w-full rounded-xl" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-9 w-9 rounded-full shrink-0" />
            <div className="space-y-2 flex-1 pb-5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Overall progress bar */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-zinc-400">Folyamat előrehaladás</span>
        <span className="text-xs font-bold text-zinc-600">{totalDone}/{ALL_STEPS.length} · {pct}%</span>
      </div>
      <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden mb-5">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, #3b82f6 0%, #8b5cf6 40%, #f59e0b 70%, #22c55e 100%)",
          }}
        />
      </div>

      {/* Phase progress bar */}
      <PhaseBar isStepDone={isStepDone} />

      {/* Step timeline */}
      <div>
        {ALL_STEPS.map((def, idx) => {
          const phase = PHASES.find((p) => p.id === def.phase)!;
          return (
            <StepRow
              key={def.key}
              def={def}
              step={steps.find((s) => s.step_key === def.key)}
              isDone={isStepDone(def.key)}
              isActive={def.key === activeStepKey}
              isLast={idx === ALL_STEPS.length - 1}
              phaseColor={phase}
              onAction={handleAction}
              onSkip={handleSkip}
            />
          );
        })}
      </div>

      {/* Dialogs */}
      <EmailSendDialog
        open={!!emailDialog}
        stepDef={emailDialog}
        bookingId={bookingId}
        onClose={() => setEmailDialog(null)}
        onSent={handleEmailSent}
      />
    </>
  );
}
