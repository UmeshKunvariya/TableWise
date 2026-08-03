import Link from "next/link";
import { notFound } from "next/navigation";

import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { getPublicRestaurant } from "@/lib/restaurant";

/**
 * Landing page for a QR scan. A Server Component so the scan-to-usable path
 * ships almost no JavaScript — customers open this outdoors on mobile data.
 */
export default async function RestaurantPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const [{ slug }, { t }] = await Promise.all([params, searchParams]);

  if (!t) {
    notFound();
  }

  const restaurant = await getPublicRestaurant(slug, t);

  if (!restaurant) {
    notFound();
  }

  const waiting = restaurant.waiting_count;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-ink">{restaurant.name}</h1>
      </div>

      <Card className="flex flex-col items-center gap-1 py-8 text-center">
        <p className="text-5xl font-semibold tabular-nums text-accent">
          {waiting}
        </p>
        <p className="text-ink-muted">
          {waiting === 1 ? "group waiting" : "groups waiting"}
        </p>
      </Card>

      {restaurant.is_queue_open ? (
        <Link
          href={`/r/${slug}/join?t=${encodeURIComponent(t)}`}
          className="inline-flex min-h-14 w-full items-center justify-center rounded-control bg-primary px-6 text-lg font-medium text-primary-fg transition-colors hover:bg-primary-hover"
        >
          Join the queue
        </Link>
      ) : (
        <Alert tone="warning" title="The queue is closed">
          Please ask a staff member at the counter.
        </Alert>
      )}

      {restaurant.has_menu ? (
        <Link
          href={`/r/${slug}/menu?t=${encodeURIComponent(t)}`}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-control px-4 font-medium text-primary underline"
        >
          View the menu
        </Link>
      ) : null}

      <p className="text-center text-sm text-ink-muted">
        You&rsquo;ll need to allow location access — the queue is only open to
        people at the restaurant.
      </p>
    </main>
  );
}
