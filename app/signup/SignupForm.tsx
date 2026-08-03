"use client";

import { useActionState, useState } from "react";

import { signUpOwner, type AuthFormState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { requestPosition } from "@/lib/geolocation-client";

const INITIAL: AuthFormState = {};

export function SignupForm() {
  const [state, formAction] = useActionState(signUpOwner, INITIAL);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  // The browser's timezone is the right default: an owner registering their own
  // restaurant is almost always standing in it.
  const timezone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC";

  async function useCurrentLocation() {
    setLocating(true);
    setLocationNote(null);

    const outcome = await requestPosition();

    if (outcome.ok) {
      setLat(outcome.reading.lat.toFixed(6));
      setLng(outcome.reading.lng.toFixed(6));
      setLocationNote(
        `Pinned to ±${Math.round(outcome.reading.accuracy)}m accuracy.`,
      );
    } else {
      setLocationNote(
        "Couldn't read your location. Enter the coordinates manually below.",
      );
    }

    setLocating(false);
  }

  return (
    <Card>
      <form action={formAction} className="flex flex-col gap-4">
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

        <Input
          label="Your name"
          name="fullName"
          autoComplete="name"
          required
          error={state.fieldErrors?.fullName?.[0]}
        />
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={state.fieldErrors?.email?.[0]}
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          hint="At least 8 characters"
          error={state.fieldErrors?.password?.[0]}
        />
        <Input
          label="Contact number"
          name="phone"
          type="tel"
          autoComplete="tel"
          required
          error={state.fieldErrors?.phone?.[0]}
        />

        <hr className="border-border" />

        <Input
          label="Restaurant name"
          name="restaurantName"
          required
          error={state.fieldErrors?.restaurantName?.[0]}
        />
        <Input
          label="Address"
          name="address"
          required
          error={state.fieldErrors?.address?.[0]}
        />

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-ink">Restaurant location</p>
          <p className="text-sm text-ink-muted">
            Customers can only join the queue when they&rsquo;re near this point,
            so set it while you&rsquo;re at the restaurant.
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={useCurrentLocation}
            disabled={locating}
          >
            {locating ? "Locating…" : "Use my current location"}
          </Button>
          {locationNote ? (
            <p className="text-sm text-ink-muted">{locationNote}</p>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Latitude"
              name="lat"
              inputMode="decimal"
              required
              value={lat}
              onChange={(event) => setLat(event.target.value)}
              error={state.fieldErrors?.lat?.[0]}
            />
            <Input
              label="Longitude"
              name="lng"
              inputMode="decimal"
              required
              value={lng}
              onChange={(event) => setLng(event.target.value)}
              error={state.fieldErrors?.lng?.[0]}
            />
          </div>
        </div>

        <input type="hidden" name="timezone" value={timezone} />

        <SubmitButton size="lg" pendingLabel="Registering…">
          Register restaurant
        </SubmitButton>
      </form>
    </Card>
  );
}
