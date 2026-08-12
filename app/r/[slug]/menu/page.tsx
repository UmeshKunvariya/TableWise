import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@/components/ui/Card";
import { menuPublicUrl } from "@/lib/menu";
import { getPublicRestaurant } from "@/lib/restaurant";

export const metadata = { title: "Menu — TableWise" };

/**
 * The menu, for someone deciding what to order while they wait.
 *
 * Gated behind the same slug + qr_token pair as everything else on the customer
 * side. The PDF is embedded, but the direct link below it is not a nicety:
 * iOS Safari has a long history of refusing to render PDFs in an iframe, and a
 * blank grey box with no way out would be worse than no menu at all.
 */
export default async function MenuPage({
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

  if (!restaurant || !restaurant.has_menu) {
    notFound();
  }

  const pdfUrl = menuPublicUrl(restaurant.id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">{restaurant.name}</h1>
        <Link
          href={`/r/${slug}?t=${encodeURIComponent(t)}`}
          className="shrink-0 text-sm font-medium text-primary underline"
        >
          Back to queue
        </Link>
      </div>

      <Card className="overflow-hidden p-0">
        <iframe
          src={pdfUrl}
          title={`${restaurant.name} menu`}
          className="h-[70vh] w-full border-0"
        />
      </Card>

      <a
        href={pdfUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-12 w-full items-center justify-center rounded-control border border-border-strong bg-surface-raised px-4 font-medium text-ink"
      >
        Open the menu full screen
      </a>
    </main>
  );
}
