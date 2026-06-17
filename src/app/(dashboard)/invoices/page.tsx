"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  FileDown,
  Mail,
  CheckCircle,
  Trash2,
  MoreHorizontal,
  Receipt,
  TrendingUp,
  AlertCircle,
  Clock,
  Pencil,
} from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";
import { toast } from "sonner";

import { useInvoices, type InvoiceListParams, type InvoiceRow, type InvoiceStats } from "@/hooks/useInvoices";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsCard } from "@/components/shared/StatsCard";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { InvoiceStatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Client, InvoiceStatus } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// ─── Due date cell ────────────────────────────────────────────────────────────

function DueDateCell({ due, status }: { due: string | null; status: InvoiceStatus }) {
  if (!due) return <span className="text-zinc-400">—</span>;
  if (["paid", "cancelled"].includes(status)) return <span className="text-zinc-500">{formatDate(due)}</span>;
  const days = differenceInDays(parseISO(due), new Date());
  return (
    <span className={cn("text-sm", days < 0 ? "text-red-600 font-bold" : "text-zinc-700")}>
      {formatDate(due)}
      {days < 0 && <span className="ml-1 text-xs font-normal">({Math.abs(days)} napja lejárt)</span>}
    </span>
  );
}

// ─── Stats row ────────────────────────────────────────────────────────────────

function StatsRow({ stats, fmt }: { stats: InvoiceStats | null; fmt: (n: number | null | undefined) => string }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-md border border-zinc-200 p-5">
            <Skeleton className="h-4 w-24 mb-3" /><Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
      <StatsCard title="Összes kiállítva"   value={fmt(stats.totalInvoiced)}   icon={Receipt} />
      <StatsCard title="Befizetve"           value={fmt(stats.totalPaid)}       icon={CheckCircle} />
      <StatsCard title="Kintlévő"            value={fmt(stats.totalOutstanding)} icon={Clock} />
      <StatsCard
        title="Lejárt"
        value={fmt(stats.totalOverdue)}
        icon={AlertCircle}
        className={stats.overdueCount > 0 ? "border-red-200 bg-red-50/30" : ""}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const router = useRouter();
  const supabase = createBrowserClient();
  const { getInvoices, getInvoiceStats, markAsPaid, deleteInvoice, generatePDF, sendInvoiceEmail, loading } = useInvoices();

  const [invoices, setInvoices]     = useState<InvoiceRow[]>([]);
  const [count, setCount]           = useState(0);
  const [page, setPage]             = useState(1);
  const [stats, setStats]           = useState<InvoiceStats | null>(null);
  const [clients, setClients]       = useState<Pick<Client, "id" | "first_name" | "last_name">[]>([]);

  const [statusFilter, setStatusFilter]   = useState("all");
  const [clientFilter, setClientFilter]   = useState("all");
  const [monthFilter, setMonthFilter]     = useState("");

  const [paidTarget, setPaidTarget]       = useState<InvoiceRow | null>(null);
  const [deleteTarget, setDeleteTarget]   = useState<InvoiceRow | null>(null);
  const [downloading, setDownloading]     = useState<string | null>(null);
  const [currency, setCurrency]           = useState<"HUF" | "EUR">("EUR");
  const [eurRate, setEurRate]             = useState<number>(400);

  const CURRENT_MONTH = new Date().toISOString().slice(0, 7);
  const MONTHS = Array.from({ length: 18 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const val = d.toISOString().slice(0, 7);
    return { value: val, label: val.replace("-", ". ") + "." };
  });

  useEffect(() => { setPage(1); }, [statusFilter, clientFilter, monthFilter]);

  useEffect(() => {
    const params: InvoiceListParams = {
      page,
      pageSize: PAGE_SIZE,
      status: statusFilter !== "all" ? (statusFilter as InvoiceStatus) : null,
      clientId: clientFilter !== "all" ? clientFilter : null,
      month: monthFilter || null,
    };
    void getInvoices(params).then((res) => {
      if (res) { setInvoices(res.data); setCount(res.count); }
    });
  }, [page, statusFilter, clientFilter, monthFilter]);

  useEffect(() => {
    void getInvoiceStats().then((s) => { if (s) setStats(s); });
    supabase.from("clients").select("id, first_name, last_name").is("deleted_at", null).order("last_name")
      .then(({ data }) => setClients((data ?? []) as typeof clients));
    fetch("/api/exchange-rate")
      .then((r) => r.json() as Promise<{ rate?: number }>)
      .then((d) => { if (d.rate) setEurRate(d.rate); })
      .catch(() => { });
  }, []);

  const fmt = useCallback(
    (n: number | null | undefined): string => {
      if (n == null) return currency === "EUR" ? "€ —" : "— Ft";
      return currency === "EUR"
        ? new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n)
        : new Intl.NumberFormat("hu-HU", { style: "currency", currency: "HUF", maximumFractionDigits: 0 }).format(n * eurRate);
    },
    [currency, eurRate],
  );

  // Outstanding amount of current visible rows
  const today = new Date().toISOString().slice(0, 10);
  const outstandingVisible = invoices
    .filter((inv) => !["paid", "cancelled"].includes(inv.status))
    .reduce((s, inv) => s + (inv.total ?? 0), 0);

  async function handleMarkPaid() {
    if (!paidTarget) return;
    const ok = await markAsPaid(paidTarget.id);
    if (ok) {
      setInvoices((prev) => prev.map((inv) => inv.id === paidTarget.id ? { ...inv, status: "paid" as InvoiceStatus } : inv));
      setStats((s) => s ? {
        ...s,
        totalPaid: s.totalPaid + (paidTarget.total ?? 0),
        totalOutstanding: s.totalOutstanding - (paidTarget.total ?? 0),
      } : s);
      toast.success("Számla befizettnek jelölve");
    } else toast.error("Hiba a módosítás során");
    setPaidTarget(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const ok = await deleteInvoice(deleteTarget.id);
    if (ok) {
      setInvoices((prev) => prev.filter((inv) => inv.id !== deleteTarget.id));
      setCount((n) => n - 1);
      toast.success("Számla törölve");
    } else toast.error("Hiba a törlés során");
    setDeleteTarget(null);
  }

  async function handleDownloadPDF(inv: InvoiceRow) {
    setDownloading(inv.id);
    const url = await generatePDF(inv.id);
    setDownloading(null);
    if (url) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `${inv.invoice_number}.pdf`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } else toast.error("Hiba a PDF generálásakor");
  }

  async function handleSendEmail(inv: InvoiceRow) {
    const result = await sendInvoiceEmail(inv.id);
    if (result) {
      setInvoices((prev) => prev.map((i) => i.id === inv.id ? { ...i, status: "sent" as InvoiceStatus } : i));
      toast.success(`${inv.invoice_number} kiállítottnak jelölve`);
      router.push(`/emails?invoice=${inv.id}`);
    } else toast.error("Hiba a küldés során");
  }

  const isOverdue = (inv: InvoiceRow) =>
    inv.due_date != null && inv.due_date < today && !["paid", "cancelled"].includes(inv.status);

  return (
    <div>
      <PageHeader
        title="Számlák"
        subtitle={`${count.toLocaleString("hu-HU")} számla`}
        actions={
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href="/invoices/new">
              <Plus className="mr-2 h-4 w-4" />Új számla
            </Link>
          </Button>
        }
      />

      <StatsRow stats={stats} fmt={fmt} />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-zinc-200 p-0.5">
          {(["HUF", "EUR"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded transition-colors",
                currency === c ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900",
              )}
            >
              {c === "HUF" ? "Ft" : "€ EUR"}
            </button>
          ))}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Összes státusz</SelectItem>
            <SelectItem value="draft">Piszkozat</SelectItem>
            <SelectItem value="sent">Kiküldve</SelectItem>
            <SelectItem value="paid">Fizetve</SelectItem>
            <SelectItem value="overdue">Lejárt</SelectItem>
            <SelectItem value="cancelled">Lemondva</SelectItem>
          </SelectContent>
        </Select>

        <Select value={monthFilter || "all"} onValueChange={(v) => setMonthFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="Összes hónap" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Összes hónap</SelectItem>
            {MONTHS.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="h-9 w-48">
            <SelectValue placeholder="Összes ügyfél" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Összes ügyfél</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.last_name} {c.first_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border border-zinc-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 text-left">Számlaszám</th>
              <th className="px-4 py-3 text-left">Ügyfél</th>
              <th className="px-4 py-3 text-left">Kiállítva</th>
              <th className="px-4 py-3 text-left">Fizetési határidő</th>
              <th className="px-4 py-3 text-right">Összeg</th>
              <th className="px-4 py-3 text-left">Státusz</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 7 }).map((_, j) => (
                  <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                ))}
              </tr>
            ))}

            {!loading && invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-zinc-400">
                  Nincs számla a szűrőfeltételek alapján
                </td>
              </tr>
            )}

            {!loading && invoices.map((inv) => (
              <tr
                key={inv.id}
                className={cn(
                  "hover:bg-zinc-50 transition-colors",
                  isOverdue(inv) && "bg-red-50/50 hover:bg-red-50",
                )}
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="font-mono text-sm font-medium text-zinc-900 hover:text-blue-600 hover:underline"
                  >
                    {inv.invoice_number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-700">
                  {inv.client
                    ? <Link href={`/clients/${inv.client.id}`} className="hover:text-blue-600 hover:underline">
                        {inv.client.last_name} {inv.client.first_name}
                      </Link>
                    : "—"}
                </td>
                <td className="px-4 py-3 text-zinc-600">{formatDate(inv.issue_date)}</td>
                <td className="px-4 py-3">
                  <DueDateCell due={inv.due_date} status={inv.status} />
                </td>
                <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                  {fmt(inv.total)}
                </td>
                <td className="px-4 py-3">
                  <InvoiceStatusBadge status={inv.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      {inv.status === "draft" && (
                        <DropdownMenuItem onClick={() => router.push(`/invoices/${inv.id}/edit`)}>
                          <Pencil className="mr-2 h-4 w-4" />Szerkesztés
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => handleDownloadPDF(inv)}
                        disabled={downloading === inv.id}
                      >
                        <FileDown className="mr-2 h-4 w-4" />
                        {downloading === inv.id ? "Generálás…" : "PDF letöltés"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSendEmail(inv)}>
                        <Mail className="mr-2 h-4 w-4" />Email küldés
                      </DropdownMenuItem>
                      {!["paid", "cancelled"].includes(inv.status) && (
                        <DropdownMenuItem onClick={() => setPaidTarget(inv)}>
                          <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                          Fizetve jelöl
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                        onClick={() => setDeleteTarget(inv)}
                        disabled={inv.status === "paid"}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {inv.status === "draft" ? "Töröl" : "Lemondja"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>

          {/* Summary row */}
          {!loading && invoices.length > 0 && outstandingVisible > 0 && (
            <tfoot>
              <tr className="border-t-2 border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-600">
                <td colSpan={4} className="px-4 py-3">Kintlévő összesen (szűrt nézet)</td>
                <td className="px-4 py-3 text-right text-zinc-900">{fmt(outstandingVisible)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>

        {/* Pagination */}
        {count > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3">
            <span className="text-xs text-zinc-500">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, count)} / {count}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Előző
              </Button>
              <Button variant="outline" size="sm" disabled={page * PAGE_SIZE >= count} onClick={() => setPage((p) => p + 1)}>
                Következő
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!paidTarget}
        title="Fizetve jelölés"
        description={paidTarget ? `Biztosan befizettnek jelölöd a(z) ${paidTarget.invoice_number} számlát?` : ""}
        confirmLabel="Igen, fizetve"
        onConfirm={handleMarkPaid}
        onCancel={() => setPaidTarget(null)}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        variant="danger"
        title={deleteTarget?.status === "draft" ? "Számla törlése" : "Számla lemondása"}
        description={deleteTarget ? `${deleteTarget.invoice_number} – ${deleteTarget.status === "draft" ? "Ez véglegesen törli a számlát." : "A számla lemondottnak lesz jelölve."}` : ""}
        confirmLabel={deleteTarget?.status === "draft" ? "Törlés" : "Lemondás"}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
