/**
 * Name of the cookie holding a customer's queue token.
 *
 * Scoped per restaurant so one phone can hold tickets at several at once, and
 * kept out of the "use server" action module because every export from one of
 * those must be an async server action.
 */
export function customerTokenCookie(slug: string): string {
  return `tw_token_${slug}`;
}
