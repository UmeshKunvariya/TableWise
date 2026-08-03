import { describe, expect, it } from "vitest";

import {
  MAX_ACCURACY_M,
  haversineMetres,
  validateLocation,
  type GeofenceTarget,
} from "./geo";

/** Reference restaurant. Radius matches the 100m default from docs/PLAN.md. */
const TARGET: GeofenceTarget = { lat: 19.076, lng: 72.8777, radiusM: 100 };

describe("haversineMetres", () => {
  it("is zero for identical points", () => {
    expect(haversineMetres(TARGET, TARGET)).toBe(0);
  });

  it("matches a known long-distance pair", () => {
    // London Heathrow → Paris CDG, ~348 km by great circle.
    const distance = haversineMetres(
      { lat: 51.47, lng: -0.4543 },
      { lat: 49.0097, lng: 2.5479 },
    );
    expect(distance).toBeGreaterThan(346_000);
    expect(distance).toBeLessThan(350_000);
  });

  it("matches a known short-distance pair", () => {
    // One degree of latitude is ~111.2 km anywhere on the globe.
    const distance = haversineMetres({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(distance).toBeGreaterThan(111_000);
    expect(distance).toBeLessThan(111_400);
  });

  it("is symmetric", () => {
    const a = { lat: 19.076, lng: 72.8777 };
    const b = { lat: 19.08, lng: 72.88 };
    expect(haversineMetres(a, b)).toBeCloseTo(haversineMetres(b, a), 9);
  });
});

describe("validateLocation", () => {
  it("rejects a null reading as a denied permission", () => {
    const result = validateLocation(null, TARGET);
    expect(result).toEqual({
      ok: false,
      reason: "permission_denied",
      distanceM: null,
    });
  });

  it("accepts a customer standing at the restaurant", () => {
    const result = validateLocation(
      { ...TARGET, accuracy: 10 },
      TARGET,
    );
    expect(result.ok).toBe(true);
    expect(result.distanceM).toBeCloseTo(0, 6);
  });

  it("accepts a customer 50m away", () => {
    // ~50m north.
    const result = validateLocation(
      { lat: TARGET.lat + 0.00045, lng: TARGET.lng, accuracy: 10 },
      TARGET,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a customer 500m away", () => {
    // ~555m north.
    const result = validateLocation(
      { lat: TARGET.lat + 0.005, lng: TARGET.lng, accuracy: 10 },
      TARGET,
    );
    expect(result).toMatchObject({ ok: false, reason: "out_of_range" });
  });

  it("rejects an unusably imprecise fix even when it lands nearby", () => {
    const result = validateLocation(
      { ...TARGET, accuracy: MAX_ACCURACY_M + 1 },
      TARGET,
    );
    // Nearby-but-vague is not evidence of presence — accuracy is checked first.
    expect(result).toMatchObject({ ok: false, reason: "inaccurate" });
  });

  it("accepts a fix exactly at the accuracy limit", () => {
    const result = validateLocation(
      { ...TARGET, accuracy: MAX_ACCURACY_M },
      TARGET,
    );
    expect(result.ok).toBe(true);
  });

  it("gives the customer the benefit of their accuracy radius", () => {
    // ~166m away, but the device admits to ±100m, so it could be ~66m away.
    const result = validateLocation(
      { lat: TARGET.lat + 0.0015, lng: TARGET.lng, accuracy: 100 },
      TARGET,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects once even the optimistic reading is outside the fence", () => {
    // ~333m away with ±100m accuracy: at best still ~233m out.
    const result = validateLocation(
      { lat: TARGET.lat + 0.003, lng: TARGET.lng, accuracy: 100 },
      TARGET,
    );
    expect(result).toMatchObject({ ok: false, reason: "out_of_range" });
  });

  it("honours a per-restaurant radius override", () => {
    const reading = { lat: TARGET.lat + 0.003, lng: TARGET.lng, accuracy: 10 };
    expect(validateLocation(reading, TARGET).ok).toBe(false);
    expect(validateLocation(reading, { ...TARGET, radiusM: 500 }).ok).toBe(true);
  });

  it("rejects malformed readings", () => {
    for (const bad of [
      { lat: Number.NaN, lng: 0, accuracy: 5 },
      { lat: 0, lng: Number.POSITIVE_INFINITY, accuracy: 5 },
      { lat: 91, lng: 0, accuracy: 5 },
      { lat: 0, lng: 181, accuracy: 5 },
      { lat: 0, lng: 0, accuracy: Number.NaN },
    ]) {
      expect(validateLocation(bad, TARGET)).toMatchObject({
        ok: false,
        reason: "invalid_reading",
      });
    }
  });

  it("reports a distance alongside range rejections so it can be logged", () => {
    const result = validateLocation(
      { lat: TARGET.lat + 0.005, lng: TARGET.lng, accuracy: 10 },
      TARGET,
    );
    expect(result.distanceM).toBeGreaterThan(500);
  });
});
