"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Registration failed");
      return;
    }

    router.push("/login");
  }

  return (
    <form className="stack card" onSubmit={onSubmit}>
      <h1>Create account</h1>
      <label className="stack">
        Email
        <input className="input" name="email" type="email" required />
      </label>
      <label className="stack">
        Password
        <input className="input" name="password" type="password" minLength={8} required />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button className="btn" type="submit">
        Register
      </button>
      <p className="field-label">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </form>
  );
}
