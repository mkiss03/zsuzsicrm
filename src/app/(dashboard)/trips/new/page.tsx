"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { differenceInDays, parseISO } from "date-fns";
import { ArrowLeft, Info } from "lucide-react";
import { toast } from "sonner";

import { tripSchema, type TripFormValues } from "@/lib/validators/trip";
import { useTrips } from "@/hooks/useTrips";
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
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ─── Field wrapper ─────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
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
      {hint && !error && <p className="text-xs text-zinc-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ─── Destinations suggestions (static list for datalist) ──────────────────────

const POPULAR_DESTINATIONS = [
  "Róma, Olaszország",
  "Velence, Olaszország",
  "Párizs, Franciaország",
  "Barcelona, Spanyolország",
  "Madrid, Spanyolország",
  "Athén, Görögország",
  "Szantorini, Görögország",
  "Dubrovnik, Horvátország",
  "Split, Horvátország",
  "Bécs, Ausztria",
  "Prága, Csehország",
  "Budapest, Magyarország",
  "Isztambul, Törökország",
  "Hurghada, Egyiptom",
  "Dubai, Emirségek",
  "Bangkok, Thaiföld",
  "Amszterdam, Hollandia",
  "Lisszabon, Portugália",
  "Tokió, Japán",
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewTripPage() {
  const router = useRouter();
  const { createTrip } = useTrips();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<TripFormValues>({
    resolver: zodResolver(tripSchema),
    defaultValues: {
      status: "planned",
      max_capacity: 12,
      base_price: 0,
    },
  });

  // Auto-calculated fields
  const departureDate   = watch("departure_date");
  const returnDate      = watch("return_date");
  const maxCapacity     = watch("max_capacity");
  const basePrice       = watch("base_price");
  const destination     = watch("destination");

  const nights =
    departureDate && returnDate && returnDate > departureDate
      ? differenceInDays(parseISO(returnDate), parseISO(departureDate))
      : null;

  const expectedRevenue = (Number(maxCapacity) || 0) * (Number(basePrice) || 0);

  // Trip code preview based on destination initials + year
  const codePreview = (() => {
    const year = departureDate ? departureDate.slice(0, 4) : new Date().getFullYear();
    const dest = destination
      ? destination
          .split(/[\s,]+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w.slice(0, 3).toUpperCase())
          .join("-")
      : "XXX";
    return `TRP-${dest}-${year}`;
  })();

  async function onSubmit(values: TripFormValues) {
    setSubmitting(true);
    const trip = await createTrip(values);
    setSubmitting(false);
    if (trip) {
      toast.success("Utazás sikeresen létrehozva!");
      router.push(`/trips/${trip.id}`);
    } else {
      toast.error("Hiba az utazás létrehozása során.");
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Új utazás"
        subtitle="Töltsd ki az alábbi adatokat az utazás rögzítéséhez"
        actions={
          <Button variant="outline" asChild>
            <Link href="/trips">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Vissza
            </Link>
          </Button>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="rounded-md border border-zinc-200 bg-white p-6 space-y-5">
          {/* Section: Basic info */}
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 border-b border-zinc-100 pb-1">
            Alapadatok
          </h3>

          <Field label="Út neve" required error={errors.name?.message}>
            <Input
              {...register("name")}
              placeholder="pl. Toszkán körutazás"
              disabled={submitting}
            />
          </Field>

          <Field label="Úti cél" required error={errors.destination?.message}>
            <Input
              {...register("destination")}
              list="destination-suggestions"
              placeholder="pl. Firenze, Olaszország"
              disabled={submitting}
              autoComplete="off"
            />
            <datalist id="destination-suggestions">
              {POPULAR_DESTINATIONS.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </Field>

          {/* Dates + duration */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Indulás dátuma" required error={errors.departure_date?.message}>
              <Input
                {...register("departure_date")}
                type="date"
                disabled={submitting}
              />
            </Field>
            <Field
              label="Visszaérkezés"
              required
              error={errors.return_date?.message}
            >
              <Input
                {...register("return_date")}
                type="date"
                disabled={submitting}
                min={departureDate || undefined}
              />
            </Field>
          </div>

          {nights !== null && (
            <div className="flex items-center gap-2 rounded-md bg-zinc-50 border border-zinc-200 px-3 py-2 text-sm text-zinc-600">
              <Info className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <span>
                Időtartam:{" "}
                <span className="font-semibold">
                  {nights} éjszaka / {nights + 1} nap
                </span>
              </span>
            </div>
          )}

          {/* Section: Capacity & pricing */}
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 border-b border-zinc-100 pb-1 pt-2">
            Kapacitás és árazás
          </h3>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Max férőhely" required error={errors.max_capacity?.message}>
              <Input
                {...register("max_capacity")}
                type="number"
                min={1}
                max={100}
                disabled={submitting}
              />
            </Field>

            <Field
              label="Alap ár (EUR)"
              required
              error={errors.base_price?.message}
            >
              <div className="relative">
                <Input
                  {...register("base_price")}
                  type="number"
                  min={0}
                  step={1000}
                  className="pr-14"
                  disabled={submitting}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400 select-none">
                  €
                </span>
              </div>
            </Field>

            <Field
              label="VIP ár (EUR)"
              error={errors.vip_price?.message}
              hint="Opcionális"
            >
              <div className="relative">
                <Input
                  {...register("vip_price")}
                  type="number"
                  min={0}
                  step={1000}
                  className="pr-14"
                  disabled={submitting}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400 select-none">
                  €
                </span>
              </div>
            </Field>
          </div>

          {/* Financial preview */}
          {expectedRevenue > 0 && (
            <div className="flex items-center justify-between rounded-md bg-green-50 border border-green-200 px-4 py-3">
              <span className="text-sm text-green-700">
                Teljes kapacitásnál várható bevétel:
              </span>
              <span className="text-sm font-semibold text-green-800">
                {formatCurrency(expectedRevenue, "EUR")}
              </span>
            </div>
          )}

          {/* Section: Details */}
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 border-b border-zinc-100 pb-1 pt-2">
            Részletek
          </h3>

          <Field label="Státusz" error={errors.status?.message}>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={submitting}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Tervezett</SelectItem>
                    <SelectItem value="advertised">Hirdetve</SelectItem>
                    <SelectItem value="full">Telített</SelectItem>
                    <SelectItem value="ongoing">Folyamatban</SelectItem>
                    <SelectItem value="completed">Lezárt</SelectItem>
                    <SelectItem value="cancelled">Törölve</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Leírás / Program" error={errors.description?.message}>
            <Textarea
              {...register("description")}
              rows={5}
              placeholder="Az utazás részletes leírása, napi program, fontos tudnivalók…"
              disabled={submitting}
            />
          </Field>

          {/* Trip code preview */}
          <div className="flex items-center justify-between rounded-md bg-zinc-50 border border-zinc-100 px-4 py-3">
            <span className="text-xs text-zinc-500">Generált kód előnézet</span>
            <span className="font-mono text-sm font-medium text-zinc-700">
              {codePreview}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/trips")}
            disabled={submitting}
          >
            Mégsem
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {submitting ? "Létrehozás…" : "Utazás létrehozása"}
          </Button>
        </div>
      </form>
    </div>
  );
}
