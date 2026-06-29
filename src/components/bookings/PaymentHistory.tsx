"use client";

import { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

import { useBookings, type PaymentResult } from "@/hooks/useBookings";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PaymentForm } from "@/components/bookings/PaymentForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Payment, BookingStatus, PaymentType } from "@/types";

// ─── Payment type badges ──────────────────────────────────────────────────────

const TYPE_META: Record<PaymentType, { label: string; variant: "info" | "warning" | "success" | "destructive" }> = {
  deposit:      { label: "Előleg",         variant: "warning" },
  partial:      { label: "Részlet",        variant: "info" },
  full_payment: { label: "Végösszeg",      variant: "success" },
  refund:       { label: "Visszatérítés",  variant: "destructive" },
};

const ACCOUNT_LABELS: Record<string, string> = {
  huf_account: "HUF számla",
  eur_account: "EUR számla",
  revolut:     "Revolut",
};

// ─── Component ────────────────────────────────────────────────────────────────

interface PaymentHistoryProps {
  bookingId: string;
  finalAmount: number | null;
  payments: Payment[];
  currentStatus: BookingStatus;
  onPaymentAdded: (result: PaymentResult) => void;
  onPaymentDeleted: (paymentId: string, newStatus: BookingStatus) => void;
}

export function PaymentHistory({
  bookingId,
  finalAmount,
  payments,
  currentStatus,
  onPaymentAdded,
  onPaymentDeleted,
}: PaymentHistoryProps) {
  const { deletePayment, loading } = useBookings();
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Net paid = sum of non-refund - sum of refunds
  const totalPaid = payments.reduce(
    (s, p) => (p.type === "refund" ? s - p.amount : s + p.amount),
    0,
  );
  const remaining = finalAmount != null ? Math.max(finalAmount - totalPaid, 0) : null;
  const overpaid  = finalAmount != null && totalPaid > finalAmount;

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deletePayment(deleteTarget, bookingId);
    if (result) {
      onPaymentDeleted(deleteTarget, result.newStatus);
      toast.success("Fizetés törölve");
    } else {
      toast.error("Hiba a törlés során");
    }
    setDeleteTarget(null);
  }

  const isLocked = currentStatus === "completed" || currentStatus === "cancelled";

  return (
    <div className="rounded-md border border-zinc-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
        <h3 className="text-sm font-semibold text-zinc-900">Fizetési előzmények</h3>
        {!isLocked && (
          <Button
            size="sm"
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 h-7 text-xs"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Fizetés rögzítése
          </Button>
        )}
      </div>

      {/* Payment list */}
      {payments.length === 0 ? (
        <div className="px-5 py-8">
          <EmptyState
            icon={Plus}
            title="Nincs rögzített fizetés"
            description="Rögzíts fizetést a 'Fizetés rögzítése' gombbal."
          />
        </div>
      ) : (
        <div className="divide-y divide-zinc-100">
          {payments
            .slice()
            .sort((a, b) => (a.payment_date < b.payment_date ? 1 : -1))
            .map((payment) => {
              const meta = TYPE_META[payment.type] ?? TYPE_META.partial;
              const isRefund = payment.type === "refund";
              return (
                <div
                  key={payment.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={meta.variant} className="text-[10px]">
                        {meta.label}
                      </Badge>
                      {payment.account && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 font-medium">
                          {ACCOUNT_LABELS[payment.account] ?? payment.account}
                        </span>
                      )}
                      {payment.currency && payment.currency !== "HUF" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
                          {payment.currency}
                        </span>
                      )}
                      <span className="text-xs text-zinc-400">
                        {formatDate(payment.payment_date)}
                      </span>
                    </div>
                    {payment.notes && (
                      <p className="text-xs text-zinc-500 mt-0.5 truncate">
                        {payment.notes}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      isRefund ? "text-red-600" : "text-zinc-900",
                    )}
                  >
                    {isRefund ? "-" : "+"}{formatCurrency(payment.amount, "EUR")}
                  </span>
                  {!isLocked && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-zinc-400 hover:text-red-600 flex-shrink-0"
                      onClick={() => setDeleteTarget(payment.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Summary */}
      <div className="border-t border-zinc-200 px-5 py-4 space-y-1.5 bg-zinc-50">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">Végösszeg</span>
          <span className="font-medium">{formatCurrency(finalAmount, "EUR")}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">Befizetett összeg</span>
          <span className="font-medium text-green-700">{formatCurrency(totalPaid, "EUR")}</span>
        </div>
        <div className="flex justify-between text-sm border-t border-zinc-200 pt-1.5">
          <span className={cn("font-medium", overpaid ? "text-green-700" : "text-zinc-700")}>
            {overpaid ? "Túlfizetés" : "Fennmaradó egyenleg"}
          </span>
          <span className={cn("font-semibold", overpaid ? "text-green-700" : remaining === 0 ? "text-green-700" : "text-red-600")}>
            {overpaid
              ? formatCurrency(totalPaid - (finalAmount ?? 0), "EUR")
              : formatCurrency(remaining ?? 0, "EUR")}
          </span>
        </div>
      </div>

      {/* Payment form dialog */}
      <PaymentForm
        open={showForm}
        bookingId={bookingId}
        remainingBalance={remaining ?? 0}
        onSuccess={(result) => {
          setShowForm(false);
          onPaymentAdded(result);
          toast.success("Fizetés sikeresen rögzítve");
        }}
        onCancel={() => setShowForm(false)}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        variant="danger"
        title="Fizetés törlése"
        description="Biztosan törlöd ezt a fizetési bejegyzést? A foglalás státusza automatikusan frissül."
        confirmLabel="Törlés"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
