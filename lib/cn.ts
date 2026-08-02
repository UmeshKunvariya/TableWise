/**
 * Minimal class joiner. Deliberately not `clsx` + `tailwind-merge` — this app
 * ships to phones on mobile data, and the component set is small enough that
 * conflicting utility classes are avoided by construction rather than resolved
 * at runtime.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
