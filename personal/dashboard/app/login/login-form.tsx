"use client";

import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm({ from }: { from: string }) {
  const [state, action, pending] = useActionState(login, { email: "", sent: false });
  const input = "mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 focus:outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
  return (
    <form action={action} className="w-full max-w-sm space-y-5 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">OTIS</h1>
        <p className="mt-2 text-sm text-zinc-500">{state.sent ? `Enter the code sent to ${state.email}.` : "Sign in to your Open Brain with a code sent to your email."}</p>
      </div>
      <input type="hidden" name="from" value={from} />
      {state.sent ? (
        <>
          <input type="hidden" name="email" value={state.email} />
          <label className="block text-sm">
            Email code
            <input className={input} name="otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus key="code" />
          </label>
        </>
      ) : (
        <label className="block text-sm">
          Email address
          <input className={input} name="email" type="email" autoComplete="email" defaultValue={state.email} required autoFocus key="email" />
        </label>
      )}
      {state.error ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p> : null}
      <button name="step" value={state.sent ? "verify" : "send"} disabled={pending} className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900">
        {pending ? "Please wait…" : state.sent ? "Sign in" : "Send sign-in code"}
      </button>
      {state.sent ? <button name="step" value="send" formNoValidate disabled={pending} className="w-full text-sm text-zinc-500 disabled:opacity-50">Send a new code</button> : null}
    </form>
  );
}
