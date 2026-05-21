import { type NextRequest, NextResponse } from "next/server";
import { getSessionAndRefresh } from "@/lib/supabase/middleware";

// ─── Route classification ──────────────────────────────────────────────────────

/**
 * Paths that are always public — no valid session required.
 *
 * /login            — auth page
 * /api/booking-form — public website integration (guarded by its own CORS + honeypot)
 * /api/cron/*       — protected by CRON_SECRET header inside the handler
 */
const PUBLIC_PREFIXES = [
  "/login",
  "/api/booking-form",
  "/api/cron",
  "/sign",          // public e-signature pages (clients open these without a session)
  "/api/sign",      // public sign API (GET contract info + POST signature submission)
  "/api/trips/public",  // public trip list for website booking form
  "/api/trips/sync",    // server-to-server webhook + bulk import (guarded by TRIPS_SYNC_SECRET)
];

/** Static-asset patterns excluded from the matcher below — already listed there,
 *  but kept here as a readable reference. */
// _next/static, _next/image, favicon.ico, *.png/jpg/…

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(prefix + "/") || pathname.startsWith(prefix + "?")
  );
}

function isApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

/**
 * Sanitise a redirect target so we never send the user to an external URL.
 * Only same-origin absolute paths are allowed (starts with "/" but not "//").
 */
function safePath(raw: string | null, fallback = "/dashboard"): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return fallback;
}

// ─── Middleware ─────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname, searchParams } = request.nextUrl;

  // 1. Always refresh the session cookie (Supabase requirement).
  const { response, userId } = await getSessionAndRefresh(request);

  // 2. Public paths — let them through with the refreshed cookies.
  if (isPublicPath(pathname)) {
    // If an authenticated user visits /login, send them home instead.
    if (userId && pathname.startsWith("/login")) {
      const dest = request.nextUrl.clone();
      dest.pathname = safePath(searchParams.get("redirect"));
      dest.search   = "";
      return NextResponse.redirect(dest);
    }
    return response;
  }

  // 3. Protected path — no valid session → redirect to /login.
  if (!userId) {
    if (isApiPath(pathname)) {
      // API callers get a JSON 401, not an HTML redirect.
      return NextResponse.json(
        { error: "Hitelesítés szükséges", code: "UNAUTHENTICATED" },
        { status: 401 }
      );
    }

    // Dashboard / page routes — preserve the original URL for post-login redirect.
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search   = "";
    const originalPath = pathname + (request.nextUrl.search ?? "");
    if (originalPath !== "/" && originalPath !== "/login") {
      loginUrl.searchParams.set("redirect", originalPath);
    }
    return NextResponse.redirect(loginUrl);
  }

  // 4. Authenticated — pass through with refreshed cookies.
  return response;
}

export const config = {
  matcher: [
    // Run on everything EXCEPT static assets and Next.js internals.
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot)$).*)",
  ],
};
