import { requireOwner } from "@/lib/auth";
import { menuPublicUrl } from "@/lib/menu";
import { createClient } from "@/lib/supabase/server";

import { MenuManager } from "./MenuManager";

export const metadata = { title: "Menu — TableWise" };

export const dynamic = "force-dynamic";

/**
 * Menus are optional per restaurant — the Menu link simply doesn't appear on
 * the customer page until a PDF exists here.
 */
export default async function OwnerMenuPage() {
  const owner = await requireOwner();
  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("menu_pdf_path, menu_updated_at")
    .eq("id", owner.restaurantId)
    .single<{ menu_pdf_path: string | null; menu_updated_at: string | null }>();

  const hasMenu = Boolean(restaurant?.menu_pdf_path);
  const version = restaurant?.menu_updated_at
    ? Date.parse(restaurant.menu_updated_at)
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">Menu</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Optional. Upload one and waiting customers can decide what to order
          before they sit down.
        </p>
      </div>

      <MenuManager
        hasMenu={hasMenu}
        // Stamped with the upload time: the storage path is fixed, so without
        // this a replaced PDF would keep serving the old cached copy.
        menuUrl={
          hasMenu ? `${menuPublicUrl(owner.restaurantId)}?v=${version}` : null
        }
      />
    </div>
  );
}
