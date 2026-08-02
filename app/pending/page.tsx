import { signOut } from "@/app/actions/auth";
import { Card } from "@/components/ui/Card";

export const metadata = { title: "Awaiting approval — TableWise" };

export default function PendingPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 p-6">
      <Card className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold">Awaiting approval</h1>
        <p className="text-sm text-ink-muted">
          Your restaurant has been registered and is waiting for review. Once
          it&rsquo;s approved you&rsquo;ll be able to print your QR poster and
          start taking your queue.
        </p>
        <form action={signOut}>
          <button
            type="submit"
            className="min-h-11 w-full rounded-control border border-border-strong bg-surface-raised px-4 font-medium text-ink transition-colors hover:bg-surface-sunken"
          >
            Sign out
          </button>
        </form>
      </Card>
    </main>
  );
}
