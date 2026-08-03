import { notFound } from "next/navigation";

import { Alert } from "@/components/ui/Alert";
import { getPublicRestaurant } from "@/lib/restaurant";

import { JoinForm } from "./JoinForm";

export default async function JoinPage({
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

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Join the queue</h1>
        <p className="mt-1 text-sm text-ink-muted">{restaurant.name}</p>
      </div>

      {restaurant.is_queue_open ? (
        <JoinForm slug={slug} qrToken={t} />
      ) : (
        <Alert tone="warning" title="The queue is closed">
          Please ask a staff member at the counter.
        </Alert>
      )}
    </main>
  );
}
