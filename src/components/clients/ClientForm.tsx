"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { differenceInDays, parseISO } from "date-fns";
import { AlertTriangle } from "lucide-react";

import { clientSchema, type ClientFormValues } from "@/lib/validators/client";
import { COUNTRIES, NATIONALITIES } from "@/lib/constants/countries";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const SOURCE_OPTIONS = [
  { value: "messenger",     label: "Messenger" },
  { value: "website_form",  label: "Weboldal (űrlap)" },
  { value: "referral",      label: "Ajánlás" },
  { value: "other",         label: "Egyéb" },
] as const;

const DISCOUNT_OPTIONS = [
  { value: "0", label: "Alap (0%)" },
  { value: "1", label: "Bronz (5%)" },
  { value: "2", label: "Ezüst (10%)" },
  { value: "3", label: "Arany (15%)" },
] as const;

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-sm font-medium text-zinc-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface ClientFormProps {
  defaultValues?: Partial<ClientFormValues>;
  onSubmit: (values: ClientFormValues) => Promise<void> | void;
  onCancel: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export function ClientForm({
  defaultValues,
  onSubmit,
  onCancel,
  isLoading = false,
  submitLabel = "Mentés",
}: ClientFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isDirty },
  } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      address_country: "Magyarország",
      is_vip: false,
      discount_level: 0,
      ...defaultValues,
    },
  });

  const passportExpiry = watch("passport_expiry");

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Passport expiry warning — show banner if < 6 months away
  const passportDaysLeft = passportExpiry
    ? differenceInDays(parseISO(passportExpiry), new Date())
    : null;
  const showPassportWarning = passportDaysLeft !== null && passportDaysLeft < 180 && passportDaysLeft >= 0;
  const passportExpired = passportDaysLeft !== null && passportDaysLeft < 0;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div className="grid grid-cols-1 gap-x-8 gap-y-0 lg:grid-cols-2">
        {/* ── LEFT COLUMN ─ Personal data ─────────────────────────────── */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 pb-1 border-b border-zinc-100">
            Személyes adatok
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Keresztnév" required error={errors.first_name?.message}>
              <Input
                {...register("first_name")}
                placeholder="Katalin"
                disabled={isLoading}
                className={errors.first_name ? "border-red-300 focus-visible:ring-red-400" : ""}
              />
            </Field>
            <Field label="Vezetéknév" required error={errors.last_name?.message}>
              <Input
                {...register("last_name")}
                placeholder="Nagy"
                disabled={isLoading}
                className={errors.last_name ? "border-red-300 focus-visible:ring-red-400" : ""}
              />
            </Field>
          </div>

          <Field label="Email cím" required error={errors.email?.message}>
            <Input
              {...register("email")}
              type="email"
              placeholder="nagy.katalin@email.com"
              disabled={isLoading}
              className={errors.email ? "border-red-300 focus-visible:ring-red-400" : ""}
            />
          </Field>

          <Field label="Telefonszám" required error={errors.phone?.message}>
            <Input
              {...register("phone")}
              type="tel"
              placeholder="+36 30 123 4567"
              disabled={isLoading}
            />
          </Field>

          <Field label="Utca, házszám" error={errors.address_street?.message}>
            <Input
              {...register("address_street")}
              placeholder="Kossuth utca 12."
              disabled={isLoading}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Város" error={errors.address_city?.message}>
              <Input
                {...register("address_city")}
                placeholder="Budapest"
                disabled={isLoading}
              />
            </Field>
            <Field label="Irányítószám" error={errors.address_zip?.message}>
              <Input
                {...register("address_zip")}
                placeholder="1051"
                disabled={isLoading}
              />
            </Field>
          </div>

          <Field label="Ország" error={errors.address_country?.message}>
            <Controller
              name="address_country"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Válassz országot…" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Születési dátum" error={errors.birth_date?.message}>
            <Input
              {...register("birth_date")}
              type="date"
              disabled={isLoading}
            />
          </Field>
        </div>

        {/* ── RIGHT COLUMN ─ Additional data ──────────────────────────── */}
        <div className="space-y-4 mt-6 lg:mt-0">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 pb-1 border-b border-zinc-100">
            Kiegészítő adatok
          </h3>

          <Field label="Állampolgárság" error={errors.nationality?.message}>
            <Controller
              name="nationality"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Válassz…" />
                  </SelectTrigger>
                  <SelectContent>
                    {NATIONALITIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Útlevélszám" error={errors.passport_number?.message}>
            <Input
              {...register("passport_number")}
              placeholder="AB1234567"
              disabled={isLoading}
            />
          </Field>

          <Field label="Útlevél lejárata" error={errors.passport_expiry?.message}>
            <Input
              {...register("passport_expiry")}
              type="date"
              disabled={isLoading}
            />
            {passportExpired && (
              <Alert variant="destructive" className="mt-2 py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Az útlevél lejárt!</AlertDescription>
              </Alert>
            )}
            {showPassportWarning && !passportExpired && (
              <Alert variant="warning" className="mt-2 py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Az útlevél {passportDaysLeft} napon belül lejár!
                </AlertDescription>
              </Alert>
            )}
          </Field>

          <Field label="Forrás" required error={errors.source?.message}>
            <Controller
              name="source"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  disabled={isLoading}
                >
                  <SelectTrigger
                    className={errors.source ? "border-red-300 focus:ring-red-400" : ""}
                  >
                    <SelectValue placeholder="Hogyan talált ránk?" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Kedvezmény szint" error={errors.discount_level?.message}>
            <Controller
              name="discount_level"
              control={control}
              render={({ field }) => (
                <Select
                  value={String(field.value ?? 0)}
                  onValueChange={(v) => field.onChange(Number(v))}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISCOUNT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <div className="flex items-center justify-between rounded-md border border-zinc-200 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-zinc-900">VIP ügyfél</p>
              <p className="text-xs text-zinc-500">
                VIP ügyfelek prioritást és különleges kedvezményeket kapnak
              </p>
            </div>
            <Controller
              name="is_vip"
              control={control}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isLoading}
                  aria-label="VIP ügyfél"
                />
              )}
            />
          </div>

          <Field label="Megjegyzés" error={errors.notes?.message}>
            <Textarea
              {...register("notes")}
              rows={4}
              placeholder="Egyéb megjegyzések az ügyfélről…"
              disabled={isLoading}
              className="resize-none"
            />
          </Field>
        </div>
      </div>

      {/* ── Actions ────────────────────────────────────────────────────── */}
      <div className="mt-8 flex items-center justify-end gap-3 border-t border-zinc-200 pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Mégsem
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isLoading ? "Mentés…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
