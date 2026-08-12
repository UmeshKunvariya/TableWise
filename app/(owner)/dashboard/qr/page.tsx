import QRCode from "qrcode";

import { PrintButton } from "@/components/PrintButton";
import { Card } from "@/components/ui/Card";
import { requireOwner } from "@/lib/auth";
import { appUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Your QR poster — TableWise" };

export const dynamic = "force-dynamic";

/**
 * The printable QR poster.
 *
 * Rendered as inline SVG on the server: it stays crisp at any print size, needs
 * no client JavaScript, and works when printed from a phone. The encoded URL
 * carries the qr_token as well as the slug, so someone who guesses a restaurant
 * name still cannot reach the join page.
 */
export default async function QrPage() {
  const owner = await requireOwner();
  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("qr_token")
    .eq("id", owner.restaurantId)
    .single<{ qr_token: string }>();

  if (!restaurant) {
    return (
      <Card>
        <p className="text-ink">Couldn&rsquo;t load your QR code.</p>
      </Card>
    );
  }

  const joinUrl = `${appUrl()}/r/${owner.slug}?t=${restaurant.qr_token}`;

  const svg = await QRCode.toString(joinUrl, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
  });

  return (
    <div className="flex flex-col gap-4">
      <Card className="print:hidden">
        <h1 className="text-xl font-semibold text-ink">Your QR poster</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Print this and put it where the queue forms. Customers must be within{" "}
          the restaurant&rsquo;s radius for the code to let them join.
        </p>
        <p className="mt-3 break-all rounded bg-surface-sunken px-2 py-1 font-mono text-xs text-ink-muted">
          {joinUrl}
        </p>
      </Card>

      {/* The poster itself — the only thing that survives onto paper. */}
      <div className="rounded-card border border-border bg-white p-8 text-center print:border-0 print:p-0">
        <p className="text-sm font-medium uppercase tracking-widest text-ink-muted">
          Join the queue
        </p>
        <h2 className="mt-1 text-3xl font-semibold text-ink">
          {owner.restaurantName}
        </h2>

        <div
          className="mx-auto mt-6 w-full max-w-xs [&>svg]:h-auto [&>svg]:w-full"
          aria-label="QR code to join the queue"
          dangerouslySetInnerHTML={{ __html: svg }}
        />

        <p className="mt-6 text-lg font-medium text-ink">
          Scan with your phone camera
        </p>
        <p className="mt-1 text-ink-muted">
          Add your name and see how many groups are ahead of you.
        </p>
        <p className="mt-6 text-sm text-ink-faint">Powered by TableWise</p>
      </div>

      <PrintButton>Print this poster</PrintButton>
    </div>
  );
}
