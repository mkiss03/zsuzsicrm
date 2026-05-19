import { Badge } from "@/components/ui/badge";
import type { BookingStatus, TripStatus, InvoiceStatus } from "@/types";

// ─── Booking ──────────────────────────────────────────────────────────────────

const bookingLabels: Record<BookingStatus, string> = {
  interested:   "Érdeklődő",
  booked:       "Foglalt",
  deposit_paid: "Előleg fizetve",
  fully_paid:   "Kifizetve",
  completed:    "Teljesített",
  cancelled:    "Lemondva",
};

const bookingVariants: Record<
  BookingStatus,
  "muted" | "info" | "warning" | "success" | "secondary" | "destructive"
> = {
  interested:   "muted",
  booked:       "info",
  deposit_paid: "warning",
  fully_paid:   "success",
  completed:    "secondary",
  cancelled:    "destructive",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <Badge variant={bookingVariants[status]}>
      {bookingLabels[status]}
    </Badge>
  );
}

// ─── Trip ─────────────────────────────────────────────────────────────────────

const tripLabels: Record<TripStatus, string> = {
  planned:    "Tervezett",
  advertised: "Meghirdetve",
  full:       "Telt ház",
  ongoing:    "Folyamatban",
  completed:  "Befejezett",
  cancelled:  "Lemondva",
};

const tripVariants: Record<
  TripStatus,
  "muted" | "info" | "warning" | "success" | "secondary" | "destructive" | "default"
> = {
  planned:    "muted",
  advertised: "info",
  full:       "warning",
  ongoing:    "default",
  completed:  "secondary",
  cancelled:  "destructive",
};

export function TripStatusBadge({ status }: { status: TripStatus }) {
  return (
    <Badge variant={tripVariants[status]}>
      {tripLabels[status]}
    </Badge>
  );
}

// ─── Invoice ──────────────────────────────────────────────────────────────────

const invoiceLabels: Record<InvoiceStatus, string> = {
  draft:     "Piszkozat",
  sent:      "Elküldve",
  paid:      "Fizetve",
  overdue:   "Lejárt",
  cancelled: "Lemondva",
};

const invoiceVariants: Record<
  InvoiceStatus,
  "muted" | "info" | "success" | "destructive" | "secondary"
> = {
  draft:     "muted",
  sent:      "info",
  paid:      "success",
  overdue:   "destructive",
  cancelled: "secondary",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge variant={invoiceVariants[status]}>
      {invoiceLabels[status]}
    </Badge>
  );
}
