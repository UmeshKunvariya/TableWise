/**
 * Geofence maths and policy.
 *
 * Pure and dependency-free on purpose: this is the rule that decides whether a
 * customer is physically at the restaurant, and it must be unit-testable
 * without a database, a browser, or a network.
 *
 * The browser reports its own position. That report is untrusted input — the
 * server recomputes the distance here from the restaurant's stored coordinates
 * and never accepts a distance claimed by the client.
 */

const EARTH_RADIUS_M = 6_371_008.8; // IUGG mean earth radius

/** Fixes worse than this are too vague to place someone at a door. */
export const MAX_ACCURACY_M = 200;

export type Coordinates = { lat: number; lng: number };

export type LocationReading = Coordinates & {
  /** Radius of 95% confidence, in metres, as reported by the device. */
  accuracy: number;
};

export type GeofenceTarget = Coordinates & { radiusM: number };

export type GeofenceRejection =
  | "permission_denied"
  | "position_unavailable"
  | "inaccurate"
  | "out_of_range"
  | "invalid_reading";

export type GeofenceResult =
  | { ok: true; distanceM: number }
  | { ok: false; reason: GeofenceRejection; distanceM: number | null };

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in metres between two points. */
export function haversineMetres(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function isValidCoordinate({ lat, lng }: Coordinates): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Decide whether a reading places the customer inside the geofence.
 *
 * The comparison is `distance - accuracy > radius`, which gives the customer
 * the benefit of their device's uncertainty: a reading 120m away with ±50m
 * accuracy could genuinely be 70m away, so a 100m fence admits it. Erring the
 * other way would turn every GPS wobble into a customer arguing at the counter.
 */
export function validateLocation(
  reading: LocationReading | null,
  target: GeofenceTarget,
): GeofenceResult {
  if (reading === null) {
    return { ok: false, reason: "permission_denied", distanceM: null };
  }

  if (!isValidCoordinate(reading) || !Number.isFinite(reading.accuracy)) {
    return { ok: false, reason: "invalid_reading", distanceM: null };
  }

  if (!isValidCoordinate(target)) {
    return { ok: false, reason: "position_unavailable", distanceM: null };
  }

  const distanceM = haversineMetres(reading, target);

  // Checked before range: a wildly imprecise fix that happens to land nearby is
  // still not evidence the customer is there.
  if (reading.accuracy > MAX_ACCURACY_M) {
    return { ok: false, reason: "inaccurate", distanceM };
  }

  if (distanceM - reading.accuracy > target.radiusM) {
    return { ok: false, reason: "out_of_range", distanceM };
  }

  return { ok: true, distanceM };
}

/** Customer-facing copy. Every rejection ends with a way to still get seated. */
export function rejectionMessage(reason: GeofenceRejection): string {
  switch (reason) {
    case "permission_denied":
      return "We need your location to confirm you're at the restaurant. Enable location access and try again, or ask a staff member to add you at the counter.";
    case "inaccurate":
      return "We couldn't pin down your location accurately enough. Step outside or near a window and try again, or ask a staff member to add you.";
    case "out_of_range":
      return "You don't appear to be at the restaurant yet. Join the queue once you arrive.";
    case "position_unavailable":
    case "invalid_reading":
      return "We couldn't read your location. Please try again, or ask a staff member to add you at the counter.";
  }
}
