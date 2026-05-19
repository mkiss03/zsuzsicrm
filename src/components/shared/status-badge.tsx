import { Badge } from "@/components/ui/badge";
import type { BookingStatus, TripStatus, InvoiceStatus } from "@/types";

const bookingLabels: Record<BookingStatus, string> = {
  interested:  "Érdeklődő",
  booked:      "Foglalt",
  deposit_paid:"Előleg fizetve",
  fully_paid:  "Teljesen fizetve",
  completed:   "Teljesített",
  cancelled:   "Lemondott",
};

const bookingVariants: Record<BookingStatus, "default" | "secondary" | "warning" | "success" | "destructive" | "info"> = {
  interested:  "secondary",
  booked:      "info",
  deposit_paid:"warning",
  fully_paid:  "success",
  completed:   "success",
  cancelled:   "destructive",
};

const tripLabels: Record<TripStatus, string> = {
  planned:    "Tervezett",
  advertised: "Meghirdetve",
  full:       "Telt ház",
  ongoing:    "Folyamatban",
  completed:  "Befejezett",
  cancelled:  "Lemondott",
};

const tripVariants: Record<TripStatus, "default" | "secondary" | "warning" | "success" | "destructive" | "info"> = {
  planned:    "secondary",
  advertised: "info",
  full:       "warning",
  ongoing:    "success",
  completed:  "default",
  cancelled:  "destructive",
};

const invoiceLabels: Record<InvoiceStatus, string> = {
  draft:     "Piszkozat",
  sent:      "Elküldve",
  paid:      "Fizetve",
  overdue:   "Lejárt",
  cancelled: "Lemondott",
};

const invoiceVariants: Record<InvoiceStatus, "default" | "secondary" | "warning" | "success" | "destructive" | "info"> = {
  draft:     "secondary",
  sent:      "info",
  paid:      "success",
  overdue:   "destructive",
  cancelled: "secondary",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <Badge variant={bookingVariants[status]}>{bookingLabels[status]}</Badge>;
}

export function TripStatusBadge({ status }: { status: TripStatus }) {
  return <Badge variant={tripVariants[status]}>{tripLabels[status]}</Badge>;
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge variant={invoiceVariants[status]}>{invoiceLabels[status]}</Badge>;
}
