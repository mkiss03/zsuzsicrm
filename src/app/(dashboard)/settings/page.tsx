"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Building2, CreditCard, Bell,
  Percent, ShieldCheck, Upload, Trash2, Loader2,
  Eye, EyeOff, CheckCircle, Info, Tag, Plus, Pencil, X, Check,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiscountLevel {
  level: number;
  name: string;
  minTrips: number;
  pct: number;
}

const DEFAULT_DISCOUNT_LEVELS: DiscountLevel[] = [
  { level: 0, name: "Alap",  minTrips: 0, pct: 0 },
  { level: 1, name: "Bronz", minTrips: 3, pct: 5 },
  { level: 2, name: "Ezüst", minTrips: 5, pct: 10 },
  { level: 3, name: "Arany", minTrips: 8, pct: 15 },
];

const DISCOUNT_BADGE_VARIANTS: Record<number, "muted" | "info" | "warning" | "success"> = {
  0: "muted", 1: "info", 2: "warning", 3: "success",
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-sm font-medium text-zinc-700">{label}</Label>
      {children}
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

function SaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      disabled={saving}
      className="bg-blue-600 hover:bg-blue-700 h-9"
    >
      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {saving ? "Mentés…" : "Mentés"}
    </Button>
  );
}

// ─── Password strength ────────────────────────────────────────────────────────

interface StrengthResult {
  score: number;  // 0-5
  label: string;
  color: string;
}

function getPasswordStrength(pw: string): StrengthResult {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 12)              score++;
  if (/[A-Z]/.test(pw))            score++;
  if (/[a-z]/.test(pw))            score++;
  if (/[0-9]/.test(pw))            score++;
  if (/[^A-Za-z0-9]/.test(pw))    score++;

  const levels: Omit<StrengthResult, "score">[] = [
    { label: "Nagyon gyenge", color: "bg-red-500" },
    { label: "Gyenge",        color: "bg-orange-500" },
    { label: "Közepes",       color: "bg-yellow-500" },
    { label: "Erős",          color: "bg-blue-500" },
    { label: "Nagyon erős",   color: "bg-green-600" },
  ];
  return { score, ...(levels[score - 1] ?? levels[0]!) };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router   = useRouter();
  const supabase = createClient();

  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading]   = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [lastSignIn, setLastSignIn] = useState<string | null>(null);

  // Load all settings + current user on mount
  useEffect(() => {
    void (async () => {
      const [settingsRes, userRes] = await Promise.all([
        supabase.from("settings").select("key, value"),
        supabase.auth.getUser(),
      ]);
      const map: Record<string, string> = {};
      for (const row of settingsRes.data ?? []) {
        map[(row as { key: string; value: string | null }).key] =
          (row as { key: string; value: string | null }).value ?? "";
      }
      setSettings(map);
      setUserEmail(userRes.data.user?.email ?? "");
      setLastSignIn(userRes.data.user?.last_sign_in_at ?? null);
      setLoading(false);
    })();
  }, []);

  function get(key: string, fallback = ""): string {
    return settings[key] ?? fallback;
  }

  function set(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function saveKeys(keys: string[]): Promise<boolean> {
    const upserts = keys.map((k) => ({ key: k, value: settings[k] ?? "" }));
    const { error } = await supabase
      .from("settings")
      .upsert(upserts, { onConflict: "key" });
    if (error) { toast.error("Mentési hiba: " + error.message); return false; }
    toast.success("Beállítások elmentve");
    return true;
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-zinc-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Beállítások betöltése…
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Beállítások</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Rendszer konfiguráció és biztonság</p>
      </div>

      <Tabs defaultValue="company">
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="company"    className="gap-1.5"><Building2   className="h-3.5 w-3.5" />Céges adatok</TabsTrigger>
          <TabsTrigger value="billing"    className="gap-1.5"><CreditCard  className="h-3.5 w-3.5" />Számlázás</TabsTrigger>
          <TabsTrigger value="notifs"     className="gap-1.5"><Bell        className="h-3.5 w-3.5" />Értesítések</TabsTrigger>
          <TabsTrigger value="discounts"  className="gap-1.5"><Percent     className="h-3.5 w-3.5" />Kedvezmény szintek</TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5"><Tag         className="h-3.5 w-3.5" />Kategóriák</TabsTrigger>
          <TabsTrigger value="security"   className="gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Biztonság</TabsTrigger>
        </TabsList>

        {/* ── TAB 1: Céges adatok ──────────────────────────────────────── */}
        <TabsContent value="company">
          <CompanyTab settings={settings} get={get} set={set} saveKeys={saveKeys} supabase={supabase} />
        </TabsContent>

        {/* ── TAB 2: Számlázás ─────────────────────────────────────────── */}
        <TabsContent value="billing">
          <BillingTab settings={settings} get={get} set={set} saveKeys={saveKeys} />
        </TabsContent>

        {/* ── TAB 3: Értesítések ───────────────────────────────────────── */}
        <TabsContent value="notifs">
          <NotificationsTab settings={settings} get={get} set={set} saveKeys={saveKeys} />
        </TabsContent>

        {/* ── TAB 4: Kedvezmény szintek ────────────────────────────────── */}
        <TabsContent value="discounts">
          <DiscountsTab get={get} set={set} saveKeys={saveKeys} />
        </TabsContent>

        {/* ── TAB 5: Kategóriák ──────────────────────────────────────── */}
        <TabsContent value="categories">
          <CategoriesTab />
        </TabsContent>

        {/* ── TAB 6: Biztonság ─────────────────────────────────────────── */}
        <TabsContent value="security">
          <SecurityTab
            userEmail={userEmail}
            lastSignIn={lastSignIn}
            supabase={supabase}
            router={router}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── TAB 1: Céges adatok ─────────────────────────────────────────────────────

function CompanyTab({
  settings, get, set, saveKeys, supabase,
}: {
  settings: Record<string, string>;
  get: (k: string, d?: string) => string;
  set: (k: string, v: string) => void;
  saveKeys: (keys: string[]) => Promise<boolean>;
  supabase: ReturnType<typeof createClient>;
}) {
  const [saving, setSaving]         = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [logoUrl, setLogoUrl]       = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLogoUrl(settings["company_logo_url"] ?? "");
  }, [settings]);

  const COMPANY_KEYS = [
    "agency_name", "agency_legal_name",
    "agency_street", "agency_zip", "agency_city", "agency_country",
    "agency_email", "agency_phone",
    "agency_tax_number", "uid_nummer",
    "iban", "bic", "bank_name", "bank_account_number",
    "company_logo_url",
  ];

  async function handleSave() {
    setSaving(true);
    await saveKeys(COMPANY_KEYS);
    setSaving(false);
  }

  async function handleLogoUpload(file: File) {
    if (!file) return;
    setUploading(true);
    const ext  = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `logo.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("company")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadErr) {
      toast.error("Feltöltési hiba: " + uploadErr.message);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("company").getPublicUrl(path);
    const urlWithBust = `${publicUrl}?t=${Date.now()}`;

    // Persist URL immediately
    await supabase.from("settings").upsert(
      { key: "company_logo_url", value: urlWithBust },
      { onConflict: "key" }
    );
    set("company_logo_url", urlWithBust);
    setLogoUrl(urlWithBust);
    toast.success("Logó sikeresen feltöltve");
    setUploading(false);
  }

  async function handleLogoDelete() {
    setUploading(true);
    // List and remove all logo files
    const { data: files } = await supabase.storage.from("company").list();
    const logos = (files ?? []).filter((f) => f.name.startsWith("logo."));
    if (logos.length > 0) {
      await supabase.storage.from("company").remove(logos.map((f) => f.name));
    }
    await supabase.from("settings").upsert(
      { key: "company_logo_url", value: "" },
      { onConflict: "key" }
    );
    set("company_logo_url", "");
    setLogoUrl("");
    toast.success("Logó törölve");
    setUploading(false);
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Company identity */}
      <Section title="Vállalkozás adatai">
        <Field label="Rövid név (emailekben, értesítésekben)">
          <Input value={get("agency_name")} onChange={(e) => set("agency_name", e.target.value)} className="h-9" />
        </Field>
        <Field label="Teljes cégnév (számlán)">
          <Input value={get("agency_legal_name")} onChange={(e) => set("agency_legal_name", e.target.value)} className="h-9" placeholder="pl. Tuza-Göncz Zsuzsanna e.U." />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email cím">
            <Input type="email" value={get("agency_email")} onChange={(e) => set("agency_email", e.target.value)} className="h-9" />
          </Field>
          <Field label="Telefonszám">
            <Input type="tel" value={get("agency_phone")} onChange={(e) => set("agency_phone", e.target.value)} className="h-9" />
          </Field>
        </div>
      </Section>

      <Separator />

      {/* Address */}
      <Section title="Cím">
        <Field label="Utca, házszám">
          <Input value={get("agency_street")} onChange={(e) => set("agency_street", e.target.value)} className="h-9" />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Irányítószám">
            <Input value={get("agency_zip")} onChange={(e) => set("agency_zip", e.target.value)} className="h-9" />
          </Field>
          <Field label="Város" className="col-span-2">
            <Input value={get("agency_city")} onChange={(e) => set("agency_city", e.target.value)} className="h-9" />
          </Field>
        </div>
        <Field label="Ország">
          <Input value={get("agency_country", "Ausztria")} onChange={(e) => set("agency_country", e.target.value)} className="h-9" />
        </Field>
      </Section>

      <Separator />

      {/* Tax */}
      <Section title="Adóazonosítók">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Adószám / Steuernummer">
            <Input value={get("agency_tax_number")} onChange={(e) => set("agency_tax_number", e.target.value)} className="h-9" />
          </Field>
          <Field label="UID szám (EU)" hint="pl. ATU12345678">
            <Input value={get("uid_nummer")} onChange={(e) => set("uid_nummer", e.target.value)} className="h-9" />
          </Field>
        </div>
      </Section>

      <Separator />

      {/* Bank */}
      <Section title="Bankszámla">
        <Field label="IBAN" hint="pl. AT60 1234 5678 9012 3456">
          <Input value={get("iban")} onChange={(e) => set("iban", e.target.value)} className="h-9 font-mono" />
        </Field>
        <Field label="Bankszámlaszám" hint="pl. 11773016-12345678-00000000">
          <Input value={get("bank_account_number")} onChange={(e) => set("bank_account_number", e.target.value)} className="h-9 font-mono" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="BIC / SWIFT">
            <Input value={get("bic")} onChange={(e) => set("bic", e.target.value)} className="h-9 font-mono" />
          </Field>
          <Field label="Bank neve">
            <Input value={get("bank_name")} onChange={(e) => set("bank_name", e.target.value)} className="h-9" />
          </Field>
        </div>
      </Section>

      <Separator />

      {/* Logo */}
      <Section title="Logó feltöltés" description="Megjelenik a számlák fejlécén (max. 2 MB, JPEG/PNG/WebP/SVG)">
        {logoUrl ? (
          <div className="flex items-start gap-4">
            {/* Preview */}
            <div className="flex h-20 w-40 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 p-2 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="Céglogó" className="max-h-full max-w-full object-contain" />
            </div>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="h-8"
              >
                {uploading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-2 h-3.5 w-3.5" />}
                Csere
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogoDelete}
                disabled={uploading}
                className="h-8 text-red-600 hover:text-red-600 hover:bg-red-50 border-red-200 block"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Logó törlése
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex h-24 w-full items-center justify-center gap-3 rounded-md border-2 border-dashed border-zinc-200 bg-zinc-50/50 text-sm text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50 transition-colors disabled:opacity-50"
          >
            {uploading
              ? <><Loader2 className="h-5 w-5 animate-spin text-blue-600" /> Feltöltés…</>
              : <><Upload className="h-5 w-5 text-zinc-400" /> Kattints a logó feltöltéséhez</>}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleLogoUpload(file);
            e.target.value = "";
          }}
        />
      </Section>

      <div className="flex justify-end pt-2">
        <SaveButton saving={saving} onClick={handleSave} />
      </div>
    </div>
  );
}

// ─── TAB 2: Számlázás ─────────────────────────────────────────────────────────

function BillingTab({
  get, set, saveKeys,
}: {
  settings: Record<string, string>;
  get: (k: string, d?: string) => string;
  set: (k: string, v: string) => void;
  saveKeys: (keys: string[]) => Promise<boolean>;
}) {
  const [saving, setSaving] = useState(false);
  const originalStart = useRef(get("invoice_number_start", "1"));
  const currentStart  = get("invoice_number_start", "1");
  const startChanged  = currentStart !== originalStart.current && originalStart.current !== "";

  const BILLING_KEYS = [
    "default_tax_rate", "payment_deadline_days",
    "invoice_number_start", "invoice_footer_text", "invoice_default_notes",
  ];

  async function handleSave() {
    setSaving(true);
    const ok = await saveKeys(BILLING_KEYS);
    if (ok) originalStart.current = currentStart;
    setSaving(false);
  }

  return (
    <div className="max-w-lg space-y-6">
      <Section title="Adó és valuta">
        <Field label="Alapértelmezett ÁFA kulcs">
          <Select value={get("default_tax_rate", "13")} onValueChange={(v) => set("default_tax_rate", v)}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20% – Normalsatz (általános)</SelectItem>
              <SelectItem value="13">13% – Ermäßigt (turisztika)</SelectItem>
              <SelectItem value="0">0% – Steuerfrei (adómentes)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Valuta">
          <div className="flex h-9 w-24 items-center rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-500 select-none">
            EUR (€)
          </div>
          <p className="text-xs text-zinc-400 mt-1">A rendszer kizárólag EUR-t használ.</p>
        </Field>
      </Section>

      <Separator />

      <Section title="Fizetési feltételek">
        <Field label="Alapértelmezett fizetési határidő (napokban)" hint="Új számlánál automatikusan ez kerül be">
          <Input
            type="number"
            min={1}
            max={90}
            value={get("payment_deadline_days", "14")}
            onChange={(e) => set("payment_deadline_days", e.target.value)}
            className="h-9 w-28"
          />
        </Field>
      </Section>

      <Separator />

      <Section title="Számlaszámozás">
        <Field label="Számlaszám kezdőértéke" hint="Az összes számla ezzel a sorszámmal indul. Módosítás esetén a korábbi számlák érintetlenek maradnak.">
          <Input
            type="number"
            min={1}
            value={currentStart}
            onChange={(e) => set("invoice_number_start", e.target.value)}
            className="h-9 w-28"
          />
        </Field>
        {startChanged && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              A számlaszám módosítása befolyásolja az összes ezután kiállított számla számát.
              Az összes eddigi számla száma változatlan marad.
            </span>
          </div>
        )}
      </Section>

      <Separator />

      <Section title="Szöveges beállítások">
        <Field label="Alapértelmezett számla lábléc szöveg" hint="Megjelenik minden számla alján (pl. fizetési információk, köszönet)">
          <Textarea
            rows={3}
            value={get("invoice_footer_text")}
            onChange={(e) => set("invoice_footer_text", e.target.value)}
            placeholder="Vielen Dank für Ihr Vertrauen!"
          />
        </Field>
        <Field label="Alapértelmezett megjegyzés" hint="Előre kitöltött megjegyzés minden új számlán (szerkeszthető)">
          <Textarea
            rows={3}
            value={get("invoice_default_notes")}
            onChange={(e) => set("invoice_default_notes", e.target.value)}
            placeholder="pl. Bitte überweisen Sie den Betrag innerhalb von 14 Tagen…"
          />
        </Field>
      </Section>

      <div className="flex justify-end pt-2">
        <SaveButton saving={saving} onClick={handleSave} />
      </div>
    </div>
  );
}

// ─── TAB 3: Értesítések ───────────────────────────────────────────────────────

function NotificationsTab({
  get, set, saveKeys,
}: {
  settings: Record<string, string>;
  get: (k: string, d?: string) => string;
  set: (k: string, v: string) => void;
  saveKeys: (keys: string[]) => Promise<boolean>;
}) {
  const [saving, setSaving] = useState(false);

  const NOTIF_KEYS = [
    "notify_passport_expiry", "notify_passport_expiry_days",
    "notify_payment_due", "notify_payment_due_days",
    "notify_payment_overdue",
    "notify_new_booking",
    "notify_trip_soon", "notify_trip_soon_days",
    "notify_low_capacity", "notify_low_capacity_spots",
    "notification_email",
  ];

  const toggle = (key: string) => set(key, get(key) === "1" ? "0" : "1");
  const isOn   = (key: string) => get(key, "1") === "1";

  return (
    <div className="max-w-lg space-y-6">
      <div className="rounded-md border border-zinc-200 bg-white divide-y divide-zinc-100">
        {/* Passport expiry */}
        <NotifRow
          label="Lejáró útlevél"
          description="Értesítés, ha egy ügyfél útlevele hamarosan lejár"
          enabled={isOn("notify_passport_expiry")}
          onToggle={() => toggle("notify_passport_expiry")}
        >
          {isOn("notify_passport_expiry") && (
            <DaysInput
              label="nappal előtte"
              value={get("notify_passport_expiry_days", "60")}
              onChange={(v) => set("notify_passport_expiry_days", v)}
            />
          )}
        </NotifRow>

        {/* Payment due */}
        <NotifRow
          label="Közelgő fizetési határidő"
          description="Értesítés, ha egy fizetési határidő hamarosan lejár"
          enabled={isOn("notify_payment_due")}
          onToggle={() => toggle("notify_payment_due")}
        >
          {isOn("notify_payment_due") && (
            <DaysInput
              label="nappal előtte"
              value={get("notify_payment_due_days", "3")}
              onChange={(v) => set("notify_payment_due_days", v)}
            />
          )}
        </NotifRow>

        {/* Payment overdue */}
        <NotifRow
          label="Lejárt fizetési határidő"
          description="Értesítés, ha egy foglalás fizetési határideje elmúlt"
          enabled={isOn("notify_payment_overdue")}
          onToggle={() => toggle("notify_payment_overdue")}
        />

        {/* New booking */}
        <NotifRow
          label="Új weboldalas foglalás"
          description="Értesítés, ha új foglalás érkezik a weboldalról"
          enabled={isOn("notify_new_booking")}
          onToggle={() => toggle("notify_new_booking")}
        />

        {/* Trip soon */}
        <NotifRow
          label="Közelgő utazás"
          description="Értesítés, ha egy utazás indulása közeledik"
          enabled={isOn("notify_trip_soon")}
          onToggle={() => toggle("notify_trip_soon")}
        >
          {isOn("notify_trip_soon") && (
            <DaysInput
              label="nappal előtte"
              value={get("notify_trip_soon_days", "14")}
              onChange={(v) => set("notify_trip_soon_days", v)}
            />
          )}
        </NotifRow>

        {/* Low capacity */}
        <NotifRow
          label="Kis szabad hely"
          description="Értesítés, ha egy hirdetett utazáson alig van hely"
          enabled={isOn("notify_low_capacity")}
          onToggle={() => toggle("notify_low_capacity")}
        >
          {isOn("notify_low_capacity") && (
            <DaysInput
              label="helynél kevesebb"
              value={get("notify_low_capacity_spots", "2")}
              onChange={(v) => set("notify_low_capacity_spots", v)}
            />
          )}
        </NotifRow>
      </div>

      <Separator />

      {/* Notification email */}
      <Section title="Értesítési email cím" description="Ide küldi a rendszer az értesítő emaileket (pl. új weboldalas foglalás)">
        <Field label="Email cím">
          <Input
            type="email"
            value={get("notification_email")}
            onChange={(e) => set("notification_email", e.target.value)}
            placeholder="admin@example.com"
            className="h-9"
          />
        </Field>
      </Section>

      <div className="flex justify-end">
        <SaveButton saving={saving} onClick={async () => { setSaving(true); await saveKeys(NOTIF_KEYS); setSaving(false); }} />
      </div>
    </div>
  );
}

function NotifRow({
  label, description, enabled, onToggle, children,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start gap-3">
        <Switch checked={enabled} onCheckedChange={onToggle} className="mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium", enabled ? "text-zinc-900" : "text-zinc-500")}>{label}</p>
          <p className="text-xs text-zinc-400 mt-0.5">{description}</p>
          {children && <div className="mt-2">{children}</div>}
        </div>
      </div>
    </div>
  );
}

function DaysInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={1}
        max={365}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-20 text-sm"
      />
      <span className="text-xs text-zinc-500">{label}</span>
    </div>
  );
}

// ─── TAB 4: Kedvezmény szintek ────────────────────────────────────────────────

function DiscountsTab({
  get, set, saveKeys,
}: {
  get: (k: string, d?: string) => string;
  set: (k: string, v: string) => void;
  saveKeys: (keys: string[]) => Promise<boolean>;
}) {
  const [saving, setSaving] = useState(false);
  const [levels, setLevels] = useState<DiscountLevel[]>(() => {
    try {
      return JSON.parse(get("discount_levels", "[]")) as DiscountLevel[];
    } catch {
      return DEFAULT_DISCOUNT_LEVELS;
    }
  });

  function updateLevel(index: number, field: keyof DiscountLevel, value: string | number) {
    setLevels((prev) => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  }

  async function handleSave() {
    setSaving(true);
    const json = JSON.stringify(levels);
    set("discount_levels", json);
    // Direct upsert since set() only updates local state
    const { error } = await (createClient()).from("settings").upsert(
      { key: "discount_levels", value: json },
      { onConflict: "key" }
    );
    setSaving(false);
    if (error) { toast.error("Mentési hiba: " + error.message); }
    else { toast.success("Kedvezmény szintek elmentve"); }
  }

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>A változtatás az összes ügyfél kedvezményét érinti. Az ügyfelek kedvezmény szintje (<code className="font-mono text-xs">discount_level</code>) manuálisan kerül beállításra a profiljukban.</span>
      </div>

      <div className="rounded-md border border-zinc-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 border-b border-zinc-200">
            <tr>
              <th className="px-4 py-3 text-left w-8">#</th>
              <th className="px-4 py-3 text-left">Megnevezés</th>
              <th className="px-4 py-3 text-left">Min. utak száma</th>
              <th className="px-4 py-3 text-left">Kedvezmény (%)</th>
              <th className="px-4 py-3 text-left">Badge</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {levels.map((lvl, i) => (
              <tr key={lvl.level} className="hover:bg-zinc-50/50">
                <td className="px-4 py-3 text-zinc-400">{lvl.level}</td>
                <td className="px-4 py-3">
                  <Input
                    value={lvl.name}
                    onChange={(e) => updateLevel(i, "name", e.target.value)}
                    className="h-8 w-28 text-sm"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      value={lvl.minTrips}
                      onChange={(e) => updateLevel(i, "minTrips", Number(e.target.value))}
                      className="h-8 w-20 text-sm"
                      disabled={i === 0}
                    />
                    <span className="text-xs text-zinc-400">utazástól</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={lvl.pct}
                      onChange={(e) => updateLevel(i, "pct", Number(e.target.value))}
                      className="h-8 w-20 text-sm"
                      disabled={i === 0}
                    />
                    <span className="text-xs text-zinc-400">%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={DISCOUNT_BADGE_VARIANTS[lvl.level] ?? "muted"} className="font-mono text-xs">
                    {lvl.pct > 0 ? `−${lvl.pct}%` : "0%"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 h-9">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saving ? "Mentés…" : "Kedvezmény szintek mentése"}
        </Button>
      </div>
    </div>
  );
}

// ─── TAB 5: Biztonság ─────────────────────────────────────────────────────────

function SecurityTab({
  userEmail, lastSignIn, supabase, router,
}: {
  userEmail: string;
  lastSignIn: string | null;
  supabase: ReturnType<typeof createClient>;
  router: ReturnType<typeof useRouter>;
}) {
  const [currentPw, setCurrentPw]   = useState("");
  const [newPw, setNewPw]           = useState("");
  const [confirmPw, setConfirmPw]   = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]       = useState(false);
  const [pwSaving, setPwSaving]     = useState(false);
  const [pwError, setPwError]       = useState<string | null>(null);
  const [signOutBusy, setSignOutBusy] = useState(false);

  const strength   = getPasswordStrength(newPw);
  const pwsMatch   = newPw === confirmPw;
  const pwLongEnough = newPw.length >= 12;

  async function handlePasswordChange() {
    setPwError(null);
    if (!currentPw || !newPw || !confirmPw) { setPwError("Minden mező kitöltése kötelező."); return; }
    if (!pwLongEnough) { setPwError("Az új jelszónak legalább 12 karakternek kell lennie."); return; }
    if (!pwsMatch) { setPwError("Az új jelszavak nem egyeznek meg."); return; }
    if (currentPw === newPw) { setPwError("Az új jelszónak el kell térnie a jelenlegi jelszótól."); return; }

    setPwSaving(true);

    // Verify current password by attempting re-authentication
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email:    userEmail,
      password: currentPw,
    });

    if (verifyErr) {
      setPwError("Helytelen jelenlegi jelszó.");
      setPwSaving(false);
      return;
    }

    // Update to new password
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPw });

    if (updateErr) {
      setPwError("Jelszó módosítási hiba: " + updateErr.message);
      setPwSaving(false);
      return;
    }

    toast.success("Jelszó sikeresen módosítva.");
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setPwSaving(false);
  }

  async function handleSignOutAll() {
    setSignOutBusy(true);
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) {
      toast.error("Hiba a kijelentkezés során.");
      setSignOutBusy(false);
      return;
    }
    router.push("/login");
  }

  const lastSignInFormatted = lastSignIn
    ? new Date(lastSignIn).toLocaleString("hu-HU", {
        year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "Ismeretlen";

  const browserInfo = typeof navigator !== "undefined"
    ? navigator.userAgent.match(/\(([^)]+)\)/)?.[1] ?? "Ismeretlen eszköz"
    : "Ismeretlen eszköz";

  return (
    <div className="max-w-lg space-y-8">
      {/* Session info */}
      <Section title="Aktív session">
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Email cím</span>
            <span className="font-medium text-zinc-900">{userEmail || "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-500">Utolsó bejelentkezés</span>
            <span className="font-medium text-zinc-900">{lastSignInFormatted}</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <span className="text-zinc-500 flex-shrink-0">Eszköz</span>
            <span className="text-zinc-600 text-xs text-right truncate max-w-xs">{browserInfo}</span>
          </div>
        </div>
      </Section>

      <Separator />

      {/* Password change */}
      <Section title="Jelszó módosítása" description="Legalább 12 karakter, ajánlott: nagy- és kisbetű, szám, speciális karakter.">
        <Field label="Jelenlegi jelszó">
          <div className="relative">
            <Input
              type={showCurrent ? "text" : "password"}
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
              className="h-9 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowCurrent((v) => !v)}
              tabIndex={-1}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
            >
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <Field label="Új jelszó">
          <div className="relative">
            <Input
              type={showNew ? "text" : "password"}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
              className="h-9 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              tabIndex={-1}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {/* Strength indicator */}
          {newPw && (
            <div className="mt-2 space-y-1.5">
              <div className="flex gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition-colors",
                      i < strength.score ? strength.color : "bg-zinc-200"
                    )}
                  />
                ))}
              </div>
              <p className={cn(
                "text-xs font-medium",
                strength.score <= 2 ? "text-red-600"
                  : strength.score === 3 ? "text-amber-600"
                  : "text-green-600"
              )}>
                {strength.label}
              </p>
              <ul className="text-xs text-zinc-400 space-y-0.5">
                <Criterion met={newPw.length >= 12}   label="Legalább 12 karakter" />
                <Criterion met={/[A-Z]/.test(newPw)}  label="Nagybetű" />
                <Criterion met={/[a-z]/.test(newPw)}  label="Kisbetű" />
                <Criterion met={/[0-9]/.test(newPw)}  label="Szám" />
                <Criterion met={/[^A-Za-z0-9]/.test(newPw)} label="Speciális karakter (!@#$%…)" />
              </ul>
            </div>
          )}
        </Field>

        <Field label="Új jelszó megerősítése">
          <Input
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            autoComplete="new-password"
            className={cn("h-9", confirmPw && (pwsMatch ? "border-green-400 focus-visible:ring-green-500" : "border-red-400 focus-visible:ring-red-500"))}
          />
          {confirmPw && !pwsMatch && (
            <p className="text-xs text-red-500 mt-1">A jelszavak nem egyeznek meg.</p>
          )}
        </Field>

        {pwError && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {pwError}
          </div>
        )}

        <Button
          onClick={handlePasswordChange}
          disabled={pwSaving || !currentPw || !newPw || !confirmPw || !pwsMatch || !pwLongEnough}
          className="bg-blue-600 hover:bg-blue-700 h-9"
        >
          {pwSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Jelszó módosítása
        </Button>
      </Section>

      <Separator />

      {/* Danger zone */}
      <Section title="Veszélyzóna">
        <div className="rounded-md border border-red-200 p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-zinc-900">Összes session kijelentkeztetése</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Kijelentkeztet minden eszközről — hasznos, ha egy eszközt elvesztettél.
              Ez az oldal is kijelentkezik.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOutAll}
            disabled={signOutBusy}
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 h-8"
          >
            {signOutBusy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Összes session kijelentkeztetése
          </Button>
        </div>
      </Section>
    </div>
  );
}

// ─── Helper sub-components ────────────────────────────────────────────────────

function Section({
  title, description, children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Criterion({ met, label }: { met: boolean; label: string }) {
  return (
    <li className={cn("flex items-center gap-1.5", met ? "text-green-600" : "text-zinc-400")}>
      <CheckCircle className={cn("h-3 w-3 flex-shrink-0", met ? "opacity-100" : "opacity-30")} />
      {label}
    </li>
  );
}

// ─── TAB 6: Kategóriák & Típusok ─────────────────────────────────────────────

interface LookupOption {
  id: string;
  category: string;
  value: string;
  label: string;
  color: string;
  sort_order: number;
  is_system: boolean;
}

const CATEGORY_META: { key: string; label: string; description: string }[] = [
  { key: "trip_status",         label: "Utazás státuszok",     description: "Az utazások állapota (tervezett, hirdetve stb.)" },
  { key: "booking_status",      label: "Foglalás státuszok",   description: "A foglalások állapota (érdeklődő, lefoglalt stb.)" },
  { key: "client_source",       label: "Ügyfél forrása",       description: "Honnan érkezett az ügyfél (Messenger, Weboldal stb.)" },
  { key: "cost_category",       label: "Kiadás kategóriák",    description: "Utazásonkénti kiadások besorolása" },
  { key: "invoice_status",      label: "Számla státuszok",     description: "Számlák állapota (vázlat, elküldve, fizetve stb.)" },
  { key: "payment_type",        label: "Fizetés típusok",      description: "Előleg, teljes összeg, részlet vagy visszatérítés" },
  { key: "email_template_type", label: "Email sablon típusok", description: "Email sablonok kategóriái" },
];

const PRESET_COLORS = [
  { label: "Szürke",   value: "bg-zinc-100 text-zinc-600" },
  { label: "Kék",     value: "bg-blue-100 text-blue-700" },
  { label: "Égkék",   value: "bg-sky-100 text-sky-700" },
  { label: "Lila",    value: "bg-violet-100 text-violet-700" },
  { label: "Bíbor",   value: "bg-purple-100 text-purple-700" },
  { label: "Zöld",    value: "bg-green-100 text-green-700" },
  { label: "Citrom",  value: "bg-yellow-100 text-yellow-700" },
  { label: "Narancs", value: "bg-orange-100 text-orange-700" },
  { label: "Rózsaszín",value: "bg-pink-100 text-pink-700" },
  { label: "Piros",   value: "bg-red-100 text-red-600" },
  { label: "Palaszürke", value: "bg-slate-100 text-slate-600" },
];

function ColorDot({ color }: { color: string }) {
  const bg = color.split(" ")[0] ?? "bg-zinc-100";
  return <span className={cn("inline-block h-3 w-3 rounded-full border border-white shadow-sm", bg)} />;
}

function CategoriesTab() {
  const [options, setOptions]     = useState<LookupOption[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editId, setEditId]       = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState("");
  const [saving, setSaving]       = useState(false);

  // Per-category add-row state: { [category]: { value, label, color, open } }
  const [addState, setAddState]   = useState<Record<string, { value: string; label: string; color: string; open: boolean }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/lookup-options");
    if (res.ok) {
      const data = (await res.json()) as LookupOption[];
      setOptions(data);
    } else {
      toast.error("Nem sikerült betölteni a kategóriákat.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  function startEdit(opt: LookupOption) {
    setEditId(opt.id);
    setEditLabel(opt.label);
    setEditColor(opt.color);
  }

  function cancelEdit() {
    setEditId(null);
    setEditLabel("");
    setEditColor("");
  }

  async function saveEdit(id: string) {
    if (!editLabel.trim()) { toast.error("A megnevezés nem lehet üres."); return; }
    setSaving(true);
    const res = await fetch(`/api/lookup-options/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: editLabel.trim(), color: editColor }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      toast.error(err.error ?? "Mentési hiba.");
      return;
    }
    const updated = (await res.json()) as LookupOption;
    setOptions((prev) => prev.map((o) => (o.id === id ? updated : o)));
    cancelEdit();
    toast.success("Mentve.");
  }

  async function deleteOption(id: string) {
    const res = await fetch(`/api/lookup-options/${id}`, { method: "DELETE" });
    if (res.status === 403) { toast.error("Rendszer-értéket nem lehet törölni."); return; }
    if (!res.ok) { toast.error("Törlési hiba."); return; }
    setOptions((prev) => prev.filter((o) => o.id !== id));
    toast.success("Törölve.");
  }

  function getAddState(cat: string) {
    return addState[cat] ?? { value: "", label: "", color: "bg-zinc-100 text-zinc-600", open: false };
  }

  function patchAdd(cat: string, patch: Partial<{ value: string; label: string; color: string; open: boolean }>) {
    setAddState((prev) => ({ ...prev, [cat]: { ...getAddState(cat), ...patch } }));
  }

  async function submitAdd(cat: string) {
    const s = getAddState(cat);
    if (!s.value.trim() || !s.label.trim()) { toast.error("A kód és megnevezés kötelező."); return; }
    if (!/^[a-z0-9_]+$/.test(s.value.trim())) {
      toast.error("A kód csak kisbetűket, számokat és aláhúzást tartalmazhat.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/lookup-options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: cat, value: s.value.trim(), label: s.label.trim(), color: s.color }),
    });
    setSaving(false);
    if (!res.ok) {
      const err = (await res.json()) as { error?: string };
      toast.error(err.error ?? "Hiba.");
      return;
    }
    const created = (await res.json()) as LookupOption;
    setOptions((prev) => [...prev, created]);
    patchAdd(cat, { value: "", label: "", color: "bg-zinc-100 text-zinc-600", open: false });
    toast.success("Hozzáadva.");
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-zinc-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Betöltés…
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <p className="text-sm text-zinc-500">
        Szerkeszd a kategóriák megnevezését és jelölőszínét, vagy hozz létre saját értékeket.
        A rendszer által használt értékeket (rendszer-sor) <strong>nem lehet törölni</strong>,
        de a megnevezésük és színük szabadon módosítható.
      </p>

      {CATEGORY_META.map(({ key, label: catLabel, description }) => {
        const rows = options.filter((o) => o.category === key);
        const add  = getAddState(key);
        return (
          <div key={key} className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
            {/* Category header */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 border-b border-zinc-200">
              <div>
                <p className="text-sm font-semibold text-zinc-900">{catLabel}</p>
                <p className="text-xs text-zinc-500">{description}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => patchAdd(key, { open: !add.open })}
              >
                <Plus className="h-3 w-3" />
                Új
              </Button>
            </div>

            {/* Option rows */}
            <div className="divide-y divide-zinc-100">
              {rows.length === 0 && (
                <p className="px-4 py-3 text-xs text-zinc-400">Nincsenek értékek.</p>
              )}
              {rows.map((opt) => (
                <div key={opt.id} className="flex items-center gap-3 px-4 py-2.5">
                  {editId === opt.id ? (
                    // ── Edit mode ───────────────────────────────────────────
                    <>
                      <ColorDot color={editColor} />
                      <Input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="h-7 text-sm flex-1"
                        placeholder="Megnevezés"
                        onKeyDown={(e) => { if (e.key === "Enter") void saveEdit(opt.id); if (e.key === "Escape") cancelEdit(); }}
                        autoFocus
                      />
                      <Select value={editColor} onValueChange={setEditColor}>
                        <SelectTrigger className="h-7 w-36 text-xs">
                          <SelectValue placeholder="Szín" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRESET_COLORS.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              <span className="flex items-center gap-1.5">
                                <ColorDot color={c.value} />
                                {c.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" disabled={saving} onClick={() => void saveEdit(opt.id)}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-zinc-400" onClick={cancelEdit}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    // ── View mode ───────────────────────────────────────────
                    <>
                      <ColorDot color={opt.color} />
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", opt.color)}>
                        {opt.label}
                      </span>
                      <span className="text-xs text-zinc-400 font-mono">{opt.value}</span>
                      {opt.is_system && (
                        <span className="ml-auto text-[10px] text-zinc-400 border border-zinc-200 rounded px-1.5 py-0.5">rendszer</span>
                      )}
                      <div className={cn("flex gap-1", opt.is_system ? "" : "ml-auto")}>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(opt)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {!opt.is_system && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => void deleteOption(opt.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add new row (inline form) */}
            {add.open && (
              <div className="flex items-center gap-2 px-4 py-3 border-t border-dashed border-zinc-200 bg-zinc-50">
                <Plus className="h-3.5 w-3.5 text-zinc-400 flex-shrink-0" />
                <Input
                  placeholder="kód (pl. hotel)"
                  value={add.value}
                  onChange={(e) => patchAdd(key, { value: e.target.value })}
                  className="h-7 text-sm w-32 font-mono"
                />
                <Input
                  placeholder="Megnevezés"
                  value={add.label}
                  onChange={(e) => patchAdd(key, { label: e.target.value })}
                  className="h-7 text-sm flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter") void submitAdd(key); }}
                />
                <Select value={add.color} onValueChange={(v) => patchAdd(key, { color: v })}>
                  <SelectTrigger className="h-7 w-36 text-xs">
                    <SelectValue placeholder="Szín" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESET_COLORS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        <span className="flex items-center gap-1.5">
                          <ColorDot color={c.value} />
                          {c.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700" disabled={saving} onClick={() => void submitAdd(key)}>
                  Hozzáad
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => patchAdd(key, { open: false })}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
