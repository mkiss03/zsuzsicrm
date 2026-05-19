"use client";

import { useState, type ReactNode, type ElementType } from "react";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  IconArrowUp, IconArrowDown, IconArrowsSort,
  IconChevronLeft, IconChevronRight,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  render?: (value: unknown, row: T, index: number) => ReactNode;
}

export interface PaginationConfig {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

interface DataTableProps<T extends object> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  keyField?: keyof T;
  onSort?: (key: string, direction: "asc" | "desc") => void;
  pagination?: PaginationConfig;
  className?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ElementType;
}

type SortDir = "asc" | "desc" | null;

// ─── Sort icon ────────────────────────────────────────────────────────────────

function SortIcon({ dir }: { dir: SortDir }) {
  if (dir === "asc")  return <IconArrowUp   size={12} stroke={2} className="ml-1 text-zinc-900" />;
  if (dir === "desc") return <IconArrowDown size={12} stroke={2} className="ml-1 text-zinc-900" />;
  return <IconArrowsSort size={12} stroke={1.5} className="ml-1 text-zinc-300" />;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRows({ rows, cols }: { rows: number; cols: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r} className="border-zinc-100">
          {Array.from({ length: cols }).map((_, c) => (
            <TableCell key={c} className="py-3">
              <div
                className="skeleton h-4 rounded"
                style={{ width: `${55 + (c * 19) % 40}%` }}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// ─── Empty ────────────────────────────────────────────────────────────────────

function EmptyRow({
  colSpan, icon: Icon, title, description,
}: {
  colSpan: number; icon?: ElementType; title: string; description?: string;
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="p-0">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          {Icon && (
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-zinc-100">
              <Icon size={36} stroke={1} className="text-zinc-300" />
            </div>
          )}
          <p className="text-[14px] font-medium text-zinc-600">{title}</p>
          {description && <p className="mt-1 text-[13px] text-zinc-400 max-w-sm">{description}</p>}
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── DataTable ────────────────────────────────────────────────────────────────

export function DataTable<T extends object>({
  columns,
  data,
  loading = false,
  keyField,
  onSort,
  pagination,
  className,
  emptyTitle = "Nincs találat",
  emptyDescription = "Még nincsenek adatok ebben a nézetben.",
  emptyIcon,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({ key: "", dir: null });

  function handleSort(key: string) {
    if (!onSort) return;
    const next: SortDir =
      sort.key !== key || sort.dir === null ? "asc" :
      sort.dir === "asc" ? "desc" : null;
    setSort({ key, dir: next });
    if (next) onSort(key, next);
  }

  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1;

  return (
    <div className={cn("overflow-hidden rounded-md border border-zinc-200 bg-white", className)}>
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-200 bg-zinc-50 hover:bg-zinc-50">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  "text-[11px] font-semibold text-zinc-500 uppercase tracking-wide py-2.5 h-10",
                  col.sortable && "cursor-pointer select-none hover:text-zinc-900 nav-item",
                  col.headerClassName
                )}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <span className="inline-flex items-center">
                  {col.header}
                  {col.sortable && <SortIcon dir={sort.key === col.key ? sort.dir : null} />}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {loading && <SkeletonRows rows={6} cols={columns.length} />}

          {!loading && data.length === 0 && (
            <EmptyRow
              colSpan={columns.length}
              icon={emptyIcon}
              title={emptyTitle}
              description={emptyDescription}
            />
          )}

          {!loading && data.map((row, ri) => {
            const rec = row as Record<string, unknown>;
            const key = keyField ? String(rec[keyField as string]) : String(ri);
            return (
              <TableRow
                key={key}
                className="border-zinc-100 table-row-hover"
              >
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={cn("text-[14px] text-zinc-700 py-3", col.className)}
                  >
                    {col.render ? col.render(rec[col.key], row, ri) : String(rec[col.key] ?? "—")}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {pagination && (
        <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3">
          <p className="text-[12px] text-zinc-500">
            {pagination.total === 0
              ? "Nincs találat"
              : `${(pagination.page - 1) * pagination.pageSize + 1}–${Math.min(pagination.page * pagination.pageSize, pagination.total)} / ${pagination.total.toLocaleString("hu-HU")}`}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <IconChevronLeft size={13} stroke={2} />
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - pagination.page) <= 1)
              .reduce<(number | "…")[]>((acc, p, i, arr) => {
                if (i > 0 && typeof arr[i - 1] === "number" && (p as number) - (arr[i - 1] as number) > 1) acc.push("…");
                acc.push(p); return acc;
              }, [])
              .map((item, i) =>
                item === "…" ? (
                  <span key={`e${i}`} className="px-1 text-[12px] text-zinc-400">…</span>
                ) : (
                  <Button
                    key={item}
                    variant={item === pagination.page ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "h-7 w-7 p-0 text-[12px]",
                      item === pagination.page && "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                    )}
                    onClick={() => pagination.onPageChange(item as number)}
                  >
                    {item}
                  </Button>
                )
              )}

            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= totalPages}
            >
              <IconChevronRight size={13} stroke={2} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
