"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { joinQueue, type JoinFormState } from "@/app/actions/queue";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { requestPosition } from "@/lib/geolocation-client";

const INITIAL: JoinFormState = {};

/**
 * Location is captured on submit rather than on mount: asking for the
 * permission prompt before the customer has shown any intent gets it dismissed.
 *
 * The reading is written into hidden fields and posted raw. The server
 * recomputes the distance — nothing here is trusted.
 */
export function JoinForm({ slug, qrToken }: { slug: string; qrToken: string }) {
  const [state, formAction] = useActionState(joinQueue, INITIAL);
  const [locating, setLocating] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const latRef = useRef<HTMLInputElement>(null);
  const lngRef = useRef<HTMLInputElement>(null);
  const accuracyRef = useRef<HTMLInputElement>(null);

  // A rejection usually means "you're not here yet". If the customer walks
  // closer and retries, they must get a fresh fix rather than resubmitting the
  // stale coordinates still sitting in the hidden fields.
  useEffect(() => {
    if (state.error && latRef.current) {
      latRef.current.value = "";
      lngRef.current!.value = "";
      accuracyRef.current!.value = "";
    }
  }, [state]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Second pass: requestSubmit() below re-fires this handler, and by then the
    // coordinates are filled in. Return without preventDefault so the form
    // action actually runs.
    if (latRef.current?.value) {
      return;
    }

    event.preventDefault();
    setLocalError(null);
    setLocating(true);

    const outcome = await requestPosition();
    setLocating(false);

    if (!outcome.ok) {
      // Leaving the coordinate fields empty would also be rejected server-side,
      // but failing here saves a round trip and names the actual problem.
      setLocalError(
        outcome.reason === "permission_denied"
          ? "We need your location to confirm you're at the restaurant. Enable location access and try again, or ask a staff member to add you at the counter."
          : "We couldn't read your location. Please try again, or ask a staff member to add you at the counter.",
      );
      return;
    }

    if (latRef.current && lngRef.current && accuracyRef.current) {
      latRef.current.value = String(outcome.reading.lat);
      lngRef.current.value = String(outcome.reading.lng);
      accuracyRef.current.value = String(outcome.reading.accuracy);
    }

    formRef.current?.requestSubmit();
  }

  return (
    <Card>
      <form
        ref={formRef}
        action={formAction}
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
        {localError ? <Alert tone="danger">{localError}</Alert> : null}

        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="qrToken" value={qrToken} />
        <input type="hidden" name="lat" ref={latRef} />
        <input type="hidden" name="lng" ref={lngRef} />
        <input type="hidden" name="accuracy" ref={accuracyRef} />

        <Input
          label="Name"
          name="name"
          autoComplete="name"
          required
          error={state.fieldErrors?.name?.[0]}
        />
        <Input
          label="Phone number"
          name="phone"
          type="tel"
          autoComplete="tel"
          required
          hint="So the restaurant can reach you if needed"
          error={state.fieldErrors?.phone?.[0]}
        />
        <Input
          label="Party size"
          name="partySize"
          type="number"
          inputMode="numeric"
          min={1}
          max={50}
          defaultValue={2}
          required
          error={state.fieldErrors?.partySize?.[0]}
        />

        <SubmitButton
          size="lg"
          disabled={locating}
          pendingLabel="Joining the queue…"
        >
          {locating ? "Checking you're here…" : "Join the queue"}
        </SubmitButton>
      </form>
    </Card>
  );
}
