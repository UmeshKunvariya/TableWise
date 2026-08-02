import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type OwnerContext = {
  userId: string;
  restaurantId: string;
  restaurantName: string;
  slug: string;
  isQueueOpen: boolean;
  isSuperAdmin: boolean;
};

/**
 * The single authorization gate for owner routes.
 *
 * This lives here rather than in proxy.ts because it needs the database:
 * a valid session says nothing about which restaurant someone belongs to or
 * whether that restaurant has been approved.
 */
export async function requireOwner(): Promise<OwnerContext> {
  const supabase = await createClient();

  // getUser() revalidates against the auth server; getSession() would trust a
  // cookie the client could have tampered with.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("restaurant_members")
    .select("restaurant_id, restaurants(id, name, slug, status, is_queue_open)")
    .eq("user_id", user.id)
    .maybeSingle();

  const restaurant = membership?.restaurants as
    | {
        id: string;
        name: string;
        slug: string;
        status: "pending" | "approved" | "suspended";
        is_queue_open: boolean;
      }
    | undefined;

  if (!restaurant) {
    redirect("/pending");
  }

  if (restaurant.status !== "approved") {
    redirect("/pending");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_super_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    userId: user.id,
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    slug: restaurant.slug,
    isQueueOpen: restaurant.is_queue_open,
    isSuperAdmin: profile?.is_super_admin ?? false,
  };
}
