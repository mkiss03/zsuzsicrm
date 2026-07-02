"use client";

import { useState } from "react";
import { Check, X, Circle, ChevronRight } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/types";

// ─── Step definitions ─────────────────────────────────────────────────────────

interface Step {
  status: BookingStatus;
  label: string;
  shortLabel: string;
}

const STEPS: Step[] = [
  { status: "interested",   label: "Érdeklődő",              shortLabel: "Érd." },
  { status: "booked",       label: "Foglalt",                shortLabel: "Fogl." },
  { status: "deposit_paid", label: "Előleg fizetve",         shortLabel: "Előleg" },
  { status: "fully_paid",   label: "Teljesen fizetve",       shortLabel: "Fizet." },
  { status: "completed",    label: "Teljesítve",             shortLabel: "Kész" },
];

const STATUS_INDEX: Record<BookingStatus, number> = {
  interested:   0,
  booked:       1,
  deposit_paid: 2,
  fully_paid:   3,
  completed:    4,
  cancelled:   -1,
};

// ─── Timestamp display ────────────────────────────────────────────────────────

function stepDate(
  step: BookingStatus,
  depositPaidAt: string | null,
  fullyPaidAt: string | null,
): string | null {
  if (step === "deposit_paid") return depositPaidAt ? formatDate(depositPaidAt) : null;
  if (step === "fully_paid")   return fullyPaidAt   ? formatDate(fullyPaidAt)   : null;
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BookingStatusFlowProps {
  status: BookingStatus;
  depositPaidAt?: string | null;
  fullyPaidAt?: string | null;
  onStatusChange: (newStatus: BookingStatus) => Promise<void> | void;
  onRequestPayment?: (type: "deposit" | "full_payment") => void;
  disabled?: boolean;
}

// Steps that represent money actually arriving — these must go through a
// real payment record instead of a blind status jump, so revenue reports
// and the "lejárt" overdue flag stay accurate.
const PAYMENT_STEPS: Partial<Record<BookingStatus, "deposit" | "full_payment">> = {
  deposit_paid: "deposit",
  fully_paid:   "full_payment",
};

export function BookingStatusFlow({
  status,
  depositPaidAt,
  fullyPaidAt,
  onStatusChange,
  onRequestPayment,
  disabled = false,
}: BookingStatusFlowProps) {
  const [confirmTarget, setConfirmTarget] = useState<BookingStatus | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const currentIdx = STATUS_INDEX[status] ?? -1;
  const isCancelled = status === "cancelled";
  const isCompleted = status === "completed";
  const isLocked = isCompleted || disabled;

  const nextStep = STEPS[currentIdx + 1];
  const currentStep = STEPS[currentIdx];

  async function handleAdvance() {
    if (!confirmTarget) return;
    await onStatusChange(confirmTarget);
    setConfirmTarget(null);
  }

  async function handleCancel() {
    await onStatusChange("cancelled");
    setCancelConfirm(false);
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-700">Foglalás folyamata</h3>
        {!isCancelled && !isCompleted && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
            onClick={() => setCancelConfirm(true)}
            disabled={disabled}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Lemondás
          </Button>
        )}
      </div>

      {/* Cancelled overlay */}
      {isCancelled ? (
        <div className="flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-red-100">
            <X className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-red-700">Lemondva</p>
            <p className="text-xs text-red-500">Ez a foglalás le lett mondva.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Stepper — horizontal desktop, compact mobile */}
          <div className="flex items-start">
            {STEPS.map((step, idx) => {
              const isDone    = currentIdx > idx;
              const isCurrent = currentIdx === idx;
              const isFuture  = currentIdx < idx;
              const isNext    = currentIdx + 1 === idx && !isLocked;
              const date      = stepDate(step.status, depositPaidAt ?? null, fullyPaidAt ?? null);

              return (
                <div key={step.status} className="flex flex-1 items-start">
                  {/* Step */}
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => {
                        if (isLocked || !isNext) return;
                        const paymentType = PAYMENT_STEPS[step.status];
                        if (paymentType && onRequestPayment) {
                          onRequestPayment(paymentType);
                        } else {
                          setConfirmTarget(step.status);
                        }
                      }}
                      disabled={isLocked || !isNext}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-md border-2 text-sm font-semibold transition-all",
                        isDone && "border-zinc-700 bg-zinc-700 text-white cursor-default",
                        isCurrent && "border-blue-600 bg-blue-600 text-white cursor-default",
                        isFuture && isNext && "border-zinc-300 bg-white text-zinc-400 hover:border-blue-400 hover:text-blue-500 cursor-pointer",
                        isFuture && !isNext && "border-zinc-200 bg-white text-zinc-300 cursor-default",
                      )}
                      title={isNext ? `Továbblép: ${step.label}` : undefined}
                      aria-label={step.label}
                    >
                      {isDone   ? <Check className="h-4 w-4" /> :
                       isCurrent ? (idx + 1) :
                       isNext    ? <ChevronRight className="h-4 w-4" /> :
                                   <Circle className="h-3 w-3" />}
                    </button>
                    {/* Label */}
                    <div className="mt-2 text-center">
                      <p className={cn(
                        "text-[11px] font-medium hidden sm:block",
                        isDone    && "text-zinc-600",
                        isCurrent && "text-blue-600",
                        isFuture  && "text-zinc-400",
                      )}>
                        {step.label}
                      </p>
                      <p className={cn(
                        "text-[11px] font-medium sm:hidden",
                        isDone    && "text-zinc-600",
                        isCurrent && "text-blue-600",
                        isFuture  && "text-zinc-400",
                      )}>
                        {step.shortLabel}
                      </p>
                      {date && (
                        <p className="text-[10px] text-zinc-400 mt-0.5">{date}</p>
                      )}
                    </div>
                  </div>

                  {/* Connector line (not after last step) */}
                  {idx < STEPS.length - 1 && (
                    <div className={cn(
                      "flex-1 mt-4 h-0.5 mx-1",
                      isDone    ? "bg-zinc-600" : "bg-zinc-200",
                    )} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Advance hint */}
          {!isLocked && nextStep && (
            <p className="mt-4 text-xs text-zinc-400 text-center">
              Kattints a következő lépésre a továbblépéshez:{" "}
              <span className="font-medium text-zinc-600">{nextStep.label}</span>
            </p>
          )}
        </>
      )}

      {/* Advance confirmation dialog */}
      <ConfirmDialog
        open={!!confirmTarget}
        title="Státusz módosítása"
        description={
          confirmTarget
            ? `Biztosan továbblépítsd a foglalást?\n\n${currentStep?.label ?? ""} → ${STEPS.find((s) => s.status === confirmTarget)?.label ?? ""}`
            : ""
        }
        confirmLabel="Igen, továbblép"
        onConfirm={handleAdvance}
        onCancel={() => setConfirmTarget(null)}
      />

      {/* Cancel confirmation */}
      <ConfirmDialog
        open={cancelConfirm}
        variant="danger"
        title="Foglalás lemondása"
        description="Biztosan lemondod ezt a foglalást? Ez a művelet a státuszt lemondottra állítja."
        confirmLabel="Lemondás"
        onConfirm={handleCancel}
        onCancel={() => setCancelConfirm(false)}
      />
    </div>
  );
}
