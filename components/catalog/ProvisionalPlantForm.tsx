"use client";

import { FormEvent, useState } from "react";
import { PLANT_CATEGORIES } from "@/lib/catalog/enums";

interface ProvisionalPlantFormProps {
  defaultName?: string;
  onCreate: (payload: {
    common_name: string;
    plant_category: string;
    spacing_cm: { row: number; plant: number };
    days_to_maturity: number;
  }) => Promise<void>;
}

export function ProvisionalPlantForm({ defaultName = "", onCreate }: ProvisionalPlantFormProps) {
  const [commonName, setCommonName] = useState(defaultName);
  const [category, setCategory] = useState("vegetable");
  const [days, setDays] = useState(75);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await onCreate({
      common_name: commonName,
      plant_category: category,
      spacing_cm: { row: 90, plant: 45 },
      days_to_maturity: days,
    });
  }

  return (
    <form className="card stack" onSubmit={onSubmit}>
      <h2>Create provisional plant</h2>
      <input
        className="input"
        value={commonName}
        onChange={(event) => setCommonName(event.target.value)}
        placeholder="Common name"
        required
      />
      <select className="input" value={category} onChange={(event) => setCategory(event.target.value)}>
        {PLANT_CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>
      <input
        className="input"
        type="number"
        value={days}
        onChange={(event) => setDays(Number(event.target.value))}
        min={1}
      />
      <button className="btn" type="submit">
        Save provisional plant
      </button>
    </form>
  );
}
