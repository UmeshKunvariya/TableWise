import { supabaseUrl } from "@/lib/env";

/**
 * Public URL of a restaurant's menu PDF.
 *
 * The path is derived from the restaurant id rather than stored per-file, so
 * the customer page can build it from what get_public_restaurant() already
 * returns — no extra query, and nothing user-supplied in the path.
 */
export function menuPublicUrl(restaurantId: string): string {
  return `${supabaseUrl()}/storage/v1/object/public/menus/${restaurantId}/menu.pdf`;
}
