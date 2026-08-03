/**
 * Slugs appear in the QR URL (/r/<slug>), so they need to be short, readable,
 * and collision-free without a round trip to check availability.
 */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Appends a short random suffix. Two restaurants called "The Curry House" in
 * different cities are entirely plausible, and the slug is not user-facing
 * enough to justify an interactive "that name is taken" flow at signup.
 */
export function uniqueSlug(name: string): string {
  const base = slugify(name) || "restaurant";
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}
