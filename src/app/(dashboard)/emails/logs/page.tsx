"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Eye, Send, Search, X, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import type { EmailLog, EmailLogStatus, EmailTemplateType } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

const STATUS_META: Record<
  EmailLogStatus,
  { label: string; variant: "success" | "info" | "destructive" }
> = {
  sent:   { label: "Elküldve",   variant: "success" },
  opened: { label: "Megnyitva",  variant: "info" },
  failed: { label: "Sikertelen", variant: "destructive" },
};

const TYPE_LABELS: Record<EmailTemplateType, string> = {
  confirmation:    "Visszaigazolás",
  deposit_request: "Előleg bekérő",
  reminder:        "Emlékeztető",
  pre_trip:        "Út előtti",
  post_trip:       "Út utáni",
  promotional:     "Promóció",
};

type LogRow = EmailLog & {
  client: { id: string; first_name: string; last_name: string } | null;
  template: { name: string; type: string | null } | null;
};

// ─── Client combobox for filter ───────────────────────────────────────────────

interface ClientFilterProps {
  selectedId: string | null;
  selectedName: string;
  onSelect: (id: string | null, name: string) => void;
}

function ClientFilter({ selectedId, selectedName, onSelect }: ClientFilterProps) {
  const supabase = createClient();
  const [query, setQuery] = useState(selectedName);
  const [results, setResults] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debRef  = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!query.trim() || selectedId) { setResults([]); setOpen(false); return; }
    debRef.current = setTimeout(async () => {
      setBusy(true);
      const { data } = await supabase
        .from("clients")
        .select("id, first_name, last_name")
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
        .is("deleted_at", null)
        .limit(8);
      setResults((data ?? []) as typeof results);
      setOpen(true);
      setBusy(false);
    }, 300);
    return () => clearTimeout(debRef.current);
  }, [query, selectedId]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (selectedId) {
    return (
      <div className="flex h-9 items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm min-w-[160px]">
        <span className="truncate flex-1 text-zinc-900">{selectedName}</span>
        <button
          onClick={() => { onSelect(null, ""); setQuery(""); }}
          className="text-zinc-400 hover:text-zinc-700 flex-shrink-0"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative min-w-[160px]">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ügyfél neve…"
          className="pl-8 h-9 text-sm"
        />
        {busy && (
          <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-zinc-400" />
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg max-h-48 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-zinc-500">Nincs találat</p>
          ) : results.map((c) => (
            <button
              key={c.id}
              className="flex w-full items-center px-3 py-2.5 text-sm hover:bg-zinc-50 text-left border-b border-zinc-100 last:border-0"
              onClick={() => {
                onSelect(c.id, `${c.last_name} ${c.first_name}`);
                setQuery(`${c.last_name} ${c.first_name}`);
                setOpen(false);
              }}
            >
              {c.last_name} {c.first_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmailLogsPage() {
  const supabase = createClient();
  const [logs, setLogs]           = useState<LogRow[]>([]);
  const [count, setCount]         = useState(0);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [viewing, setViewing]     = useState<LogRow | null>(null);
  const [resending, setResending] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter]     = useState("all");
  const [fromDate, setFromDate]         = useState("");
  const [toDate, setToDate]             = useState("");
  const [clientId, setClientId]         = useState<string | null>(null);
  const [clientName, setClientName]     = useState("");

  // Reset to page 1 when any filter changes
  useEffect(() => { setPage(1); }, [statusFilter, typeFilter, fromDate, toDate, clientId]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;

    // Resolve template IDs for type filter (requires sub-lookup)
    let templateIds: string[] | null = null;
    if (typeFilter !== "all") {
      const { data: tmpls } = await supabase
        .from("email_templates")
        .select("id")
        .eq("type", typeFilter);
      templateIds = (tmpls ?? []).map((t) => (t as { id: string }).id);
      if (templateIds.length === 0) {
        // No templates of this type → empty result
        setLogs([]);
        setCount(0);
        setLoading(false);
        return;
      }
    }

    let query = supabase
      .from("email_logs")
      .select(
        "*, client:clients(id,first_name,last_name), template:email_templates(name,type)",
        { count: "exact" },
      )
      .order("sent_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (fromDate) query = query.gte("sent_at", fromDate);
    if (toDate)   query = query.lte("sent_at", toDate + "T23:59:59");
    if (clientId) query = query.eq("client_id", clientId);
    if (templateIds) query = query.in("template_id", templateIds);

    const { data, count: c } = await query;
    setLogs((data ?? []) as LogRow[]);
    setCount(c ?? 0);
    setLoading(false);
  }, [page, statusFilter, typeFilter, fromDate, toDate, clientId]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  async function handleResend(log: LogRow) {
    if (!log.client_id) { toast.error("Nincs ügyfél ehhez az emailhez"); return; }
    setResending(log.id);
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientIds:     [log.client_id],
          templateId:    log.template_id,
          bookingId:     log.booking_id,
          customSubject: log.subject,
          customBody:    log.body,
        }),
      });
      const result = await res.json() as { success: boolean; error?: string };
      if (result.success) {
        toast.success("Email újraküldve");
        void fetchLogs();
      } else {
        toast.error(result.error ?? "Hiba az újraküldés során");
      }
    } finally {
      setResending(null);
    }
  }

  const hasActiveFilters =
    statusFilter !== "all" || typeFilter !== "all" || fromDate || toDate || clientId;

  function clearFilters() {
    setStatusFilter("all");
    setTypeFilter("all");
    setFromDate("");
    setToDate("");
    setClientId(null);
    setClientName("");
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-zinc-500">
          {count.toLocaleString("hu-HU")} email összesen
        </p>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-zinc-500" onClick={clearFilters}>
              <X className="mr-1 h-3.5 w-3.5" />Szűrők törlése
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-8" onClick={() => void fetchLogs()}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" />Frissítés
          </Button>
        </div>
      </div>

      {/* Filters — all 4 from spec */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* 1. Client search */}
        <ClientFilter
          selectedId={clientId}
          selectedName={clientName}
          onSelect={(id, name) => { setClientId(id); setClientName(name); }}
        />

        {/* 2. Type filter */}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Összes típus</SelectItem>
            {(Object.entries(TYPE_LABELS) as [EmailTemplateType, string][]).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 3. Status filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Összes státusz</SelectItem>
            <SelectItem value="sent">Elküldve</SelectItem>
            <SelectItem value="opened">Megnyitva</SelectItem>
            <SelectItem value="failed">Sikertelen</SelectItem>
          </SelectContent>
        </Select>

        {/* 4a. Date from */}
        <Input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="h-9 w-36"
          title="Kezdő dátum"
        />

        {/* 4b. Date to */}
        <Input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="h-9 w-36"
          min={fromDate || undefined}
          title="Záró dátum"
        />
      </div>

      {/* Table */}
      <div className="rounded-md border border-zinc-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 text-left">Dátum</th>
              <th className="px-4 py-3 text-left">Ügyfél</th>
              <th className="px-4 py-3 text-left">Tárgy</th>
              <th className="px-4 py-3 text-left">Sablon / Típus</th>
              <th className="px-4 py-3 text-left">Státusz</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-14 text-center text-zinc-400 text-sm">
                  {hasActiveFilters
                    ? "A szűrőknek megfelelő email nem található."
                    : "Nincs email előzmény."}
                </td>
              </tr>
            )}

            {!loading && logs.map((log) => {
              const meta = log.status ? STATUS_META[log.status] : null;
              const typeLabel = log.template?.type
                ? (TYPE_LABELS[log.template.type as EmailTemplateType] ?? log.template.type)
                : null;

              return (
                <tr
                  key={log.id}
                  className="hover:bg-zinc-50 cursor-pointer"
                  onClick={() => setViewing(log)}
                >
                  <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                    {formatDate(log.sent_at)}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    {log.client
                      ? `${log.client.last_name} ${log.client.first_name}`
                      : <span className="text-zinc-400">—</span>}
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate text-zinc-700">
                    {log.subject}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      {log.template?.name
                        ? <span className="text-zinc-700">{log.template.name}</span>
                        : <span className="text-zinc-400">—</span>}
                      {typeLabel && (
                        <span className="text-[10px] text-zinc-400">{typeLabel}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {meta ? (
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div
                      className="flex items-center gap-1 justify-end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setViewing(log)}
                        title="Megtekintés"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {log.status === "failed" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-blue-600"
                          disabled={resending === log.id}
                          onClick={() => void handleResend(log)}
                          title="Újraküldés"
                        >
                          {resending === log.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Send className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        {count > PAGE_SIZE && !loading && (
          <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3">
            <span className="text-xs text-zinc-500">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, count)} / {count.toLocaleString("hu-HU")}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Előző
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page * PAGE_SIZE >= count}
                onClick={() => setPage((p) => p + 1)}
              >
                Következő
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Email detail dialog */}
      <Dialog open={!!viewing} onOpenChange={(v) => { if (!v) setViewing(null); }}>
        {viewing && (
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="truncate pr-8">{viewing.subject}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                <span>
                  {viewing.client
                    ? `${viewing.client.last_name} ${viewing.client.first_name}`
                    : "—"}
                </span>
                <span>{formatDate(viewing.sent_at)}</span>
                {viewing.template?.name && (
                  <span>{viewing.template.name}</span>
                )}
                {viewing.status && (
                  <Badge
                    variant={STATUS_META[viewing.status]?.variant ?? "muted"}
                    className="text-[10px]"
                  >
                    {STATUS_META[viewing.status]?.label}
                  </Badge>
                )}
              </div>
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 max-h-80 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-xs text-zinc-700 font-sans leading-relaxed">
                  {viewing.body}
                </pre>
              </div>
              {viewing.status === "failed" && (
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={resending === viewing.id}
                  onClick={() => void handleResend(viewing)}
                >
                  {resending === viewing.id
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <Send className="mr-2 h-4 w-4" />}
                  Újraküldés
                </Button>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
