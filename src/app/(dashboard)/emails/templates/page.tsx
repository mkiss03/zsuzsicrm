"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Copy, Trash2, Send, MoreHorizontal, GitBranch, Tag } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import type { EmailTemplate, EmailTemplateType } from "@/types";

// ─── Type metadata ────────────────────────────────────────────────────────────

const TYPE_META: Record<
  EmailTemplateType,
  { label: string; variant: "info" | "warning" | "success" | "default" | "secondary" | "muted" }
> = {
  confirmation:    { label: "Visszaigazolás",  variant: "info" },
  deposit_request: { label: "Előleg bekérő",   variant: "warning" },
  reminder:        { label: "Emlékeztető",     variant: "muted" },
  pre_trip:        { label: "Út előtti",       variant: "default" },
  post_trip:       { label: "Út utáni",        variant: "success" },
  promotional:     { label: "Promóció",        variant: "secondary" },
};

// Workflow step → template type mapping (for "Linked step" badge)
const WORKFLOW_STEP_LABELS: Partial<Record<EmailTemplateType, string>> = {
  confirmation:    "Visszaigazolás elküldve",
  deposit_request: "Előleg bekérve",
  reminder:        "Végösszeg bekérve",
  pre_trip:        "Utazás előtti tájékoztató",
  post_trip:       "Visszajelzés kérve",
};

// Types that are directly triggered by a workflow step
const WORKFLOW_TYPES = new Set<EmailTemplateType>([
  "confirmation", "deposit_request", "reminder", "pre_trip", "post_trip",
]);

// ─── Page ─────────────────────────────────────────────────────────────────────

type TabKey = "all" | "workflow" | "custom";

export default function TemplatesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [templates, setTemplates]       = useState<EmailTemplate[]>([]);
  const [loading, setLoading]           = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);
  const [activeTab, setActiveTab]       = useState<TabKey>("all");

  useEffect(() => {
    void fetchTemplates();
  }, []);

  async function fetchTemplates() {
    setLoading(true);
    const { data } = await supabase
      .from("email_templates")
      .select("*")
      .order("type")
      .order("name");
    setTemplates((data as EmailTemplate[]) ?? []);
    setLoading(false);
  }

  async function handleDuplicate(template: EmailTemplate) {
    const { data, error } = await supabase
      .from("email_templates")
      .insert({
        name:      `Másolat: ${template.name}`,
        subject:   template.subject,
        body:      template.body,
        variables: template.variables,
        type:      template.type,
        is_default: false,
      })
      .select()
      .single();

    if (error) {
      toast.error("Hiba a másolás során");
      return;
    }
    toast.success("Sablon lemásolva");
    router.push(`/emails/templates/${(data as EmailTemplate).id}`);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("email_templates")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      toast.error("Hiba a törlés során");
    } else {
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      toast.success("Sablon törölve");
    }
    setDeleteTarget(null);
  }

  async function handleTestSend(template: EmailTemplate) {
    const email = prompt("Teszt email cím:");
    if (!email?.includes("@")) return;

    await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        testMode: true,
        testEmail: email,
        clientIds: ["00000000-0000-0000-0000-000000000000"],
        customSubject: template.subject.replace(/\{\{[^}]+\}\}/g, "(példa)"),
        customBody: template.body.replace(/\{\{[^}]+\}\}/g, "(példa)"),
      }),
    });

    toast.info(`Teszt email elküldve: ${email}`);
  }

  // ── Filtering ──────────────────────────────────────────────────────────────
  const workflowTemplates = templates.filter(
    t => t.type && WORKFLOW_TYPES.has(t.type as EmailTemplateType)
  );
  const customTemplates = templates.filter(
    t => !t.type || !WORKFLOW_TYPES.has(t.type as EmailTemplateType)
  );
  const visibleTemplates =
    activeTab === "workflow" ? workflowTemplates :
    activeTab === "custom"   ? customTemplates   :
    templates;

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "all",      label: "Összes",           count: templates.length },
    { key: "workflow", label: "Workflow sablonok", count: workflowTemplates.length },
    { key: "custom",   label: "Egyéni",            count: customTemplates.length },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-zinc-500">{templates.length} sablon összesen</p>
        <Button
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => router.push("/emails/templates/new")}
        >
          <Plus className="mr-2 h-4 w-4" />Új sablon
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-zinc-100">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {tab.key === "workflow" && <GitBranch className="h-3.5 w-3.5" />}
            {tab.key === "custom"   && <Tag className="h-3.5 w-3.5" />}
            {tab.label}
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold ${
              activeTab === tab.key ? "bg-blue-100 text-blue-700" : "bg-zinc-100 text-zinc-500"
            }`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Workflow section info banner */}
      {activeTab === "workflow" && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
          <GitBranch className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800">Workflow sablonok</p>
            <p className="text-xs text-blue-600 mt-0.5">
              Ezeket a sablonokat a Workflow Center automatikusan ajánlja fel a megfelelő lépésnél.
              Az alapértelmezett sablonokat <strong>másolással</strong> szerkesztheted — az originálok megmaradnak.
            </p>
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-md border border-zinc-200 p-5">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-5 w-3/4 mb-2" />
              <Skeleton className="h-4 w-full mb-4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : visibleTemplates.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-zinc-200 text-sm text-zinc-400">
          Még nincs sablon ebben a kategóriában
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleTemplates.map((tmpl) => {
            const typeMeta    = tmpl.type ? TYPE_META[tmpl.type as EmailTemplateType] : null;
            const stepLabel   = tmpl.type ? WORKFLOW_STEP_LABELS[tmpl.type as EmailTemplateType] : null;
            const isWorkflow  = tmpl.type ? WORKFLOW_TYPES.has(tmpl.type as EmailTemplateType) : false;
            return (
              <div
                key={tmpl.id}
                className={`flex flex-col rounded-md border bg-white hover:border-zinc-300 transition-colors ${
                  isWorkflow ? "border-blue-200" : "border-zinc-200"
                }`}
              >
                <div className="flex-1 p-5">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                    {typeMeta ? (
                      <Badge variant={typeMeta.variant}>{typeMeta.label}</Badge>
                    ) : (
                      <div />
                    )}
                    <div className="flex items-center gap-1">
                      {tmpl.is_default && (
                        <Badge variant="muted" className="text-[10px]">Alapértelmezett</Badge>
                      )}
                      {isWorkflow && (
                        <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-600 gap-1">
                          <GitBranch className="h-2.5 w-2.5" />Workflow
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Workflow step link */}
                  {stepLabel && (
                    <div className="flex items-center gap-1.5 mb-2 text-[11px] text-blue-600 bg-blue-50 rounded-md px-2.5 py-1 w-fit">
                      <GitBranch className="h-3 w-3 shrink-0" />
                      <span>Lépés: <strong>{stepLabel}</strong></span>
                    </div>
                  )}

                  {/* Name */}
                  <h3 className="font-semibold text-zinc-900 mb-1">{tmpl.name}</h3>

                  {/* Subject preview */}
                  <p className="text-xs text-zinc-500 mb-3 truncate" title={tmpl.subject}>
                    {tmpl.subject}
                  </p>

                  {/* Variable chips */}
                  {tmpl.variables && tmpl.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {tmpl.variables.slice(0, 4).map((v) => (
                        <span
                          key={v}
                          className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500"
                        >
                          {`{{${v}}}`}
                        </span>
                      ))}
                      {(tmpl.variables.length ?? 0) > 4 && (
                        <span className="text-[10px] text-zinc-400">
                          +{tmpl.variables.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Last modified */}
                  <p className="text-[11px] text-zinc-400">
                    Módosítva: {formatDate(tmpl.updated_at)}
                  </p>
                </div>

                {/* Actions footer */}
                <div className="flex items-center gap-1 border-t border-zinc-100 px-4 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 text-xs h-7"
                    onClick={() => router.push(`/emails/templates/${tmpl.id}`)}
                  >
                    <Pencil className="mr-1 h-3.5 w-3.5" />
                    {tmpl.is_default ? "Megtekint" : "Szerkeszt"}
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => handleDuplicate(tmpl)}>
                        <Copy className="mr-2 h-4 w-4" />Másolat készítése
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleTestSend(tmpl)}>
                        <Send className="mr-2 h-4 w-4" />Teszt küldés
                      </DropdownMenuItem>
                      {!tmpl.is_default && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                            onClick={() => setDeleteTarget(tmpl)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />Töröl
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        variant="danger"
        title="Sablon törlése"
        description={`Biztosan törlöd a(z) "${deleteTarget?.name}" sablont?`}
        confirmLabel="Törlés"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
