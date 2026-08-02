import Link from "next/link";

import { SignupForm } from "./SignupForm";

export const metadata = { title: "Register your restaurant — TableWise" };

export default function SignupPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary">
          Register your restaurant
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          We&rsquo;ll review your details before your queue goes live.
        </p>
      </div>
      <SignupForm />
      <p className="text-center text-sm text-ink-muted">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-primary underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
