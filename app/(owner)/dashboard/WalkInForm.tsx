"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { addWalkIn, type WalkInState } from "@/app/actions/dashboard";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

/**
 * Manual entry at the counter.
 *
 * This is the required escape hatch for the geofence: a customer whose phone
 * refuses to give a location, or who simply has no smartphone, still has to be
 * able to join. Collapsed by default so it never competes with the queue itself.
 */
export function WalkInForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<WalkInState, FormData>(
    addWalkIn,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Collapse and reset once the party lands in the queue, so the next walk-in
  // starts from a clean form.
  useEffect(() => {
    if (state && !state.error && !state.fieldErrors && open) {
      const submitted = formRef.current?.dataset.submitted === "true";
      if (submitted) {
        formRef.current?.reset();
        setOpen(false);
      }
    }
  }, [state, open]);

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        + Add walk-in
      </Button>
    );
  }

  return (
    <Card>
      <form
        ref={formRef}
        action={formAction}
        onSubmit={(e) => {
          e.currentTarget.dataset.submitted = "true";
        }}
        className="flex flex-col gap-3"
      >
        <p className="font-semibold text-ink">Add a party at the counter</p>

        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

        <Input
          label="Name"
          name="name"
          required
          autoComplete="off"
          error={state.fieldErrors?.name?.[0]}
        />
        <Input
          label="People"
          name="partySize"
          type="number"
          inputMode="numeric"
          min={1}
          max={50}
          defaultValue={2}
          required
          error={state.fieldErrors?.partySize?.[0]}
        />
        <Input
          label="Phone (optional)"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          hint="Only needed if you want to call them."
          error={state.fieldErrors?.phone?.[0]}
        />

        <div className="flex gap-2">
          <SubmitButton pendingLabel="Adding…">Add to queue</SubmitButton>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
