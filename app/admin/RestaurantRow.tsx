"use client";

import { useState, useTransition } from "react";

import {
  approveRestaurant,
  reinstateRestaurant,
  suspendRestaurant,
} from "@/app/actions/admin";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  address: string;
  status: "pending" | "approved" | "suspended";
};

const BADGES: Record<Restaurant["status"], string> = {
  pending: "bg-warning-soft text-warning",
  approved: "bg-success-soft text-success",
  suspended: "bg-danger-soft text-danger",
};

export function RestaurantRow({ restaurant }: { restaurant: Restaurant }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: (id: string) => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action(restaurant.id);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{restaurant.name}</p>
          <p className="truncate text-sm text-ink-muted">{restaurant.address}</p>
          <code className="text-xs text-ink-faint">/r/{restaurant.slug}</code>
        </div>
        <span
          className={`shrink-0 rounded-control px-2 py-1 text-xs font-semibold capitalize ${BADGES[restaurant.status]}`}
        >
          {restaurant.status}
        </span>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="flex gap-2">
        {restaurant.status === "pending" ? (
          <Button disabled={pending} onClick={() => run(approveRestaurant)}>
            Approve
          </Button>
        ) : null}

        {restaurant.status === "approved" ? (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => run(suspendRestaurant)}
          >
            Suspend
          </Button>
        ) : null}

        {restaurant.status === "suspended" ? (
          <Button disabled={pending} onClick={() => run(reinstateRestaurant)}>
            Reinstate
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
