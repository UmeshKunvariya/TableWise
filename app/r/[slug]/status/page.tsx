import { cookies } from "next/headers";

import { Card } from "@/components/ui/Card";
import { customerTokenCookie } from "@/lib/customer-token";
import { createAdminClient } from "@/lib/supabase/admin";

import { LiveStatus, type Position } from "./LiveStatus";

export const metadata = { title: "Your place in the queue — TableWise" };

/**
 * Reads the httpOnly token server-side and hands it to the client component.
 * The token is the customer's own credential, so rendering it into the page is
 * fine; keeping the cookie httpOnly still stops casual script access to it.
 */
export default async function StatusPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get(customerTokenCookie(slug))?.value;

  if (!token) {
    return <NotInQueue />;
  }

  // Service role, server-side only: the channel name needs the restaurant id,
  // and get_my_position() deliberately doesn't return it.
  const admin = createAdminClient();

  const { data: entry } = await admin
    .from("queue_entries")
    .select("restaurant_id, restaurants(name)")
    .eq("customer_token", token)
    .maybeSingle<{ restaurant_id: string; restaurants: { name: string } | null }>();

  const { data: position } = await admin
    .rpc("get_my_position", { p_customer_token: token })
    .maybeSingle<Position>();

  if (!entry || !position) {
    return <NotInQueue />;
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 p-6">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-ink">
          {entry.restaurants?.name ?? "Your queue"}
        </h1>
      </div>

      <LiveStatus
        restaurantId={entry.restaurant_id}
        token={token}
        slug={slug}
        initial={position}
      />
    </main>
  );
}

function NotInQueue() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 p-6">
      <Card className="flex flex-col items-center gap-2 py-10 text-center">
        <p className="text-xl font-semibold text-ink">
          You&rsquo;re not in the queue
        </p>
        <p className="text-ink-muted">
          Scan the QR code at the entrance to join.
        </p>
      </Card>
    </main>
  );
}
