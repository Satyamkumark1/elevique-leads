"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <p role="status" className="mt-6">
        Check your inbox for a sign-in link.
      </p>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block">
        <span className="text-xs text-text-muted">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 block h-10 w-full rounded-md border bg-surface-2 px-3 text-text"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-10 w-full rounded-md bg-accent font-medium text-bg disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send sign-in link"}
      </button>
      {state.status === "not_authorised" && (
        <p role="alert" className="text-error">
          Not authorised. This email is not on the team list.
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="text-error">
          {state.message}
        </p>
      )}
    </form>
  );
}
