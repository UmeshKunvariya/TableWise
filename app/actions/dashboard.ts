"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Owner-side queue operations.
 *
 * These use the session-scoped client, not the service role: RLS already
 * restricts queue_entries to the caller's own restaurant, so letting the
 * database enforce ownership is stronger than re-checking it here. The one
 * exception is addWalkIn(), which needs join_queue() — service-role only,
 * because that function is what the geofence protects.
 */

/** Both clear buttons do the same thing bar the recorded outcome. */
async function closeEntry(entryId: string, status: "seated" | "no_show") {
  const owner = await requireOwner();
  const supabase = await createClient();

  const { error } = await supabase
    .from("queue_entries")
    .update({
      status,
      seated_at: status === "seated" ? new Date().toISOString() : null,
    })
    .eq("id", entryId)
    // Redundant under RLS, but makes the intent explicit and survives any
    // future loosening of the policy.
    .eq("restaurant_id", owner.restaurantId)
    .eq("status", "waiting");

  if (error) {
    return { error: "That didn't save. Check your connection and try again." };
  }

  revalidatePath("/dashboard");
  return {};
}

export async function seatEntry(entryId: string) {
  return closeEntry(entryId, "seated");
}

export async function markNoShow(entryId: string) {
  return closeEntry(entryId, "no_show");
}

export type WalkInState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

const walkInSchema = z.object({
  name: z.string().min(1, "Enter a name"),
  partySize: z.coerce
    .number()
    .int()
    .min(1, "At least one person")
    .max(50, "That's too large for the queue"),
  // Optional on purpose: the escape hatch for a customer whose GPS failed
  // shouldn't itself demand a phone number.
  phone: z.string().optional(),
});

/**
 * The counter's manual entry — and the answer to a blocked geofence.
 *
 * Deliberately bypasses the location check: the owner is standing in front of
 * the customer, which is better evidence of presence than any GPS fix.
 */
export async function addWalkIn(
  _prev: WalkInState,
  formData: FormData,
): Promise<WalkInState> {
  const owner = await requireOwner();
  const parsed = walkInSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const { name, partySize, phone } = parsed.data;
  const admin = createAdminClient();

  const { error } = await admin.rpc("join_queue", {
    p_restaurant_id: owner.restaurantId,
    p_name: name,
    p_phone: phone?.trim() ? phone.trim() : null,
    p_party_size: partySize,
    p_lat: null,
    p_lng: null,
    p_distance_m: null,
    p_source: "walk_in",
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "That number is already waiting in the queue." };
    }
    return { error: "Couldn't add them. Try again." };
  }

  revalidatePath("/dashboard");
  return {};
}

/**
 * Closing the queue stops new QR joins only. Parties already waiting keep their
 * places, and the counter can still add walk-ins.
 */
export async function setQueueOpen(isOpen: boolean) {
  const owner = await requireOwner();
  const supabase = await createClient();

  const { error } = await supabase
    .from("restaurants")
    .update({ is_queue_open: isOpen })
    .eq("id", owner.restaurantId);

  if (error) {
    return { error: "Couldn't change the queue setting." };
  }

  revalidatePath("/dashboard");
  return {};
}
