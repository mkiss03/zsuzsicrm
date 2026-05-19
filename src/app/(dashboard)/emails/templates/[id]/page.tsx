"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Bold, Italic, Link as LinkIcon, List, ListOrdered, ChevronDown, Eye, EyeOff, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { EmailTemplate, EmailTemplateType } from "@/types";

// ─── Variable catalogue ───────────────────────────────────────────────────────

const VARIABLES = [
  { name: "ugyfel_neve",         label: "Ügyfél neve",              example: "Nagy Katalin" },
  { name: "ut_neve",             label: "Utazás neve",               example: "Toszkán körutazás" },
  { name: "indulas_datum",       label: "Indulás dátuma",            example: "2025. jún. 15." },
  { name: "visszaerkezes_datum", label: "Visszaérkezés dátuma",      example: "2025. jún. 22." },
  { name: "foglalas_kod",        label: "Foglalás kód",              example: "BKG-00042" },
  { name: "ar",                  label: "Végösszeg",                 example: "120 000 Ft" },
  { name: "elofizetes_osszege",  label: "Előleg összege",            example: "36 000 Ft" },
  { name: "fizetes_hatarido",    label: "Fizetési határidő",         example: "2025. máj. 31." },
  { name: "hatralevo_osszeg",    label: "Hátralévő egyenleg",        example: "84 000 Ft" },
  { name: "iban",                label: "IBAN bankszámlaszám",       example: "AT60 1234 5678" },
  { name: "szabad_helyek",       label: "Szabad helyek száma",       example: "4" },
  { name: "program",             label: "Program / leírás",          example: "(utazás leírása)" },
  { name: "iroda_neve",          label: "Iroda neve",                example: "ZsuzsiTravel" },
  { name: "talalkozasi_pont",    label: "Találkozási pont",          example: "Budapest Keleti" },
  { name: "indulasi_ido",        label: "Indulási idő",              example: "07:30" },
] as const;

type VarName = (typeof VARIABLES)[number]["name"];

const TYPE_OPTIONS: { value: EmailTemplateType; label: string }[] = [
  { value: "confirmation",    label: "Visszaigazolás" },
  { value: "deposit_request", label: "Előleg bekérő" },
  { value: "reminder",        label: "Emlékeztető" },
  { value: "pre_trip",        label: "Út előtti tájékoztató" },
  { value: "post_trip",       label: "Út utáni köszönő" },
  { value: "promotional",     label: "Promóció" },
];

// ─── Preview renderer ─────────────────────────────────────────────────────────

function renderPreview(text: string): string {
  const DUMMY: Record<VarName, string> = {
    ugyfel_neve:         "Minta Ügyfél",
    ut_neve:             "Toszkán körutazás",
    indulas_datum:       "2025. jún. 15.",
    visszaerkezes_datum: "2025. jún. 22.",
    foglalas_kod:        "BKG-00042",
    ar:                  "120 000 Ft",
    elofizetes_osszege:  "36 000 Ft",
    fizetes_hatarido:    "2025. máj. 31.",
    hatralevo_osszeg:    "84 000 Ft",
    iban:                "AT60 1234 5678 0000",
    szabad_helyek:       "4",
    program:             "(program leírása)",
    iroda_neve:          "ZsuzsiTravel",
    talalkozasi_pont:    "Budapest Keleti",
    indulasi_ido:        "07:30",
  };

  return text
    .replace(
      /\{\{(\w+)\}\}/g,
      (_, key: string) =>
        key in DUMMY
          ? `<span style="background:#dbeafe;color:#1e40af;padding:1px 5px;border-radius:3px;font-family:monospace;font-size:0.85em">${DUMMY[key as VarName]}</span>`
          : `<span style="background:#fef3c7;color:#92400e;padding:1px 5px;border-radius:3px;font-family:monospace;font-size:0.85em">{{${key}}}</span>`,
    )
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/_(.*?)_/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#2563eb">$1</a>')
    .replace(/\n/g, "<br>");
}

// ─── Textarea toolbar helpers ─────────────────────────────────────────────────

function wrapSelection(textarea: HTMLTextAreaElement, before: string, after: string) {
  const start = textarea.selectionStart;
  const end   = textarea.selectionEnd;
  const sel   = textarea.value.slice(start, end) || "szöveg";
  const next  = textarea.value.slice(0, start) + before + sel + after + textarea.value.slice(end);
  return { next, cursor: start + before.length + sel.length + after.length };
}

function prefixLines(textarea: HTMLTextAreaElement, prefix: string) {
  const start  = textarea.selectionStart;
  const end    = textarea.selectionEnd;
  const before = textarea.value.slice(0, start);
  const sel    = textarea.value.slice(start, end) || "tétel";
  const after  = textarea.value.slice(end);
  const lines  = sel.split("\n").map((l) => prefix + l).join("\n");
  return { next: before + lines + after, cursor: start + lines.length };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TemplateEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const isNew = params.id === "new";

  const [initialLoading, setInitialLoading] = useState(!isNew);
  const [saving, setSaving]                 = useState(false);
  const [testing, setTesting]               = useState(false);
  const [showPreview, setShowPreview]       = useState(false);
  const [testEmail, setTestEmail]           = useState("");
  const [isDefault, setIsDefault]           = useState(false);

  // Form state
  const [name, setName]       = useState("");
  const [type, setType]       = useState<EmailTemplateType>("confirmation");
  const [subject, setSubject] = useState("");
  const [body, setBody]       = useState("");

  const bodyRef    = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);

  // Load existing template
  useEffect(() => {
    if (isNew) return;
    supabase
      .from("email_templates")
      .select("*")
      .eq("id", params.id)
      .single()
      .then(({ data }) => {
        if (data) {
          const tmpl = data as EmailTemplate;
          setName(tmpl.name);
          setType(tmpl.type ?? "confirmation");
          setSubject(tmpl.subject);
          setBody(tmpl.body);
          setIsDefault(tmpl.is_default);
        }
        setInitialLoading(false);
      });
  }, [params.id, isNew]);

  // Insert variable at cursor in body or subject
  function insertVariable(varName: string, target: "body" | "subject" = "body") {
    const token = `{{${varName}}}`;

    if (target === "subject") {
      const inp = subjectRef.current;
      if (!inp) return;
      const s = inp.selectionStart ?? subject.length;
      const e = inp.selectionEnd   ?? subject.length;
      const next = subject.slice(0, s) + token + subject.slice(e);
      setSubject(next);
      setTimeout(() => {
        inp.selectionStart = s + token.length;
        inp.selectionEnd   = s + token.length;
        inp.focus();
      }, 0);
    } else {
      const ta = bodyRef.current;
      if (!ta) return;
      const s = ta.selectionStart;
      const e = ta.selectionEnd;
      const next = body.slice(0, s) + token + body.slice(e);
      setBody(next);
      setTimeout(() => {
        ta.selectionStart = s + token.length;
        ta.selectionEnd   = s + token.length;
        ta.focus();
      }, 0);
    }
  }

  function applyToolbar(action: "bold" | "italic" | "link" | "ol" | "ul") {
    const ta = bodyRef.current;
    if (!ta) return;

    let result: { next: string; cursor: number };

    if (action === "bold")   result = wrapSelection(ta, "**", "**");
    else if (action === "italic") result = wrapSelection(ta, "_", "_");
    else if (action === "link") {
      const url = prompt("Link URL:", "https://");
      if (!url) return;
      result = wrapSelection(ta, "[", `](${url})`);
    }
    else if (action === "ol") result = prefixLines(ta, "1. ");
    else result = prefixLines(ta, "- ");

    setBody(result.next);
    setTimeout(() => {
      ta.selectionStart = result.cursor;
      ta.selectionEnd   = result.cursor;
      ta.focus();
    }, 0);
  }

  async function handleSave() {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      toast.error("Töltsd ki a kötelező mezőket");
      return;
    }

    setSaving(true);
    const payload = {
      name:      name.trim(),
      type,
      subject:   subject.trim(),
      body:      body.trim(),
      variables: VARIABLES.filter((v) => body.includes(`{{${v.name}}}`) || subject.includes(`{{${v.name}}}`)).map((v) => v.name),
      is_default: isDefault,
    };

    const { error } = isNew
      ? await supabase.from("email_templates").insert(payload)
      : await supabase.from("email_templates").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", params.id);

    setSaving(false);

    if (error) {
      toast.error("Hiba a mentés során");
    } else {
      toast.success("Sablon mentve");
      router.push("/emails/templates");
    }
  }

  async function handleTestSend() {
    if (!testEmail.includes("@")) { toast.error("Érvénytelen email cím"); return; }
    if (!subject.trim() || !body.trim()) { toast.error("Tárgy és törzs szükséges"); return; }

    setTesting(true);
    const res = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        testMode: true,
        testEmail,
        clientIds: [],
        customSubject: subject.replace(/\{\{(\w+)\}\}/g, (_, k: string) => `(${k})`),
        customBody:    body.replace(/\{\{(\w+)\}\}/g, (_, k: string) => `(${k})`),
      }),
    });
    setTesting(false);
    toast.success(`Teszt email elküldve: ${testEmail}`);
  }

  if (initialLoading) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild className="-ml-2">
            <Link href="/emails/templates">
              <ArrowLeft className="mr-1.5 h-4 w-4" />Vissza
            </Link>
          </Button>
          <h2 className="text-lg font-semibold text-zinc-900">
            {isNew ? "Új sablon" : "Sablon szerkesztése"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview((v) => !v)}
          >
            {showPreview ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
            {showPreview ? "Szerkesztő" : "Előnézet"}
          </Button>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={handleSave}
            disabled={saving}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Mentés
          </Button>
        </div>
      </div>

      <div className={showPreview ? "grid grid-cols-2 gap-6" : "space-y-4"}>
        {/* ── Editor column ──────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Name + Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-zinc-700">
                Sablon neve <span className="text-red-500">*</span>
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="pl. Foglalás visszaigazolás"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-zinc-700">Típus</Label>
              <Select value={type} onValueChange={(v) => setType(v as EmailTemplateType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-zinc-700">
                Tárgy <span className="text-red-500">*</span>
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600">
                    <ChevronDown className="mr-1 h-3 w-3" />Változó a tárgyba
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 max-h-64 overflow-y-auto">
                  {VARIABLES.map((v) => (
                    <DropdownMenuItem
                      key={v.name}
                      onClick={() => insertVariable(v.name, "subject")}
                    >
                      <span className="font-mono text-xs text-blue-600 mr-2">{`{{${v.name}}}`}</span>
                      <span className="text-zinc-500">{v.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Input
              ref={subjectRef}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="pl. Foglalásod visszaigazolása – {{ut_neve}}"
            />
          </div>

          {/* Body editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-zinc-700">
                Üzenet törzse <span className="text-red-500">*</span>
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600">
                    <ChevronDown className="mr-1 h-3 w-3" />Változó beszúrása
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 max-h-72 overflow-y-auto">
                  {VARIABLES.map((v) => (
                    <DropdownMenuItem
                      key={v.name}
                      onClick={() => insertVariable(v.name)}
                    >
                      <div className="flex flex-col">
                        <span className="font-mono text-xs text-blue-600">{`{{${v.name}}}`}</span>
                        <span className="text-[11px] text-zinc-400">{v.label} · pl. {v.example}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-1 border border-b-0 border-zinc-200 rounded-t-md bg-zinc-50 px-2 py-1.5">
              {[
                { icon: Bold,         action: "bold"   as const, title: "Félkövér (**szöveg**)" },
                { icon: Italic,       action: "italic" as const, title: "Dőlt (_szöveg_)" },
                { icon: LinkIcon,     action: "link"   as const, title: "Link [szöveg](url)" },
                { icon: ListOrdered,  action: "ol"     as const, title: "Számozott lista" },
                { icon: List,         action: "ul"     as const, title: "Felsorolás" },
              ].map(({ icon: Icon, action, title }) => (
                <button
                  key={action}
                  onClick={() => applyToolbar(action)}
                  title={title}
                  className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 transition-colors"
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
              <div className="ml-2 text-[10px] text-zinc-400">
                **félkövér** · _dőlt_ · [link](url) · - lista
              </div>
            </div>

            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={14}
              placeholder={"Kedves {{ugyfel_neve}}!\n\nÖrömmel értesítünk, hogy…"}
              className="w-full rounded-b-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-0"
            />
          </div>

          {/* Variables reference */}
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">
              Elérhető változók
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {VARIABLES.map((v) => (
                <button
                  key={v.name}
                  onClick={() => insertVariable(v.name)}
                  className="flex items-start gap-2 text-left hover:bg-zinc-100 rounded p-1 transition-colors"
                >
                  <span className="font-mono text-[10px] text-blue-600 mt-0.5 flex-shrink-0">
                    {`{{${v.name}}}`}
                  </span>
                  <span className="text-[11px] text-zinc-500">{v.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Test send */}
          <div className="rounded-md border border-zinc-200 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Teszt küldés
            </p>
            <div className="flex gap-2">
              <Input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="teszt@email.com"
                className="flex-1 h-9"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleTestSend}
                disabled={testing || !testEmail}
                className="h-9"
              >
                {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Teszt küldés
              </Button>
            </div>
            <p className="text-xs text-zinc-400">
              A változók helyére mintaadatok kerülnek.
            </p>
          </div>
        </div>

        {/* ── Preview column (only when showPreview) ─────────────────────── */}
        {showPreview && (
          <div className="sticky top-6">
            <div className="rounded-md border border-zinc-200 bg-white overflow-hidden">
              <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-2.5">
                <p className="text-xs font-semibold text-zinc-500">Előnézet (mintaadatokkal)</p>
                <p className="text-sm font-medium text-zinc-900 mt-0.5 truncate">
                  {subject
                    ? subject.replace(/\{\{(\w+)\}\}/g, (_, k: string) => `(${k})`)
                    : "(tárgy)"}
                </p>
              </div>
              <div
                className="p-5 text-sm text-zinc-800 leading-relaxed min-h-48 max-h-[60vh] overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: renderPreview(body || "(üres)") }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
