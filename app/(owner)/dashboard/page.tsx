import { Card } from "@/components/ui/Card";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { QueueBoard, type QueueEntry } from "./QueueBoard";

export const metadata = { title: "Queue — TableWise" };

// The queue changes constantly; a cached render would show a stale board on
// first paint before realtime catches up.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const owner = await requireOwner();
  const supabase = await createClient();

  // RLS scopes this to the owner's own restaurant — no restaurant_id filter is
  // needed for correctness, only for the index.
  const { data: entries } = await supabase
    .from("queue_entries")
    .select("id, ticket_number, name, phone, party_size, joined_at, source")
    .eq("restaurant_id", owner.restaurantId)
    .eq("status", "waiting")
    .order("joined_at", { ascending: true });

  return (
    <div className="flex flex-col gap-4">
      <QueueBoard
        restaurantId={owner.restaurantId}
        initialEntries={(entries ?? []) as QueueEntry[]}
        isQueueOpen={owner.isQueueOpen}
      />

      <Card className="flex flex-col gap-1">
        <p className="text-sm font-medium text-ink">Your customer link</p>
        <code className="break-all rounded bg-surface-sunken px-2 py-1 font-mono text-xs text-ink-muted">
          /r/{owner.slug}
        </code>
        <p className="text-sm text-ink-muted">
          Customers reach this by scanning your QR poster — the link alone
          won&rsquo;t work without the code in it.
        </p>
      </Card>
    </div>
  );
}
