"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Eye, EyeOff, Loader2, Lock } from "lucide-react";

// ─── Brute-force protection (localStorage) ────────────────────────────────────

const LOCKOUT_KEY       = "crm_login_attempts";
const MAX_ATTEMPTS      = 5;
const COOLDOWN_MS       = 15 * 60 * 1000; // 15 minutes

interface AttemptState {
  count: number;
  cooldownUntil: number | null; // epoch ms
}

function readAttemptState(): AttemptState {
  try {
    const raw = localStorage.getItem(LOCKOUT_KEY);
    if (!raw) return { count: 0, cooldownUntil: null };
    const parsed = JSON.parse(raw) as AttemptState;
    // Auto-expire cooldown
    if (parsed.cooldownUntil && parsed.cooldownUntil < Date.now()) {
      return { count: 0, cooldownUntil: null };
    }
    return parsed;
  } catch {
    return { count: 0, cooldownUntil: null };
  }
}

function writeAttemptState(state: AttemptState) {
  try {
    localStorage.setItem(LOCKOUT_KEY, JSON.stringify(state));
  } catch { /* storage unavailable — ignore */ }
}

function clearAttemptState() {
  try { localStorage.removeItem(LOCKOUT_KEY); } catch { /* ignore */ }
}

function recordFailedAttempt(): AttemptState {
  const state = readAttemptState();
  const newCount = state.count + 1;
  const newState: AttemptState = {
    count:         newCount,
    cooldownUntil: newCount >= MAX_ATTEMPTS ? Date.now() + COOLDOWN_MS : null,
  };
  writeAttemptState(newState);
  return newState;
}

/** Format remaining seconds as mm:ss */
function fmtCountdown(ms: number): string {
  const s   = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  return <Suspense><LoginPageContent /></Suspense>;
}

function LoginPageContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const supabase     = createClient();

  const redirectTo = searchParams.get("redirect") ?? "/dashboard";
  // Sanitise: only allow same-origin paths
  const safeRedirect =
    redirectTo.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : "/dashboard";

  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Cooldown countdown
  const [cooldownMs, setCooldownMs] = useState<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialise + tick every second
  useEffect(() => {
    function tick() {
      const state = readAttemptState();
      if (state.cooldownUntil) {
        const remaining = state.cooldownUntil - Date.now();
        if (remaining > 0) {
          setCooldownMs(remaining);
        } else {
          setCooldownMs(0);
          writeAttemptState({ count: 0, cooldownUntil: null });
        }
      } else {
        setCooldownMs(0);
      }
    }

    tick(); // run immediately on mount
    tickRef.current = setInterval(tick, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const isLockedOut = cooldownMs > 0;

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (!email || !password || loading || isLockedOut) return;

    // Pre-check: already locked out?
    const stateBeforeAttempt = readAttemptState();
    if (stateBeforeAttempt.cooldownUntil && stateBeforeAttempt.cooldownUntil > Date.now()) {
      setCooldownMs(stateBeforeAttempt.cooldownUntil - Date.now());
      return;
    }

    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email:    email.trim().toLowerCase(),
      password,
    });

    if (authError) {
      const newState = recordFailedAttempt();
      const remaining = newState.count;

      let msg: string;
      if (newState.cooldownUntil) {
        msg = `Túl sok sikertelen próbálkozás. Próbáld újra ${fmtCountdown(COOLDOWN_MS)} múlva.`;
        setCooldownMs(COOLDOWN_MS);
      } else if (authError.message.includes("Invalid login credentials")) {
        const attemptsLeft = MAX_ATTEMPTS - remaining;
        msg = attemptsLeft > 0
          ? `Hibás email cím vagy jelszó. (${attemptsLeft} próbálkozás maradt)`
          : "Hibás email cím vagy jelszó.";
      } else if (authError.message.includes("Email not confirmed")) {
        msg = "Az email cím nincs megerősítve. Ellenőrizd a postaládádat.";
      } else if (authError.message.includes("Too many requests")) {
        msg = "Túl sok próbálkozás. Kérjük, várj egy percet.";
      } else {
        msg = "Bejelentkezési hiba. Kérjük, próbáld újra.";
      }

      setError(msg);
      setLoading(false);
      return;
    }

    // Success: clear lockout state and redirect
    clearAttemptState();
    router.push(safeRedirect);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white p-4">
      <div className="w-full max-w-sm">
        {/* Heading */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-semibold text-zinc-900">UtazóFotós</h1>
            <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white tracking-wide">
              CRM
            </span>
          </div>
          <p className="text-sm text-zinc-500">
            Bejelentkezés az adminisztrátori felületre
          </p>
        </div>

        {/* Cooldown banner */}
        {isLockedOut && (
          <div className="mb-5 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
            <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-900">Fiók ideiglenesen zárolva</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Túl sok sikertelen próbálkozás. Próbáld újra{" "}
                <span className="font-mono font-semibold">{fmtCountdown(cooldownMs)}</span> múlva.
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium text-zinc-700">
              Email cím
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus={!isLockedOut}
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading || isLockedOut}
              className="h-10 border-zinc-200 focus-visible:ring-blue-600"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium text-zinc-700">
              Jelszó
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || isLockedOut}
                className="h-10 border-zinc-200 pr-10 focus-visible:ring-blue-600"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                disabled={loading || isLockedOut}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors disabled:pointer-events-none"
                aria-label={showPw ? "Jelszó elrejtése" : "Jelszó megjelenítése"}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && !isLockedOut && (
            <Alert variant="destructive" className="py-2.5">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">{error}</AlertDescription>
            </Alert>
          )}

          {/* Submit */}
          <Button
            type="submit"
            disabled={loading || isLockedOut || !email || !password}
            className="h-10 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Bejelentkezés…
              </>
            ) : isLockedOut ? (
              <>
                <Lock className="mr-2 h-4 w-4" />
                {fmtCountdown(cooldownMs)}
              </>
            ) : (
              "Bejelentkezés"
            )}
          </Button>
        </form>

        <p className="mt-8 text-center text-xs text-zinc-400">
          Csak jogosult felhasználók számára
        </p>
      </div>
    </main>
  );
}
