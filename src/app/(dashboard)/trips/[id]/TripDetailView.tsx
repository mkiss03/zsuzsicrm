"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  MoreHorizontal,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  CalendarDays,
  Users,
  Plus,
  Loader2,
  Upload,
  FileDown,
  Trash,
  GripVertical,
  Plane,
  Hotel,
  Utensils,
  Bus,
  Ticket,
  Circle,
  Check,
  FilePlus,
} from "lucide-react";
import { differenceInDays, eachDayOfInterval, format, parseISO } from "date-fns";
import { hu } from "date-fns/locale";

import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { useTrips, type TripFinancials, type TripCostInput } from "@/hooks/useTrips";
import { ParticipantsTable } from "@/components/trips/ParticipantsTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { TripStatusBadge } from "@/components/shared/StatusBadge";
import { StatsCard } from "@/components/shared/StatsCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Trip, TripStatus, TripCost, CostCategory } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type ItineraryItemType = "flight" | "hotel" | "activity" | "meal" | "transfer" | "other";

interface ItineraryItem {
  id: string;
  trip_id: string;
  day_date: string;
  time_of_day: string | null;
  description: string;
  type: ItineraryItemType;
  sort_order: number;
  created_at: string;
}

interface StorageFile {
  name: string;
  id: string | null;
  metadata: { size: number; mimetype: string };
  created_at: string | null;
  updated_at: string | null;
  last_accessed_at: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: TripStatus; label: string }[] = [
  { value: "planned",    label: "Tervezett" },
  { value: "advertised", label: "Hirdetve" },
  { value: "full",       label: "Telített" },
  { value: "ongoing",    label: "Folyamatban" },
  { value: "completed",  label: "Lezárt" },
  { value: "cancelled",  label: "Törölve" },
];

const COST_CATEGORIES: { value: CostCategory; label: string }[] = [
  { value: "accommodation", label: "Szállás" },
  { value: "flight",        label: "Repülő" },
  { value: "transfer",      label: "Transfer" },
  { value: "meals",         label: "Étkezés" },
  { value: "tickets",       label: "Belépők" },
  { value: "other",         label: "Egyéb" },
];

const CATEGORY_COLORS: Record<CostCategory, string> = {
  accommodation: "bg-blue-500",
  flight:        "bg-purple-500",
  transfer:      "bg-amber-500",
  meals:         "bg-orange-500",
  tickets:       "bg-green-500",
  other:         "bg-zinc-400",
};

const ITINERARY_TYPES: { value: ItineraryItemType; label: string; Icon: typeof Plane }[] = [
  { value: "flight",   label: "Repülő",   Icon: Plane },
  { value: "hotel",    label: "Szállás",  Icon: Hotel },
  { value: "activity", label: "Program",  Icon: Ticket },
  { value: "meal",     label: "Étkezés",  Icon: Utensils },
  { value: "transfer", label: "Transfer", Icon: Bus },
  { value: "other",    label: "Egyéb",    Icon: Circle },
];

// ─── TAB 2 – Kiadások ─────────────────────────────────────────────────────────

function CostsTab({ tripId }: { tripId: string }) {
  const supabase = createBrowserClient();
  const { addTripCost, deleteTripCost } = useTrips();

  const [costs, setCosts] = useState<TripCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newCost, setNewCost] = useState<Partial<TripCostInput>>({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function fetchCosts() {
    const { data } = await supabase
      .from("trip_costs")
      .select("*")
      .eq("trip_id", tripId)
      .order("cost_date", { ascending: false });
    setCosts((data as TripCost[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void fetchCosts(); }, [tripId]);

  async function handleAdd() {
    if (!newCost.description || !newCost.amount) return;
    setSaving(true);
    const cost = await addTripCost(tripId, {
      description: newCost.description,
      amount: Number(newCost.amount),
      category: (newCost.category as CostCategory) ?? null,
      cost_date: newCost.cost_date || null,
    });
    setSaving(false);
    if (cost) {
      setCosts((prev) => [cost, ...prev]);
      setNewCost({});
      setShowForm(false);
      toast.success("Kiadás hozzáadva");
    } else {
      toast.error("Hiba a kiadás rögzítésekor");
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    const ok = await deleteTripCost(deleteId);
    if (ok) {
      setCosts((prev) => prev.filter((c) => c.id !== deleteId));
      toast.success("Kiadás törölve");
    }
    setDeleteId(null);
  }

  const total = costs.reduce((s, c) => s + c.amount, 0);

  // Category breakdown
  const catTotals = costs.reduce((acc, c) => {
    const cat = (c.category as CostCategory) ?? "other";
    acc[cat] = (acc[cat] ?? 0) + c.amount;
    return acc;
  }, {} as Record<CostCategory, number>);

  return (
    <div className="space-y-4">
      {/* Add button */}
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => setShowForm((v) => !v)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          Kiadás hozzáadása
        </Button>
      </div>

      {/* Inline add form */}
      {showForm && (
        <div className="rounded-md border border-blue-200 bg-blue-50/40 p-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Input
            placeholder="Leírás *"
            value={newCost.description ?? ""}
            onChange={(e) => setNewCost((p) => ({ ...p, description: e.target.value }))}
            className="col-span-2 sm:col-span-1"
          />
          <Input
            type="number"
            placeholder="Összeg (€) *"
            value={newCost.amount ?? ""}
            onChange={(e) => setNewCost((p) => ({ ...p, amount: Number(e.target.value) }))}
          />
          <Select
            value={newCost.category ?? ""}
            onValueChange={(v) => setNewCost((p) => ({ ...p, category: v as CostCategory }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Kategória" />
            </SelectTrigger>
            <SelectContent>
              {COST_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={newCost.cost_date ?? ""}
            onChange={(e) => setNewCost((p) => ({ ...p, cost_date: e.target.value }))}
          />
          <div className="col-span-2 sm:col-span-4 flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Mégse</Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={saving || !newCost.description || !newCost.amount}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mentés
            </Button>
          </div>
        </div>
      )}

      {/* Costs table */}
      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : costs.length === 0 ? (
        <EmptyState icon={Receipt} title="Nincs kiadás" description="Adj hozzá kiadásokat az úthoz." />
      ) : (
        <div className="rounded-md border border-zinc-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 border-b border-zinc-200">
              <tr>
                <th className="px-4 py-3 text-left">Dátum</th>
                <th className="px-4 py-3 text-left">Leírás</th>
                <th className="px-4 py-3 text-left">Kategória</th>
                <th className="px-4 py-3 text-right">Összeg</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {costs.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(c.cost_date)}</td>
                  <td className="px-4 py-3 font-medium text-zinc-900">{c.description}</td>
                  <td className="px-4 py-3">
                    {c.category ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {COST_CATEGORIES.find((x) => x.value === c.category)?.label ?? c.category}
                      </Badge>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(c.amount, "EUR")}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-zinc-400 hover:text-red-600"
                      onClick={() => setDeleteId(c.id)}
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {/* Total row */}
              <tr className="bg-zinc-50 border-t-2 border-zinc-200 font-semibold">
                <td colSpan={3} className="px-4 py-3 text-xs text-zinc-600">
                  Összes kiadás
                </td>
                <td className="px-4 py-3 text-right text-zinc-900">{formatCurrency(total, "EUR")}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Category breakdown */}
      {costs.length > 0 && (
        <div className="rounded-md border border-zinc-200 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">
            Kategóriánkénti bontás
          </h4>
          <div className="space-y-2">
            {Object.entries(catTotals)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, amount]) => (
                <div key={cat} className="flex items-center gap-3">
                  <span className="w-24 text-xs text-zinc-500 truncate">
                    {COST_CATEGORIES.find((x) => x.value === cat)?.label ?? cat}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-zinc-100">
                    <div
                      className={cn("h-2 rounded-full transition-all", CATEGORY_COLORS[cat as CostCategory] ?? "bg-zinc-400")}
                      style={{ width: total > 0 ? `${(amount / total) * 100}%` : "0%" }}
                    />
                  </div>
                  <span className="text-xs font-medium text-zinc-700 w-24 text-right">
                    {formatCurrency(amount, "EUR")}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        variant="danger"
        title="Kiadás törlése"
        description="Biztosan törlöd ezt a kiadást?"
        confirmLabel="Törlés"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

// ─── TAB 3 – Program / Roadmap ────────────────────────────────────────────────

function ItineraryTab({ tripId, departureDate, returnDate }: {
  tripId: string;
  departureDate: string;
  returnDate: string;
}) {
  const supabase = createBrowserClient();
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingForDay, setAddingForDay] = useState<string | null>(null);
  const [newItem, setNewItem] = useState<{ time: string; description: string; type: ItineraryItemType }>({
    time: "", description: "", type: "activity",
  });
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Generate day list from date range
  const days = eachDayOfInterval({
    start: parseISO(departureDate),
    end: parseISO(returnDate),
  });

  async function fetchItems() {
    const { data } = await supabase
      .from("trip_itinerary_items")
      .select("*")
      .eq("trip_id", tripId)
      .order("day_date")
      .order("sort_order");
    setItems((data as ItineraryItem[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void fetchItems(); }, [tripId]);

  async function handleAddItem(dayDate: string) {
    if (!newItem.description.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("trip_itinerary_items")
      .insert({
        trip_id: tripId,
        day_date: dayDate,
        time_of_day: newItem.time || null,
        description: newItem.description.trim(),
        type: newItem.type,
        sort_order: items.filter((i) => i.day_date === dayDate).length,
      })
      .select()
      .single();
    setSaving(false);
    if (error) { toast.error("Hiba a mentésnél"); return; }
    setItems((prev) => [...prev, data as ItineraryItem]);
    setNewItem({ time: "", description: "", type: "activity" });
    setAddingForDay(null);
  }

  async function handleDeleteItem(id: string) {
    await supabase.from("trip_itinerary_items").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  // Drag-and-drop reorder (HTML5)
  async function handleDrop(targetId: string, dayDate: string) {
    if (!draggedId || draggedId === targetId) return;
    const dayItems = items.filter((i) => i.day_date === dayDate);
    const fromIndex = dayItems.findIndex((i) => i.id === draggedId);
    const toIndex   = dayItems.findIndex((i) => i.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const reordered = [...dayItems];
    const [moved] = reordered.splice(fromIndex, 1);
    if (moved) reordered.splice(toIndex, 0, moved);

    // Update sort_order
    const updates = reordered.map((item, idx) => ({ id: item.id, sort_order: idx }));
    setItems((prev) => {
      const otherDayItems = prev.filter((i) => i.day_date !== dayDate);
      const updatedDayItems = reordered.map((item, idx) => ({ ...item, sort_order: idx }));
      return [...otherDayItems, ...updatedDayItems].sort((a, b) =>
        a.day_date < b.day_date ? -1 : a.day_date > b.day_date ? 1 : a.sort_order - b.sort_order
      );
    });

    // Persist to DB
    for (const u of updates) {
      await supabase.from("trip_itinerary_items").update({ sort_order: u.sort_order }).eq("id", u.id);
    }
    setDraggedId(null);
  }

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      {days.map((day) => {
        const dayStr = format(day, "yyyy-MM-dd");
        const dayLabel = format(day, "EEEE, yyyy. MMMM d.", { locale: hu });
        const dayNum = differenceInDays(day, parseISO(departureDate)) + 1;
        const dayItems = items.filter((i) => i.day_date === dayStr).sort((a, b) => a.sort_order - b.sort_order);

        return (
          <div key={dayStr} className="rounded-md border border-zinc-200">
            {/* Day header */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 border-b border-zinc-200">
              <div>
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mr-2">
                  {dayNum}. nap
                </span>
                <span className="text-sm font-medium text-zinc-900 capitalize">
                  {dayLabel}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-blue-600 hover:text-blue-700"
                onClick={() => setAddingForDay(addingForDay === dayStr ? null : dayStr)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Hozzáad
              </Button>
            </div>

            {/* Items */}
            <div className="divide-y divide-zinc-100">
              {dayItems.map((item) => {
                const TypeIcon = ITINERARY_TYPES.find((t) => t.value === item.type)?.Icon ?? Circle;
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDraggedId(item.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(item.id, dayStr)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 transition-colors cursor-grab active:cursor-grabbing",
                      draggedId === item.id && "opacity-50 bg-blue-50"
                    )}
                  >
                    <GripVertical className="h-4 w-4 text-zinc-300 flex-shrink-0" />
                    <TypeIcon className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                    {item.time_of_day && (
                      <span className="text-xs font-mono text-zinc-500 w-10 flex-shrink-0">
                        {item.time_of_day}
                      </span>
                    )}
                    <span className="flex-1 text-sm text-zinc-900">{item.description}</span>
                    <Badge variant="muted" className="text-[10px] flex-shrink-0">
                      {ITINERARY_TYPES.find((t) => t.value === item.type)?.label}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-zinc-300 hover:text-red-500 flex-shrink-0"
                      onClick={() => handleDeleteItem(item.id)}
                    >
                      <Trash className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}

              {dayItems.length === 0 && addingForDay !== dayStr && (
                <div className="px-4 py-3 text-xs text-zinc-400 italic">
                  Nincs program erre a napra
                </div>
              )}
            </div>

            {/* Inline add form */}
            {addingForDay === dayStr && (
              <div className="px-4 py-3 border-t border-zinc-100 bg-zinc-50/60 flex flex-wrap gap-2 items-end">
                <Input
                  type="time"
                  value={newItem.time}
                  onChange={(e) => setNewItem((p) => ({ ...p, time: e.target.value }))}
                  className="w-28 h-8 text-xs"
                  placeholder="09:00"
                />
                <Input
                  value={newItem.description}
                  onChange={(e) => setNewItem((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Program leírása *"
                  className="flex-1 min-w-[160px] h-8 text-xs"
                />
                <Select
                  value={newItem.type}
                  onValueChange={(v) => setNewItem((p) => ({ ...p, type: v as ItineraryItemType }))}
                >
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITINERARY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value} className="text-xs">
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
                  disabled={saving || !newItem.description.trim()}
                  onClick={() => handleAddItem(dayStr)}
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={() => setAddingForDay(null)}
                >
                  Mégse
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── TAB 4 – Dokumentumok ─────────────────────────────────────────────────────

function DocumentsTab({ tripId }: { tripId: string }) {
  const supabase = createBrowserClient();
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteFile, setDeleteFile] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  async function fetchFiles() {
    const { data } = await supabase.storage
      .from("trip-documents")
      .list(tripId, { sortBy: { column: "created_at", order: "desc" } });
    setFiles((data ?? []) as StorageFile[]);
    setLoading(false);
  }

  useEffect(() => { void fetchFiles(); }, [tripId]);

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    for (const file of Array.from(fileList)) {
      const path = `${tripId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("trip-documents").upload(path, file);
      if (error) toast.error(`Hiba: ${file.name}`);
    }
    await fetchFiles();
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    toast.success("Feltöltés kész");
  }

  async function handleDelete() {
    if (!deleteFile) return;
    await supabase.storage.from("trip-documents").remove([`${tripId}/${deleteFile}`]);
    setFiles((prev) => prev.filter((f) => f.name !== deleteFile));
    setDeleteFile(null);
    toast.success("Fájl törölve");
  }

  async function handleDownload(name: string) {
    const { data } = await supabase.storage
      .from("trip-documents")
      .createSignedUrl(`${tripId}/${name}`, 3600);
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
          accept="application/pdf,image/*"
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
            <p className="text-xs">PDF, JPG, PNG – max. 50 MB</p>
          </div>
        )}
      </div>

      {/* File list */}
      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : files.length === 0 ? (
        <EmptyState icon={FilePlus} title="Nincs dokumentum" description="Tölts fel fájlokat a fenti területre." />
      ) : (
        <div className="rounded-md border border-zinc-200 divide-y divide-zinc-100">
          {files.map((file) => (
            <div key={file.name} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 truncate">
                  {file.name.replace(/^\d+-/, "")}
                </p>
                <p className="text-xs text-zinc-400">
                  {formatSize(file.metadata?.size ?? 0)} · {file.created_at ? formatDate(file.created_at) : "—"}
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

// ─── Main detail view ─────────────────────────────────────────────────────────

interface Props {
  trip: Trip;
}

export function TripDetailView({ trip: initialTrip }: Props) {
  const router = useRouter();
  const { updateTripStatus, deleteTrip, getTripFinancials } = useTrips();
  const supabase = createBrowserClient();

  const [trip, setTrip] = useState<Trip>(initialTrip);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [financials, setFinancials] = useState<TripFinancials | null>(null);
  const [finLoading, setFinLoading] = useState(true);

  useEffect(() => {
    void getTripFinancials(trip.id).then((f) => { setFinancials(f); setFinLoading(false); });
  }, [trip.id]);

  async function handleStatusChange(newStatus: TripStatus) {
    const ok = await updateTripStatus(trip.id, newStatus);
    if (ok) {
      setTrip((t) => ({ ...t, status: newStatus }));
      toast.success("Státusz frissítve");
    } else {
      toast.error("Hiba a státusz módosításakor");
    }
  }

  async function handleDelete() {
    const ok = await deleteTrip(trip.id);
    if (ok) {
      toast.success("Utazás törölve");
      setShowDeleteDialog(false);
      router.refresh();
      router.push("/trips");
    } else {
      toast.error("Hiba a törlés során");
    }
  }

  async function handleGenerateInvoices() {
    // Fetch all fully_paid bookings that don't have invoices
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, client_id, final_amount, booking_code")
      .eq("trip_id", trip.id)
      .eq("status", "fully_paid");

    if (!bookings || bookings.length === 0) {
      toast.info("Nincs teljesen fizetett foglalás ehhez az úthoz");
      return;
    }

    const { data: existingInvoices } = await supabase
      .from("invoices")
      .select("booking_id")
      .in("booking_id", bookings.map((b: { id: string }) => b.id));

    const existingBookingIds = new Set(
      (existingInvoices ?? []).map((inv: { booking_id: string | null }) => inv.booking_id)
    );

    const toCreate = bookings.filter((b: { id: string }) => !existingBookingIds.has(b.id));

    if (toCreate.length === 0) {
      toast.info("Minden foglaláshoz már van számla");
      return;
    }

    const invoiceInserts = toCreate.map((b: { id: string; client_id: string; final_amount: number | null; booking_code: string }) => ({
      client_id: b.client_id,
      booking_id: b.id,
      status: "draft",
      issue_date: new Date().toISOString().slice(0, 10),
      items: [{ description: trip.name, quantity: 1, unit_price: b.final_amount ?? 0, total: b.final_amount ?? 0 }],
      subtotal: b.final_amount ?? 0,
      tax_rate: 13,
      tax_amount: ((b.final_amount ?? 0) * 0.13),
      total: (b.final_amount ?? 0) * 1.13,
    }));

    const { error } = await supabase.from("invoices").insert(invoiceInserts);
    if (error) {
      toast.error("Hiba a számlák generálása során");
    } else {
      toast.success(`${toCreate.length} számla sikeresen létrehozva (piszkozat)`);
    }
  }

  const capacityPct =
    trip.max_capacity > 0 ? (trip.current_bookings / trip.max_capacity) * 100 : 0;
  const profitPositive = (financials?.profit ?? 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Back */}
      <Button variant="ghost" asChild className="-ml-2 text-zinc-500 hover:text-zinc-900">
        <Link href="/trips">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Vissza az utazásokhoz
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-3xl font-semibold text-zinc-900">{trip.name}</h1>

            {/* Clickable status badge */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-1 rounded">
                  <TripStatusBadge status={trip.status} />
                  <ChevronDown className="h-3 w-3 text-zinc-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                {STATUS_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => handleStatusChange(opt.value)}
                    className={opt.value === trip.status ? "font-medium" : ""}
                  >
                    {opt.value === trip.status && <Check className="mr-2 h-3 w-3" />}
                    {opt.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500">
            <span className="font-mono text-xs">{trip.trip_code}</span>
            <span>{trip.destination}</span>
            <span className="flex items-center gap-1">
              <CalendarDays className="h-4 w-4" />
              {formatDate(trip.departure_date)} – {formatDate(trip.return_date)}
            </span>
          </div>

          {/* Capacity bar */}
          <div className="mt-3 flex items-center gap-3 max-w-xs">
            <Progress value={capacityPct} className="h-2 flex-1" />
            <span className="text-sm font-medium text-zinc-700 whitespace-nowrap">
              <Users className="inline h-3.5 w-3.5 mr-1" />
              {trip.current_bookings} / {trip.max_capacity} fő
            </span>
          </div>
        </div>

        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          <Button asChild className="bg-blue-600 hover:bg-blue-700">
            <Link href={`/trips/${trip.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Szerkeszt
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleGenerateInvoices}>
                <FilePlus className="mr-2 h-4 w-4" />
                Számlák generálása
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Utazás törlése
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {finLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-md border border-zinc-200 p-5">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-7 w-20" />
            </div>
          ))
        ) : (
          <>
            <StatsCard
              title="Várható bevétel"
              value={formatCurrency(financials?.expectedRevenue ?? 0, "EUR")}
              subtitle="teljes kapacitásnál"
              icon={TrendingUp}
            />
            <StatsCard
              title="Beérkezett előlegek"
              value={formatCurrency(financials?.depositTotal ?? 0, "EUR")}
              icon={Wallet}
            />
            <StatsCard
              title="Beérkezett végösszegek"
              value={formatCurrency(financials?.fullPaymentTotal ?? 0, "EUR")}
              icon={Receipt}
            />
            <StatsCard
              title="Nettó nyereség"
              value={formatCurrency(financials?.profit ?? 0, "EUR")}
              subtitle="bevétel – kiadások"
              icon={profitPositive ? TrendingUp : TrendingDown}
              trend={financials ? { value: profitPositive ? 100 : -100 } : undefined}
            />
          </>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="resztvevok">
        <TabsList>
          <TabsTrigger value="resztvevok">
            Résztvevők
            {trip.current_bookings > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">
                {trip.current_bookings}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="kiadasok">Kiadások</TabsTrigger>
          <TabsTrigger value="program">Program</TabsTrigger>
          <TabsTrigger value="dokumentumok">Dokumentumok</TabsTrigger>
        </TabsList>

        <TabsContent value="resztvevok">
          <ParticipantsTable tripId={trip.id} />
        </TabsContent>
        <TabsContent value="kiadasok">
          <CostsTab tripId={trip.id} />
        </TabsContent>
        <TabsContent value="program">
          <ItineraryTab
            tripId={trip.id}
            departureDate={trip.departure_date}
            returnDate={trip.return_date}
          />
        </TabsContent>
        <TabsContent value="dokumentumok">
          <DocumentsTab tripId={trip.id} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={showDeleteDialog}
        variant="danger"
        title="Utazás törlése"
        description={`Biztosan törlöd a(z) "${trip.name}" utazást? A foglalások és kiadások megmaradnak, de az utazás nem lesz látható.`}
        confirmLabel="Törlés"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </div>
  );
}
