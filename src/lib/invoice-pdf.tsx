/**
 * Austrian invoice template (Rechnung) — React-PDF
 *
 * Standards:
 * - §11 UStG mandatory fields
 * - European date format: DD.MM.YYYY
 * - European currency format: € 1.234,56
 * - All amounts in EUR
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { Invoice, Client, InvoiceItem } from "@/types";

// ─── Colour palette (matches Tailwind config) ─────────────────────────────────

const C = {
  blue:        "#2563EB",  // blue-600
  blueDark:    "#1E3A8A",  // blue-900
  blueLight:   "#EFF6FF",  // blue-50
  ink:         "#18181B",  // zinc-900
  muted:       "#52525B",  // zinc-600
  subtle:      "#71717A",  // zinc-500
  border:      "#E4E4E7",  // zinc-200
  surfaceAlt:  "#F4F4F5",  // zinc-100
  surfaceFaint:"#FAFAFA",  // zinc-50
  white:       "#FFFFFF",
};

// ─── Formatters ───────────────────────────────────────────────────────────────

/** Austrian EUR format: € 1.234,56 */
function fmt(n: number | null | undefined): string {
  if (n == null) return "€ 0,00";
  const sign = n < 0 ? "-" : "";
  const abs  = Math.abs(n);
  const [intPart = "0", decPart = "00"] = abs.toFixed(2).split(".");
  const thousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}€ ${thousands},${decPart}`;
}

/** Austrian date format: DD.MM.YYYY */
function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const parts = d.slice(0, 10).split("-");
  if (parts.length !== 3) return d;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.ink,
    paddingTop: 40,
    paddingBottom: 70,
    paddingLeft: 42,
    paddingRight: 42,
    lineHeight: 1.4,
  },

  // ── Header ──────────────────────────────────────────────────────────────────

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  companyBlock: {
    flex: 1,
    paddingRight: 20,
  },
  companyName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    color: C.ink,
    marginBottom: 5,
  },
  companyLine: {
    fontSize: 8.5,
    color: C.muted,
    marginBottom: 1.5,
  },
  companyUid: {
    fontSize: 8.5,
    color: C.ink,
    fontFamily: "Helvetica-Bold",
    marginTop: 5,
  },

  invoiceBlock: {
    alignItems: "flex-end",
    minWidth: 200,
  },
  rechnungLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 24,
    color: C.blue,
    letterSpacing: 3,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 3,
  },
  metaLabel: {
    fontSize: 8,
    color: C.subtle,
    width: 110,
    textAlign: "right",
    marginRight: 8,
  },
  metaValue: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
    width: 85,
    textAlign: "right",
  },

  // ── Divider ──────────────────────────────────────────────────────────────────

  dividerBlue: {
    height: 2,
    backgroundColor: C.blue,
    marginBottom: 20,
  },
  dividerThin: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 6,
  },

  // ── Recipient ────────────────────────────────────────────────────────────────

  recipientSection: {
    marginBottom: 22,
  },
  recipientLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.subtle,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  recipientName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10.5,
    color: C.ink,
    marginBottom: 2,
  },
  recipientLine: {
    fontSize: 9,
    color: C.muted,
    marginBottom: 1.5,
  },

  // ── Table ─────────────────────────────────────────────────────────────────────

  table: {
    marginBottom: 18,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: C.surfaceAlt,
    borderRadius: 3,
    paddingVertical: 5,
    marginBottom: 1,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceAlt,
    paddingVertical: 5,
    backgroundColor: C.white,
  },
  tableRowAlt: {
    backgroundColor: C.surfaceFaint,
  },

  colHeaderCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    color: C.subtle,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  colCell: {
    fontSize: 9,
    color: C.ink,
  },

  // Column widths (total content = 511pt)
  colPos:    { width: 26,  paddingLeft: 8 },
  colDesc:   { flex: 1,    paddingRight: 8 },
  colQty:    { width: 46,  textAlign: "right", paddingRight: 8 },
  colSingle: { width: 88,  textAlign: "right", paddingRight: 8 },
  colTotal:  { width: 88,  textAlign: "right", paddingRight: 10 },

  // ── Totals ────────────────────────────────────────────────────────────────────

  totalsSection: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 22,
  },
  totalsBox: {
    width: 240,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3.5,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  totalsLabel: {
    fontSize: 8.5,
    color: C.muted,
  },
  totalsValue: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: C.ink,
    textAlign: "right",
  },
  grandTotalBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: C.blueLight,
    borderWidth: 1.5,
    borderColor: C.blue,
    borderRadius: 3,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  grandTotalLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: C.blueDark,
  },
  grandTotalValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    color: C.blueDark,
  },

  // ── Notes ────────────────────────────────────────────────────────────────────

  notesBox: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 3,
    padding: 8,
    marginBottom: 16,
    backgroundColor: C.surfaceFaint,
  },
  notesLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    color: C.subtle,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 8.5,
    color: C.muted,
    lineHeight: 1.6,
  },

  // ── Payment info ──────────────────────────────────────────────────────────────

  paymentBox: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 3,
    padding: 12,
    marginBottom: 20,
  },
  paymentTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    color: C.ink,
    marginBottom: 8,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceAlt,
  },
  paymentInstruction: {
    fontSize: 8.5,
    color: C.muted,
    marginBottom: 8,
    lineHeight: 1.5,
  },
  bankGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 0,
  },
  bankRow: {
    flexDirection: "row",
    width: "50%",
    marginBottom: 4,
  },
  bankLabel: {
    fontSize: 8,
    color: C.subtle,
    width: 60,
  },
  bankValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: C.ink,
    flex: 1,
  },
  usageRow: {
    flexDirection: "row",
    marginTop: 4,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: C.surfaceAlt,
  },

  // ── Thank-you ─────────────────────────────────────────────────────────────────

  thankYou: {
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
    color: C.ink,
    marginBottom: 6,
    marginTop: 4,
  },

  // ── Footer (fixed) ────────────────────────────────────────────────────────────

  footer: {
    position: "absolute",
    bottom: 22,
    left: 42,
    right: 42,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 7,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  footerLeft: {
    fontSize: 7,
    color: C.subtle,
    flex: 1,
    paddingRight: 10,
  },
  footerRight: {
    fontSize: 7,
    color: C.subtle,
    textAlign: "right",
  },
  footerPage: {
    fontSize: 7,
    color: C.subtle,
    marginTop: 2,
  },
});

// ─── Helper sub-components ────────────────────────────────────────────────────

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={S.metaRow}>
      <Text style={S.metaLabel}>{label}</Text>
      <Text style={S.metaValue}>{value}</Text>
    </View>
  );
}

function TableHeader() {
  return (
    <View style={S.tableHeaderRow}>
      <Text style={[S.colHeaderCell, S.colPos]}>Pos.</Text>
      <Text style={[S.colHeaderCell, S.colDesc]}>Beschreibung</Text>
      <Text style={[S.colHeaderCell, S.colQty]}>Menge</Text>
      <Text style={[S.colHeaderCell, S.colSingle]}>Einzelpreis</Text>
      <Text style={[S.colHeaderCell, S.colTotal]}>Gesamtpreis</Text>
    </View>
  );
}

function TableItemRow({ item, index }: { item: InvoiceItem; index: number }) {
  const isAlt = index % 2 === 1;
  return (
    <View style={isAlt ? [S.tableRow, S.tableRowAlt] : S.tableRow}>
      <Text style={[S.colCell, S.colPos]}>{index + 1}</Text>
      <Text style={[S.colCell, S.colDesc]}>{item.description}</Text>
      <Text style={[S.colCell, S.colQty]}>
        {typeof item.quantity === "number" ? item.quantity.toLocaleString("de-AT") : item.quantity}
      </Text>
      <Text style={[S.colCell, S.colSingle]}>{fmt(item.unit_price)}</Text>
      <Text style={[S.colCell, S.colTotal]}>{fmt(item.total)}</Text>
    </View>
  );
}

function BankRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={S.bankRow}>
      <Text style={S.bankLabel}>{label}</Text>
      <Text style={S.bankValue}>{value || "—"}</Text>
    </View>
  );
}

// ─── Main PDF component ───────────────────────────────────────────────────────

export interface InvoicePDFProps {
  invoice: Invoice;
  client: Client;
  settings: Record<string, string>;
}

export function InvoicePDF({ invoice, client, settings }: InvoicePDFProps) {
  const companyName    = settings["agency_legal_name"] || settings["agency_name"] || "UtazóFotós – Tuza-Göncz Zsuzsanna";
  const street         = settings["agency_street"] || "";
  const zip            = settings["agency_zip"]    || "";
  const city           = settings["agency_city"]   || "";
  const country        = settings["agency_country"] || "Ausztria";
  const addressLine    = [street, [zip, city].filter(Boolean).join(" "), country].filter(Boolean).join(", ");
  const email          = settings["agency_email"]   || "";
  const phone          = settings["agency_phone"]   || "";
  const uid            = settings["uid_nummer"]     || settings["agency_tax_number"] || "";
  const iban           = settings["iban"]           || "";
  const bic            = settings["bic"]            || "";
  const bankName       = settings["bank_name"]      || "";
  const footerText     = settings["invoice_footer_text"] || "Vielen Dank für Ihr Vertrauen!";

  const items = (invoice.items ?? []) as InvoiceItem[];
  const subtotal   = invoice.subtotal   ?? items.reduce((s, i) => s + i.total, 0);
  const taxAmount  = invoice.tax_amount ?? subtotal * invoice.tax_rate / 100;
  const total      = invoice.total      ?? subtotal + taxAmount;
  const taxRate    = invoice.tax_rate;

  const taxLabel =
    taxRate === 20 ? "20% (Normalsatz)"      :
    taxRate === 13 ? "13% (Ermäßigt)"        :
    taxRate === 0  ? "0% (Steuerfrei)"       :
                     `${taxRate}%`;

  const clientAddressLine = [
    client.address_street,
    [client.address_zip, client.address_city].filter(Boolean).join(" "),
    client.address_country,
  ].filter(Boolean);

  const footerCompanyLine =
    [companyName, addressLine, uid ? `UID: ${uid}` : null, email, phone]
      .filter(Boolean)
      .join(" · ");

  return (
    <Document
      title={`Rechnung ${invoice.invoice_number}`}
      author={companyName}
      creator="ZsuzsiCRM"
    >
      <Page size="A4" style={S.page}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={S.header}>
          {/* Company block */}
          <View style={S.companyBlock}>
            <Text style={S.companyName}>{companyName}</Text>
            {addressLine ? <Text style={S.companyLine}>{addressLine}</Text> : null}
            {email  ? <Text style={S.companyLine}>{email}</Text>  : null}
            {phone  ? <Text style={S.companyLine}>{phone}</Text>  : null}
            {uid    ? <Text style={S.companyUid}>UID-Nr.: {uid}</Text> : null}
          </View>

          {/* Invoice identity block */}
          <View style={S.invoiceBlock}>
            <Text style={S.rechnungLabel}>RECHNUNG</Text>
            <MetaRow label="Rechnungsnummer:" value={invoice.invoice_number} />
            <MetaRow label="Rechnungsdatum:"  value={fmtDate(invoice.issue_date)} />
            {invoice.service_date && (
              <MetaRow label="Lieferdatum:" value={fmtDate(invoice.service_date)} />
            )}
            {invoice.due_date && (
              <MetaRow label="Zahlungsziel:" value={fmtDate(invoice.due_date)} />
            )}
          </View>
        </View>

        {/* ── Blue divider ─────────────────────────────────────────────────── */}
        <View style={S.dividerBlue} />

        {/* ── Recipient ────────────────────────────────────────────────────── */}
        <View style={S.recipientSection}>
          <Text style={S.recipientLabel}>Rechnungsempfänger:</Text>
          <Text style={S.recipientName}>
            {client.last_name} {client.first_name}
          </Text>
          {clientAddressLine.map((line, i) => (
            <Text key={i} style={S.recipientLine}>{line}</Text>
          ))}
        </View>

        {/* ── Line items table ─────────────────────────────────────────────── */}
        <View style={S.table}>
          <TableHeader />
          {items.map((item, i) => (
            <TableItemRow key={i} item={item} index={i} />
          ))}
        </View>

        {/* ── Totals ───────────────────────────────────────────────────────── */}
        <View style={S.totalsSection}>
          <View style={S.totalsBox}>
            <View style={S.totalsRow}>
              <Text style={S.totalsLabel}>Nettobetrag:</Text>
              <Text style={S.totalsValue}>{fmt(subtotal)}</Text>
            </View>
            <View style={S.totalsRow}>
              <Text style={S.totalsLabel}>MwSt. {taxLabel}:</Text>
              <Text style={S.totalsValue}>{fmt(taxAmount)}</Text>
            </View>
            {taxRate === 0 && (
              <View style={[S.totalsRow, { borderBottomWidth: 0 }]}>
                <Text style={[S.totalsLabel, { fontSize: 7.5, fontStyle: "italic" }]}>
                  Steuerfreie Leistung gemäß §6 UStG
                </Text>
              </View>
            )}
            {/* Grand total box */}
            <View style={S.grandTotalBox}>
              <Text style={S.grandTotalLabel}>Gesamtbetrag:</Text>
              <Text style={S.grandTotalValue}>{fmt(total)}</Text>
            </View>
          </View>
        </View>

        {/* ── Notes / Zahlungshinweis ───────────────────────────────────────── */}
        {invoice.notes ? (
          <View style={S.notesBox}>
            <Text style={S.notesLabel}>Zahlungshinweis / Megjegyzés</Text>
            <Text style={S.notesText}>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* ── Payment information ───────────────────────────────────────────── */}
        <View style={S.paymentBox}>
          <Text style={S.paymentTitle}>Zahlungsinformationen</Text>
          {invoice.due_date ? (
            <Text style={S.paymentInstruction}>
              Bitte überweisen Sie den Gesamtbetrag von {fmt(total)} bis zum{" "}
              {fmtDate(invoice.due_date)} auf folgendes Konto:
            </Text>
          ) : (
            <Text style={S.paymentInstruction}>
              Bitte überweisen Sie den Gesamtbetrag von {fmt(total)} auf folgendes Konto:
            </Text>
          )}

          <View style={S.bankGrid}>
            {bankName ? <BankRow label="Bank:" value={bankName} /> : null}
            <BankRow label="IBAN:" value={iban} />
            <BankRow label="BIC:" value={bic} />
          </View>

          <View style={S.usageRow}>
            <Text style={S.bankLabel}>Verwendungszweck:</Text>
            <Text style={[S.bankValue, { fontFamily: "Helvetica-Bold" }]}>
              {invoice.invoice_number}
            </Text>
          </View>
        </View>

        {/* ── Thank you ────────────────────────────────────────────────────── */}
        <Text style={S.thankYou}>{footerText}</Text>

        {/* ── Footer (fixed, repeats on all pages) ─────────────────────────── */}
        <View style={S.footer} fixed>
          <Text style={S.footerLeft}>{footerCompanyLine}</Text>
          <Text
            style={S.footerRight}
            render={({ pageNumber, totalPages }) =>
              `Seite ${pageNumber} von ${totalPages}`
            }
          />
        </View>

      </Page>
    </Document>
  );
}
