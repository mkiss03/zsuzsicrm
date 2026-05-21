"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Mail,
  FilePlus,
  Pencil,
  Star,
  CalendarDays,
  MapPin,
  User,
  Phone,
  AtSign,
  Tag,
  Wallet,
  TrendingDown,
} from "lucide-react";

import { useBookings, type PaymentResult } from "@/hooks/useBookings";
import { BookingStatusFlow } from "@/components/bookings/BookingStatusFlow";
import { PaymentHistory } from "@/components/bookings/PaymentHistory";
import { WorkflowTab } from "@/components/bookings/WorkflowTab";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { BookingStatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Booking, BookingStatus, Client, Trip, Payment } from "@/types";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

// ─── Discount level labels ────────────────────────────────────────────────────

const DISCOUNT_META: Record<number, { label: string; pct: string }> = {
  0: { label: "Alap",   pct: "0%" },
  1: { label: "Bronz",  pct: "5%" },
  2: { label: "Ezüst",  pct: "10%" },
  3: { label: "Arany",  pct: "15%" },
};

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-zinc-100 last:border-0">
      <Icon className="h-4 w-4 text-zinc-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs text-zinc-400">{label}</p>
        <p className="text-sm font-medium text-zinc-900">{value || "—"}</p>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  booking: Booking & { client: Client; trip: Trip | null };
  initialPayments: Payment[];
}

export function BookingDetailView({ booking: initialBooking, initialPayments }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createBrowserClient();
  const { updateBookingStatus, deleteBooking } = useBookings();

  const [booking, setBooking]   = useState(initialBooking);
  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [showDelete, setShowDelete] = useState(false);

  const defaultTab = searchParams.get("tab") === "workflow" ? "workflow" : "attekintes";

  const { client, trip } = booking;
  const discountMeta = DISCOUNT_META[client.discount_level] ?? DISCOUNT_META[0];

  // Total paid
  const totalPaid = payments.reduce((s, p) => p.type === "refund" ? s - p.amount : s + p.amount, 0);
  const remaining = booking.final_amount != null ? Math.max(booking.final_amount - totalPaid, 0) : null;

  async function handleStatusChange(newStatus: BookingStatus) {
    const ok = await updateBookingStatus(booking.id, newStatus);
    if (ok) {
      setBooking((b) => ({ ...b, status: newStatus }));
      toast.success("Státusz frissítve");
    } else {
      toast.error("Hiba a státusz módosításakor");
    }
  }

  function handlePaymentAdded(result: PaymentResult) {
    setPayments((prev) => [...prev, result.payment]);
    setBooking((b) => ({
      ...b,
      status: result.newStatus,
      deposit_paid_at: result.depositPaidAt ?? b.deposit_paid_at,
      fully_paid_at: result.fullyPaidAt ?? b.fully_paid_at,
    }));
  }

  function handlePaymentDeleted(paymentId: string, newStatus: BookingStatus) {
    setPayments((prev) => prev.filter((p) => p.id !== paymentId));
    setBooking((b) => ({ ...b, status: newStatus }));
  }

  async function handleDelete() {
    const ok = await deleteBooking(booking.id);
    if (ok) {
      toast.success("Foglalás törölve");
      router.push("/bookings");
    } else {
      toast.error("Hiba a törlés során");
    }
  }

  async function handleGenerateInvoice() {
    const { data: existing } = await supabase
      .from("invoices")
      .select("id")
      .eq("booking_id", booking.id)
      .single();

    if (existing) {
      toast.info("Ehhez a foglaláshoz már van számla");
      return;
    }

    const { error } = await supabase.from("invoices").insert({
      client_id: booking.client_id,
      booking_id: booking.id,
      status: "draft",
      issue_date: new Date().toISOString().slice(0, 10),
      items: [{
        description: trip?.name ?? "Utazás",
        quantity: 1,
        unit_price: booking.final_amount ?? 0,
        total: booking.final_amount ?? 0,
      }],
      subtotal: booking.final_amount ?? 0,
      tax_rate: 13,
      tax_amount: (booking.final_amount ?? 0) * 0.13,
      total: (booking.final_amount ?? 0) * 1.13,
    });

    if (error) {
      toast.error("Hiba a számla generálásakor");
    } else {
      toast.success("Számla sikeresen létrehozva (piszkozat)");
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back */}
      <Button variant="ghost" asChild className="-ml-2 text-zinc-500 hover:text-zinc-900">
        <Link href="/bookings">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Vissza a foglalásokhoz
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold text-zinc-900 font-mono">{booking.booking_code}</h1>
            <BookingStatusBadge status={booking.status} />
          </div>
          <p className="text-zinc-600">
            <span className="font-medium">{client.last_name} {client.first_name}</span>
            {trip && (
              <>
                {" — "}
                <span>{trip.name}</span>
              </>
            )}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">
            Létrehozva: {formatDate(booking.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push(`/emails?booking=${booking.id}`)}>
            <Mail className="mr-2 h-4 w-4" />Email küldése
          </Button>
          <Button variant="outline" size="sm" onClick={handleGenerateInvoice}>
            <FilePlus className="mr-2 h-4 w-4" />Számla generálása
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700"
            onClick={() => router.push(`/bookings/${booking.id}/edit`)}>
            <Pencil className="mr-2 h-4 w-4" />Szerkeszt
          </Button>
          <Button size="sm" variant="outline"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            onClick={() => setShowDelete(true)}>
            Töröl
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab} className="mt-2">
        <TabsList className="mb-4">
          <TabsTrigger value="attekintes">Áttekintés</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
        </TabsList>

        <TabsContent value="attekintes" className="space-y-6">

      {/* Status flow */}
      <BookingStatusFlow
        status={booking.status}
        depositPaidAt={booking.deposit_paid_at}
        fullyPaidAt={booking.fully_paid_at}
        onStatusChange={handleStatusChange}
      />

      {/* Info cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Client card */}
        <div className="rounded-md border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-700">Ügyfél adatai</h3>
            <Link href={`/clients/${client.id}`} className="text-xs text-blue-600 hover:underline">
              Ügyfél profil →
            </Link>
          </div>
          <InfoRow icon={User} label="Teljes név" value={`${client.last_name} ${client.first_name}`} />
          <InfoRow icon={AtSign} label="Email" value={client.email} />
          <InfoRow icon={Phone} label="Telefon" value={client.phone} />
          <div className="flex items-center gap-2 pt-2.5">
            {client.is_vip && <Badge variant="warning"><Star className="mr-1 h-3 w-3 fill-amber-600" />VIP</Badge>}
            {discountMeta && (
              <Badge variant="muted">
                <Tag className="mr-1 h-3 w-3" />
                {discountMeta.label} – {discountMeta.pct} kedvezmény
              </Badge>
            )}
          </div>
        </div>

        {/* Trip card */}
        <div className="rounded-md border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-700">Utazás adatai</h3>
            {trip && (
              <Link href={`/trips/${trip.id}`} className="text-xs text-blue-600 hover:underline">
                Utazás részletei →
              </Link>
            )}
          </div>
          {trip ? (
            <>
              <InfoRow icon={User} label="Út neve" value={trip.name} />
              <InfoRow icon={MapPin} label="Úti cél" value={trip.destination} />
              <InfoRow icon={CalendarDays} label="Dátum" value={`${formatDate(trip.departure_date)} – ${formatDate(trip.return_date)}`} />
              <InfoRow icon={User} label="Kód" value={trip.trip_code} />
            </>
          ) : (
            <p className="text-sm text-zinc-400 py-2">Nincs hozzárendelt utazás</p>
          )}
        </div>
      </div>

      {/* Financial breakdown */}
      <div className="rounded-md border border-zinc-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-zinc-700 mb-4">Pénzügyi részletek</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Alap ár",       value: formatCurrency(booking.base_amount),   icon: Wallet },
            { label: "Kedvezmény",    value: booking.discount_amount > 0
                ? `-${formatCurrency(booking.discount_amount)} (${booking.discount_percentage}%)`
                : "—",                                                               icon: TrendingDown },
            { label: "Végösszeg",     value: formatCurrency(booking.final_amount),  icon: Wallet },
            { label: "Előleg",        value: formatCurrency(booking.deposit_amount), icon: Wallet },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-md border border-zinc-100 bg-zinc-50 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="h-3.5 w-3.5 text-zinc-400" />
                <span className="text-xs text-zinc-500">{label}</span>
              </div>
              <p className="text-sm font-semibold text-zinc-900">{value}</p>
            </div>
          ))}
        </div>
        {remaining !== null && (
          <div className={cn(
            "mt-3 flex items-center justify-between rounded-md px-4 py-2.5 text-sm font-medium",
            remaining === 0 ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700",
          )}>
            <span>Fennmaradó egyenleg</span>
            <span>{formatCurrency(remaining)}</span>
          </div>
        )}
      </div>

      {/* Payment history */}
      <PaymentHistory
        bookingId={booking.id}
        finalAmount={booking.final_amount}
        payments={payments}
        currentStatus={booking.status}
        onPaymentAdded={handlePaymentAdded}
        onPaymentDeleted={handlePaymentDeleted}
      />

        </TabsContent>

        <TabsContent value="workflow">
          <WorkflowTab
            bookingId={booking.id}
            bookingStatus={booking.status}
            clientEmail={client.email ?? null}
            tripDepartureDate={trip?.departure_date ?? null}
            tripReturnDate={trip?.return_date ?? null}
          />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={showDelete}
        variant="danger"
        title="Foglalás törlése"
        description={`Biztosan törlöd a(z) ${booking.booking_code} foglalást?`}
        confirmLabel="Törlés"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
