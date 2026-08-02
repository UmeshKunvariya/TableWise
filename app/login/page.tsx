import Link from "next/link";

import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in — TableWise" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold text-primary">Sign in</h1>
      <LoginForm />
      <p className="text-center text-sm text-ink-muted">
        Don&rsquo;t have an account?{" "}
        <Link href="/signup" className="font-medium text-primary underline">
          Register your restaurant
        </Link>
      </p>
    </main>
  );
}
