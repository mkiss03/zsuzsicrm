import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TripStatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/utils";
import { CalendarDays } from "lucide-react";
import type { Trip } from "@/types";

interface Props {
  trips: Trip[];
}

export function UpcomingTrips({ trips }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="h-4 w-4" />
          Közelgő utak
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {trips.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nincs közelgő út
          </p>
        ) : (
          trips.map((t) => (
            <div key={t.id} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/trips/${t.id}`}
                  className="truncate text-sm font-medium hover:underline"
                >
                  {t.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {formatDate(t.departure_date)} · {t.current_bookings}/{t.max_capacity} fő
                </p>
              </div>
              <TripStatusBadge status={t.status} />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
