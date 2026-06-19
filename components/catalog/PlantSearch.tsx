"use client";

import { PLANT_CATEGORIES } from "@/lib/catalog/enums";

interface PlantSearchProps {
  query: string;
  category: string;
  climateFilter: boolean;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onClimateFilterChange: (value: boolean) => void;
  onSearch: () => void;
}

export function PlantSearch({
  query,
  category,
  climateFilter,
  onQueryChange,
  onCategoryChange,
  onClimateFilterChange,
  onSearch,
}: PlantSearchProps) {
  return (
    <div className="card stack">
      <div className="row">
        <input
          className="input"
          placeholder="Search by common or botanical name"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && onSearch()}
        />
        <button className="btn" type="button" onClick={onSearch}>
          Search
        </button>
      </div>
      <div className="row">
        <select
          className="input"
          value={category}
          onChange={(event) => onCategoryChange(event.target.value)}
        >
          <option value="">All categories</option>
          {PLANT_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat.replace("_", " ")}
            </option>
          ))}
        </select>
        <label className="row">
          <input
            type="checkbox"
            checked={climateFilter}
            onChange={(event) => onClimateFilterChange(event.target.checked)}
          />
          Climate filter
        </label>
      </div>
    </div>
  );
}
