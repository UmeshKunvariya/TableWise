"use client";

import { useActionState } from "react";

import { signIn, type AuthFormState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

const INITIAL: AuthFormState = {};

export function LoginForm() {
  const [state, formAction] = useActionState(signIn, INITIAL);

  return (
    <Card>
      <form action={formAction} className="flex flex-col gap-4">
        {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={state.fieldErrors?.email?.[0]}
        />
        <Input
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={state.fieldErrors?.password?.[0]}
        />
        <SubmitButton size="lg" pendingLabel="Signing in…">
          Sign in
        </SubmitButton>
      </form>
    </Card>
  );
}
