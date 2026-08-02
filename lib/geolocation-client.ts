"use client";

import type { LocationReading } from "@/lib/geo";

export type PositionOutcome =
  | { ok: true; reading: LocationReading }
  | {
      ok: false;
      reason: "permission_denied" | "position_unavailable" | "timeout" | "unsupported";
    };

/**
 * Promise wrapper around navigator.geolocation.
 *
 * Shared by owner signup (pinning the restaurant) and the customer join form
 * (proving presence). Requires a secure context — localhost counts in
 * development, and production is HTTPS via Vercel.
 */
export function requestPosition(timeoutMs = 15_000): Promise<PositionOutcome> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ ok: false, reason: "unsupported" });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          ok: true,
          reading: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          } satisfies LocationReading,
        }),
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            return resolve({ ok: false, reason: "permission_denied" });
          case error.TIMEOUT:
            return resolve({ ok: false, reason: "timeout" });
          default:
            return resolve({ ok: false, reason: "position_unavailable" });
        }
      },
      {
        // A cached fix from an hour ago is worthless for proving presence.
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: timeoutMs,
      },
    );
  });
}
