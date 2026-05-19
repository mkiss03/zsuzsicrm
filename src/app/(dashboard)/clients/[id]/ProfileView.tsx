"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  MoreHorizontal,
  Star,
  CalendarCheck,
  Wallet,
  Tag,
  Clock,
  Plus,
  FileText,
  Mail,
  MessageSquare,
  Plane,
  Loader2,
  Upload,
  FileDown,
  FilePlus,
  Trash,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { hu } from "date-fns/locale";
import { differenceInDays } from "date-fns";

import { createClient } from "@/lib/supabase/client";
import { useClients } from "@/hooks/useClients";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatsCard } from "@/components/shared/StatsCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { BookingStatusBadge, InvoiceStatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Client, Booking, Invoice, EmailLog, Trip } from "@/types";

interface StorageFile {
  name: string;
  id: string | null;
  metadata: { size: number; mimetype: string };
  created_at: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DISCOUNT_META: Record<number, { label: string; variant: "muted" | "info" | "warning" | "success"; pct: string }> = {
  0: { label: "Alap",      variant: "muted",    pct: "0%" },
  1: { label: "Bronz",     variant: "info",     pct: "5%" },
  2: { label: "Ezüst",     variant: "warning",  pct: "10%" },
  3: { label: "Arany",     variant: "success",  pct: "15%" },
};

function timeAgo(iso: string) {
  try { return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: hu }); }
  catch { return ""; }
}

// ─── DataRow ──────────────────────────────────────────────────────────────────

function DataRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-2 gap-4 py-2.5 border-b border-zinc-100 last:border-0">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-900 font-medium">{value || "—"}</span>
    </div>
  );
}

// ─── TAB 1 – Adatok ───────────────────────────────────────────────────────────

function DataTab({ client }: { client: Client }) {
  const passportDays = client.passport_expiry
    ? differenceInDays(parseISO(client.passport_expiry), new Date())
    : null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-md border border-zinc-200 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Személyes adatok
        </h3>
        <DataRow label="Teljes név" value={`${client.last_name} ${client.first_name}`} />
        <DataRow label="Email" value={client.email} />
        <DataRow label="Telefon" value={client.phone} />
        <DataRow label="Születési dátum" value={formatDate(client.birth_date)} />
        <DataRow label="Állampolgárság" value={client.nationality} />
      </div>
      <div className="rounded-md border border-zinc-200 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Lakcím
        </h3>
        <DataRow label="Utca, házszám" value={client.address_street} />
        <DataRow label="Város" value={client.address_city} />
        <DataRow label="Irányítószám" value={client.address_zip} />
        <DataRow label="Ország" value={client.address_country} />
      </div>
      <div className="rounded-md border border-zinc-200 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Útlevél
        </h3>
        <DataRow label="Útlevélszám" value={client.passport_number} />
        <DataRow label="Lejárat" value={formatDate(client.passport_expiry)} />
        {passportDays !== null && passportDays < 180 && (
          <Alert variant={passportDays < 0 ? "destructive" : "warning"} className="mt-3">
            <AlertDescription>
              {passportDays < 0
                ? "Az útlevél lejárt!"
                : `Az útlevél ${passportDays} napon belül lejár!`}
            </AlertDescription>
          </Alert>
        )}
      </div>
      <div className="rounded-md border border-zinc-200 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          CRM adatok
        </h3>
        <DataRow label="Ügyfélkód" value={client.client_code} />
        <DataRow label="Forrás" value={client.source ?? undefined} />
        <DataRow label="Regisztrálva" value={formatDate(client.created_at)} />
        <DataRow label="Utoljára módosítva" value={formatDate(client.updated_at)} />
        {client.notes && (
          <div className="mt-3 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">
            {client.notes}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TAB 2 – Utazások ─────────────────────────────────────────────────────────

function BookingsTab({ clientId }: { clientId: string }) {
  const supabase = createClient();
  const [bookings, setBookings] = useState<(Booking & { trip: Pick<Trip, "name" | "destination" | "departure_date"> | null })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("bookings")
      .select("*, trip:trips(name, destination, departure_date)")
      .eq("client_id", clientId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setBookings((data as never) ?? []); setLoading(false); });
  }, [clientId]);

  if (loading) return <Skeleton className="h-40 w-full" />;
  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={Plane}
        title="Még nem volt utazás"
        description="Adj hozzá egy foglalást az ügyfélhez."
        action={
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href={`/bookings/new?client=${clientId}`}>
              <Plus className="mr-2 h-4 w-4" />
              Új foglalás
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-1">
      <div className="mb-3 flex justify-end">
        <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
          <Link href={`/bookings/new?client=${clientId}`}>
            <Plus className="mr-2 h-4 w-4" />
            Új foglalás hozzáadása
          </Link>
        </Button>
      </div>
      <div className="rounded-md border border-zinc-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 text-left">Út neve</th>
              <th className="px-4 py-3 text-left">Indulás</th>
              <th className="px-4 py-3 text-left">Állapot</th>
              <th className="px-4 py-3 text-right">Végösszeg</th>
              <th className="px-4 py-3 text-right">Előleg</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {bookings.map((b) => (
              <tr key={b.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3 font-medium text-zinc-900">
                  {b.trip?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {formatDate(b.trip?.departure_date)}
                </td>
                <td className="px-4 py-3">
                  <BookingStatusBadge status={b.status} />
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatCurrency(b.final_amount)}
                </td>
                <td className="px-4 py-3 text-right text-zinc-600">
                  {formatCurrency(b.deposit_amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── TAB 3 – Számlák ──────────────────────────────────────────────────────────

function InvoicesTab({ clientId }: { clientId: string }) {
  const supabase = createClient();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("invoices")
      .select("*")
      .eq("client_id", clientId)
      .order("issue_date", { ascending: false })
      .then(({ data }) => { setInvoices((data as Invoice[]) ?? []); setLoading(false); });
  }, [clientId]);

  if (loading) return <Skeleton className="h-40 w-full" />;
  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Nincs számla"
        description="Az ügyfélhez még nem lett számla kiállítva."
        action={
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href={`/invoices/new?client=${clientId}`}>
              <Plus className="mr-2 h-4 w-4" />
              Új számla
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="rounded-md border border-zinc-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3 text-left">Számlaszám</th>
            <th className="px-4 py-3 text-left">Kiállítva</th>
            <th className="px-4 py-3 text-left">Határidő</th>
            <th className="px-4 py-3 text-left">Állapot</th>
            <th className="px-4 py-3 text-right">Összeg</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {invoices.map((inv) => (
            <tr key={inv.id} className="hover:bg-zinc-50">
              <td className="px-4 py-3 font-mono text-xs font-medium text-zinc-900">
                {inv.invoice_number}
              </td>
              <td className="px-4 py-3 text-zinc-600">{formatDate(inv.issue_date)}</td>
              <td className="px-4 py-3 text-zinc-600">{formatDate(inv.due_date)}</td>
              <td className="px-4 py-3">
                <InvoiceStatusBadge status={inv.status} />
              </td>
              <td className="px-4 py-3 text-right font-medium">
                {formatCurrency(inv.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── TAB 4 – Emailek ──────────────────────────────────────────────────────────

const EMAIL_STATUS_LABELS: Record<string, string> = {
  sent:   "Elküldve",
  opened: "Megnyitva",
  failed: "Sikertelen",
};

function EmailsTab({ clientId }: { clientId: string }) {
  const supabase = createClient();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("email_logs")
      .select("*")
      .eq("client_id", clientId)
      .order("sent_at", { ascending: false })
      .then(({ data }) => { setLogs((data as EmailLog[]) ?? []); setLoading(false); });
  }, [clientId]);

  if (loading) return <Skeleton className="h-40 w-full" />;
  if (logs.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="Nincs email előzmény"
        description="Az ügyfélnek még nem küldtek emailt."
        action={
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href={`/emails?client=${clientId}`}>
              <Mail className="mr-2 h-4 w-4" />
              Email küldése
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-1">
      <div className="mb-3 flex justify-end">
        <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
          <Link href={`/emails?client=${clientId}`}>
            <Mail className="mr-2 h-4 w-4" />
            Email küldése
          </Link>
        </Button>
      </div>
      <div className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
        {logs.map((log) => (
          <div key={log.id} className="flex items-start justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-zinc-900">{log.subject}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{timeAgo(log.sent_at)}</p>
            </div>
            <Badge
              variant={
                log.status === "sent"
                  ? "info"
                  : log.status === "opened"
                  ? "success"
                  : "destructive"
              }
            >
              {log.status ? EMAIL_STATUS_LABELS[log.status] : "—"}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TAB 5 – Megjegyzések ─────────────────────────────────────────────────────

interface ClientNote {
  id: string;
  client_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
}

function NotesTab({ clientId }: { clientId: string }) {
  const supabase = createClient();
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  async function fetchNotes() {
    const { data } = await supabase
      .from("client_notes")
      .select("*")
      .eq("client_id", clientId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setNotes((data as ClientNote[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void fetchNotes(); }, [clientId]);

  async function handleAdd() {
    if (!newNote.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("client_notes")
      .insert({ client_id: clientId, body: newNote.trim() })
      .select()
      .single();
    setSaving(false);
    if (error) { toast.error("Hiba a megjegyzés mentésekor"); return; }
    setNotes((prev) => [data as ClientNote, ...prev]);
    setNewNote("");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("client_notes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deleteTarget);
    if (error) { toast.error("Hiba a törlés során"); return; }
    setNotes((prev) => prev.filter((n) => n.id !== deleteTarget));
    setDeleteTarget(null);
    toast.success("Megjegyzés törölve");
  }

  return (
    <div className="space-y-4">
      {/* Add note form */}
      <div className="rounded-md border border-zinc-200 p-4">
        <Textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Írj megjegyzést az ügyfélről…"
          rows={3}
          className="mb-3"
        />
        <Button
          onClick={handleAdd}
          disabled={saving || !newNote.trim()}
          className="bg-blue-600 hover:bg-blue-700"
          size="sm"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Megjegyzés hozzáadása
        </Button>
      </div>

      {/* Notes list */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : notes.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Nincs megjegyzés"
          description="Adj hozzá megjegyzést az ügyfélhez."
        />
      ) : (
        <div className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
          {notes.map((note) => (
            <div key={note.id} className="flex items-start gap-3 px-4 py-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-900 whitespace-pre-wrap">{note.body}</p>
                <p className="mt-1 text-xs text-zinc-400">{timeAgo(note.created_at)}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-zinc-400 hover:text-red-600 flex-shrink-0"
                onClick={() => setDeleteTarget(note.id)}
                aria-label="Megjegyzés törlése"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        variant="danger"
        title="Megjegyzés törlése"
        description="Biztosan törlöd ezt a megjegyzést? Ez a művelet nem vonható vissza."
        confirmLabel="Törlés"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ─── TAB 6 – Dokumentumok ────────────────────────────────────────────────────

function DocumentsTab({ clientId }: { clientId: string }) {
  const supabase = createClient();
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteFile, setDeleteFile] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  async function fetchFiles() {
    const { data } = await supabase.storage
      .from("client-documents")
      .list(clientId, { sortBy: { column: "created_at", order: "desc" } });
    setFiles((data ?? []) as StorageFile[]);
    setLoading(false);
  }

  useEffect(() => { void fetchFiles(); }, [clientId]);

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    for (const file of Array.from(fileList)) {
      const path = `${clientId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("client-documents").upload(path, file);
      if (error) toast.error(`Hiba: ${file.name}`);
    }
    await fetchFiles();
    setUploading(false);
    toast.success("Feltöltés kész");
  }

  async function handleDelete() {
    if (!deleteFile) return;
    await supabase.storage.from("client-documents").remove([`${clientId}/${deleteFile}`]);
    setFiles((prev) => prev.filter((f) => f.name !== deleteFile));
    setDeleteFile(null);
    toast.success("Fájl törölve");
  }

  async function handleDownload(name: string) {
    const { data } = await supabase.storage
      .from("client-documents")
      .createSignedUrl(`${clientId}/${name}`, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-md p-8 text-center transition-colors cursor-pointer",
          dragging ? "border-blue-400 bg-blue-50" : "border-zinc-200 hover:border-zinc-300"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
          className="hidden"
          onChange={(e) => void uploadFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-blue-600">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm font-medium">Feltöltés folyamatban…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-zinc-400">
            <Upload className="h-8 w-8" />
            <p className="text-sm">
              <span className="font-medium text-blue-600">Kattints a feltöltéshez</span>
              {" "}vagy húzd ide a fájlokat
            </p>
            <p className="text-xs">PDF, JPG, PNG, Word, Excel – max. 50 MB</p>
          </div>
        )}
      </div>

      {/* File list */}
      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : files.length === 0 ? (
        <EmptyState
          icon={FilePlus}
          title="Nincs dokumentum"
          description="Tölts fel útlevélmásolatot, biztosítást, vízumot vagy egyéb iratot."
        />
      ) : (
        <div className="rounded-md border border-zinc-200 divide-y divide-zinc-100">
          {files.map((file) => (
            <div key={file.name} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 truncate">
                  {file.name.replace(/^\d+-/, "")}
                </p>
                <p className="text-xs text-zinc-400">
                  {formatSize(file.metadata?.size ?? 0)}
                  {file.created_at ? ` · ${formatDate(file.created_at)}` : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-zinc-400 hover:text-blue-600"
                onClick={() => handleDownload(file.name)}
                title="Letöltés"
              >
                <FileDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-zinc-400 hover:text-red-600"
                onClick={() => setDeleteFile(file.name)}
                title="Törlés"
              >
                <Trash className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteFile}
        variant="danger"
        title="Dokumentum törlése"
        description="Biztosan törlöd ezt a fájlt? A művelet nem visszavonható."
        confirmLabel="Törlés"
        onConfirm={handleDelete}
        onCancel={() => setDeleteFile(null)}
      />
    </div>
  );
}

// ─── Main profile view ────────────────────────────────────────────────────────

interface Props {
  client: Client;
}

export function ClientProfileView({ client }: Props) {
  const router = useRouter();
  const { deleteClient } = useClients();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const discountMeta = DISCOUNT_META[client.discount_level] ?? DISCOUNT_META[0];

  async function handleDelete() {
    const ok = await deleteClient(client.id);
    if (ok) {
      toast.success("Ügyfél törölve");
      router.push("/clients");
    } else {
      toast.error("Hiba a törlés során");
    }
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <div>
        <Button variant="ghost" asChild className="-ml-2 text-zinc-500 hover:text-zinc-900">
          <Link href="/clients">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Vissza az ügyfelekhez
          </Link>
        </Button>
      </div>

      {/* Profile header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-3xl font-semibold text-zinc-900">
              {client.last_name} {client.first_name}
            </h1>
            {client.is_vip && (
              <Badge variant="warning" className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-amber-600" />
                VIP
              </Badge>
            )}
            {discountMeta && (
              <Badge variant={discountMeta.variant}>
                {discountMeta.label} {discountMeta.pct}
              </Badge>
            )}
          </div>
          <p className="font-mono text-sm text-zinc-500">{client.client_code}</p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href={`/clients/${client.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Szerkeszt
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Több művelet</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Ügyfél törlése
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          title="Összes utazás"
          value={client.trip_count}
          icon={CalendarCheck}
        />
        <StatsCard
          title="Összes költés"
          value={formatCurrency(client.total_spent)}
          icon={Wallet}
        />
        <StatsCard
          title="Kedvezmény szint"
          value={discountMeta?.label ?? "Alap"}
          subtitle={discountMeta?.pct}
          icon={Tag}
        />
        <StatsCard
          title="Regisztrált"
          value={formatDate(client.created_at)}
          icon={Clock}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="adatok">
        <TabsList>
          <TabsTrigger value="adatok">Adatok</TabsTrigger>
          <TabsTrigger value="utazasok">
            Utazások
            {client.trip_count > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                {client.trip_count}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="szamlak">Számlák</TabsTrigger>
          <TabsTrigger value="emailek">Emailek</TabsTrigger>
          <TabsTrigger value="megjegyzesek">Megjegyzések</TabsTrigger>
          <TabsTrigger value="dokumentumok">Dokumentumok</TabsTrigger>
        </TabsList>

        <TabsContent value="adatok">
          <DataTab client={client} />
        </TabsContent>
        <TabsContent value="utazasok">
          <BookingsTab clientId={client.id} />
        </TabsContent>
        <TabsContent value="szamlak">
          <InvoicesTab clientId={client.id} />
        </TabsContent>
        <TabsContent value="emailek">
          <EmailsTab clientId={client.id} />
        </TabsContent>
        <TabsContent value="megjegyzesek">
          <NotesTab clientId={client.id} />
        </TabsContent>
        <TabsContent value="dokumentumok">
          <DocumentsTab clientId={client.id} />
        </TabsContent>
      </Tabs>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={showDeleteDialog}
        variant="danger"
        title="Ügyfél törlése"
        description={`Biztosan törlöd ${client.last_name} ${client.first_name} ügyfelet? A foglalásai és számlái megmaradnak, de az ügyfél nem lesz látható a rendszerben.`}
        confirmLabel="Törlés"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </div>
  );
}
