import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TripStatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDate, formatPercent } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import type { Trip } from "@/types";

interface Props {
  trips: Trip[];
  count: number;
  page: number;
  pageSize: number;
}

export function TripsTable({ trips, count }: Props) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kód</TableHead>
              <TableHead>Út neve</TableHead>
              <TableHead>Úticél</TableHead>
              <TableHead>Indulás</TableHead>
              <TableHead>Visszaérk.</TableHead>
              <TableHead>Állapot</TableHead>
              <TableHead>Kapacitás</TableHead>
              <TableHead className="text-right">Alapár</TableHead>
              <TableHead className="text-right">Bevétel</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trips.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                  Nincs út
                </TableCell>
              </TableRow>
            )}
            {trips.map((t) => {
              const occupancy = t.max_capacity > 0
                ? (t.current_bookings / t.max_capacity) * 100
                : 0;
              return (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {t.trip_code}
                  </TableCell>
                  <TableCell>
                    <Link href={`/trips/${t.id}`} className="font-medium hover:underline">
                      {t.name}
                    </Link>
                  </TableCell>
                  <TableCell>{t.destination}</TableCell>
                  <TableCell>{formatDate(t.departure_date)}</TableCell>
                  <TableCell>{formatDate(t.return_date)}</TableCell>
                  <TableCell><TripStatusBadge status={t.status} /></TableCell>
                  <TableCell className="w-36">
                    <div className="flex items-center gap-2">
                      <Progress value={occupancy} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {t.current_bookings}/{t.max_capacity}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(t.base_price)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(t.total_revenue)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          {count} út összesen
        </div>
      </CardContent>
    </Card>
  );
}
