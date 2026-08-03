import { signOut } from "@/app/actions/auth";
import { requireOwner } from "@/lib/auth";

/**
 * Every owner route passes through this gate. requireOwner() redirects to
 * /login or /pending as needed, so children can assume an approved restaurant.
 */
export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const owner = await requireOwner();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-surface-raised">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">
              {owner.restaurantName}
            </p>
            <p className="text-xs text-ink-muted">TableWise dashboard</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="min-h-11 rounded-control px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-sunken"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 p-4">{children}</main>
    </div>
  );
}
