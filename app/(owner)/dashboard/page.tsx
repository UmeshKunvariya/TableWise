import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { requireOwner } from "@/lib/auth";

/**
 * Placeholder. The live queue, optimistic Seated/No-show, Add walk-in and the
 * queue open/close toggle are step 6 of docs/PLAN.md and are not built yet.
 */
export default async function DashboardPage() {
  const owner = await requireOwner();

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Queue</h1>
        <p className="text-sm text-ink-muted">
          Your customer link is{" "}
          <code className="rounded bg-surface-sunken px-1 py-0.5 font-mono text-xs">
            /r/{owner.slug}
          </code>
        </p>
      </Card>

      <Alert tone="info" title="Dashboard not built yet">
        The live queue view is step 6 of the build order. Until then, use the
        Supabase Studio table view to watch <code>queue_entries</code>.
      </Alert>
    </div>
  );
}
