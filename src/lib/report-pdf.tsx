import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { RevenueCostsRow, TripProfitRow, ClientStatsData, TopClient } from "@/hooks/useReports";

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page:       { fontFamily: "Helvetica", fontSize: 9, padding: 40, color: "#18181b" },
  header:     { marginBottom: 24, borderBottom: "1 solid #e4e4e7", paddingBottom: 16 },
  logo:       { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#2563eb", marginBottom: 4 },
  subtitle:   { fontSize: 9, color: "#71717a" },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 8, marginTop: 16, color: "#18181b" },
  kpiRow:     { flexDirection: "row", gap: 12, marginBottom: 16 },
  kpiBox:     { flex: 1, border: "1 solid #e4e4e7", borderRadius: 4, padding: 10 },
  kpiLabel:   { fontSize: 8, color: "#71717a", marginBottom: 4 },
  kpiValue:   { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#18181b" },
  kpiSub:     { fontSize: 8, color: "#52525b", marginTop: 2 },
  table:      { borderTop: "1 solid #e4e4e7", marginTop: 4 },
  thead:      { flexDirection: "row", backgroundColor: "#f8fafc", borderBottom: "1 solid #e4e4e7" },
  theadCell:  { flex: 1, padding: "5 6", fontSize: 7, fontFamily: "Helvetica-Bold", color: "#52525b", textTransform: "uppercase" },
  trow:       { flexDirection: "row", borderBottom: "1 solid #f4f4f5" },
  tcell:      { flex: 1, padding: "5 6", fontSize: 8, color: "#27272a" },
  tcellRight: { flex: 1, padding: "5 6", fontSize: 8, color: "#27272a", textAlign: "right" },
  profitPos:  { color: "#16a34a", fontFamily: "Helvetica-Bold" },
  profitNeg:  { color: "#dc2626", fontFamily: "Helvetica-Bold" },
  footer:     { position: "absolute", bottom: 28, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: "#a1a1aa" },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtEur(n: number): string {
  const abs = Math.abs(n);
  const int = Math.floor(abs).toLocaleString("de-AT");
  const dec = (abs % 1).toFixed(2).slice(1);
  return `${n < 0 ? "-" : ""}€ ${int}${dec}`;
}

function fmtDate(s: string): string {
  return s.slice(0, 10).split("-").reverse().join(".");
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={S.kpiBox}>
      <Text style={S.kpiLabel}>{label}</Text>
      <Text style={S.kpiValue}>{value}</Text>
      {sub && <Text style={S.kpiSub}>{sub}</Text>}
    </View>
  );
}

// ─── Main PDF component ───────────────────────────────────────────────────────

interface ReportPDFProps {
  period: { startDate: string; endDate: string };
  revenue: RevenueCostsRow[];
  trips: TripProfitRow[];
  clients: ClientStatsData;
  topClients: TopClient[];
}

export function ReportPDF({ period, revenue, trips, clients, topClients }: ReportPDFProps) {
  const totalRevenue = revenue.reduce((s, r) => s + r.revenue, 0);
  const totalCosts   = revenue.reduce((s, r) => s + r.costs, 0);
  const totalProfit  = totalRevenue - totalCosts;
  const margin       = totalRevenue > 0 ? (totalProfit / totalRevenue * 100).toFixed(1) : "0.0";

  const generatedAt = new Date().toLocaleString("hu-HU", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <Document>
      {/* ── Page 1: Overview ── */}
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <Text style={S.logo}>ZsuzsiCRM — Pénzügyi riport</Text>
          <Text style={S.subtitle}>
            {fmtDate(period.startDate)} – {fmtDate(period.endDate)} · Generálva: {generatedAt}
          </Text>
        </View>

        {/* KPI summary */}
        <Text style={S.sectionTitle}>Összefoglaló</Text>
        <View style={S.kpiRow}>
          <KpiBox label="Összes bevétel"  value={fmtEur(totalRevenue)} />
          <KpiBox label="Összes kiadás"   value={fmtEur(totalCosts)} />
          <KpiBox label="Nyereség"        value={fmtEur(totalProfit)} sub={`Margó: ${margin}%`} />
          <KpiBox label="Aktív ügyfelek" value={String(clients.totalActive)} sub={`${clients.totalNew} új a periódusban`} />
        </View>

        {/* Monthly revenue table */}
        <Text style={S.sectionTitle}>Havi bevétel vs. kiadás</Text>
        <View style={S.table}>
          <View style={S.thead}>
            <Text style={[S.theadCell, { flex: 2 }]}>Hónap</Text>
            <Text style={[S.theadCell, { textAlign: "right" }]}>Bevétel</Text>
            <Text style={[S.theadCell, { textAlign: "right" }]}>Kiadás</Text>
            <Text style={[S.theadCell, { textAlign: "right" }]}>Nyereség</Text>
          </View>
          {revenue.map((r, i) => (
            <View key={i} style={[S.trow, i % 2 === 1 ? { backgroundColor: "#fafafa" } : {}]}>
              <Text style={[S.tcell, { flex: 2 }]}>{r.monthLabel}</Text>
              <Text style={S.tcellRight}>{fmtEur(r.revenue)}</Text>
              <Text style={S.tcellRight}>{fmtEur(r.costs)}</Text>
              <Text style={[S.tcellRight, r.profit >= 0 ? S.profitPos : S.profitNeg]}>
                {fmtEur(r.profit)}
              </Text>
            </View>
          ))}
          {/* Totals row */}
          <View style={[S.trow, { backgroundColor: "#f1f5f9" }]}>
            <Text style={[S.tcell, { flex: 2, fontFamily: "Helvetica-Bold" }]}>Összesen</Text>
            <Text style={[S.tcellRight, { fontFamily: "Helvetica-Bold" }]}>{fmtEur(totalRevenue)}</Text>
            <Text style={[S.tcellRight, { fontFamily: "Helvetica-Bold" }]}>{fmtEur(totalCosts)}</Text>
            <Text style={[S.tcellRight, { fontFamily: "Helvetica-Bold" }, totalProfit >= 0 ? S.profitPos : S.profitNeg]}>
              {fmtEur(totalProfit)}
            </Text>
          </View>
        </View>

        <View style={S.footer} fixed>
          <Text style={S.footerText}>ZsuzsiCRM – Bizalmas</Text>
          <Text style={S.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* ── Page 2: Trip Profitability ── */}
      {trips.length > 0 && (
        <Page size="A4" style={S.page}>
          <Text style={S.sectionTitle}>Utazások nyereségessége</Text>
          <View style={S.table}>
            <View style={S.thead}>
              <Text style={[S.theadCell, { flex: 3 }]}>Út neve</Text>
              <Text style={[S.theadCell, { textAlign: "right" }]}>Bevétel</Text>
              <Text style={[S.theadCell, { textAlign: "right" }]}>Kiadás</Text>
              <Text style={[S.theadCell, { textAlign: "right" }]}>Nyereség</Text>
              <Text style={[S.theadCell, { textAlign: "right" }]}>Margó</Text>
              <Text style={[S.theadCell, { textAlign: "right" }]}>Telít.</Text>
            </View>
            {trips.map((t, i) => (
              <View key={t.id} style={[S.trow, i % 2 === 1 ? { backgroundColor: "#fafafa" } : {}]}>
                <View style={[{ flex: 3, padding: "5 6" }]}>
                  <Text style={{ fontSize: 8, color: "#27272a" }}>{t.name}</Text>
                  <Text style={{ fontSize: 7, color: "#71717a" }}>
                    {t.destination} · {fmtDate(t.departure_date)}
                  </Text>
                </View>
                <Text style={S.tcellRight}>{fmtEur(t.revenue)}</Text>
                <Text style={S.tcellRight}>{fmtEur(t.costs)}</Text>
                <Text style={[S.tcellRight, t.profit >= 0 ? S.profitPos : S.profitNeg]}>
                  {fmtEur(t.profit)}
                </Text>
                <Text style={[S.tcellRight, t.margin >= 20 ? S.profitPos : t.margin >= 0 ? {} : S.profitNeg]}>
                  {t.margin.toFixed(1)}%
                </Text>
                <Text style={S.tcellRight}>{t.occupancy}%</Text>
              </View>
            ))}
          </View>

          <View style={S.footer} fixed>
            <Text style={S.footerText}>ZsuzsiCRM – Bizalmas</Text>
            <Text style={S.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          </View>
        </Page>
      )}

      {/* ── Page 3: Top Clients ── */}
      {topClients.length > 0 && (
        <Page size="A4" style={S.page}>
          <Text style={S.sectionTitle}>Top ügyfelek (összes költ. szerint)</Text>
          <View style={S.table}>
            <View style={S.thead}>
              <Text style={[S.theadCell, { flex: 0.4 }]}>#</Text>
              <Text style={[S.theadCell, { flex: 3 }]}>Ügyfél</Text>
              <Text style={S.theadCell}>Kód</Text>
              <Text style={[S.theadCell, { textAlign: "right" }]}>Utak</Text>
              <Text style={[S.theadCell, { textAlign: "right" }]}>Összes költ.</Text>
              <Text style={[S.theadCell, { textAlign: "right" }]}>Kedv.</Text>
            </View>
            {topClients.map((c, i) => (
              <View key={c.id} style={[S.trow, i % 2 === 1 ? { backgroundColor: "#fafafa" } : {}]}>
                <Text style={[S.tcell, { flex: 0.4, color: "#71717a" }]}>{i + 1}</Text>
                <Text style={[S.tcell, { flex: 3 }]}>
                  {c.last_name} {c.first_name}{c.is_vip ? " ★" : ""}
                </Text>
                <Text style={[S.tcell, { fontFamily: "Helvetica-Oblique", color: "#71717a" }]}>
                  {c.client_code}
                </Text>
                <Text style={S.tcellRight}>{c.trip_count}</Text>
                <Text style={[S.tcellRight, { fontFamily: "Helvetica-Bold" }]}>
                  {fmtEur(c.total_spent)}
                </Text>
                <Text style={S.tcellRight}>{c.discount_level * 5}%</Text>
              </View>
            ))}
          </View>

          {/* Client acquisition summary */}
          <Text style={[S.sectionTitle, { marginTop: 24 }]}>Ügyfélszerzés forrása</Text>
          <View style={S.table}>
            <View style={S.thead}>
              <Text style={[S.theadCell, { flex: 2 }]}>Forrás</Text>
              <Text style={[S.theadCell, { textAlign: "right" }]}>Ügyfelek</Text>
              <Text style={[S.theadCell, { textAlign: "right" }]}>Részarány</Text>
            </View>
            {clients.sourceBreakdown.map((s) => (
              <View key={s.source} style={S.trow}>
                <Text style={[S.tcell, { flex: 2 }]}>{s.label}</Text>
                <Text style={S.tcellRight}>{s.count}</Text>
                <Text style={S.tcellRight}>{s.percentage}%</Text>
              </View>
            ))}
          </View>

          <View style={S.footer} fixed>
            <Text style={S.footerText}>ZsuzsiCRM – Bizalmas</Text>
            <Text style={S.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          </View>
        </Page>
      )}
    </Document>
  );
}
