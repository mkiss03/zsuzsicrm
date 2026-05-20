import { createServerClient } from "@supabase/ssr";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session cookie on every request and returns
 * both the refreshed response and the authenticated user (or null).
 *
 * This function only refreshes the session — route protection is handled
 * in the main middleware.ts file.
 */
export async function getSessionAndRefresh(request: NextRequest): Promise<{
  response: NextResponse;
  userId: string | null;
}> {
  let response = NextResponse.next({ request });

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If env vars aren't configured (e.g. preview deploy without secrets),
  // return the user as unauthenticated rather than crashing the middleware.
  if (!supabaseUrl || !supabaseAnon) {
    return { response, userId: null };
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnon,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Partial<ResponseCookie> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() validates the JWT with Supabase servers on every call — this is
  // intentional: it detects revoked tokens and refreshes expired sessions.
  const { data: { user } } = await supabase.auth.getUser();

  return { response, userId: user?.id ?? null };
}

// Keep the old name as an alias so existing callers don't break.
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { response } = await getSessionAndRefresh(request);
  return response;
}
