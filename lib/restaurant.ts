import "server-only";

import { createClient } from "@/lib/supabase/server";

export type PublicRestaurant = {
  id: string;
  name: string;
  slug: string;
  is_queue_open: boolean;
  has_menu: boolean;
  waiting_count: number;
};

/**
 * The anonymous customer's view of a restaurant.
 *
 * Goes through the get_public_restaurant() definer function rather than a table
 * read: anon has no select policy on `restaurants`, and the function returns a
 * curated column set only when slug and qr_token both match an approved row.
 */
export async function getPublicRestaurant(
  slug: string,
  qrToken: string,
): Promise<PublicRestaurant | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("get_public_restaurant", { p_slug: slug, p_qr_token: qrToken })
    .maybeSingle<PublicRestaurant>();

  if (error) {
    return null;
  }

  return data;
}
