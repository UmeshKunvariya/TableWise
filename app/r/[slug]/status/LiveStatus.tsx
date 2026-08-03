"use client";

import { useCallback, useEffect, useState } from "react";

import { leaveQueue } from "@/app/actions/queue";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { createClient } from "@/lib/supabase/client";

export type Position = {
  ticket_number: number;
  people_ahead: number;
  status: "waiting" | "seated" | "no_show" | "left";
};

/**
 * The customer's live view.
 *
 * The page is anonymous and has no read access to queue_entries, so it cannot
 * subscribe to postgres_changes. Instead it listens on the public broadcast
 * topic — which carries only a version counter, no PII — and on each ping calls
 * get_my_position() with its own token to fetch its own three numbers.
 */
export function LiveStatus({
  restaurantId,
  token,
  slug,
  initial,
}: {
  restaurantId: string;
  token: string;
  slug: string;
  initial: Position;
}) {
  const [position, setPosition] = useState<Position>(initial);
  const [stale, setStale] = useState(false);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .rpc("get_my_position", { p_customer_token: token })
      .maybeSingle<Position>();

    if (!error && data) {
      setPosition(data);
      setStale(false);
    }
  }, [token]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`queue:${restaurantId}`)
      .on("broadcast", { event: "queue_changed" }, () => {
        void refresh();
      })
      .subscribe((status) => {
        // A dropped socket means the count on screen may silently go stale, so
        // say so rather than showing a confidently wrong number.
        setStale(status !== "SUBSCRIBED");
        if (status === "SUBSCRIBED") {
          void refresh();
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [restaurantId, refresh]);

  if (position.status === "seated") {
    return (
      <Card className="flex flex-col items-center gap-2 py-10 text-center">
        <p className="text-2xl font-semibold text-success">You&rsquo;re up!</p>
        <p className="text-ink-muted">
          Table {position.ticket_number} — please head to the counter.
        </p>
      </Card>
    );
  }

  if (position.status === "left") {
    return (
      <Card className="flex flex-col items-center gap-2 py-10 text-center">
        <p className="text-xl font-semibold text-ink">You&rsquo;ve left the queue</p>
        <p className="text-ink-muted">
          Scan the QR code again if you&rsquo;d like to rejoin.
        </p>
      </Card>
    );
  }

  if (position.status === "no_show") {
    return (
      <Card className="flex flex-col items-center gap-2 py-10 text-center">
        <p className="text-xl font-semibold text-ink">
          You&rsquo;re no longer in the queue
        </p>
        <p className="text-ink-muted">
          Speak to a staff member if this looks wrong.
        </p>
      </Card>
    );
  }

  const ahead = position.people_ahead;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col items-center gap-1 py-4 text-center">
        <p className="text-sm text-ink-muted">Your ticket</p>
        <p className="font-mono text-3xl font-semibold text-accent tabular-nums">
          #{position.ticket_number}
        </p>
      </Card>

      <Card className="flex flex-col items-center gap-2 py-10 text-center">
        <p
          className="text-6xl font-semibold tabular-nums text-primary"
          aria-live="polite"
        >
          {ahead}
        </p>
        <p className="text-lg text-ink-muted">
          {ahead === 0
            ? "You're next"
            : ahead === 1
              ? "group ahead of you"
              : "groups ahead of you"}
        </p>
      </Card>

      {stale ? (
        <Alert tone="warning">
          Reconnecting — this count may be out of date.
        </Alert>
      ) : null}

      <form action={leaveQueue.bind(null, slug)}>
        <Button type="submit" variant="ghost">
          Leave the queue
        </Button>
      </form>
    </div>
  );
}
