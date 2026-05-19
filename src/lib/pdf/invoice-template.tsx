"use client";

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import type { Invoice, Client } from "@/types";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 40,
    color: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  agencyName: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  agencyMeta: { fontSize: 9, color: "#666", marginTop: 4 },
  invoiceTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", textAlign: "right" },
  invoiceMeta: { fontSize: 9, color: "#666", textAlign: "right", marginTop: 4 },
  section: { marginBottom: 16 },
  label: { fontSize: 8, color: "#999", marginBottom: 2 },
  value: { fontSize: 10 },
  table: { marginTop: 16 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    padding: "6 8",
    borderRadius: 3,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    padding: "5 8",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  col_desc: { flex: 4 },
  col_qty: { flex: 1, textAlign: "right" },
  col_price: { flex: 2, textAlign: "right" },
  col_total: { flex: 2, textAlign: "right" },
  totals: { marginTop: 16, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 4 },
  totalLabel: { width: 120, textAlign: "right", color: "#555" },
  totalValue: { width: 100, textAlign: "right" },
  grandTotalLabel: {
    width: 120,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
  },
  grandTotalValue: {
    width: 100,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
    fontSize: 8,
    color: "#999",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

interface InvoicePDFProps {
  invoice: Invoice;
  client: Client;
  agencyName?: string;
  agencyAddress?: string;
  agencyTaxNumber?: string;
}

export function InvoicePDF({
  invoice,
  client,
  agencyName = "ZsuzsiTravel",
  agencyAddress = "",
  agencyTaxNumber = "",
}: InvoicePDFProps) {
  const fmt = (n: number | null | undefined) =>
    n != null
      ? new Intl.NumberFormat("hu-HU", {
          style: "currency",
          currency: "HUF",
          maximumFractionDigits: 0,
        }).format(n)
      : "—";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.agencyName}>{agencyName}</Text>
            {agencyAddress ? (
              <Text style={styles.agencyMeta}>{agencyAddress}</Text>
            ) : null}
            {agencyTaxNumber ? (
              <Text style={styles.agencyMeta}>Adószám: {agencyTaxNumber}</Text>
            ) : null}
          </View>
          <View>
            <Text style={styles.invoiceTitle}>SZÁMLA</Text>
            <Text style={styles.invoiceMeta}>
              Számlaszám: {invoice.invoice_number}
            </Text>
            <Text style={styles.invoiceMeta}>
              Kiállítás dátuma: {invoice.issue_date}
            </Text>
            {invoice.due_date ? (
              <Text style={styles.invoiceMeta}>
                Fizetési határidő: {invoice.due_date}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Client info */}
        <View style={styles.section}>
          <Text style={styles.label}>VEVŐ</Text>
          <Text style={styles.value}>
            {client.last_name} {client.first_name}
          </Text>
          {client.address_street ? (
            <Text style={styles.value}>
              {client.address_zip} {client.address_city},{" "}
              {client.address_street}
            </Text>
          ) : null}
          {client.email ? (
            <Text style={styles.value}>{client.email}</Text>
          ) : null}
        </View>

        {/* Line items */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.col_desc, { fontFamily: "Helvetica-Bold" }]}>
              Megnevezés
            </Text>
            <Text style={[styles.col_qty, { fontFamily: "Helvetica-Bold" }]}>
              Menny.
            </Text>
            <Text style={[styles.col_price, { fontFamily: "Helvetica-Bold" }]}>
              Egységár
            </Text>
            <Text style={[styles.col_total, { fontFamily: "Helvetica-Bold" }]}>
              Összesen
            </Text>
          </View>
          {invoice.items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.col_desc}>{item.description}</Text>
              <Text style={styles.col_qty}>{item.quantity}</Text>
              <Text style={styles.col_price}>{fmt(item.unit_price)}</Text>
              <Text style={styles.col_total}>{fmt(item.total)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Nettó összeg:</Text>
            <Text style={styles.totalValue}>{fmt(invoice.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>ÁFA ({invoice.tax_rate}%):</Text>
            <Text style={styles.totalValue}>{fmt(invoice.tax_amount)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.grandTotalLabel}>Fizetendő összesen:</Text>
            <Text style={styles.grandTotalValue}>{fmt(invoice.total)}</Text>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes ? (
          <View style={[styles.section, { marginTop: 24 }]}>
            <Text style={styles.label}>MEGJEGYZÉS</Text>
            <Text style={styles.value}>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>{agencyName}</Text>
          <Text>Számlaszám: {invoice.invoice_number}</Text>
          <Text render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}. oldal`
          } />
        </View>
      </Page>
    </Document>
  );
}
