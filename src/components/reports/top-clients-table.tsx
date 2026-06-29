import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import type { Client } from "@/types";

type Row = Pick<Client, "id" | "first_name" | "last_name" | "client_code" | "trip_count" | "total_spent" | "is_vip">;

interface Props {
  clients: Row[];
}

export function TopClientsTable({ clients }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top 10 ügyfél (összes költés alapján)</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Ügyfél</TableHead>
              <TableHead>Kód</TableHead>
              <TableHead className="text-right">Utak</TableHead>
              <TableHead className="text-right">Összes költés</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((c, i) => (
              <TableRow key={c.id}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell>
                  <span className="font-medium">
                    {c.last_name} {c.first_name}
                  </span>
                  {c.is_vip && (
                    <Badge variant="warning" className="ml-2 text-[10px]">VIP</Badge>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {c.client_code}
                </TableCell>
                <TableCell className="text-right">{c.trip_count}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(c.total_spent, "EUR")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
