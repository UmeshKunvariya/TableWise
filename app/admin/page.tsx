import { Card } from "@/components/ui/Card";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { RestaurantRow } from "./RestaurantRow";

export const metadata = { title: "Admin — TableWise" };

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  slug: string;
  address: string;
  status: "pending" | "approved" | "suspended";
  created_at: string;
};

/**
 * Super-admin approvals.
 *
 * Deliberately outside the (owner) route group: an admin need not own a
 * restaurant, and the owner layout would redirect them to /pending.
 */
export default async function AdminPage() {
  await requireSuperAdmin();
  const supabase = await createClient();

  const { data } = await supabase
    .from("restaurants")
    .select("id, name, slug, address, status, created_at")
    .order("created_at", { ascending: false });

  const restaurants = (data ?? []) as Row[];
  const pending = restaurants.filter((r) => r.status === "pending");
  const rest = restaurants.filter((r) => r.status !== "pending");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4">
      <h1 className="text-xl font-semibold text-ink">Restaurants</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          Awaiting approval ({pending.length})
        </h2>

        {pending.length === 0 ? (
          <Card className="py-6 text-center text-ink-muted">
            Nothing waiting for review.
          </Card>
        ) : (
          pending.map((r) => <RestaurantRow key={r.id} restaurant={r} />)
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
          All restaurants ({rest.length})
        </h2>

        {rest.map((r) => (
          <RestaurantRow key={r.id} restaurant={r} />
        ))}
      </section>
    </main>
  );
}
