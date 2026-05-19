import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookingStatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Booking, Client, Trip } from "@/types";

type Row = Booking & {
  client: Pick<Client, "id" | "first_name" | "last_name" | "client_code" | "is_vip">;
  trip: Pick<Trip, "id" | "name" | "destination" | "departure_date">;
};

interface Props {
  bookings: Row[];
  count: number;
  page: number;
  pageSize: number;
}

export function BookingsTable({ bookings, count }: Props) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kód</TableHead>
              <TableHead>Ügyfél</TableHead>
              <TableHead>Út</TableHead>
              <TableHead>Indulás</TableHead>
              <TableHead>Állapot</TableHead>
              <TableHead className="text-right">Végösszeg</TableHead>
              <TableHead>Határidő</TableHead>
              <TableHead>Létrehozva</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Nincs foglalás
                </TableCell>
              </TableRow>
            )}
            {bookings.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {b.booking_code}
                </TableCell>
                <TableCell>
                  <Link href={`/clients/${b.client.id}`} className="font-medium hover:underline">
                    {b.client.last_name} {b.client.first_name}
                  </Link>
                  {b.client.is_vip && (
                    <Badge variant="warning" className="ml-2 text-[10px]">VIP</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Link href={`/trips/${b.trip.id}`} className="hover:underline text-sm">
                    {b.trip.name}
                  </Link>
                </TableCell>
                <TableCell className="text-sm">{formatDate(b.trip.departure_date)}</TableCell>
                <TableCell><BookingStatusBadge status={b.status} /></TableCell>
                <TableCell className="text-right">{formatCurrency(b.final_amount)}</TableCell>
                <TableCell className="text-sm">
                  {b.payment_deadline ? formatDate(b.payment_deadline) : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(b.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          {count} foglalás összesen
        </div>
      </CardContent>
    </Card>
  );
}
