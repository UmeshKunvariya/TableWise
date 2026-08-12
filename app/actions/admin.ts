"use server";

import { revalidatePath } from "next/cache";

import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Approval controls for the super admin.
 *
 * Uses the session-scoped client: the restaurants_admin_all policy is what
 * grants this, so a non-admin session updates nothing even if it reaches these
 * actions. requireSuperAdmin() is the second lock, not the only one.
 */
async function setStatus(
  restaurantId: string,
  status: "approved" | "pending" | "suspended",
) {
  await requireSuperAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("restaurants")
    .update({ status })
    .eq("id", restaurantId);

  if (error) {
    return { error: "Couldn't update that restaurant." };
  }

  revalidatePath("/admin");
  return {};
}

/** Approve a restaurant: its owner gains the dashboard, its QR starts working. */
export async function approveRestaurant(restaurantId: string) {
  return setStatus(restaurantId, "approved");
}

/**
 * Suspend a restaurant. Its QR stops accepting joins immediately — parties
 * already waiting keep their entries, so nobody is silently dropped.
 */
export async function suspendRestaurant(restaurantId: string) {
  return setStatus(restaurantId, "suspended");
}

/** Undo a suspension by returning the restaurant to approved. */
export async function reinstateRestaurant(restaurantId: string) {
  return setStatus(restaurantId, "approved");
}
