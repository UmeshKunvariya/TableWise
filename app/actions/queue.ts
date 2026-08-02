"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { customerTokenCookie } from "@/lib/customer-token";
import { rejectionMessage, validateLocation } from "@/lib/geo";
import { createAdminClient } from "@/lib/supabase/admin";

export type JoinFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

const joinSchema = z.object({
  slug: z.string().min(1),
  qrToken: z.string().min(1),
  name: z.string().min(2, "Enter the name for the party"),
  phone: z.string().min(6, "Enter a contact number"),
  partySize: z.coerce
    .number()
    .int()
    .min(1, "At least one person")
    .max(50, "Call the restaurant for parties this large"),
  // Sent as strings by the form; absent entirely when the browser refused.
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  accuracy: z.coerce.number().optional(),
});

export async function joinQueue(
  _prev: JoinFormState,
  formData: FormData,
): Promise<JoinFormState> {
  const parsed = joinSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const { slug, qrToken, name, phone, partySize, lat, lng, accuracy } =
    parsed.data;

  // Service role: the geofence is enforced here, so the underlying join_queue
  // RPC is deliberately not callable by anon or authenticated roles.
  const admin = createAdminClient();

  const { data: restaurant, error: lookupError } = await admin
    .from("restaurants")
    .select("id, lat, lng, geofence_radius_m, status, is_queue_open")
    .eq("slug", slug)
    .eq("qr_token", qrToken)
    .maybeSingle();

  if (lookupError || !restaurant || restaurant.status !== "approved") {
    return { error: "This restaurant isn't taking a queue right now." };
  }

  if (!restaurant.is_queue_open) {
    return {
      error:
        "The queue is closed at the moment. Please ask a staff member at the counter.",
    };
  }

  // The client sends a raw reading and never a distance. Distance is recomputed
  // here from the restaurant's stored coordinates.
  const reading =
    lat === undefined || lng === undefined || accuracy === undefined
      ? null
      : { lat, lng, accuracy };

  const verdict = validateLocation(reading, {
    lat: restaurant.lat,
    lng: restaurant.lng,
    radiusM: restaurant.geofence_radius_m,
  });

  if (!verdict.ok) {
    return { error: rejectionMessage(verdict.reason) };
  }

  const { data, error } = await admin
    .rpc("join_queue", {
      p_restaurant_id: restaurant.id,
      p_name: name,
      p_phone: phone,
      p_party_size: partySize,
      p_lat: reading!.lat,
      p_lng: reading!.lng,
      p_distance_m: verdict.distanceM,
      p_source: "qr",
    })
    .single<{ customer_token: string; ticket_number: number }>();

  if (error || !data) {
    return { error: "We couldn't add you to the queue. Please try again." };
  }

  const cookieStore = await cookies();
  cookieStore.set(customerTokenCookie(slug), data.customer_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/r/${slug}`,
    maxAge: 60 * 60 * 12,
  });

  redirect(`/r/${slug}/status`);
}

export async function leaveQueue(slug: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(customerTokenCookie(slug))?.value;

  if (token) {
    const admin = createAdminClient();
    await admin.rpc("leave_queue", { p_customer_token: token });
    cookieStore.delete({ name: customerTokenCookie(slug), path: `/r/${slug}` });
  }

  // Back to the status page, which renders the "not in the queue" state once
  // the cookie is gone. /r/[slug] itself needs the QR token we no longer hold.
  redirect(`/r/${slug}/status`);
}
