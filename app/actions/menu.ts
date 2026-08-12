"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type MenuState = { error?: string; success?: string };

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Upload or replace the restaurant's menu PDF.
 *
 * Storage writes go through the service role after requireOwner() has
 * established which restaurant the caller owns, so the bucket needs no upload
 * policies and browsers never touch it directly. The object path is derived
 * from the restaurant id rather than anything user-supplied — a filename from
 * the client is an obvious path-traversal vector.
 */
export async function uploadMenu(
  _prev: MenuState,
  formData: FormData,
): Promise<MenuState> {
  const owner = await requireOwner();
  const file = formData.get("menu");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a PDF to upload." };
  }

  // Checked here as well as on the bucket: the bucket limit returns an opaque
  // error, and this one can explain itself.
  if (file.type !== "application/pdf") {
    return { error: "The menu must be a PDF file." };
  }

  if (file.size > MAX_BYTES) {
    return { error: "That PDF is over 10 MB. Please compress it and retry." };
  }

  const admin = createAdminClient();
  const path = `${owner.restaurantId}/menu.pdf`;

  const { error: uploadError } = await admin.storage
    .from("menus")
    .upload(path, file, { contentType: "application/pdf", upsert: true });

  if (uploadError) {
    return { error: "Upload failed. Check your connection and try again." };
  }

  const { error: updateError } = await admin
    .from("restaurants")
    .update({ menu_pdf_path: path, menu_updated_at: new Date().toISOString() })
    .eq("id", owner.restaurantId);

  if (updateError) {
    return { error: "Uploaded, but couldn't link it. Please try again." };
  }

  revalidatePath("/dashboard/menu");
  revalidatePath(`/r/${owner.slug}`);
  return { success: "Menu updated. Customers can see it now." };
}

/** Remove the menu. The Menu tab disappears from the customer page with it. */
export async function removeMenu(): Promise<MenuState> {
  const owner = await requireOwner();
  const admin = createAdminClient();

  await admin.storage.from("menus").remove([`${owner.restaurantId}/menu.pdf`]);

  const supabase = await createClient();
  const { error } = await supabase
    .from("restaurants")
    .update({ menu_pdf_path: null, menu_updated_at: null })
    .eq("id", owner.restaurantId);

  if (error) {
    return { error: "Couldn't remove the menu. Please try again." };
  }

  revalidatePath("/dashboard/menu");
  revalidatePath(`/r/${owner.slug}`);
  return { success: "Menu removed." };
}
