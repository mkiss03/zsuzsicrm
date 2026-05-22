"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileDown,
  Mail,
  CheckCircle,
  Trash2,
  Loader2,
  Clock,
  Send,
  Check,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { hu } from "date-fns/locale";

import { useInvoices } from "@/hooks/useInvoices";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { InvoiceStatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Invoice, InvoiceStatus, Client } from "@/types";
import type { InvoiceLanguage, InvoiceCurrency } from "@/lib/invoice-pdf";

// ─── Date formatters ──────────────────────────────────────────────────────────

function fmtHU(d: string | null): string {
  if (!d) return "—";
  try { return format(parseISO(d), "yyyy. MMM d.", { locale: hu }); }
  catch { return d; }
}

function fmtDE(d: string | null): string {
  if (!d) return "—";
  const p = d.slice(0, 10).split("-");
  return `${p[2]}.${p[1]}.${p[0]}`;
}

function fmtEur(n: number | null | undefined): string {
  if (n == null) return "€ —";
  const [int = "0", dec = "00"] = Math.abs(n).toFixed(2).split(".");
  return `€ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`;
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

function TimelineItem({
  icon: Icon,
  label,
  date,
  active,
}: {
  icon: typeof Clock;
  label: string;
  date: string | null;
  active: boolean;
}) {
  return (
    <div className={cn("flex items-start gap-3", !active && "opacity-40")}>
      <div
        className={cn(
          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md",
          active ? "bg-blue-100 text-blue-600" : "bg-zinc-100 text-zinc-400",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className={cn("text-sm font-medium", active ? "text-zinc-900" : "text-zinc-400")}>
          {label}
        </p>
        <p className="text-xs text-zinc-400">{date ? fmtHU(date) : "—"}</p>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  invoice: Invoice & { client: Client };
  settings: Record<string, string>;
}

export function InvoiceDetailView({ invoice: initialInvoice, settings }: Props) {
  const router = useRouter();
  const { markAsPaid, deleteInvoice, generatePDF, sendInvoiceEmail } = useInvoices();

  const [invoice, setInvoice]           = useState(initialInvoice);
  const [pdfUrl, setPdfUrl]             = useState<string | null>(null);
  const [pdfLoading, setPdfLoading]     = useState(false);
  const [showPaid, setShowPaid]         = useState(false);
  const [showDelete, setShowDelete]     = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [language, setLanguage]         = useState<InvoiceLanguage>("hu");
  const [currency, setCurrency]         = useState<InvoiceCurrency>("EUR");

  const { client } = invoice;
  const isEditable  = invoice.status === "draft";
  const isPaid      = invoice.status === "paid";
  const isCancelled = invoice.status === "cancelled";

  // Generate (or re-generate) PDF with current language/currency
  async function regeneratePDF(lang: InvoiceLanguage, curr: InvoiceCurrency) {
    setPdfUrl(null);
    setIframeLoaded(false);
    setPdfLoading(true);
    const url = await generatePDF(invoice.id, { language: lang, currency: curr });
    setPdfLoading(false);
    if (url) setPdfUrl(url);
    else toast.error("Hiba a PDF generálásakor");
  }

  // Trigger PDF load on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void regeneratePDF(language, currency); }, []);

  function handleLanguageChange(lang: InvoiceLanguage) {
    setLanguage(lang);
    void regeneratePDF(lang, currency);
  }

  function handleCurrencyChange(curr: InvoiceCurrency) {
    setCurrency(curr);
    void regeneratePDF(language, curr);
  }

  async function handleDownload() {
    const url = pdfUrl ?? await (async () => {
      setPdfLoading(true);
      const u = await generatePDF(invoice.id, { language, currency });
      setPdfLoading(false);
      if (u) setPdfUrl(u);
      return u;
    })();
    if (!url) { toast.error("Hiba a PDF generálásakor"); return; }
    const a = document.createElement("a");
    a.href = url;
    a.download = `${invoice.invoice_number}.pdf`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  async function handleSendEmail() {
    const result = await sendInvoiceEmail(invoice.id);
    if (result) {
      setInvoice((inv) => ({ ...inv, status: "sent" as InvoiceStatus, sent_at: new Date().toISOString() }));
      toast.success("Számla kiállítottnak jelölve");
      router.push(`/emails?invoice=${invoice.id}`);
    } else toast.error("Hiba a küldés során");
  }

  async function handleMarkPaid() {
    const ok = await markAsPaid(invoice.id);
    if (ok) {
      setInvoice((inv) => ({ ...inv, status: "paid" as InvoiceStatus, paid_at: new Date().toISOString() }));
      toast.success("Számla befizettnek jelölve");
    } else toast.error("Hiba a módosítás során");
    setShowPaid(false);
  }

  async function handleDelete() {
    const ok = await deleteInvoice(invoice.id);
    if (ok) {
      toast.success(isEditable ? "Számla törölve" : "Számla lemondva");
      router.push("/invoices");
    } else toast.error("Hiba a törlés során");
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <Button variant="ghost" asChild className="-ml-2 text-zinc-500 hover:text-zinc-900">
        <Link href="/invoices">
          <ArrowLeft className="mr-1.5 h-4 w-4" />Vissza a számlákhoz
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold font-mono text-zinc-900">{invoice.invoice_number}</h1>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
          <p className="text-zinc-500 text-sm">
            {client.last_name} {client.first_name} · {fmtDE(invoice.issue_date)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Language toggle */}
          <div className="flex rounded-md border border-zinc-200 overflow-hidden text-xs font-medium">
            {(["hu", "de", "bilingual"] as InvoiceLanguage[]).map((l) => (
              <button
                key={l}
                onClick={() => handleLanguageChange(l)}
                className={cn(
                  "px-2.5 py-1.5 transition-colors",
                  language === l
                    ? "bg-zinc-800 text-white"
                    : "bg-white text-zinc-600 hover:bg-zinc-50",
                  l !== "hu" && "border-l border-zinc-200",
                )}
              >
                {l === "bilingual" ? "HU+DE" : l.toUpperCase()}
              </button>
            ))}
          </div>
          {/* Currency toggle */}
          <div className="flex rounded-md border border-zinc-200 overflow-hidden text-xs font-medium">
            {(["EUR", "HUF"] as InvoiceCurrency[]).map((c) => (
              <button
                key={c}
                onClick={() => handleCurrencyChange(c)}
                className={cn(
                  "px-2.5 py-1.5 transition-colors",
                  currency === c
                    ? "bg-zinc-800 text-white"
                    : "bg-white text-zinc-600 hover:bg-zinc-50",
                  c === "HUF" && "border-l border-zinc-200",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={pdfLoading}>
            {pdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            PDF letöltés
          </Button>
          <Button variant="outline" size="sm" onClick={handleSendEmail}>
            <Mail className="mr-2 h-4 w-4" />Email küldés
          </Button>
          {!isPaid && !isCancelled && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => setShowPaid(true)}
            >
              <CheckCircle className="mr-2 h-4 w-4" />Fizetve jelöl
            </Button>
          )}
          {isEditable && (
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />Töröl
            </Button>
          )}
        </div>
      </div>

      {/* Two-column: PDF viewer + sidebar */}
      <div className="flex gap-6 items-start">

        {/* PDF viewer */}
        <div className="flex-[3] rounded-md border border-zinc-200 overflow-hidden min-h-[600px]" style={{ height: "calc(100vh - 220px)" }}>
          {pdfLoading && !pdfUrl ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-xs text-zinc-400">PDF betöltése…</p>
              </div>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full border-0"
              title={`Számla ${invoice.invoice_number}`}
              onLoad={() => setIframeLoaded(true)}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-400 text-sm">
              PDF nem elérhető
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex-[1.5] space-y-4 min-w-[200px]">
          {/* Financial summary */}
          <div className="rounded-md border border-zinc-200 bg-white p-4 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">
              Összefoglaló
            </h4>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Nettobetrag</span>
              <span className="font-medium">{fmtEur(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">MwSt. {invoice.tax_rate}%</span>
              <span className="font-medium">{fmtEur(invoice.tax_amount)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-zinc-100 pt-2 font-semibold">
              <span>Gesamtbetrag</span>
              <span className="text-zinc-900">{fmtEur(invoice.total)}</span>
            </div>
          </div>

          {/* Client info */}
          <div className="rounded-md border border-zinc-200 bg-white p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">Ügyfél</h4>
            <p className="text-sm font-medium text-zinc-900">{client.last_name} {client.first_name}</p>
            {client.email && <p className="text-xs text-zinc-500 mt-0.5">{client.email}</p>}
            {client.address_city && (
              <p className="text-xs text-zinc-400 mt-0.5">{client.address_zip} {client.address_city}</p>
            )}
            <Link href={`/clients/${client.id}`} className="mt-2 block text-xs text-blue-600 hover:underline">
              Ügyfél profil →
            </Link>
          </div>

          {/* Timeline */}
          <div className="rounded-md border border-zinc-200 bg-white p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-4">Időszak</h4>
            <div className="space-y-4">
              <TimelineItem
                icon={Clock}
                label="Létrehozva"
                date={invoice.created_at}
                active
              />
              <TimelineItem
                icon={Send}
                label="Kiállítva / Elküldve"
                date={invoice.sent_at}
                active={!!invoice.sent_at || ["sent", "paid"].includes(invoice.status)}
              />
              <TimelineItem
                icon={Check}
                label="Befizetve"
                date={invoice.paid_at}
                active={invoice.status === "paid"}
              />
            </div>
          </div>

          {/* Dates */}
          <div className="rounded-md border border-zinc-200 bg-white p-4 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">Dátumok</h4>
            {[
              { label: "Rechnungsdatum", value: fmtDE(invoice.issue_date) },
              { label: "Zahlungsziel", value: fmtDE(invoice.due_date) },
              { label: "Lieferdatum", value: fmtDE(invoice.service_date) },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-xs">
                <span className="text-zinc-400">{label}</span>
                <span className="font-medium text-zinc-700">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showPaid}
        title="Fizetve jelölés"
        description={`Biztosan befizettnek jelölöd a(z) ${invoice.invoice_number} számlát?`}
        confirmLabel="Igen, fizetve"
        onConfirm={handleMarkPaid}
        onCancel={() => setShowPaid(false)}
      />
      <ConfirmDialog
        open={showDelete}
        variant="danger"
        title="Számla törlése"
        description={`A(z) ${invoice.invoice_number} piszkozat véglegesen törlődik.`}
        confirmLabel="Törlés"
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
