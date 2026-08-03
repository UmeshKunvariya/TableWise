import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

/**
 * Request-scoped client carrying the signed-in user's session.
 *
 * Only getAll/setAll are implemented — the get/set/remove trio is deprecated in
 * @supabase/ssr and mis-handles chunked auth cookies.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies. Safe to swallow: proxy.ts
          // refreshes the session on every request, so the write is not lost.
        }
      },
    },
  });
}
