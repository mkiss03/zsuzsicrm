"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { paymentSchema, type PaymentFormValues } from "@/lib/validators/booking";
import { useBookings, type PaymentResult } from "@/hooks/useBookings";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

// ─── Payment type labels ──────────────────────────────────────────────────────

const PAYMENT_TYPES = [
  { value: "deposit",      label: "Előleg" },
  { value: "partial",      label: "Részlet" },
  { value: "full_payment", label: "Végösszeg" },
  { value: "refund",       label: "Visszatérítés" },
] as const;

const BANK_ACCOUNTS = [
  { value: "huf_account", label: "Magyar forint alapú számla", defaultCurrency: "HUF" },
  { value: "eur_account", label: "Euró alapú osztrák számla",  defaultCurrency: "EUR" },
  { value: "revolut",     label: "Revolut számla",             defaultCurrency: "HUF" },
] as const;

const CURRENCIES = [
  { value: "HUF", label: "Forint (HUF)" },
  { value: "EUR", label: "Euró (EUR)" },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

interface PaymentFormProps {
  open: boolean;
  bookingId: string;
  remainingBalance: number;   // pre-fill amount suggestion
  onSuccess: (result: PaymentResult) => void;
  onCancel: () => void;
}

export function PaymentForm({
  open,
  bookingId,
  remainingBalance,
  onSuccess,
  onCancel,
}: PaymentFormProps) {
  const { addPayment, loading } = useBookings();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: remainingBalance > 0 ? remainingBalance : 0,
      type: "full_payment",
      payment_date: new Date().toISOString().slice(0, 16),
      account: undefined,
      currency: "HUF",
      notes: "",
    },
  });

  // When account changes, auto-select the matching currency
  const watchedAccount = watch("account");
  useEffect(() => {
    const acct = BANK_ACCOUNTS.find((a) => a.value === watchedAccount);
    if (acct) setValue("currency", acct.defaultCurrency);
  }, [watchedAccount, setValue]);

  // Reset form with updated default when opened
  useEffect(() => {
    if (open) {
      reset({
        amount: remainingBalance > 0 ? remainingBalance : 0,
        type: "full_payment",
        payment_date: new Date().toISOString().slice(0, 16),
        account: undefined,
        currency: "HUF",
        notes: "",
      });
    }
  }, [open, remainingBalance, reset]);

  async function onSubmit(values: PaymentFormValues) {
    const result = await addPayment(bookingId, values);
    if (result) {
      onSuccess(result);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !loading) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fizetés rögzítése</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {/* Amount */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-zinc-700">
              Összeg <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                {...register("amount")}
                type="number"
                step="1"
                min="0"
                className={`pr-10 ${errors.amount ? "border-red-300" : ""}`}
                disabled={loading}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">Ft</span>
            </div>
            {remainingBalance > 0 && (
              <p className="text-xs text-zinc-400">
                Fennmaradó egyenleg: <span className="font-medium">{formatCurrency(remainingBalance)}</span>
              </p>
            )}
            {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-zinc-700">
              Típus <span className="text-red-500">*</span>
            </Label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Bank account + Currency (side by side) */}
          <div className="grid grid-cols-5 gap-3">
            <div className="col-span-3 space-y-1.5">
              <Label className="text-sm font-medium text-zinc-700">Bankszámla</Label>
              <Controller
                name="account"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? ""}
                    onValueChange={(v) => field.onChange(v || undefined)}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Válassz…" />
                    </SelectTrigger>
                    <SelectContent>
                      {BANK_ACCOUNTS.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label className="text-sm font-medium text-zinc-700">Pénznem</Label>
              <Controller
                name="currency"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={loading}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Payment date */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-zinc-700">
              Fizetés dátuma <span className="text-red-500">*</span>
            </Label>
            <Input
              {...register("payment_date")}
              type="datetime-local"
              disabled={loading}
            />
            {errors.payment_date && (
              <p className="text-xs text-red-500">{errors.payment_date.message}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-zinc-700">Megjegyzés</Label>
            <Textarea
              {...register("notes")}
              rows={2}
              placeholder="Opcionális megjegyzés…"
              disabled={loading}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              Mégse
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Rögzítés
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
