"use client";

import React, { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Invoice, InvoiceStatus, InvoiceItem, Client } from "@/types";
import type { InvoiceFormValues } from "@/lib/validators/invoice";
import type { InvoiceLanguage, InvoiceCurrency } from "@/lib/invoice-pdf";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InvoiceListParams {
  page?: number;
  pageSize?: number;
  status?: InvoiceStatus | null;
  clientId?: string | null;
  month?: string | null;        // "YYYY-MM"
  sortBy?: "issue_date" | "due_date" | "total" | "created_at";
  sortDirection?: "asc" | "desc";
}

export type InvoiceRow = Invoice & {
  client: Pick<Client, "id" | "first_name" | "last_name" | "email"> | null;
};

export interface InvoiceStats {
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  totalOverdue: number;
  overdueCount: number;
}

export interface AgencySettings {
  agency_name: string;
  agency_legal_name: string;
  agency_email: string;
  agency_phone: string;
  agency_address: string;   // legacy single-field
  agency_street: string;
  agency_zip: string;
  agency_city: string;
  agency_country: string;
  agency_tax_number: string;
  uid_nummer: string;
  iban: string;
  bic: string;
  bank_name: string;
  invoice_footer_text: string;
  invoice_default_notes: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInvoices() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      console.error("[generatePDF] error:", e);
      setError(e instanceof Error ? e.message : "Ismeretlen hiba");
      return null;
    } finally {
      setLoading(false);
    }
  }

  // ── getInvoices ────────────────────────────────────────────────────────────
  const getInvoices = useCallback(
    (params: InvoiceListParams = {}): Promise<{ data: InvoiceRow[]; count: number } | null> => {
      const {
        page = 1,
        pageSize = 20,
        status,
        clientId,
        month,
        sortBy = "issue_date",
        sortDirection = "desc",
      } = params;

      return run(async () => {
        let query = supabase
          .from("invoices")
          .select("*, client:clients(id, first_name, last_name, email)", { count: "exact" })
          .order(sortBy, { ascending: sortDirection === "asc" });

        if (status) query = query.eq("status", status);
        if (clientId) query = query.eq("client_id", clientId);
        if (month) {
          query = query
            .gte("issue_date", `${month}-01`)
            .lte("issue_date", `${month}-31`);
        }

        const from = (page - 1) * pageSize;
        query = query.range(from, from + pageSize - 1);

        const { data, count, error: sbErr } = await query;
        if (sbErr) throw new Error(sbErr.message);
        return { data: (data ?? []) as InvoiceRow[], count: count ?? 0 };
      });
    },
    [],
  );

  // ── getInvoiceById ─────────────────────────────────────────────────────────
  const getInvoiceById = useCallback(
    (id: string): Promise<(Invoice & { client: Client }) | null> => {
      return run(async () => {
        const { data, error: sbErr } = await supabase
          .from("invoices")
          .select("*, client:clients(*)")
          .eq("id", id)
          .single();
        if (sbErr) throw new Error(sbErr.message);
        return data as unknown as Invoice & { client: Client };
      });
    },
    [],
  );

  // ── createInvoice ──────────────────────────────────────────────────────────
  const createInvoice = useCallback(
    (values: InvoiceFormValues): Promise<Invoice | null> => {
      return run(async () => {
        // Advance items (is_advance=true) are excluded from the invoice total
        const billableItems = values.items.filter((i) => !i.is_advance);
        const subtotal = billableItems.reduce((s, i) => s + i.total, 0);
        const taxAmount = subtotal * values.tax_rate / 100;
        const total = subtotal + taxAmount;

        const { data, error: sbErr } = await supabase
          .from("invoices")
          .insert({
            ...values,
            subtotal: Math.round(subtotal * 100) / 100,
            tax_amount: Math.round(taxAmount * 100) / 100,
            total: Math.round(total * 100) / 100,
            notes: values.notes || null,
            booking_id: values.booking_id ?? null,
            due_date: values.due_date ?? null,
            service_date: values.service_date ?? null,
          })
          .select()
          .single();
        if (sbErr) throw new Error(sbErr.message);
        return data as Invoice;
      });
    },
    [],
  );

  // ── updateInvoice ──────────────────────────────────────────────────────────
  const updateInvoice = useCallback(
    (id: string, values: Partial<InvoiceFormValues>): Promise<Invoice | null> => {
      return run(async () => {
        const subtotal = values.items?.reduce((s, i) => s + i.total, 0);
        const taxAmount = subtotal != null ? subtotal * (values.tax_rate ?? 13) / 100 : undefined;
        const total = subtotal != null && taxAmount != null ? subtotal + taxAmount : undefined;

        const { data, error: sbErr } = await supabase
          .from("invoices")
          .update({
            ...values,
            ...(subtotal != null && { subtotal: Math.round(subtotal * 100) / 100 }),
            ...(taxAmount != null && { tax_amount: Math.round(taxAmount * 100) / 100 }),
            ...(total != null && { total: Math.round(total * 100) / 100 }),
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select()
          .single();
        if (sbErr) throw new Error(sbErr.message);
        return data as Invoice;
      });
    },
    [],
  );

  // ── markAsPaid ─────────────────────────────────────────────────────────────
  const markAsPaid = useCallback(
    (id: string): Promise<boolean | null> => {
      return run(async () => {
        const { error: sbErr } = await supabase
          .from("invoices")
          .update({ status: "paid", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", id);
        if (sbErr) throw new Error(sbErr.message);
        return true;
      });
    },
    [],
  );

  // ── deleteInvoice ──────────────────────────────────────────────────────────
  const deleteInvoice = useCallback(
    (id: string): Promise<boolean | null> => {
      return run(async () => {
        // Hard delete for drafts, cancel for others
        const { data: inv } = await supabase.from("invoices").select("status").eq("id", id).single();
        if ((inv as { status: string } | null)?.status === "draft") {
          const { error: sbErr } = await supabase.from("invoices").delete().eq("id", id);
          if (sbErr) throw new Error(sbErr.message);
        } else {
          const { error: sbErr } = await supabase.from("invoices")
            .update({ status: "cancelled", updated_at: new Date().toISOString() })
            .eq("id", id);
          if (sbErr) throw new Error(sbErr.message);
        }
        return true;
      });
    },
    [],
  );

  // ── sendInvoiceEmail — mark as sent + create email_log ────────────────────
  const sendInvoiceEmail = useCallback(
    (id: string): Promise<{ invoiceNumber: string } | null> => {
      return run(async () => {
        const { data: inv, error: fetchErr } = await supabase
          .from("invoices")
          .select("invoice_number, client_id")
          .eq("id", id)
          .single();
        if (fetchErr) throw new Error(fetchErr.message);

        const { error: updErr } = await supabase
          .from("invoices")
          .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", id);
        if (updErr) throw new Error(updErr.message);

        return { invoiceNumber: (inv as { invoice_number: string }).invoice_number };
      });
    },
    [],
  );

  // ── generatePDF — returns object URL for download/preview ─────────────────
  const generatePDF = useCallback(
    async (
      invoiceId: string,
      options?: { language?: InvoiceLanguage; currency?: InvoiceCurrency },
    ): Promise<string | null> => {
      return run(async () => {
        const [{ data: invoice }, { data: settingsRows }] = await Promise.all([
          supabase.from("invoices").select("*, client:clients(*)").eq("id", invoiceId).single(),
          supabase.from("settings").select("key, value"),
        ]);
        if (!invoice) throw new Error("Invoice not found");

        const settings: Record<string, string> = Object.fromEntries(
          ((settingsRows ?? []) as { key: string; value: string | null }[]).map(
            (s) => [s.key, s.value ?? ""],
          ),
        );

        const [{ pdf }, { InvoicePDF }] = await Promise.all([
          import("@react-pdf/renderer"),
          import("@/lib/invoice-pdf"),
        ]);

        // Fetch live EUR/HUF exchange rate (stored values are in EUR).
        // Returns how many HUF = 1 EUR (e.g. 395).
        let eurHufRate = 395;
        try {
          const rateRes = await fetch("/api/exchange-rate", {
            signal: AbortSignal.timeout(4000),
          });
          if (rateRes.ok) {
            const rateJson = await rateRes.json() as { rate?: number };
            if (rateJson.rate && rateJson.rate > 1) {
              eurHufRate = Math.round(rateJson.rate);
            }
          }
        } catch {
          // keep default 395
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const element = React.createElement(InvoicePDF, {
          invoice: invoice as unknown as Invoice,
          client: (invoice as unknown as { client: Client }).client,
          settings,
          eurHufRate,
        }) as any;
        const blob = await pdf(element).toBlob();

        return URL.createObjectURL(blob);
      });
    },
    [],
  );

  // ── getAgencySettings ──────────────────────────────────────────────────────
  const getAgencySettings = useCallback((): Promise<AgencySettings | null> => {
    return run(async () => {
      const { data } = await supabase.from("settings").select("key, value");
      const m: Record<string, string> = Object.fromEntries(
        ((data ?? []) as { key: string; value: string | null }[]).map((s) => [s.key, s.value ?? ""]),
      );
      return {
        agency_name:         m["agency_name"]          ?? "ZsuzsiTravel",
        agency_legal_name:   m["agency_legal_name"]    ?? "UtazóFotós – Tuza-Göncz Zsuzsanna",
        agency_email:        m["agency_email"]         ?? "",
        agency_phone:        m["agency_phone"]         ?? "",
        agency_address:      m["agency_address"]       ?? "",
        agency_street:       m["agency_street"]        ?? "",
        agency_zip:          m["agency_zip"]           ?? "",
        agency_city:         m["agency_city"]          ?? "",
        agency_country:      m["agency_country"]       ?? "Ausztria",
        agency_tax_number:   m["agency_tax_number"]    ?? "",
        uid_nummer:          m["uid_nummer"]           ?? "ATU00000000",
        iban:                m["iban"]                 ?? "",
        bic:                 m["bic"]                  ?? "",
        bank_name:           m["bank_name"]            ?? "",
        invoice_footer_text: m["invoice_footer_text"]  ?? "Vielen Dank für Ihr Vertrauen!\nKöszönöm a bizalmat!",
        invoice_default_notes: m["invoice_default_notes"] ?? "Ez az ajánlat egy hétig , azaz a befizetési határidőig érvényes!\nAz utazásra előleg befizetéssel biztosítod a helyedet.\nA fennmaradó összeget, amiből a helyi kiadásokat fedezzük, kérlek hozd magaddal euróban!",
      };
    });
  }, []);

  // ── getInvoiceStats ────────────────────────────────────────────────────────
  const getInvoiceStats = useCallback((): Promise<InvoiceStats | null> => {
    return run(async () => {
      const today = new Date().toISOString().slice(0, 10);

      const { data: all } = await supabase
        .from("invoices")
        .select("total, status, due_date")
        .neq("status", "cancelled");

      const rows = (all ?? []) as {
        total: number | null;
        status: string;
        due_date: string | null;
      }[];

      const totalInvoiced   = rows.reduce((s, r) => s + (r.total ?? 0), 0);
      const totalPaid       = rows.filter((r) => r.status === "paid").reduce((s, r) => s + (r.total ?? 0), 0);
      const totalOutstanding = rows
        .filter((r) => !["paid", "cancelled"].includes(r.status))
        .reduce((s, r) => s + (r.total ?? 0), 0);

      const overdueRows = rows.filter(
        (r) => r.due_date != null && r.due_date < today && !["paid", "cancelled"].includes(r.status),
      );
      const totalOverdue = overdueRows.reduce((s, r) => s + (r.total ?? 0), 0);

      return {
        totalInvoiced,
        totalPaid,
        totalOutstanding,
        totalOverdue,
        overdueCount: overdueRows.length,
      };
    });
  }, []);

  return {
    loading,
    error,
    getInvoices,
    getInvoiceById,
    createInvoice,
    updateInvoice,
    markAsPaid,
    deleteInvoice,
    sendInvoiceEmail,
    generatePDF,
    getAgencySettings,
    getInvoiceStats,
  };
}
