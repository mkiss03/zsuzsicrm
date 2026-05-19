"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  ShieldCheck,
  FileText,
  PenLine,
  Keyboard,
  RotateCcw,
  Camera,
  HeartPulse,
  MapPin,
  Calendar,
  Hash,
} from "lucide-react";

interface ContractData {
  id: string;
  token: string;
  document_type: string;
  document_title: string;
  document_body: string;
  status: "pending" | "signed" | "expired" | "cancelled";
  signed_name: string | null;
  signed_at: string | null;
  signature_data: string | null;
  expires_at: string;
  booking: {
    booking_code: string;
    client: { first_name: string; last_name: string };
    trip: { name: string; departure_date: string; return_date: string };
  };
}

interface Props {
  contract: ContractData;
  expired: boolean;
  token: string;
}

type SignMode = "typed" | "drawn";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("hu-HU", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("hu-HU", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const DOC_TYPE_ICON: Record<string, React.ReactNode> = {
  travel_contract:    <FileText   className="h-5 w-5" />,
  health_declaration: <HeartPulse className="h-5 w-5" />,
  photo_consent:      <Camera     className="h-5 w-5" />,
};

// ─── Document renderer ──────────────────────────────────────────────────────

function renderDocumentBody(text: string): React.ReactNode {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let para: string[] = [];
  let key = 0;

  const flushPara = () => {
    if (!para.length) return;
    const joined = para.join(" ").trim();
    if (joined) {
      nodes.push(
        <p key={key++} className="text-sm text-zinc-700 leading-relaxed">
          {joined}
        </p>,
      );
    }
    para = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Section divider ━━━
    if (/^━{3,}/.test(line)) {
      flushPara();
      nodes.push(<hr key={key++} className="border-zinc-100 my-3" />);
      continue;
    }

    // All-caps heading (3+ uppercase chars, no lowercase letters)
    if (
      line.length >= 3 &&
      /^[A-ZÁÉÍÓÖŐÚÜŰ0-9\s\-–/()]+$/.test(line) &&
      /[A-ZÁÉÍÓÖŐÚÜŰ]{3}/.test(line)
    ) {
      flushPara();
      nodes.push(
        <h2 key={key++} className="text-sm font-bold text-zinc-900 uppercase tracking-wide mt-4 mb-1 first:mt-0">
          {line}
        </h2>,
      );
      continue;
    }

    // Numbered section header: "1. TITLE" or "2. Title"
    if (/^\d+\.\s+\S/.test(line)) {
      flushPara();
      nodes.push(
        <h3 key={key++} className="text-sm font-semibold text-zinc-800 mt-4 mb-1">
          {line}
        </h3>,
      );
      continue;
    }

    // Key: Value info lines
    if (/^[A-Za-záéíóöőúüűÁÉÍÓÖŐÚÜŰ ]+:\s+\S/.test(line) && !line.startsWith("•")) {
      flushPara();
      const colonIdx = line.indexOf(":");
      const label = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim();
      nodes.push(
        <div key={key++} className="flex gap-1.5 text-sm leading-snug">
          <span className="text-zinc-400 shrink-0 w-36 text-right">{label}:</span>
          <span className="text-zinc-700 font-medium">{value}</span>
        </div>,
      );
      continue;
    }

    // Bullet item
    if (line.startsWith("•")) {
      flushPara();
      nodes.push(
        <li key={key++} className="text-sm text-zinc-700 leading-relaxed ml-1 flex gap-2">
          <span className="text-zinc-400 mt-0.5">•</span>
          <span>{line.slice(1).trim()}</span>
        </li>,
      );
      continue;
    }

    // Empty line → paragraph break
    if (!line.trim()) {
      flushPara();
      continue;
    }

    para.push(line);
  }
  flushPara();

  return <div className="space-y-1.5">{nodes}</div>;
}

// ─── Canvas Signature Pad ───────────────────────────────────────────────────

interface CanvasPadProps {
  onSave: (dataUrl: string) => void;
  onClear: () => void;
  isEmpty: boolean;
  setIsEmpty: (v: boolean) => void;
}

function CanvasPad({ onSave, onClear, isEmpty, setIsEmpty }: CanvasPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPt    = useRef<[number, number] | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep canvas resolution matching its CSS size (HiDPI / resize)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr  = window.devicePixelRatio || 1;
      canvas.width  = rect.width  * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  function getCtx() {
    return canvasRef.current?.getContext("2d") ?? null;
  }

  function getCoords(canvas: HTMLCanvasElement, clientX: number, clientY: number): [number, number] {
    const rect = canvas.getBoundingClientRect();
    return [clientX - rect.left, clientY - rect.top];
  }

  function startPath(x: number, y: number) {
    const ctx = getCtx();
    if (!ctx) return;
    isDrawing.current = true;
    lastPt.current = [x, y];
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.strokeStyle = "#111827";
    ctx.lineWidth   = 2.2;
  }

  function continuePath(x: number, y: number) {
    if (!isDrawing.current) return;
    const ctx = getCtx();
    if (!ctx || !lastPt.current) return;
    const [lx, ly] = lastPt.current;
    const mx = (lx + x) / 2;
    const my = (ly + y) / 2;
    ctx.quadraticCurveTo(lx, ly, mx, my);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx, my);
    lastPt.current = [x, y];
    if (isEmpty) setIsEmpty(false);
  }

  function endPath() {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    lastPt.current = null;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (canvasRef.current) onSave(canvasRef.current.toDataURL("image/png"));
    }, 300);
  }

  function handleClear() {
    const canvas = canvasRef.current;
    const ctx    = getCtx();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onClear();
  }

  const onMouseDown  = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const [x, y] = getCoords(canvasRef.current!, e.clientX, e.clientY);
    startPath(x, y);
  };
  const onMouseMove  = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const [x, y] = getCoords(canvasRef.current!, e.clientX, e.clientY);
    continuePath(x, y);
  };
  const onMouseUp    = () => endPath();
  const onMouseLeave = () => endPath();

  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    const [x, y] = getCoords(canvasRef.current!, touch.clientX, touch.clientY);
    startPath(x, y);
  };
  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const touch = e.touches[0];
    if (!touch) return;
    const [x, y] = getCoords(canvasRef.current!, touch.clientX, touch.clientY);
    continuePath(x, y);
  };
  const onTouchEnd = () => endPath();

  return (
    <div className="space-y-2">
      <div
        className="relative rounded-xl border-2 border-dashed border-zinc-200 bg-white overflow-hidden"
        style={{ height: 160 }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair touch-none select-none"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        />
        {/* Baseline guide */}
        <div className="pointer-events-none absolute bottom-10 left-6 right-6 border-b border-zinc-100" />
        {/* Placeholder */}
        {isEmpty && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 select-none">
            <PenLine className="h-8 w-8 text-zinc-200" />
            <p className="text-xs text-zinc-300 font-medium">Írjon alá ezen a területen</p>
            <p className="text-[10px] text-zinc-200">egérrel · ujjal · érintőtollal</p>
          </div>
        )}
      </div>
      {!isEmpty && (
        <button
          type="button"
          onClick={handleClear}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          Újra rajzolom
        </button>
      )}
    </div>
  );
}

// ─── Typed Signature ────────────────────────────────────────────────────────

function TypedSignature({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-3">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Írja be teljes nevét…"
        autoComplete="name"
        className="w-full rounded-lg border-2 border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900
                   placeholder:text-zinc-300 focus:border-blue-400 focus:outline-none focus:ring-0
                   transition-colors"
      />
      <div className="flex items-center justify-center min-h-[80px] rounded-xl border border-zinc-100 bg-zinc-50 px-6 py-4">
        {value ? (
          <span
            className="text-3xl text-zinc-800 select-none"
            style={{ fontFamily: 'Georgia, "Times New Roman", "Palatino Linotype", serif', fontStyle: "italic" }}
          >
            {value}
          </span>
        ) : (
          <span className="text-sm text-zinc-300">Az aláírás előnézete itt jelenik meg</span>
        )}
      </div>
    </div>
  );
}

// ─── Shared info row ────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="text-zinc-300 shrink-0">{icon}</span>
      <span className="text-xs text-zinc-400 w-32 shrink-0">{label}</span>
      <span className="text-sm text-zinc-800 font-medium truncate">{value}</span>
    </div>
  );
}

// ─── Already Signed ─────────────────────────────────────────────────────────

export function AlreadySigned({ contract }: { contract: ContractData }) {
  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <header className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-zinc-700">
          <FileText className="h-5 w-5 text-blue-600" />
          <span className="font-semibold text-sm">UtazóFotós</span>
        </div>
        <span className="text-xs text-zinc-400">Elektronikus szerződés</span>
      </header>

      <div className="flex-1 flex items-start justify-center p-6 pt-12">
        <div className="max-w-md w-full">
          <div className="flex justify-center mb-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-50 ring-8 ring-green-50/50">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-zinc-900 text-center mb-2">Dokumentum aláírva</h1>
          <p className="text-sm text-zinc-500 text-center mb-8">
            Köszönjük! Az aláírás rögzítve, az utazási iroda értesítést kapott.
          </p>

          {/* Signature preview */}
          {(contract.signature_data || contract.signed_name) && (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 mb-5 space-y-3">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Aláírás</p>
              {contract.signature_data ? (
                <img src={contract.signature_data} alt="Aláírás" className="max-h-20 max-w-full" />
              ) : (
                <p
                  className="text-2xl text-zinc-800"
                  style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: "italic" }}
                >
                  {contract.signed_name}
                </p>
              )}
            </div>
          )}

          <div className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">
            <InfoRow icon={<FileText className="h-3.5 w-3.5" />} label="Dokumentum"        value={contract.document_title} />
            <InfoRow icon={<PenLine  className="h-3.5 w-3.5" />} label="Aláíró neve"       value={contract.signed_name ?? "—"} />
            <InfoRow icon={<Clock    className="h-3.5 w-3.5" />} label="Aláírás időpontja" value={contract.signed_at ? fmtDateTime(contract.signed_at) : "—"} />
            <InfoRow icon={<MapPin   className="h-3.5 w-3.5" />} label="Utazás"            value={contract.booking?.trip?.name ?? "—"} />
            <InfoRow icon={<Hash     className="h-3.5 w-3.5" />} label="Foglalási szám"    value={contract.booking?.booking_code ?? "—"} />
          </div>

          <p className="text-center text-xs text-zinc-400 mt-8">
            Kérdése van?{" "}
            <a href="mailto:info@utazofotos.com" className="underline hover:text-zinc-600 transition-colors">
              info@utazofotos.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Expired ────────────────────────────────────────────────────────────────

export function Expired() {
  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-5">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 ring-8 ring-amber-50/50">
            <Clock className="h-8 w-8 text-amber-500" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-zinc-900">Az aláírási link lejárt</h1>
        <p className="text-sm text-zinc-500 leading-relaxed">
          Ez az aláírási link már nem érvényes. Kérjük, vegye fel a kapcsolatot
          az utazási irodával egy új link igényléséhez.
        </p>
        <a href="mailto:info@utazofotos.com"
           className="inline-block text-sm text-blue-600 hover:text-blue-700 underline transition-colors">
          info@utazofotos.com
        </a>
        <p className="text-xs text-zinc-400">UtazóFotós – Tuza-Göncz Zsuzsanna</p>
      </div>
    </div>
  );
}

// ─── Not Found ──────────────────────────────────────────────────────────────

export function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-5">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100">
            <AlertTriangle className="h-8 w-8 text-zinc-400" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-zinc-900">Link nem található</h1>
        <p className="text-sm text-zinc-500 leading-relaxed">
          Ez az aláírási link nem létezik. Kérjük, ellenőrizze az emailben
          kapott linket, vagy vegye fel a kapcsolatot az utazási irodával.
        </p>
        <p className="text-xs text-zinc-400">UtazóFotós – Tuza-Göncz Zsuzsanna</p>
      </div>
    </div>
  );
}

// ─── Main sign page ──────────────────────────────────────────────────────────

export function SignPageClient({ contract, expired, token }: Props) {
  const [signMode, setSignMode]           = useState<SignMode>("typed");
  const [typedName, setTypedName]         = useState("");
  const [drawnData, setDrawnData]         = useState<string | null>(null);
  const [canvasIsEmpty, setCanvasIsEmpty] = useState(true);
  const [drawnName, setDrawnName]         = useState("");
  const [agreed, setAgreed]               = useState(false);
  const [correct, setCorrect]             = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [done, setDone]                   = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const signedName = signMode === "typed" ? typedName : drawnName;
  const hasSignature =
    signMode === "typed"
      ? typedName.trim().length >= 2
      : !canvasIsEmpty && drawnName.trim().length >= 2;

  const allReady = agreed && correct && hasSignature;

  // ── Stable canvas callbacks (must be before any early return) ────────
  const handleDrawSave  = useCallback((url: string) => setDrawnData(url), []);
  const handleDrawClear = useCallback(() => setDrawnData(null), []);

  // ── Terminal states ──────────────────────────────────────────────────
  if (contract.status === "signed" || done) {
    return (
      <AlreadySigned
        contract={
          done
            ? { ...contract, signed_name: signedName, signed_at: new Date().toISOString(), signature_data: drawnData }
            : contract
        }
      />
    );
  }

  if (contract.status === "expired" || contract.status === "cancelled" || expired) {
    return <Expired />;
  }

  // ── Submit ───────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allReady || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        signed_name: signedName.trim(),
        agreed_all:  true,
      };
      if (signMode === "drawn" && drawnData) {
        body.signature_data = drawnData;
      }

      const res = await fetch(`/api/sign/${token}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });

      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Hiba történt. Kérjük, próbálja újra.");
      } else {
        setDone(true);
      }
    } catch {
      setError("Hálózati hiba. Kérjük, ellenőrizze az internetkapcsolatát.");
    } finally {
      setSubmitting(false);
    }
  }

  const docTypeIcon = DOC_TYPE_ICON[contract.document_type] ?? <FileText className="h-5 w-5" />;

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="text-blue-600">{docTypeIcon}</div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900 truncate leading-tight">
                {contract.document_title}
              </p>
              <p className="text-xs text-zinc-400 leading-tight">{contract.booking?.trip?.name}</p>
            </div>
          </div>
          <div className="shrink-0 text-right hidden sm:block">
            <p className="text-xs text-zinc-400">Foglalás</p>
            <p className="text-xs font-mono font-medium text-zinc-700">{contract.booking?.booking_code}</p>
          </div>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 space-y-5">

        {/* Info strip */}
        <div className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">
          {contract.booking?.trip?.name && (
            <InfoRow icon={<MapPin   className="h-3.5 w-3.5" />} label="Utazás"         value={contract.booking.trip.name} />
          )}
          {contract.booking?.trip?.departure_date && (
            <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Indulás"        value={fmtDate(contract.booking.trip.departure_date)} />
          )}
          {contract.booking?.trip?.return_date && (
            <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Visszaérkezés"  value={fmtDate(contract.booking.trip.return_date)} />
          )}
          <InfoRow icon={<Hash  className="h-3.5 w-3.5" />} label="Foglalási szám"  value={contract.booking?.booking_code ?? "—"} />
          <InfoRow icon={<Clock className="h-3.5 w-3.5" />} label="Link érvényes"   value={`${fmtDate(contract.expires_at)}-ig`} />
        </div>

        {/* Document card */}
        <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
          <div className="border-b border-zinc-100 bg-zinc-50 px-5 py-3.5 flex items-center gap-2.5">
            <div className="text-zinc-400">{docTypeIcon}</div>
            <span className="text-sm font-semibold text-zinc-700">A dokumentum szövege</span>
          </div>
          <div className="px-5 sm:px-8 py-6 max-h-[520px] overflow-y-auto">
            {renderDocumentBody(contract.document_body)}
          </div>
          <div className="border-t border-zinc-100 bg-zinc-50 px-5 py-2.5 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-zinc-300" />
            <p className="text-[11px] text-zinc-400">
              Kérjük, olvassa el figyelmesen a dokumentumot az aláírás előtt.
            </p>
          </div>
        </div>

        {/* Signature card */}
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
            <div className="border-b border-zinc-100 bg-zinc-50 px-5 py-3.5 flex items-center gap-2.5">
              <PenLine className="h-4 w-4 text-zinc-400" />
              <span className="text-sm font-semibold text-zinc-700">Elektronikus aláírás</span>
            </div>

            <div className="p-5 space-y-5">

              {/* Checkboxes */}
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer group select-none">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 shrink-0 cursor-pointer"
                  />
                  <span className="text-sm text-zinc-600 leading-snug group-hover:text-zinc-900 transition-colors">
                    Elolvastam a fenti dokumentumot, és elfogadom a benne foglalt feltételeket.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer group select-none">
                  <input
                    type="checkbox"
                    checked={correct}
                    onChange={(e) => setCorrect(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 shrink-0 cursor-pointer"
                  />
                  <span className="text-sm text-zinc-600 leading-snug group-hover:text-zinc-900 transition-colors">
                    Megerősítem, hogy az általam megadott személyes adatok helyesek és érvényesek.
                  </span>
                </label>
              </div>

              {/* Mode tabs */}
              <div>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">
                  Aláírás módja
                </p>
                <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 overflow-hidden text-sm font-medium mb-4">
                  <button
                    type="button"
                    onClick={() => setSignMode("typed")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 transition-colors ${
                      signMode === "typed"
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-600"
                    }`}
                  >
                    <Keyboard className="h-4 w-4" />
                    Gépelt aláírás
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignMode("drawn")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 transition-colors ${
                      signMode === "drawn"
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-400 hover:text-zinc-600"
                    }`}
                  >
                    <PenLine className="h-4 w-4" />
                    Kézzel rajzolt
                  </button>
                </div>

                {signMode === "typed" && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-zinc-400">
                      Írja be teljes nevét — ez jelenik meg aláírásként a dokumentumon.
                    </p>
                    <TypedSignature value={typedName} onChange={setTypedName} />
                  </div>
                )}

                {signMode === "drawn" && (
                  <div className="space-y-4">
                    <p className="text-xs text-zinc-400">
                      Rajzolja fel aláírását egérrel, ujjal vagy érintőtollal.
                    </p>
                    <CanvasPad
                      onSave={handleDrawSave}
                      onClear={handleDrawClear}
                      isEmpty={canvasIsEmpty}
                      setIsEmpty={setCanvasIsEmpty}
                    />
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-zinc-500">
                        Teljes neve (a dokumentumon)
                      </label>
                      <input
                        type="text"
                        value={drawnName}
                        onChange={(e) => setDrawnName(e.target.value)}
                        placeholder="pl. Kiss Péter"
                        autoComplete="name"
                        className="w-full rounded-lg border-2 border-zinc-200 bg-white px-3.5 py-2.5 text-sm
                                   text-zinc-900 placeholder:text-zinc-300 focus:border-blue-400
                                   focus:outline-none focus:ring-0 transition-colors"
                      />
                      <p className="text-[11px] text-zinc-400">
                        A neve jogilag azonosítja az aláírót az audit-trail számára.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3.5 py-3">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={!allReady || submitting}
                className="w-full flex items-center justify-center gap-2.5 rounded-lg bg-blue-600 px-4 py-3.5
                           text-sm font-semibold text-white shadow-sm transition-colors
                           hover:bg-blue-700 active:bg-blue-800
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Aláírás küldése…</>
                ) : (
                  <><ShieldCheck className="h-4 w-4" /> Dokumentum aláírása</>
                )}
              </button>

              {!allReady && !submitting && (
                <p className="text-center text-xs text-zinc-400">
                  {!agreed || !correct
                    ? "A folytatáshoz fogadja el a feltételeket."
                    : "A folytatáshoz adja meg az aláírást."}
                </p>
              )}
            </div>
          </div>
        </form>

        {/* Legal footer */}
        <p className="text-center text-xs text-zinc-400 pb-6 leading-relaxed">
          Ez az oldal az UtazóFotós foglalási rendszerének része.
          Az elektronikus aláírás az EU 910/2014/EU (eIDAS) rendelet szerinti
          egyszerű elektronikus aláírásnak minősül.
        </p>
      </main>
    </div>
  );
}


