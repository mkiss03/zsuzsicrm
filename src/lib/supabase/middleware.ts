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

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
