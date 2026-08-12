"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { markNoShow, seatEntry, setQueueOpen } from "@/app/actions/dashboard";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";

import { WalkInForm } from "./WalkInForm";

export type QueueEntry = {
  id: string;
  ticket_number: number;
  name: string;
  phone: string | null;
  party_size: number;
  joined_at: string;
  source: "qr" | "walk_in";
};

/**
 * The live queue board.
 *
 * Two things matter here and nothing else does. First, a customer who joins
 * must appear without the owner touching anything — hence the realtime
 * subscription. Second, clearing a party must feel instant, because the owner
 * is doing this with a queue of people watching them: the row disappears on tap
 * and only comes back if the server rejects it.
 *
 * The subscription is scoped by restaurant_id, and RLS independently guarantees
 * the socket can never deliver another restaurant's rows.
 */
export function QueueBoard({
  restaurantId,
  initialEntries,
  isQueueOpen,
}: {
  restaurantId: string;
  initialEntries: QueueEntry[];
  isQueueOpen: boolean;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [clearing, setClearing] = useState<Set<string>>(new Set());
  const [queueOpen, setQueueOpenState] = useState(isQueueOpen);
  const [error, setError] = useState<string | null>(null);
  const [disconnected, setDisconnected] = useState(false);
  const [, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from("queue_entries")
      .select("id, ticket_number, name, phone, party_size, joined_at, source")
      .eq("restaurant_id", restaurantId)
      .eq("status", "waiting")
      .order("joined_at", { ascending: true });

    if (!fetchError && data) {
      setEntries(data as QueueEntry[]);
      // Anything the server no longer reports as waiting is settled, so drop
      // its optimistic hide rather than letting the set grow all evening.
      setClearing((prev) => {
        if (prev.size === 0) return prev;
        const live = new Set(data.map((e) => e.id));
        return new Set([...prev].filter((id) => live.has(id)));
      });
    }
  }, [restaurantId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`dashboard:${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue_entries",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => void refresh(),
      )
      .subscribe((status) => {
        // A silently dead socket is the dangerous failure here: the board would
        // look calm while people pile up outside.
        setDisconnected(status !== "SUBSCRIBED");
        if (status === "SUBSCRIBED") void refresh();
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [restaurantId, refresh]);

  function clear(entry: QueueEntry, action: typeof seatEntry) {
    setError(null);
    setClearing((prev) => new Set(prev).add(entry.id));

    startTransition(async () => {
      const result = await action(entry.id);

      if (result?.error) {
        // Put the row back: pretending it worked would lose a real customer.
        setClearing((prev) => {
          const next = new Set(prev);
          next.delete(entry.id);
          return next;
        });
        setError(result.error);
      }
    });
  }

  function toggleQueue() {
    const next = !queueOpen;
    setQueueOpenState(next);

    startTransition(async () => {
      const result = await setQueueOpen(next);
      if (result?.error) {
        setQueueOpenState(!next);
        setError(result.error);
      }
    });
  }

  const visible = entries.filter((e) => !clearing.has(e.id));

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">Waiting now</p>
          <p className="text-3xl font-semibold tabular-nums text-ink">
            {visible.length}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            variant={queueOpen ? "secondary" : "primary"}
            className="w-auto"
            onClick={toggleQueue}
          >
            {queueOpen ? "Close queue" : "Reopen queue"}
          </Button>
          <p className="text-xs text-ink-muted">
            {queueOpen ? "Accepting QR joins" : "QR joins paused"}
          </p>
        </div>
      </Card>

      {disconnected ? (
        <Alert tone="warning">
          Reconnecting — new customers may not appear until this clears.
        </Alert>
      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <WalkInForm />

      {visible.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="text-lg font-medium text-ink">Nobody waiting</p>
          <p className="text-ink-muted">
            Parties appear here the moment they scan your QR code.
          </p>
        </Card>
      ) : (
        <ol className="flex flex-col gap-3">
          {visible.map((entry, index) => (
            <li key={entry.id}>
              <QueueRow
                entry={entry}
                position={index + 1}
                onSeat={() => clear(entry, seatEntry)}
                onNoShow={() => clear(entry, markNoShow)}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function QueueRow({
  entry,
  position,
  onSeat,
  onNoShow,
}: {
  entry: QueueEntry;
  position: number;
  onSeat: () => void;
  onNoShow: () => void;
}) {
  const waited = useWaitedMinutes(entry.joined_at);

  return (
    <Card className={position === 1 ? "border-primary/40 bg-primary-soft" : ""}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-lg font-semibold text-accent tabular-nums">
              #{entry.ticket_number}
            </span>
            <span className="truncate text-lg font-semibold text-ink">
              {entry.name}
            </span>
          </div>
          <p className="text-sm text-ink-muted">
            {entry.party_size} {entry.party_size === 1 ? "person" : "people"}
            {waited !== null ? ` · waiting ${waited}` : null}
            {entry.source === "walk_in" ? " · added at counter" : null}
          </p>
          {entry.phone ? (
            <a
              href={`tel:${entry.phone}`}
              className="text-sm font-medium text-primary underline underline-offset-2"
            >
              {entry.phone}
            </a>
          ) : null}
        </div>
        {position === 1 ? (
          <span className="shrink-0 rounded-control bg-primary px-2 py-1 text-xs font-semibold text-primary-fg">
            Next
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex gap-2">
        <Button onClick={onSeat}>Seated</Button>
        <Button variant="secondary" onClick={onNoShow}>
          No-show
        </Button>
      </div>
    </Card>
  );
}

/**
 * Minutes since joining, computed after mount.
 *
 * Server and client would disagree on "now" during hydration, so this starts as
 * null and fills in on the client rather than rendering a mismatched value.
 */
function useWaitedMinutes(joinedAt: string): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    function update() {
      const minutes = Math.max(
        0,
        Math.floor((Date.now() - new Date(joinedAt).getTime()) / 60_000),
      );

      if (minutes < 60) {
        setLabel(`${minutes} min`);
        return;
      }

      const hours = Math.floor(minutes / 60);
      setLabel(`${hours}h ${minutes % 60}m`);
    }

    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, [joinedAt]);

  return label;
}
