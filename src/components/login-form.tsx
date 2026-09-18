"use client";

import { useActionState } from "react";

import { signInAction } from "@/lib/actions/auth";
import type { FormState } from "@/lib/actions/shared";

import { Field, FormError, Input, SubmitButton } from "./form";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<FormState, FormData>(signInAction, {});

  return (
    <form action={formAction} className="card w-full space-y-4 p-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <FormError message={state.error} />

      <Field label="Passphrase" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
        />
      </Field>

      <SubmitButton pendingLabel="Checking…" className="w-full">
        Sign in
      </SubmitButton>
    </form>
  );
}
