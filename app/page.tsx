import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";

/**
 * Marketing root. Customers never land here — they arrive at
 * /r/[slug]?t=<qr_token> by scanning the poster at the restaurant door.
 */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-primary">
          TableWise
        </h1>
        <p className="mt-2 text-ink-muted">
          A digital waitlist for restaurants — no more paper diary, no more
          shouted names at the door.
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">For restaurant owners</h2>
        <p className="text-sm text-ink-muted">
          Register your restaurant, print your QR poster, and watch parties
          arrive on your dashboard in real time.
        </p>
        <a
          href="/signup"
          className="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-4 font-medium text-primary-fg transition-colors hover:bg-primary-hover"
        >
          Register your restaurant
        </a>
        <a
          href="/login"
          className="inline-flex min-h-11 items-center justify-center rounded-control px-4 font-medium text-ink-muted transition-colors hover:bg-surface-sunken"
        >
          Sign in
        </a>
      </Card>

      <Alert tone="info" title="Looking to join a queue?">
        Scan the QR code at the restaurant entrance. You can only join while
        you&rsquo;re actually there.
      </Alert>
    </main>
  );
}
