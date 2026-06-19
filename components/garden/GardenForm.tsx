"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { MeasurementUnit } from "@/lib/garden/enums";

export function GardenForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name")),
      length: Number(form.get("length")),
      width: Number(form.get("width")),
      unit: String(form.get("unit")) as MeasurementUnit,
      description: String(form.get("description") || "") || undefined,
    };

    const response = await fetch("/api/gardens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Failed to create garden");
      return;
    }

    const garden = await response.json();
    router.push(`/gardens/${garden.id}`);
    router.refresh();
  }

  return (
    <form className="stack card" onSubmit={onSubmit}>
      <h1>Create garden</h1>
      <label className="stack">
        Name
        <input className="input" name="name" required maxLength={128} />
      </label>
      <div className="row">
        <label className="stack">
          Length
          <input className="input" name="length" type="number" min="0.01" step="0.01" required />
        </label>
        <label className="stack">
          Width
          <input className="input" name="width" type="number" min="0.01" step="0.01" required />
        </label>
        <label className="stack">
          Unit
          <select className="input" name="unit" defaultValue="feet">
            <option value="feet">Feet</option>
            <option value="meters">Meters</option>
          </select>
        </label>
      </div>
      <label className="stack">
        Description (optional)
        <textarea className="input" name="description" rows={3} />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button className="btn" type="submit" disabled={submitting}>
        {submitting ? "Creating…" : "Create garden"}
      </button>
    </form>
  );
}
