"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Star,
  FileWarning,
  TrendingUp,
  Plus,
  Download,
  Eye,
  Pencil,
  Trash2,
  MoreHorizontal,
  Search,
  X,
} from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";
import { toast } from "sonner";

import { useClients, type ClientListParams } from "@/hooks/useClients";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsCard } from "@/components/shared/StatsCard";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Client, ClientSource } from "@/types";
import type { ClientStats } from "@/hooks/useClients";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const DISCOUNT_LABELS: Record<number, { label: string; variant: "muted" | "info" | "warning" | "success" }> = {
  0: { label: "Alap",       variant: "muted" },
  1: { label: "Bronz 5%",   variant: "info" },
  2: { label: "Ezüst 10%",  variant: "warning" },
  3: { label: "Arany 15%",  variant: "success" },
};

const SOURCE_LABELS: Record<ClientSource, string> = {
  messenger:    "Messenger",
  website_form: "Weboldal",
  referral:     "Ajánlás",
  other:        "Egyéb",
};

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(clients: Client[]) {
  const headers = ["Kód", "Vezetéknév", "Keresztnév", "Email", "Telefon", "Város", "Ország", "VIP", "Utak", "Összes költ.", "Kedvezmény szint", "Útlevél lejárat", "Forrás", "Regisztrálva"];
  const rows = clients.map((c) => [
    c.client_code,
    c.last_name,
    c.first_name,
    c.email ?? "",
    c.phone ?? "",
    c.address_city ?? "",
    c.address_country,
    c.is_vip ? "Igen" : "Nem",
    String(c.trip_count),
    String(c.total_spent),
    String(c.discount_level),
    c.passport_expiry ?? "",
    c.source ? SOURCE_LABELS[c.source] : "",
    c.created_at.slice(0, 10),
  ]);

  const csv =
    "﻿" + // BOM for Excel
    [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ugyfelek-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── PassportCell ─────────────────────────────────────────────────────────────

function PassportCell({ expiry }: { expiry: string | null }) {
  if (!expiry) return <span className="text-zinc-400">—</span>;
  const days = differenceInDays(parseISO(expiry), new Date());
  const className =
    days < 0
      ? "text-red-600 font-medium"
      : days < 60
      ? "text-red-500"
      : days < 180
      ? "text-amber-600"
      : "text-zinc-700";
  return <span className={className}>{formatDate(expiry)}</span>;
}

// ─── StatsRow ─────────────────────────────────────────────────────────────────

function StatsRow({ stats }: { stats: ClientStats | null }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-md border border-zinc-200 p-5">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
      <StatsCard
        title="Összes ügyfél"
        value={stats.total.toLocaleString("hu-HU")}
        icon={Users}
      />
      <StatsCard
        title="VIP ügyfelek"
        value={stats.vipCount.toLocaleString("hu-HU")}
        subtitle={stats.total > 0 ? `${((stats.vipCount / stats.total) * 100).toFixed(1)}%` : ""}
        icon={Star}
      />
      <StatsCard
        title="Lejáró útlevelek"
        value={stats.expiringPassports.toLocaleString("hu-HU")}
        subtitle="60 napon belül"
        icon={FileWarning}
      />
      <StatsCard
        title="Átlag utazás/ügyfél"
        value={stats.avgTrips.toFixed(1)}
        icon={TrendingUp}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const router = useRouter();
  const { getClients, searchClients, deleteClient, getClientStats, loading } = useClients();

  // Pagination + filter state
  const [clients, setClients] = useState<Client[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<ClientStats | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [source, setSource] = useState<string>("all");
  const [vipFilter, setVipFilter] = useState<string>("all");
  const [discountFilter, setDiscountFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // CSV export loading
  const [exporting, setExporting] = useState(false);

  // Debounce search
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [debouncedSearch, source, vipFilter, discountFilter, sortBy, sortDir]);

  // Fetch clients
  useEffect(() => {
    const params: ClientListParams = {
      page,
      pageSize: PAGE_SIZE,
      search: debouncedSearch || undefined,
      source: source !== "all" ? (source as ClientSource) : null,
      isVip: vipFilter === "vip" ? true : vipFilter === "nonvip" ? false : null,
      discountLevel: discountFilter !== "all" ? Number(discountFilter) : null,
      sortBy: sortBy as ClientListParams["sortBy"],
      sortDirection: sortDir,
    };
    void getClients(params).then((res) => {
      if (res) { setClients(res.data); setCount(res.count); }
    });
  }, [page, debouncedSearch, source, vipFilter, discountFilter, sortBy, sortDir]);

  // Fetch stats once on mount
  useEffect(() => {
    void getClientStats().then((s) => { if (s) setStats(s); });
  }, []);

  // Handle delete
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const ok = await deleteClient(deleteTarget.id);
    setDeleteLoading(false);
    setDeleteTarget(null);
    if (ok) {
      toast.success("Ügyfél sikeresen törölve");
      setClients((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setCount((n) => n - 1);
    } else {
      toast.error("Hiba a törlés során");
    }
  }

  // Handle CSV export
  async function handleExport() {
    setExporting(true);
    const all = await searchClients({
      search: debouncedSearch || undefined,
      source: source !== "all" ? (source as ClientSource) : null,
      isVip: vipFilter === "vip" ? true : vipFilter === "nonvip" ? false : null,
      discountLevel: discountFilter !== "all" ? Number(discountFilter) : null,
    });
    setExporting(false);
    if (all && all.length > 0) {
      exportCSV(all);
    } else {
      toast.info("Nincs exportálható adat");
    }
  }

  // ── Column definitions ─────────────────────────────────────────────────────
  const columns: Column<Client>[] = [
    {
      key: "client_code",
      header: "Kód",
      className: "font-mono text-xs text-zinc-500 w-28",
      render: (v) => String(v),
    },
    {
      key: "last_name",
      header: "Név",
      sortable: true,
      render: (_, row) => (
        <Link
          href={`/clients/${row.id}`}
          className="font-medium text-zinc-900 hover:text-blue-600 hover:underline"
        >
          {row.last_name} {row.first_name}
        </Link>
      ),
    },
    {
      key: "email",
      header: "Email",
      className: "max-w-[200px]",
      render: (v) =>
        v ? (
          <span className="truncate block text-zinc-600" title={String(v)}>
            {String(v)}
          </span>
        ) : (
          <span className="text-zinc-400">—</span>
        ),
    },
    {
      key: "phone",
      header: "Telefon",
      render: (v) => v ? <span className="text-zinc-700">{String(v)}</span> : <span className="text-zinc-400">—</span>,
    },
    {
      key: "trip_count",
      header: "Utak",
      className: "text-right",
      sortable: true,
      render: (v) => (
        <Badge variant={Number(v) > 0 ? "info" : "muted"}>
          {String(v)}
        </Badge>
      ),
    },
    {
      key: "discount_level",
      header: "Kedvezmény",
      render: (v) => {
        const lvl = Number(v);
        const meta = DISCOUNT_LABELS[lvl] ?? DISCOUNT_LABELS[0];
        return <Badge variant={meta!.variant}>{meta!.label}</Badge>;
      },
    },
    {
      key: "is_vip",
      header: "VIP",
      className: "text-center",
      render: (v) =>
        v ? (
          <Star className="h-4 w-4 fill-amber-400 text-amber-400 mx-auto" />
        ) : (
          <Star className="h-4 w-4 text-zinc-200 mx-auto" />
        ),
    },
    {
      key: "passport_expiry",
      header: "Útlevél lejárat",
      render: (v) => <PassportCell expiry={v as string | null} />,
    },
    {
      key: "id",
      header: "",
      className: "w-10 text-right",
      render: (_, row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Műveletek</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => router.push(`/clients/${row.id}`)}>
              <Eye className="mr-2 h-4 w-4" />
              Megtekint
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/clients/${row.id}/edit`)}>
              <Pencil className="mr-2 h-4 w-4" />
              Szerkeszt
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
              onClick={() => setDeleteTarget(row)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Töröl
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <PageHeader
        title="Ügyfelek"
        subtitle={`${count.toLocaleString("hu-HU")} ügyfél összesen`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exporting}
            >
              <Download className="mr-2 h-4 w-4" />
              {exporting ? "Exportálás…" : "CSV export"}
            </Button>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href="/clients/new">
                <Plus className="mr-2 h-4 w-4" />
                Új ügyfél
              </Link>
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <StatsRow stats={stats} />

      {/* Search + Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keresés…"
            className="pl-9 h-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Source filter */}
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Összes forrás</SelectItem>
            <SelectItem value="messenger">Messenger</SelectItem>
            <SelectItem value="website_form">Weboldal</SelectItem>
            <SelectItem value="referral">Ajánlás</SelectItem>
            <SelectItem value="other">Egyéb</SelectItem>
          </SelectContent>
        </Select>

        {/* VIP filter */}
        <Select value={vipFilter} onValueChange={setVipFilter}>
          <SelectTrigger className="h-9 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mindenki</SelectItem>
            <SelectItem value="vip">VIP</SelectItem>
            <SelectItem value="nonvip">Nem VIP</SelectItem>
          </SelectContent>
        </Select>

        {/* Discount filter */}
        <Select value={discountFilter} onValueChange={setDiscountFilter}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Összes szint</SelectItem>
            <SelectItem value="0">Alap (0%)</SelectItem>
            <SelectItem value="1">Bronz (5%)</SelectItem>
            <SelectItem value="2">Ezüst (10%)</SelectItem>
            <SelectItem value="3">Arany (15%)</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select
          value={`${sortBy}:${sortDir}`}
          onValueChange={(v) => {
            const [key, dir] = v.split(":");
            setSortBy(key ?? "created_at");
            setSortDir((dir ?? "desc") as "asc" | "desc");
          }}
        >
          <SelectTrigger className="h-9 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last_name:asc">Név (A–Z)</SelectItem>
            <SelectItem value="last_name:desc">Név (Z–A)</SelectItem>
            <SelectItem value="created_at:desc">Legújabb</SelectItem>
            <SelectItem value="created_at:asc">Legrégebbi</SelectItem>
            <SelectItem value="trip_count:desc">Legtöbb utazás</SelectItem>
            <SelectItem value="total_spent:desc">Legtöbb költ.</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <DataTable<Client>
        columns={columns}
        data={clients}
        loading={loading}
        keyField="id"
        onSort={(key, dir) => { setSortBy(key); setSortDir(dir); }}
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total: count,
          onPageChange: setPage,
        }}
        emptyTitle="Nincs még ügyfél"
        emptyDescription="Adj hozzá az első ügyfelet az 'Új ügyfél' gombbal."
        emptyIcon={Users}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        variant="danger"
        title="Ügyfél törlése"
        description={
          deleteTarget
            ? `Biztosan törlöd ${deleteTarget.last_name} ${deleteTarget.first_name} ügyfelet? Ez a művelet visszavonható az adatbázisból, de az adatok nem lesznek láthatók a rendszerben.`
            : ""
        }
        confirmLabel="Törlés"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
