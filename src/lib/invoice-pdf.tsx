/**
 * Invoice PDF — botanical / elegant style  (React-PDF)
 *
 * Props:
 *   language : "hu" | "de" | "bilingual"   (default "hu")
 *   currency : "EUR" | "HUF"               (default "EUR")
 *
 * Design: warm beige palette, botanical leaf decorations,
 * matches the style used by UtazóFotós / Tuza-Göncz Zsuzsanna.
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Path,
} from "@react-pdf/renderer";
import type { Invoice, Client, InvoiceItem } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type InvoiceLanguage = "hu" | "de" | "bilingual";
export type InvoiceCurrency = "EUR" | "HUF";

// ─── Colour palette ───────────────────────────────────────────────────────────

const C = {
  white:       "#FFFFFF",
  beige:       "#F6F1EB",   // warm beige section backgrounds
  beigeAlt:    "#EDE5D8",   // table header row
  taupe:       "#BEA98E",   // TOTAL row highlight
  taupeDeep:   "#A08060",   // TOTAL row border accent
  brown:       "#3D3529",   // primary text
  brownMid:    "#7A6E5F",   // secondary text
  brownLight:  "#B0A494",   // subtle / placeholder text
  border:      "#D9CFBF",   // dividers / borders
  borderLight: "#EDE8E0",   // thin separators
};

// ─── Labels ───────────────────────────────────────────────────────────────────

interface LabelSet {
  title:        string;
  client:       string;
  date:         string;
  invNum:       string;
  dueDate:      string;
  serviceDate:  string;
  colItem:      string;
  colQty:       string;
  colUnit:      string;
  colValue:     string;
  netTotal:     string;
  tax:          string;
  total:        string;
  beneficiary:  string;
  bankAcct:     string;
  iban:         string;
  bic:          string;
  payRef:       string;
  notes:        string;
  thanks:       string;
  page:         (n: number, t: number) => string;
}

const HU: LabelSet = {
  title:       "Számla részletező",
  client:      "Megrendelő:",
  date:        "Dátum:",
  invNum:      "Számlaszám:",
  dueDate:     "Fizetési határidő:",
  serviceDate: "Teljesítés dátuma:",
  colItem:     "TÉTEL",
  colQty:      "MENNYISÉG",
  colUnit:     "EGYSÉGÁR",
  colValue:    "ÉRTÉK",
  netTotal:    "Nettó összeg:",
  tax:         "ÁFA",
  total:       "TOTAL",
  beneficiary: "KEDVEZMÉNYEZETT",
  bankAcct:    "Bankszámlaszám:",
  iban:        "IBAN:",
  bic:         "BIC/SWIFT:",
  payRef:      "Közlemény:",
  notes:       "Megjegyzés",
  thanks:      "Köszönjük a bizalmat!",
  page:        (n, t) => `${n}. oldal / ${t}`,
};

const DE: LabelSet = {
  title:       "Rechnungsaufstellung",
  client:      "Auftraggeber:",
  date:        "Datum:",
  invNum:      "Rechnungsnummer:",
  dueDate:     "Zahlungsziel:",
  serviceDate: "Leistungsdatum:",
  colItem:     "POSITION",
  colQty:      "MENGE",
  colUnit:     "EINZELPREIS",
  colValue:    "BETRAG",
  netTotal:    "Nettobetrag:",
  tax:         "MwSt.",
  total:       "GESAMT",
  beneficiary: "EMPFÄNGER",
  bankAcct:    "Bankkontonummer:",
  iban:        "IBAN:",
  bic:         "BIC/SWIFT:",
  payRef:      "Verwendungszweck:",
  notes:       "Hinweis",
  thanks:      "Vielen Dank für Ihr Vertrauen!",
  page:        (n, t) => `Seite ${n} von ${t}`,
};

function label(key: keyof Omit<LabelSet, "page">, lang: InvoiceLanguage): string {
  if (lang === "bilingual") return `${HU[key]} / ${DE[key]}`;
  return lang === "de" ? DE[key] : HU[key];
}

function titleLabel(lang: InvoiceLanguage): string {
  if (lang === "bilingual") return `${HU.title}  ·  ${DE.title}`;
  return lang === "de" ? DE.title : HU.title;
}

function pageLabel(n: number, t: number, lang: InvoiceLanguage): string {
  if (lang === "bilingual") return `${HU.page(n, t)}  ·  ${DE.page(n, t)}`;
  return lang === "de" ? DE.page(n, t) : HU.page(n, t);
}

function thanksLabel(lang: InvoiceLanguage): string {
  if (lang === "bilingual") return `${HU.thanks}  ·  ${DE.thanks}`;
  return lang === "de" ? DE.thanks : HU.thanks;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const parts = d.slice(0, 10).split("-");
  if (parts.length !== 3) return d;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function fmtMoney(n: number | null | undefined, currency: InvoiceCurrency): string {
  if (n == null) return currency === "HUF" ? "0 Ft" : "€ 0,00";
  if (currency === "HUF") {
    const rounded = Math.round(n);
    const parts = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
    return (n < 0 ? "-" : "") + parts + " Ft";
  }
  // EUR
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const [int = "0", dec = "00"] = abs.toFixed(2).split(".");
  const thousands = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}€ ${thousands},${dec}`;
}

// ─── SVG decorations (botanical leaf clusters) ────────────────────────────────

/** Top-right corner: elegant leaf branch curving from top-right inward */
function LeafTopRight() {
  return (
    <Svg
      viewBox="0 0 72 80"
      style={{ position: "absolute", top: 0, right: 0, width: 72, height: 80, opacity: 0.75 }}
    >
      {/* main stem */}
      <Path
        d="M 68 4 C 58 12 42 28 28 44 C 18 54 10 64 6 74"
        stroke={C.brownLight}
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
      />
      {/* leaf 1 – upper tip */}
      <Path
        d="M 68 4 C 62 0 54 2 52 10 C 58 10 66 8 68 4 Z"
        stroke={C.brownLight}
        strokeWidth="0.9"
        fill="none"
      />
      {/* leaf 2 */}
      <Path
        d="M 52 18 C 58 12 66 14 66 22 C 60 22 54 20 52 18 Z"
        stroke={C.brownLight}
        strokeWidth="0.9"
        fill="none"
      />
      {/* leaf 3 */}
      <Path
        d="M 38 32 C 44 26 52 28 52 36 C 46 36 40 34 38 32 Z"
        stroke={C.brownLight}
        strokeWidth="0.9"
        fill="none"
      />
      {/* leaf 4 */}
      <Path
        d="M 25 46 C 30 40 38 42 38 50 C 32 50 27 48 25 46 Z"
        stroke={C.brownLight}
        strokeWidth="0.9"
        fill="none"
      />
      {/* leaf 5 – lower */}
      <Path
        d="M 12 60 C 16 54 24 56 24 64 C 18 64 13 62 12 60 Z"
        stroke={C.brownLight}
        strokeWidth="0.9"
        fill="none"
      />
    </Svg>
  );
}

/** Bottom-left corner: mirrored, larger leaf cluster */
function LeafBottomLeft() {
  return (
    <Svg
      viewBox="0 0 90 100"
      style={{ position: "absolute", bottom: 0, left: 0, width: 90, height: 100, opacity: 0.75 }}
    >
      {/* main stem */}
      <Path
        d="M 8 96 C 18 84 34 68 50 52 C 62 40 72 28 80 12"
        stroke={C.brownLight}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* leaf 1 – lower */}
      <Path
        d="M 8 96 C 2 88 4 78 12 76 C 14 84 12 92 8 96 Z"
        stroke={C.brownLight}
        strokeWidth="1"
        fill="none"
      />
      {/* leaf 2 */}
      <Path
        d="M 22 82 C 14 76 16 66 24 64 C 26 72 26 80 22 82 Z"
        stroke={C.brownLight}
        strokeWidth="1"
        fill="none"
      />
      {/* leaf 3 */}
      <Path
        d="M 38 68 C 30 62 30 52 38 50 C 42 58 42 66 38 68 Z"
        stroke={C.brownLight}
        strokeWidth="1"
        fill="none"
      />
      {/* leaf 4 */}
      <Path
        d="M 54 52 C 46 46 46 36 54 34 C 58 42 58 50 54 52 Z"
        stroke={C.brownLight}
        strokeWidth="1"
        fill="none"
      />
      {/* leaf 5 */}
      <Path
        d="M 68 36 C 60 30 62 20 70 18 C 74 26 74 34 68 36 Z"
        stroke={C.brownLight}
        strokeWidth="1"
        fill="none"
      />
      {/* small side leaf */}
      <Path
        d="M 80 12 C 74 6 76 -2 84 -2 C 88 6 86 12 80 12 Z"
        stroke={C.brownLight}
        strokeWidth="0.9"
        fill="none"
      />
    </Svg>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.brown,
    backgroundColor: C.white,
    paddingTop: 38,
    paddingBottom: 65,
    paddingLeft: 44,
    paddingRight: 44,
    lineHeight: 1.45,
  },

  // ── Title area ──────────────────────────────────────────────────────────────
  titleArea: {
    marginBottom: 6,
    paddingRight: 80, // leave room for leaf SVG
  },
  titleText: {
    fontFamily: "Helvetica",
    fontSize: 28,
    color: "#B0A494",
    letterSpacing: -0.5,
    marginBottom: 2,
  },

  // ── Divider ─────────────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginBottom: 16,
    marginTop: 6,
  },

  // ── Client + meta block ──────────────────────────────────────────────────────
  clientMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  clientBlock: {
    flex: 1,
    paddingRight: 24,
  },
  clientLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: C.brownLight,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  clientName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: C.brown,
    marginBottom: 2,
  },
  clientLine: {
    fontSize: 9,
    color: C.brownMid,
    marginBottom: 1.5,
  },
  metaBlock: {
    alignItems: "flex-end",
    minWidth: 170,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 3,
  },
  metaLabel: {
    fontSize: 8,
    color: C.brownLight,
    textAlign: "right",
    marginRight: 8,
    width: 100,
  },
  metaValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    color: C.brown,
    width: 80,
    textAlign: "right",
  },

  // ── Table ────────────────────────────────────────────────────────────────────
  table: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: C.beigeAlt,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
  },
  tableRowAlt: {
    backgroundColor: C.beige,
  },
  colHead: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    color: C.brownMid,
    letterSpacing: 0.4,
  },
  colCell: {
    fontSize: 9,
    color: C.brown,
  },
  // Column widths
  cDesc:  { flex: 1, paddingRight: 8 },
  cQty:   { width: 58,  textAlign: "right", paddingRight: 8 },
  cUnit:  { width: 78,  textAlign: "right", paddingRight: 8 },
  cVal:   { width: 78,  textAlign: "right" },

  // ── Totals ───────────────────────────────────────────────────────────────────
  totalsSection: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 20,
  },
  totalsBox: {
    width: 250,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 2,
    overflow: "hidden",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  totalsLabel: {
    fontSize: 8.5,
    color: C.brownMid,
  },
  totalsValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    color: C.brown,
  },
  totalFinalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: C.taupe,
  },
  totalFinalLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: C.white,
    letterSpacing: 0.5,
  },
  totalFinalValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    color: C.white,
  },

  // ── Notes ────────────────────────────────────────────────────────────────────
  notesBox: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 2,
    padding: 10,
    marginBottom: 18,
    backgroundColor: C.beige,
  },
  notesLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    color: C.brownMid,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 8.5,
    color: C.brownMid,
    lineHeight: 1.6,
  },

  // ── Beneficiary / payment section ─────────────────────────────────────────────
  beneSection: {
    backgroundColor: C.beige,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 2,
    padding: 14,
    marginBottom: 16,
  },
  beneTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: C.brownMid,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingBottom: 4,
  },
  beneName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: C.brown,
    marginBottom: 4,
  },
  beneGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  beneRow: {
    flexDirection: "row",
    width: "50%",
    marginBottom: 3,
  },
  beneLabel: {
    fontSize: 8,
    color: C.brownLight,
    width: 70,
  },
  beneValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: C.brown,
    flex: 1,
  },
  payRefRow: {
    flexDirection: "row",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
  },

  // ── Contact footer ────────────────────────────────────────────────────────────
  contactBar: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  contactText: {
    fontSize: 8,
    color: C.brownMid,
    textAlign: "center",
  },

  // ── Fixed page footer ──────────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 18,
    left: 44,
    right: 44,
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
    paddingTop: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerText: {
    fontSize: 7,
    color: C.brownLight,
  },
});

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetaRow({ lbl, val }: { lbl: string; val: string }) {
  return (
    <View style={S.metaRow}>
      <Text style={S.metaLabel}>{lbl}</Text>
      <Text style={S.metaValue}>{val}</Text>
    </View>
  );
}

function TableHeaderRow({ lang }: { lang: InvoiceLanguage }) {
  return (
    <View style={S.tableHeaderRow}>
      <Text style={[S.colHead, S.cDesc]}>{label("colItem", lang)}</Text>
      <Text style={[S.colHead, S.cQty]}>{label("colQty", lang)}</Text>
      <Text style={[S.colHead, S.cUnit]}>{label("colUnit", lang)}</Text>
      <Text style={[S.colHead, S.cVal]}>{label("colValue", lang)}</Text>
    </View>
  );
}

function TableItemRow({
  item,
  index,
  currency,
}: {
  item: InvoiceItem;
  index: number;
  currency: InvoiceCurrency;
}) {
  const alt = index % 2 === 1;
  return (
    <View style={[S.tableRow, alt ? S.tableRowAlt : {}]}>
      <Text style={[S.colCell, S.cDesc]}>{item.description}</Text>
      <Text style={[S.colCell, S.cQty]}>
        {typeof item.quantity === "number"
          ? item.quantity % 1 === 0
            ? String(item.quantity)
            : item.quantity.toFixed(2)
          : item.quantity}
      </Text>
      <Text style={[S.colCell, S.cUnit]}>{fmtMoney(item.unit_price, currency)}</Text>
      <Text style={[S.colCell, S.cVal]}>{fmtMoney(item.total, currency)}</Text>
    </View>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface InvoicePDFProps {
  invoice:  Invoice;
  client:   Client;
  settings: Record<string, string>;
  language?: InvoiceLanguage;
  currency?: InvoiceCurrency;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InvoicePDF({
  invoice,
  client,
  settings,
  language = "hu",
  currency = "EUR",
}: InvoicePDFProps) {
  const companyName = settings["agency_legal_name"] || settings["agency_name"] || "Tuza-Göncz Zsuzsanna, Utazó fotós";
  const street      = settings["agency_street"]  || "";
  const zip         = settings["agency_zip"]     || "";
  const city        = settings["agency_city"]    || "";
  const country     = settings["agency_country"] || "";
  const email       = settings["agency_email"]   || "";
  const phone       = settings["agency_phone"]   || "";
  const iban        = settings["iban"]           || "";
  const bic         = settings["bic"]            || "";
  const bankName    = settings["bank_name"]      || "";
  const bankAcctNo  = settings["bank_account_number"] || "";

  const items     = (invoice.items ?? []) as InvoiceItem[];
  const subtotal  = invoice.subtotal  ?? items.reduce((s, i) => s + i.total, 0);
  const taxAmount = invoice.tax_amount ?? subtotal * invoice.tax_rate / 100;
  const total     = invoice.total     ?? subtotal + taxAmount;
  const taxRate   = invoice.tax_rate ?? 0;
  const showTax   = taxRate > 0;

  const clientAddress = [
    client.address_street,
    [client.address_zip, client.address_city].filter(Boolean).join(" "),
    client.address_country,
  ].filter(Boolean);

  // Contact bar: phone · email
  const contactParts = [phone, email].filter(Boolean);
  const contactLine  = contactParts.join("  ·  ");

  // Tax label
  const taxLabel = language === "bilingual"
    ? `${taxRate}% ÁFA / MwSt.`
    : language === "de"
      ? `${taxRate}% MwSt.`
      : `${taxRate}% ÁFA`;

  return (
    <Document
      title={`${titleLabel(language)} ${invoice.invoice_number}`}
      author={companyName}
      creator="ZsuzsiCRM"
    >
      <Page size="A4" style={S.page}>

        {/* ── Leaf decoration — top right ─────────────────────────────────── */}
        <LeafTopRight />

        {/* ── Title ───────────────────────────────────────────────────────── */}
        <View style={S.titleArea}>
          <Text style={S.titleText}>{titleLabel(language)}</Text>
        </View>

        {/* ── Divider ─────────────────────────────────────────────────────── */}
        <View style={S.divider} />

        {/* ── Client + meta block ─────────────────────────────────────────── */}
        <View style={S.clientMetaRow}>
          <View style={S.clientBlock}>
            <Text style={S.clientLabel}>{label("client", language)}</Text>
            <Text style={S.clientName}>{client.last_name} {client.first_name}</Text>
            {clientAddress.map((line, i) => (
              <Text key={i} style={S.clientLine}>{line}</Text>
            ))}
            {client.phone && <Text style={S.clientLine}>{client.phone}</Text>}
            {client.email && <Text style={S.clientLine}>{client.email}</Text>}
          </View>

          <View style={S.metaBlock}>
            <MetaRow lbl={label("date",   language)} val={fmtDate(invoice.issue_date)} />
            <MetaRow lbl={label("invNum", language)} val={invoice.invoice_number}      />
            {invoice.service_date && (
              <MetaRow lbl={label("serviceDate", language)} val={fmtDate(invoice.service_date)} />
            )}
            {invoice.due_date && (
              <MetaRow lbl={label("dueDate", language)} val={fmtDate(invoice.due_date)} />
            )}
          </View>
        </View>

        {/* ── Line-items table ────────────────────────────────────────────── */}
        <View style={S.table}>
          <TableHeaderRow lang={language} />
          {items.map((item, i) => (
            <TableItemRow key={i} item={item} index={i} currency={currency} />
          ))}
        </View>

        {/* ── Totals ──────────────────────────────────────────────────────── */}
        <View style={S.totalsSection}>
          <View style={S.totalsBox}>
            {showTax && (
              <>
                <View style={S.totalsRow}>
                  <Text style={S.totalsLabel}>{label("netTotal", language)}</Text>
                  <Text style={S.totalsValue}>{fmtMoney(subtotal, currency)}</Text>
                </View>
                <View style={S.totalsRow}>
                  <Text style={S.totalsLabel}>{taxLabel}:</Text>
                  <Text style={S.totalsValue}>{fmtMoney(taxAmount, currency)}</Text>
                </View>
              </>
            )}
            <View style={S.totalFinalRow}>
              <Text style={S.totalFinalLabel}>{label("total", language)}</Text>
              <Text style={S.totalFinalValue}>{fmtMoney(total, currency)}</Text>
            </View>
          </View>
        </View>

        {/* ── Notes ───────────────────────────────────────────────────────── */}
        {invoice.notes ? (
          <View style={S.notesBox}>
            <Text style={S.notesLabel}>{label("notes", language)}</Text>
            <Text style={S.notesText}>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* ── Beneficiary / payment section ───────────────────────────────── */}
        <View style={S.beneSection}>
          <Text style={S.beneTitle}>{label("beneficiary", language)}</Text>
          <Text style={S.beneName}>{companyName}</Text>
          <View style={S.beneGrid}>
            {(bankAcctNo || bankName) ? (
              <View style={S.beneRow}>
                <Text style={S.beneLabel}>{label("bankAcct", language)}</Text>
                <Text style={S.beneValue}>{bankAcctNo || bankName}</Text>
              </View>
            ) : null}
            {iban ? (
              <View style={S.beneRow}>
                <Text style={S.beneLabel}>{label("iban", language)}</Text>
                <Text style={S.beneValue}>{iban}</Text>
              </View>
            ) : null}
            {bic ? (
              <View style={S.beneRow}>
                <Text style={S.beneLabel}>{label("bic", language)}</Text>
                <Text style={S.beneValue}>{bic}</Text>
              </View>
            ) : null}
          </View>
          <View style={S.payRefRow}>
            <Text style={S.beneLabel}>{label("payRef", language)}</Text>
            <Text style={[S.beneValue, { fontFamily: "Helvetica-Bold" }]}>
              {invoice.invoice_number}
            </Text>
          </View>
        </View>

        {/* ── Contact bar ─────────────────────────────────────────────────── */}
        {contactLine ? (
          <View style={S.contactBar}>
            <Text style={S.contactText}>{contactLine}</Text>
          </View>
        ) : null}

        {/* ── Leaf decoration — bottom left ───────────────────────────────── */}
        <LeafBottomLeft />

        {/* ── Fixed footer ────────────────────────────────────────────────── */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>{companyName}</Text>
          <Text
            style={S.footerText}
            render={({ pageNumber, totalPages }) =>
              pageLabel(pageNumber, totalPages, language)
            }
          />
        </View>

      </Page>
    </Document>
  );
}
