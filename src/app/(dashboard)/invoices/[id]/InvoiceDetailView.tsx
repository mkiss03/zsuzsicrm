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
  Pencil,
  Check,
  X,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { hu } from "date-fns/locale";

import { useInvoices } from "@/hooks/useInvoices";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { InvoiceStatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Invoice, InvoiceStatus, Client, EmailTemplate } from "@/types";

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

// ─── Send-email modal ─────────────────────────────────────────────────────────

interface SendEmailModalProps {
  invoice: Invoice & { client: Client };
  onClose: () => void;
  onSent: () => void;
}

function interpolatePreview(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `[${key}]`);
}

function SendEmailModal({ invoice, onClose, onSent }: SendEmailModalProps) {
  const supabase = createBrowserClient();
  const [templates, setTemplates]           = useState<EmailTemplate[]>([]);
  const [templateId, setTemplateId]         = useState<string>("none");
  const [recipientEmail, setRecipientEmail] = useState(invoice.client.email ?? "");
  const [sending, setSending]               = useState(false);
  const [loadingTpl, setLoadingTpl]         = useState(true);
  const [bookingVars, setBookingVars]       = useState<Record<string, string>>({});

  // Load templates
  useEffect(() => {
    supabase.from("email_templates").select("*").order("name")
      .then(({ data }) => { setTemplates((data ?? []) as EmailTemplate[]); setLoadingTpl(false); });
  }, []);

  // Load booking + trip variables if invoice has a booking_id
  useEffect(() => {
    if (!invoice.booking_id) return;
    supabase.from("bookings").select("*, trip:trips(*)")
      .eq("id", invoice.booking_id).single()
      .then(({ data }) => {
        if (!data) return;
        const trip = (data as { trip?: Record<string, unknown> }).trip ?? {};
        const bk   = data as Record<string, unknown>;
        setBookingVars({
          trip_name:        (trip.name as string) ?? "",
          ut_neve:          (trip.name as string) ?? "",
          departure_date:   (trip.departure_date as string)?.slice(0, 10) ?? "",
          indulas_datum:    (trip.departure_date as string)?.slice(0, 10) ?? "",
          return_date:      (trip.return_date as string)?.slice(0, 10) ?? "",
          visszaerkezes_datum: (trip.return_date as string)?.slice(0, 10) ?? "",
          booking_code:     (bk.booking_code as string) ?? "",
          foglalas_kod:     (bk.booking_code as string) ?? "",
          departure_time:   (trip.departure_time as string) ?? "",
          indulasi_ido:     (trip.departure_time as string) ?? "",
          meeting_point:    (trip.meeting_point as string) ?? "",
          talalkozasi_pont: (trip.meeting_point as string) ?? "",
        });
      });
  }, [invoice.booking_id]);

  // Build preview variables
  const clientName = `${invoice.client.last_name} ${invoice.client.first_name}`.trim();
  const fmtTotal = invoice.total ? `€ ${invoice.total.toFixed(2).replace(".", ",")}` : "—";
  const previewVars: Record<string, string> = {
    ...bookingVars,
    client_name:      clientName,
    ugyfel_neve:      clientName,
    invoice_number:   invoice.invoice_number,
    szamla_szam:      invoice.invoice_number,
    total:            fmtTotal,
    vegosszeg:        fmtTotal,
    due_date:         invoice.due_date ? invoice.due_date.slice(0, 10) : "—",
    fizetes_hatarido: invoice.due_date ? invoice.due_date.slice(0, 10) : "—",
    issue_date:       invoice.issue_date ? invoice.issue_date.slice(0, 10) : "—",
    kiallitas_datum:  invoice.issue_date ? invoice.issue_date.slice(0, 10) : "—",
  };

  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null;
  const previewSubject = selectedTemplate
    ? interpolatePreview(selectedTemplate.subject, previewVars)
    : `Számla: ${invoice.invoice_number}`;
  const previewBody = selectedTemplate
    ? interpolatePreview(selectedTemplate.body, previewVars)
    : `Mellékletben találja a(z) ${invoice.invoice_number} számú számláját.\n\nKöszönjük!`;

  async function handleSend() {
    if (!recipientEmail) { toast.error("Adj meg email-t!"); return; }
    setSending(true);
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: templateId === "none" ? null : templateId,
          recipientEmail,
        }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? "Ismeretlen hiba");
      toast.success("Számla elküldve PDF csatolással!");
      onSent();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Küldési hiba");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg space-y-5 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Számla küldése emailben</h2>
            <p className="text-xs text-zinc-400 mt-0.5">{invoice.invoice_number} · PDF automatikusan csatolva</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Recipient */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Címzett email <span className="text-red-500">*</span></Label>
          <Input
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="pelda@email.com"
          />
          <p className="text-xs text-zinc-400">
            Ügyfél: <span className="font-medium text-zinc-600">{clientName}</span>
            {invoice.client.email && invoice.client.email !== recipientEmail && (
              <button
                className="ml-2 text-blue-500 hover:underline"
                onClick={() => setRecipientEmail(invoice.client.email!)}
              >
                Visszaállítás ({invoice.client.email})
              </button>
            )}
          </p>
        </div>

        {/* Template selector */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Email sablon</Label>
          {loadingTpl ? (
            <div className="h-9 rounded-md border border-zinc-200 bg-zinc-50 animate-pulse" />
          ) : (
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sablon nélkül (alap szöveg) —</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}{t.type ? ` · ${t.type}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 mb-1">Tárgy</p>
            <p className="text-sm text-zinc-800">{previewSubject}</p>
          </div>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 max-h-44 overflow-y-auto">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 mb-1">Email szöveg előnézet</p>
            <Textarea
              readOnly
              value={previewBody}
              rows={6}
              className="text-xs text-zinc-700 bg-transparent border-0 shadow-none resize-none p-0 focus-visible:ring-0"
            />
          </div>
          <p className="text-[10px] text-zinc-400">A változók ({"{{"}...{"}}"}) automatikusan ki lesznek töltve küldéskor.</p>
        </div>

        {/* Attachment note */}
        <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-100 px-3 py-2">
          <FileDown className="h-4 w-4 text-blue-500 flex-shrink-0" />
          <p className="text-xs text-blue-700 font-medium">{invoice.invoice_number}.pdf csatolva lesz az emailhez</p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={sending}>Mégse</Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={handleSend}
            disabled={sending || !recipientEmail}
          >
            {sending
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Küldés…</>
              : <><Send className="mr-2 h-4 w-4" />Küldés PDF-fel</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface Props {
  invoice: Invoice & { client: Client };
  settings: Record<string, string>;
}

export function InvoiceDetailView({ invoice: initialInvoice, settings }: Props) {
  const router = useRouter();
  const { markAsPaid, deleteInvoice, generatePDF } = useInvoices();

  const [invoice, setInvoice]           = useState(initialInvoice);
  const [pdfUrl, setPdfUrl]             = useState<string | null>(null);
  const [pdfLoading, setPdfLoading]     = useState(false);
  const [showPaid, setShowPaid]         = useState(false);
  const [showDelete, setShowDelete]     = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const { client } = invoice;
  const isEditable  = invoice.status === "draft";
  const isPaid      = invoice.status === "paid";
  const isCancelled = invoice.status === "cancelled";

  async function regeneratePDF() {
    setPdfUrl(null);
    setIframeLoaded(false);
    setPdfLoading(true);
    const url = await generatePDF(invoice.id);
    setPdfLoading(false);
    if (url) setPdfUrl(url);
    else toast.error("Hiba a PDF generalasakor");
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void regeneratePDF(); }, []);

  async function handleDownload() {
    const url = pdfUrl ?? await (async () => {
      setPdfLoading(true);
      const u = await generatePDF(invoice.id);
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

  function handleEmailSent() {
    setInvoice((inv) => ({ ...inv, status: "sent" as InvoiceStatus, sent_at: new Date().toISOString() }));
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
          {isEditable && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/invoices/${invoice.id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />Szerkesztés
              </Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleDownload} disabled={pdfLoading}>
            {pdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            PDF letöltés
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEmailModal(true)}
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
          >
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
          {/* "not used" suppression */}
          {iframeLoaded && false && null}
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

      {/* ── Email send modal ────────────────────────────────────────────────── */}
      {showEmailModal && (
        <SendEmailModal
          invoice={invoice}
          onClose={() => setShowEmailModal(false)}
          onSent={handleEmailSent}
        />
      )}

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
