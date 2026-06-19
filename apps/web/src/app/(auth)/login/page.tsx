'use client';
import { useActionState } from 'react';
import { loginAction } from './actions';
import { Button } from '@/ui/Button';

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-cr-md px-cr-md">
      <h1 className="text-3xl font-extrabold text-cr-text">Sign in</h1>
      <form action={action} className="flex flex-col gap-cr-sm">
        <input
          name="email"
          type="email"
          placeholder="Email"
          className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          className="rounded-cr-input border border-cr-border bg-cr-surface px-cr-md py-cr-sm"
        />
        {state?.error && (
          <p className="text-cr-danger text-xs font-semibold">Invalid credentials</p>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </main>
  );
}
