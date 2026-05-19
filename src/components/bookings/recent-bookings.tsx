import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookingStatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Booking } from "@/types";

type Row = Booking & {
  client: { first_name: string; last_name: string; email: string | null } | null;
  trip: { name: string; departure_date: string } | null;
};

interface Props {
  bookings: Row[];
}

export function RecentBookings({ bookings }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Legutóbbi foglalások</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {bookings.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nincs foglalás
          </p>
        ) : (
          bookings.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {b.client
                      ? `${b.client.last_name} ${b.client.first_name}`
                      : "—"}
                  </span>
                  <BookingStatusBadge status={b.status} />
                </div>
                <div className="text-xs text-muted-foreground">
                  {b.trip?.name ?? "—"} · {b.trip ? formatDate(b.trip.departure_date) : "—"}
                </div>
              </div>
              <div className="ml-4 text-right">
                <div className="text-sm font-medium">{formatCurrency(b.final_amount)}</div>
                <div className="text-xs text-muted-foreground">{b.booking_code}</div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
