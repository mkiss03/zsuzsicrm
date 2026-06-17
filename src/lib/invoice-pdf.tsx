/**
 * Invoice PDF - botanical / elegant style  (React-PDF)
 *
 * Always bilingual (DE + HU) and always shows BOTH EUR and HUF columns.
 * Amounts are stored in EUR; HUF is computed as EUR x eurHufRate.
 * The "Eloeleg / Anzahlung" item (is_advance=true) is shown separately
 * after the total and is NOT included in the invoice total.
 */

import React from "react";
import {
  Document,
  Font,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Path,
} from "@react-pdf/renderer";

Font.register({
  family: "Lato",
  fonts: [
    { src: (typeof window !== "undefined" ? window.location.origin : "") + "/fonts/Lato-Regular.ttf", fontWeight: 400 },
    { src: (typeof window !== "undefined" ? window.location.origin : "") + "/fonts/Lato-Bold.ttf",    fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

import type { Invoice, Client, InvoiceItem } from "@/types";

export type InvoiceLanguage = "hu" | "de" | "bilingual";
export type InvoiceCurrency = "EUR" | "HUF";

const C = {
  white:       "#FFFFFF",
  beige:       "#F6F1EB",
  beigeAlt:    "#EDE5D8",
  taupe:       "#BEA98E",
  brown:       "#3D3529",
  brownMid:    "#7A6E5F",
  brownLight:  "#B0A494",
  border:      "#D9CFBF",
  borderLight: "#EDE8E0",
};

function fmtDate(d: string | null | undefined): string {
  if (!d) return "-";
  const parts = d.slice(0, 10).split("-");
  if (parts.length !== 3) return d;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function fmtEur(n: number | null | undefined): string {
  if (n == null) return "\u20ac 0,00";
  const sign = n < 0 ? "\u2212" : "";
  const [int = "0", dec = "00"] = Math.abs(n).toFixed(2).split(".");
  return `${sign}\u20ac ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
}

function fmtHuf(n: number | null | undefined): string {
  if (n == null) return "0 Ft";
  const sign = n < 0 ? "-" : "";
  const parts = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  return `${sign}${parts} Ft`;
}

function LeafTopRight() {
  return (
    <Svg viewBox="0 0 100 115" style={{ position: "absolute", top: 0, right: 0, width: 90, height: 105, opacity: 0.75 }}>
      <Path d="M 94 5 C 80 16 60 36 40 58 C 26 72 14 86 8 100" stroke={C.taupe} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <Path d="M 94 5 C 86 -1 74 2 72 13 C 80 13 90 10 94 5 Z" stroke={C.taupe} strokeWidth="1" fill={C.beigeAlt} />
      <Path d="M 94 5 C 88 7 78 10 72 13" stroke={C.brownLight} strokeWidth="0.5" fill="none" />
      <Path d="M 72 22 C 80 14 92 17 92 28 C 84 28 74 26 72 22 Z" stroke={C.taupe} strokeWidth="1" fill={C.beigeAlt} />
      <Path d="M 72 22 C 78 23 86 25 92 28" stroke={C.brownLight} strokeWidth="0.5" fill="none" />
      <Path d="M 52 40 C 60 32 72 35 72 46 C 64 46 54 44 52 40 Z" stroke={C.taupe} strokeWidth="1" fill={C.beigeAlt} />
      <Path d="M 52 40 C 58 42 66 44 72 46" stroke={C.brownLight} strokeWidth="0.5" fill="none" />
      <Path d="M 34 58 C 42 50 54 53 54 64 C 46 64 36 62 34 58 Z" stroke={C.taupe} strokeWidth="1" fill={C.beigeAlt} />
      <Path d="M 34 58 C 40 60 48 62 54 64" stroke={C.brownLight} strokeWidth="0.5" fill="none" />
      <Path d="M 16 76 C 22 68 34 71 34 82 C 26 82 18 80 16 76 Z" stroke={C.taupe} strokeWidth="1" fill={C.beigeAlt} />
      <Path d="M 16 76 C 22 78 28 80 34 82" stroke={C.brownLight} strokeWidth="0.5" fill="none" />
    </Svg>
  );
}

function LeafBottomLeft() {
  return (
    <Svg viewBox="0 0 115 130" style={{ position: "absolute", bottom: 0, left: 0, width: 100, height: 115, opacity: 0.75 }}>
      <Path d="M 10 122 C 22 106 42 88 62 68 C 78 52 90 36 100 14" stroke={C.taupe} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <Path d="M 10 122 C 2 112 4 98 14 94 C 18 106 16 118 10 122 Z" stroke={C.taupe} strokeWidth="1.1" fill={C.beigeAlt} />
      <Path d="M 10 122 C 12 114 14 104 14 94" stroke={C.brownLight} strokeWidth="0.5" fill="none" />
      <Path d="M 28 104 C 18 96 20 82 30 78 C 34 88 34 100 28 104 Z" stroke={C.taupe} strokeWidth="1.1" fill={C.beigeAlt} />
      <Path d="M 28 104 C 30 96 30 86 30 78" stroke={C.brownLight} strokeWidth="0.5" fill="none" />
      <Path d="M 48 86 C 38 78 38 64 48 60 C 54 70 54 82 48 86 Z" stroke={C.taupe} strokeWidth="1.1" fill={C.beigeAlt} />
      <Path d="M 48 86 C 50 78 50 68 48 60" stroke={C.brownLight} strokeWidth="0.5" fill="none" />
      <Path d="M 66 68 C 56 60 58 46 68 42 C 74 52 74 64 66 68 Z" stroke={C.taupe} strokeWidth="1.1" fill={C.beigeAlt} />
      <Path d="M 66 68 C 68 60 68 50 68 42" stroke={C.brownLight} strokeWidth="0.5" fill="none" />
      <Path d="M 84 48 C 74 40 76 26 86 22 C 92 32 92 44 84 48 Z" stroke={C.taupe} strokeWidth="1.1" fill={C.beigeAlt} />
      <Path d="M 84 48 C 86 40 86 30 86 22" stroke={C.brownLight} strokeWidth="0.5" fill="none" />
    </Svg>
  );
}

const S = StyleSheet.create({
  page: {
    fontFamily: "Lato",
    fontSize: 8.5,
    color: C.brown,
    backgroundColor: C.white,
    paddingTop: 30,
    paddingBottom: 44,
    paddingLeft: 38,
    paddingRight: 38,
    lineHeight: 1.4,
  },
  titleArea:  { marginBottom: 4, paddingRight: 75 },
  titleText:  { fontFamily: "Lato", fontWeight: 400, fontSize: 22, color: "#B0A494", letterSpacing: -0.4, marginBottom: 1 },
  divider:    { height: 1, backgroundColor: C.border, marginBottom: 12, marginTop: 4 },
  clientMetaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  clientBlock:   { flex: 1, paddingRight: 20 },
  clientLabel:   { fontSize: 7, fontFamily: "Lato", fontWeight: 700, color: C.brownLight, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  clientName:    { fontFamily: "Lato", fontWeight: 700, fontSize: 10, color: C.brown, marginBottom: 1.5 },
  clientLine:    { fontSize: 8.5, color: C.brownMid, marginBottom: 1.5 },
  metaBlock:     { alignItems: "flex-end", minWidth: 165 },
  metaRow:       { flexDirection: "row", justifyContent: "flex-end", marginBottom: 2.5 },
  metaLabel:     { fontSize: 7.5, color: C.brownLight, textAlign: "right", marginRight: 6, width: 100 },
  metaValue:     { fontFamily: "Lato", fontWeight: 700, fontSize: 8, color: C.brown, width: 72, textAlign: "right" },
  table:          { marginBottom: 12, borderWidth: 1, borderColor: C.border, borderRadius: 2, overflow: "hidden" },
  tableHeaderRow: { flexDirection: "row", backgroundColor: C.beigeAlt, paddingVertical: 5, paddingHorizontal: 6 },
  tableRow:       { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderTopWidth: 1, borderTopColor: C.borderLight },
  tableRowAlt:    { backgroundColor: C.beige },
  colHead:        { fontFamily: "Lato", fontWeight: 700, fontSize: 7, color: C.brownMid, letterSpacing: 0.3 },
  colCell:        { fontSize: 8.5, color: C.brown },
  cDesc:    { flex: 1, paddingRight: 4 },
  cQty:     { width: 26,  textAlign: "right", paddingRight: 4 },
  cUnitEur: { width: 57,  textAlign: "right", paddingRight: 4 },
  cUnitHuf: { width: 64,  textAlign: "right", paddingRight: 4 },
  cTotEur:  { width: 57,  textAlign: "right", paddingRight: 4 },
  cTotHuf:  { width: 64,  textAlign: "right" },
  totalsSection: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 8 },
  totalsBox:     { width: 315, borderWidth: 1, borderColor: C.border, borderRadius: 2, overflow: "hidden" },
  totalsRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: C.borderLight },
  totalsLabel: { fontSize: 8, color: C.brownMid, flex: 1 },
  totalsEur:   { fontFamily: "Lato", fontWeight: 700, fontSize: 8, color: C.brown, width: 74, textAlign: "right" },
  totalsHuf:   { fontFamily: "Lato", fontWeight: 700, fontSize: 8, color: C.brown, width: 82, textAlign: "right" },
  totalFinalRow:  { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 8, backgroundColor: C.taupe },
  totalFinalLabel: { fontFamily: "Lato", fontWeight: 700, fontSize: 10, color: C.white, letterSpacing: 0.4, flex: 1 },
  totalFinalEur:   { fontFamily: "Lato", fontWeight: 700, fontSize: 10, color: C.white, width: 74, textAlign: "right" },
  totalFinalHuf:   { fontFamily: "Lato", fontWeight: 700, fontSize: 10, color: C.white, width: 82, textAlign: "right" },
  advanceRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: C.borderLight, backgroundColor: C.beige },
  advanceLabel:  { fontSize: 7.5, color: C.brownMid, flex: 1 },
  advanceVal:    { fontSize: 7.5, color: C.brownMid, width: 74, textAlign: "right" },
  advanceValHuf: { fontSize: 7.5, color: C.brownMid, width: 82, textAlign: "right" },
  remainRow:  { flexDirection: "row", alignItems: "center", paddingVertical: 5, paddingHorizontal: 8, backgroundColor: C.beigeAlt },
  remainLabel: { fontFamily: "Lato", fontWeight: 700, fontSize: 8.5, color: C.brown, flex: 1 },
  remainVal:   { fontFamily: "Lato", fontWeight: 700, fontSize: 8.5, color: C.brown, width: 74, textAlign: "right" },
  remainValHuf:{ fontFamily: "Lato", fontWeight: 700, fontSize: 8.5, color: C.brown, width: 82, textAlign: "right" },
  rateNote:     { flexDirection: "row", justifyContent: "flex-end", marginBottom: 8, marginTop: -2 },
  rateNoteText: { fontSize: 7, color: C.brownLight },
  notesBox: { borderWidth: 1, borderColor: C.border, borderRadius: 2, paddingHorizontal: 8, paddingVertical: 6, marginBottom: 8, backgroundColor: C.beige },
  notesLabel: { fontFamily: "Lato", fontWeight: 700, fontSize: 7, color: C.brownMid, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  notesText:  { fontSize: 8, color: C.brownMid, lineHeight: 1.5 },
  beneSection: { backgroundColor: C.beige, borderWidth: 1, borderColor: C.border, borderRadius: 2, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 8 },
  beneTitle:   { fontFamily: "Lato", fontWeight: 700, fontSize: 7, color: C.brownMid, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 3 },
  beneBody:    { flexDirection: "row", alignItems: "flex-start" },
  beneLeft:    { flex: 1, paddingRight: 10 },
  beneRight:   { flex: 1 },
  beneName:    { fontFamily: "Lato", fontWeight: 700, fontSize: 9, color: C.brown, marginBottom: 3 },
  beneRow:     { flexDirection: "row", marginBottom: 2 },
  beneLabel:   { fontSize: 7.5, color: C.brownLight, width: 68 },
  beneValue:   { fontFamily: "Lato", fontWeight: 700, fontSize: 7.5, color: C.brown, flex: 1 },
  contactBar:  { flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 4 },
  contactText: { fontSize: 7.5, color: C.brownMid, textAlign: "center" },
  footer: { position: "absolute", bottom: 16, left: 38, right: 38, borderTopWidth: 1, borderTopColor: C.borderLight, paddingTop: 4, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerText: { fontSize: 7, color: C.brownLight },
});

function MetaRow({ lbl, val }: { lbl: string; val: string }) {
  return (
    <View style={S.metaRow}>
      <Text style={S.metaLabel}>{lbl}</Text>
      <Text style={S.metaValue}>{val}</Text>
    </View>
  );
}

function TableHeader() {
  return (
    <View style={S.tableHeaderRow}>
      <Text style={[S.colHead, S.cDesc]}>POSITION / TÉTEL</Text>
      <Text style={[S.colHead, S.cQty]}>DB</Text>
      <Text style={[S.colHead, S.cUnitEur]}>EGYSÉGÁR EUR</Text>
      <Text style={[S.colHead, S.cUnitHuf]}>EGYSÉGÁR HUF</Text>
      <Text style={[S.colHead, S.cTotEur]}>GESAMT EUR</Text>
      <Text style={[S.colHead, S.cTotHuf]}>GESAMT HUF</Text>
    </View>
  );
}

function TableItemRow({ item, index, eurHufRate }: { item: InvoiceItem; index: number; eurHufRate: number }) {
  const alt = index % 2 === 1;
  const qty = typeof item.quantity === "number"
    ? item.quantity % 1 === 0 ? String(item.quantity) : item.quantity.toFixed(2)
    : String(item.quantity);
  const unitEur = item.unit_price ?? 0;
  const totEur  = item.total ?? 0;
  return (
    <View style={[S.tableRow, alt ? S.tableRowAlt : {}]}>
      <Text style={[S.colCell, S.cDesc]}>{item.description}</Text>
      <Text style={[S.colCell, S.cQty]}>{qty}</Text>
      <Text style={[S.colCell, S.cUnitEur]}>{fmtEur(unitEur)}</Text>
      <Text style={[S.colCell, S.cUnitHuf]}>{fmtHuf(unitEur * eurHufRate)}</Text>
      <Text style={[S.colCell, S.cTotEur]}>{fmtEur(totEur)}</Text>
      <Text style={[S.colCell, S.cTotHuf]}>{fmtHuf(totEur * eurHufRate)}</Text>
    </View>
  );
}

export interface InvoicePDFProps {
  invoice:      Invoice;
  client:       Client;
  settings:     Record<string, string>;
  /** 1 EUR = X HUF (e.g. 395). Default: 395 */
  eurHufRate?:  number;
  /** @deprecated ignored – always bilingual */
  language?:    InvoiceLanguage;
  /** @deprecated ignored – always shows both EUR + HUF */
  currency?:    InvoiceCurrency;
  /** @deprecated use eurHufRate instead (was HUF-to-EUR multiplier like 0.0025) */
  exchangeRate?: number;
}

export function InvoicePDF({ invoice, client, settings, eurHufRate, exchangeRate }: InvoicePDFProps) {
  const rate: number =
    eurHufRate != null
      ? eurHufRate
      : exchangeRate != null && exchangeRate < 1
        ? Math.round(1 / exchangeRate)
        : 395;

  const companyName = settings["agency_legal_name"] || settings["agency_name"] || "Tuza-Goncz Zsuzsanna, Utazo fotos";
  const email       = settings["agency_email"]   || "";
  const phone       = settings["agency_phone"]   || "";
  const iban        = settings["iban"]           || "";
  const bic         = settings["bic"]            || "";
  const bankAcctNo  = settings["bank_account_number"] || "";
  const bankName    = settings["bank_name"]      || "";
  const footerText  = settings["invoice_footer_text"] || "";

  const allItems     = (invoice.items ?? []) as InvoiceItem[];
  const regularItems = allItems.filter((i) => !i.is_advance);
  const advanceItems = allItems.filter((i) => i.is_advance);

  const rawSubtotal  = invoice.subtotal  ?? regularItems.reduce((s, i) => s + i.total, 0);
  const rawTaxAmount = invoice.tax_amount ?? rawSubtotal * invoice.tax_rate / 100;
  const rawTotal     = invoice.total     ?? rawSubtotal + rawTaxAmount;
  const taxRate      = invoice.tax_rate ?? 0;
  const showTax      = taxRate > 0;

  const totalAdvanceEur = advanceItems.reduce((s, i) => s + (i.total ?? 0), 0);
  const remainingEur    = rawTotal - totalAdvanceEur;

  const clientAddress = [
    client.address_country,
    [client.address_zip, client.address_city].filter(Boolean).join(" "),
    client.address_street,
  ].filter(Boolean);

  const contactParts = [phone, email].filter(Boolean);
  const contactLine  = contactParts.join("  -  ");
  const taxLabel     = `${taxRate}% MwSt. / ÁFA`;

  return (
    <Document
      title={`Rechnungsaufstellung / Számla részletező  ${invoice.invoice_number}`}
      author={companyName}
      creator="ZsuzsiCRM"
    >
      <Page size="A4" style={S.page}>
        <LeafTopRight />

        <View style={S.titleArea}>
          <Text style={S.titleText}>Rechnungsaufstellung  –  Számla részletező</Text>
        </View>
        <View style={S.divider} />

        <View style={S.clientMetaRow}>
          <View style={S.clientBlock}>
            <Text style={S.clientLabel}>Rechnungsempfänger / Megrendelő:</Text>
            <Text style={S.clientName}>{client.last_name} {client.first_name}</Text>
            {clientAddress.map((line, i) => (
              <Text key={i} style={S.clientLine}>{line}</Text>
            ))}
            {client.phone && <Text style={S.clientLine}>{client.phone}</Text>}
            {client.email && <Text style={S.clientLine}>{client.email}</Text>}
          </View>
          <View style={S.metaBlock}>
            <MetaRow lbl="Datum / Datum:"              val={fmtDate(invoice.issue_date)} />
            <MetaRow lbl="Rechnungsnummer / Szám:"     val={invoice.invoice_number} />
            {invoice.service_date && (
              <MetaRow lbl="Leistungsdatum / Teljesítés:" val={fmtDate(invoice.service_date)} />
            )}
            {invoice.due_date && (
              <MetaRow lbl="Zahlungsziel / Határidő:"  val={fmtDate(invoice.due_date)} />
            )}
          </View>
        </View>

        <View style={S.table}>
          <TableHeader />
          {regularItems.map((item, i) => (
            <TableItemRow key={i} item={item} index={i} eurHufRate={rate} />
          ))}
        </View>

        <View style={S.totalsSection}>
          <View style={S.totalsBox}>
            {showTax && (
              <>
                <View style={S.totalsRow}>
                  <Text style={S.totalsLabel}>Nettobetrag / Nettó összeg:</Text>
                  <Text style={S.totalsEur}>{fmtEur(rawSubtotal)}</Text>
                  <Text style={S.totalsHuf}>{fmtHuf(rawSubtotal * rate)}</Text>
                </View>
                <View style={S.totalsRow}>
                  <Text style={S.totalsLabel}>{taxLabel}:</Text>
                  <Text style={S.totalsEur}>{fmtEur(rawTaxAmount)}</Text>
                  <Text style={S.totalsHuf}>{fmtHuf(rawTaxAmount * rate)}</Text>
                </View>
              </>
            )}
            <View style={S.totalFinalRow}>
              <Text style={S.totalFinalLabel}>GESAMT / ÖSSZESEN</Text>
              <Text style={S.totalFinalEur}>{fmtEur(rawTotal)}</Text>
              <Text style={S.totalFinalHuf}>{fmtHuf(rawTotal * rate)}</Text>
            </View>
            {advanceItems.length > 0 && advanceItems.map((adv, idx) => (
              <View key={idx} style={S.advanceRow}>
                <Text style={S.advanceLabel}>Anzahlung / Előleg:</Text>
                <Text style={S.advanceVal}>{fmtEur(adv.total ?? 0)}</Text>
                <Text style={S.advanceValHuf}>{fmtHuf((adv.total ?? 0) * rate)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={S.rateNote}>
          <Text style={S.rateNoteText}>Átváltás / Umrechnung: 1 EUR = {rate} Ft</Text>
        </View>

        {invoice.notes ? (
          <View style={S.notesBox}>
            <Text style={S.notesLabel}>Hinweis / Megjegyzés</Text>
            <Text style={S.notesText}>{invoice.notes}</Text>
          </View>
        ) : null}

        <View style={S.beneSection}>
          <Text style={S.beneTitle}>EMPFÄNGER / KEDVEZMÉNYEZETT</Text>
          <View style={S.beneBody}>
            <View style={S.beneLeft}>
              <Text style={S.beneName}>{companyName}</Text>
              {bankName ? (
                <View style={S.beneRow}>
                  <Text style={S.beneLabel}>Bank:</Text>
                  <Text style={S.beneValue}>{bankName}</Text>
                </View>
              ) : null}
              {bankAcctNo ? (
                <View style={S.beneRow}>
                  <Text style={S.beneLabel}>Konto / Számlaszám:</Text>
                  <Text style={S.beneValue}>{bankAcctNo}</Text>
                </View>
              ) : null}
              {iban ? (
                <View style={S.beneRow}>
                  <Text style={S.beneLabel}>IBAN:</Text>
                  <Text style={S.beneValue}>{iban}</Text>
                </View>
              ) : null}
            </View>
            <View style={S.beneRight}>
              {bic ? (
                <View style={S.beneRow}>
                  <Text style={S.beneLabel}>BIC/SWIFT:</Text>
                  <Text style={S.beneValue}>{bic}</Text>
                </View>
              ) : null}
              <View style={S.beneRow}>
                  <Text style={S.beneLabel}>Verwendungszweck / Közlemény:</Text>
                <Text style={[S.beneValue, { fontFamily: "Lato", fontWeight: 700 }]}>
                  {invoice.invoice_number}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {footerText ? (
          <View style={{ ...S.contactBar, marginTop: 6 }}>
            <Text style={{ ...S.contactText, fontFamily: "Lato", fontStyle: "italic" }}>{footerText}</Text>
          </View>
        ) : null}

        {contactLine ? (
          <View style={S.contactBar}>
            <Text style={S.contactText}>{contactLine}</Text>
          </View>
        ) : null}

        <LeafBottomLeft />

        <View style={S.footer} fixed>
          <Text style={S.footerText}>{companyName}</Text>
          <Text
            style={S.footerText}
            render={({ pageNumber, totalPages }) =>
              `${pageNumber}. oldal / ${totalPages}  -  Seite ${pageNumber} von ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
