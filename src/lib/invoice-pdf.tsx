/**
 * Invoice PDF â€” botanical / elegant style  (React-PDF)
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
  Font,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Path,
} from "@react-pdf/renderer";

// â”€â”€â”€ Font registration (Lato â€” full Latin Extended / Hungarian support) â”€â”€â”€â”€â”€â”€â”€â”€
Font.register({
  family: "Lato",
  fonts: [
    { src: (typeof window !== "undefined" ? window.location.origin : "") + "/fonts/Lato-Regular.ttf", fontWeight: 400 },
    { src: (typeof window !== "undefined" ? window.location.origin : "") + "/fonts/Lato-Bold.ttf",    fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]); // disable hyphenation
import type { Invoice, Client, InvoiceItem } from "@/types";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type InvoiceLanguage = "hu" | "de" | "bilingual";
export type InvoiceCurrency = "EUR" | "HUF";

// â”€â”€â”€ Colour palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Labels â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Formatters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const parts = d.slice(0, 10).split("-");
  if (parts.length !== 3) return d;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function fmtMoney(n: number | null | undefined, currency: InvoiceCurrency): string {
  if (n == null) return currency === "HUF" ? "0 Ft" : "â‚¬ 0,00";
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

// â”€â”€â”€ SVG decorations (botanical leaf clusters) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Top-right corner: elegant leaf branch curving from top-right inward */
function LeafTopRight() {
  return (
    <Svg
      viewBox="0 0 100 115"
      style={{ position: "absolute", top: 0, right: 0, width: 100, height: 115, opacity: 0.80 }}
    >
      {/* main stem */}
      <Path
        d="M 94 5 C 80 16 60 36 40 58 C 26 72 14 86 8 100"
        stroke={C.taupe}
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
      {/* leaf 1 â€“ upper tip */}
      <Path
        d="M 94 5 C 86 -1 74 2 72 13 C 80 13 90 10 94 5 Z"
        stroke={C.taupe}
        strokeWidth="1"
        fill={C.beigeAlt}
      />
      {/* leaf 1 midrib */}
      <Path d="M 94 5 C 88 7 78 10 72 13" stroke={C.brownLight} strokeWidth="0.5" fill="none" />
      {/* leaf 2 */}
      <Path
        d="M 72 22 C 80 14 92 17 92 28 C 84 28 74 26 72 22 Z"
        stroke={C.taupe}
        strokeWidth="1"
        fill={C.beigeAlt}
      />
      <Path d="M 72 22 C 78 23 86 25 92 28" stroke={C.brownLight} strokeWidth="0.5" fill="none" />
      {/* leaf 3 */}
      <Path
        d="M 52 40 C 60 32 72 35 72 46 C 64 46 54 44 52 40 Z"
        stroke={C.taupe}
        strokeWidth="1"
        fill={C.beigeAlt}
      />
      <Path d="M 52 40 C 58 42 66 44 72 46" stroke={C.brownLight} strokeWidth="0.5" fill="none" />
      {/* leaf 4 */}
      <Path
        d="M 34 58 C 42 50 54 53 54 64 C 46 64 36 62 34 58 Z"
        stroke={C.taupe}
        strokeWidth="1"
        fill={C.beigeAlt}
      />
      <Path d="M 34 58 C 40 60 48 62 54 64" stroke={C.brownLight} strokeWidth="0.5" fill="none" />
      {/* leaf 5 â€“ lower */}
      <Path
        d="M 16 76 C 22 68 34 71 34 82 C 26 82 18 80 16 76 Z"
        stroke={C.taupe}
        strokeWidth="1"
        fill={C.beigeAlt}
      />
      <Path d="M 16 76 C 22 78 28 80 34 82" stroke={C.brownLight} strokeWidth="0.5" fill="none" />
    </Svg>
  );
}

/** Bottom-left corner: mirrored, larger leaf cluster */
function LeafBottomLeft() {
  return (
    <Svg
      viewBox="0 0 115 130"
      style={{ position: "absolute", bottom: 0, left: 0, width: 115, height: 130, opacity: 0.80 }}
    >
      {/* main stem */}
      <Path
        d="M 10 122 C 22 106 42 88 62 68 C 78 52 90 36 100 14"
        stroke={C.taupe}
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      {/* leaf 1 â€“ lower */}
      <Path
        d="M 10 122 C 2 112 4 98 14 94 C 18 106 16 118 10 122 Z"
        stroke={C.taupe}
        strokeWidth="1.1"
        fill={C.beigeAlt}
      />
      <Path d="M 10 122 C 12 114 14 104 14 94" stroke={C.brownLight} strokeWidth="0.5" fill="none" />
      {/* leaf 2 */}
      <Path
        d="M 28 104 C 18 96 20 82 30 78 C 34 88 34 100 28 104 Z"
        stroke={C.taupe}
        strokeWidth="1.1"
        fill={C.beigeAlt}
      />
      <Path d="M 28 104 C 30 96 30 86 30 78" stroke={C.brownLight} strokeWidth="0.5" fill="none" />
      {/* leaf 3 */}
      <Path
        d="M 48 86 C 38 78 38 64 48 60 C 54 70 54 82 48 86 Z"
        stroke={C.taupe}
        strokeWidth="1.1"
        fill={C.beigeAlt}
      />
      <Path d="M 48 86 C 50 78 50 68 48 60" stroke={C.brownLight} strokeWidth="0.5" fill="none" />
      {/* leaf 4 */}
      <Path
        d="M 66 68 C 56 60 58 46 68 42 C 74 52 74 64 66 68 Z"
        stroke={C.taupe}
        strokeWidth="1.1"
        fill={C.beigeAlt}
      />
      <Path d="M 66 68 C 68 60 68 50 68 42" stroke={C.brownLight} strokeWidth="0.5" fill="none" />
      {/* leaf 5 */}
      <Path
        d="M 84 48 C 74 40 76 26 86 22 C 92 32 92 44 84 48 Z"
        stroke={C.taupe}
        strokeWidth="1.1"
        fill={C.beigeAlt}
      />
      <Path d="M 84 48 C 86 40 86 30 86 22" stroke={C.brownLight} strokeWidth="0.5" fill="none" />
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

// â”€â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const S = StyleSheet.create({
  page: {
    fontFamily: "Lato",
    fontSize: 9,
    color: C.brown,
    backgroundColor: C.white,
    paddingTop: 38,
    paddingBottom: 65,
    paddingLeft: 44,
    paddingRight: 44,
    lineHeight: 1.45,
  },

  // â”€â”€ Title area â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  titleArea: {
    marginBottom: 6,
    paddingRight: 80, // leave room for leaf SVG
  },
  titleText: {
    fontFamily: "Lato",
    fontWeight: 400,
    fontSize: 28,
    color: "#B0A494",
    letterSpacing: -0.5,
    marginBottom: 2,
  },

  // â”€â”€ Divider â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginBottom: 16,
    marginTop: 6,
  },

  // â”€â”€ Client + meta block â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    fontFamily: "Lato",
    fontWeight: 700,
    color: C.brownLight,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  clientName: {
    fontFamily: "Lato",
    fontWeight: 700,
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
    fontFamily: "Lato",
    fontWeight: 700,
    fontSize: 8.5,
    color: C.brown,
    width: 80,
    textAlign: "right",
  },

  // â”€â”€ Table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    fontFamily: "Lato",
    fontWeight: 700,
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

  // â”€â”€ Totals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    fontFamily: "Lato",
    fontWeight: 700,
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
    fontFamily: "Lato",
    fontWeight: 700,
    fontSize: 11,
    color: C.white,
    letterSpacing: 0.5,
  },
  totalFinalValue: {
    fontFamily: "Lato",
    fontWeight: 700,
    fontSize: 12,
    color: C.white,
  },

  // â”€â”€ Notes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  notesBox: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 2,
    padding: 10,
    marginBottom: 18,
    backgroundColor: C.beige,
  },
  notesLabel: {
    fontFamily: "Lato",
    fontWeight: 700,
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

  // â”€â”€ Beneficiary / payment section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  beneSection: {
    backgroundColor: C.beige,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 2,
    padding: 14,
    marginBottom: 16,
  },
  beneTitle: {
    fontFamily: "Lato",
    fontWeight: 700,
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
    fontFamily: "Lato",
    fontWeight: 700,
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
    fontFamily: "Lato",
    fontWeight: 700,
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

  // â”€â”€ Contact footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Fixed page footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Exchange-rate note â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  rateNote: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: -10,
    marginBottom: 14,
  },
  rateNoteText: {
    fontSize: 7,
    color: C.brownLight,
    fontStyle: "italic",
  },
});

// â”€â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  rate,
}: {
  item: InvoiceItem;
  index: number;
  currency: InvoiceCurrency;
  rate: number;
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
      <Text style={[S.colCell, S.cUnit]}>{fmtMoney((item.unit_price ?? 0) * rate, currency)}</Text>
      <Text style={[S.colCell, S.cVal]}>{fmtMoney((item.total ?? 0) * rate, currency)}</Text>
    </View>
  );
}

// â”€â”€â”€ Props â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface InvoicePDFProps {
  invoice:      Invoice;
  client:       Client;
  settings:     Record<string, string>;
  language?:    InvoiceLanguage;
  currency?:    InvoiceCurrency;
  /** Multiplier applied to all amounts (e.g. 0.0025 for HUFâ†’EUR at 400 Ft/â‚¬) */
  exchangeRate?: number;
}

// â”€â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function InvoicePDF({
  invoice,
  client,
  settings,
  language = "hu",
  currency = "EUR",
  exchangeRate,
}: InvoicePDFProps) {
  const rate = exchangeRate ?? 1;
  const companyName = settings["agency_legal_name"] || settings["agency_name"] || "Tuza-Göncz Zsuzsanna, Utazó fotós";
  const email       = settings["agency_email"]   || "";
  const phone       = settings["agency_phone"]   || "";
  const iban        = settings["iban"]           || "";
  const bic         = settings["bic"]            || "";
  const bankName    = settings["bank_name"]      || "";
  const bankAcctNo  = settings["bank_account_number"] || "";

  const items          = (invoice.items ?? []) as InvoiceItem[];
  const rawSubtotal    = invoice.subtotal  ?? items.reduce((s, i) => s + i.total, 0);
  const rawTaxAmount   = invoice.tax_amount ?? rawSubtotal * invoice.tax_rate / 100;
  const rawTotal       = invoice.total     ?? rawSubtotal + rawTaxAmount;
  // Apply exchange rate (1 = no conversion)
  const subtotal  = rawSubtotal  * rate;
  const taxAmount = rawTaxAmount * rate;
  const total     = rawTotal     * rate;
  const taxRate   = invoice.tax_rate ?? 0;
  const showTax   = taxRate > 0;

  const clientAddress = [
    client.address_street,
    [client.address_zip, client.address_city].filter(Boolean).join(" "),
    client.address_country,
  ].filter(Boolean);

  // Contact bar: phone Â· email
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

        {/* â”€â”€ Leaf decoration â€” top right â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <LeafTopRight />

        {/* â”€â”€ Title â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <View style={S.titleArea}>
          <Text style={S.titleText}>{titleLabel(language)}</Text>
        </View>

        {/* â”€â”€ Divider â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <View style={S.divider} />

        {/* â”€â”€ Client + meta block â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

        {/* â”€â”€ Line-items table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <View style={S.table}>
          <TableHeaderRow lang={language} />
          {items.map((item, i) => (
            <TableItemRow key={i} item={item} index={i} currency={currency} rate={rate} />
          ))}
        </View>

        {/* â”€â”€ Totals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

        {/* â”€â”€ Exchange-rate note â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {rate !== 1 && (
          <View style={S.rateNote}>
            <Text style={S.rateNoteText}>
              {language === "de"
                ? `Umrechnung: 1 EUR = ${Math.round(1 / rate)} Ft`
                : language === "bilingual"
                  ? `Átváltás / Umrechnung: 1 EUR = ${Math.round(1 / rate)} Ft`
                  : `Átváltás: 1 EUR = ${Math.round(1 / rate)} Ft`}
            </Text>
          </View>
        )}

        {/* â”€â”€ Notes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {invoice.notes ? (
          <View style={S.notesBox}>
            <Text style={S.notesLabel}>{label("notes", language)}</Text>
            <Text style={S.notesText}>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* â”€â”€ Beneficiary / payment section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
            <Text style={[S.beneValue, { fontFamily: "Lato", fontWeight: 700 }]}>
              {invoice.invoice_number}
            </Text>
          </View>
        </View>

        {/* â”€â”€ Contact bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {contactLine ? (
          <View style={S.contactBar}>
            <Text style={S.contactText}>{contactLine}</Text>
          </View>
        ) : null}

        {/* â”€â”€ Leaf decoration â€” bottom left â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <LeafBottomLeft />

        {/* â”€â”€ Fixed footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
