import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Client } from "@/types";

interface Props {
  clients: Client[];
  count: number;
  page: number;
  pageSize: number;
}

const sourceLabels: Record<string, string> = {
  messenger: "Messenger",
  website_form: "Weboldal",
  referral: "Ajánlás",
  other: "Egyéb",
};

export function ClientsTable({ clients, count }: Props) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kód</TableHead>
              <TableHead>Név</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefon</TableHead>
              <TableHead>Forrás</TableHead>
              <TableHead className="text-right">Utak</TableHead>
              <TableHead className="text-right">Összes költ.</TableHead>
              <TableHead>Regisztrálva</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Nincs ügyfél
                </TableCell>
              </TableRow>
            )}
            {clients.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {c.client_code}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/clients/${c.id}`}
                    className="font-medium hover:underline"
                  >
                    {c.last_name} {c.first_name}
                  </Link>
                  {c.is_vip && (
                    <Badge variant="warning" className="ml-2 text-[10px]">VIP</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm">{c.email ?? "—"}</TableCell>
                <TableCell className="text-sm">{c.phone ?? "—"}</TableCell>
                <TableCell>
                  {c.source ? (
                    <Badge variant="outline">{sourceLabels[c.source] ?? c.source}</Badge>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-right">{c.trip_count}</TableCell>
                <TableCell className="text-right">{formatCurrency(c.total_spent, "EUR")}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(c.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          {count} ügyfél összesen
        </div>
      </CardContent>
    </Card>
  );
}
