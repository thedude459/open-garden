"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: String(form.get("email")),
      password: String(form.get("password")),
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      return;
    }

    const callback = searchParams.get("callbackUrl") ?? "/plants";
    router.push(callback);
    router.refresh();
  }

  return (
    <form className="stack card" onSubmit={onSubmit}>
      <h1>Sign in</h1>
      <label className="stack">
        Email
        <input className="input" name="email" type="email" required />
      </label>
      <label className="stack">
        Password
        <input className="input" name="password" type="password" required />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button className="btn" type="submit">
        Sign in
      </button>
      <p className="field-label">
        No account?{" "}
        <Link href="/register">Create one</Link>
      </p>
    </form>
  );
}
