import "server-only";

import { createClient } from "@supabase/supabase-js";

import { supabaseUrl } from "@/lib/env";

/**
 * Service-role client. Bypasses every RLS policy in the database.
 *
 * The `server-only` import above turns any client-component import of this file
 * into a build error rather than a leaked key. Reach for this exclusively where
 * privileged work is unavoidable — geofence enforcement and ticket allocation,
 * both of which must not be callable from a browser.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. This must be set server-side only.",
    );
  }

  return createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
