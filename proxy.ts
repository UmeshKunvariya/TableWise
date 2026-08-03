import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Session refresh only.
 *
 * Next 16 renamed `middleware` to `proxy` and scoped it to the network boundary:
 * routing, rewrites, headers. Authorization deliberately does NOT live here —
 * it lives in app/(owner)/layout.tsx where it can hit the database and check
 * membership and approval status. This file only keeps the auth cookie fresh so
 * those checks see a valid session.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Before .env.local is filled in there is no session to refresh. Skip rather
  // than throw: this runs on every route, so failing here would turn a missing
  // config value into a blanket 500. Any actual data path still fails loudly
  // with the explicit message from lib/env.ts.
  if (!url || !anonKey) {
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Responses that set auth cookies must never be cached by a CDN,
        // or one user's session token can be served to another.
        for (const [key, headerValue] of Object.entries(headers)) {
          response.headers.set(key, headerValue);
        }
      },
    },
  });

  // Touching getUser() is what triggers the refresh; the result is discarded
  // here on purpose, since this file makes no access decisions.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image optimization — without this,
    // auth work would run on every CSS, JS, and font request.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf)$).*)",
  ],
};
