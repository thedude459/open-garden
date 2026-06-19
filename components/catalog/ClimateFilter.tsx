"use client";

import { FormEvent, useState } from "react";

interface ClimateFilterProps {
  onSave: (cityOrPostal: string) => Promise<void>;
}

export function ClimateFilter({ onSave }: ClimateFilterProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("97201");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await onSave(value);
    setOpen(false);
  }

  if (!open) {
    return (
      <button className="btn secondary" type="button" onClick={() => setOpen(true)}>
        Set location
      </button>
    );
  }

  return (
    <form className="card row" onSubmit={onSubmit}>
      <input
        className="input"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="City or postal code"
      />
      <button className="btn" type="submit">
        Save location
      </button>
    </form>
  );
}
