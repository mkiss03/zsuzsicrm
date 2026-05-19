import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InvoiceStatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Invoice, Client } from "@/types";

type Row = Invoice & {
  client: Pick<Client, "id" | "first_name" | "last_name" | "client_code"> | null;
};

interface Props {
  invoices: Row[];
  count: number;
  page: number;
  pageSize: number;
}

export function InvoicesTable({ invoices, count }: Props) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Számlaszám</TableHead>
              <TableHead>Ügyfél</TableHead>
              <TableHead>Állapot</TableHead>
              <TableHead>Kiállítva</TableHead>
              <TableHead>Határidő</TableHead>
              <TableHead className="text-right">Összeg</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Nincs számla
                </TableCell>
              </TableRow>
            )}
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-mono text-sm">
                  {inv.invoice_number}
                </TableCell>
                <TableCell>
                  {inv.client ? (
                    <Link href={`/clients/${inv.client.id}`} className="font-medium hover:underline">
                      {inv.client.last_name} {inv.client.first_name}
                    </Link>
                  ) : "—"}
                </TableCell>
                <TableCell><InvoiceStatusBadge status={inv.status} /></TableCell>
                <TableCell>{formatDate(inv.issue_date)}</TableCell>
                <TableCell>
                  {inv.due_date ? formatDate(inv.due_date) : "—"}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(inv.total)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          {count} számla összesen
        </div>
      </CardContent>
    </Card>
  );
}
