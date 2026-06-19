"use client";

import { useEffect, useState } from "react";
import { PlantSearch } from "@/components/catalog/PlantSearch";
import { PlantCard } from "@/components/catalog/PlantCard";
import { ClimateFilter } from "@/components/catalog/ClimateFilter";
import { ProvisionalPlantForm } from "@/components/catalog/ProvisionalPlantForm";
import { ProvisionalLinkOffer } from "@/components/catalog/ProvisionalLinkOffer";
import type { PlantSummary } from "@/lib/catalog/types";

export default function PlantsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [climateFilter, setClimateFilter] = useState(false);
  const [results, setResults] = useState<PlantSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [showProvisional, setShowProvisional] = useState(false);
  const [linkOffers, setLinkOffers] = useState<Array<{ id: string; commonName: string }>>([]);

  async function runSearch() {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    if (climateFilter) params.set("climate_filter", "true");

    const response = await fetch(`/api/plants/search?${params.toString()}`);
    if (!response.ok) {
      if (response.status === 422 && climateFilter) {
        alert("Set your location before enabling climate filter.");
      }
      setResults([]);
      setTotal(0);
      setShowProvisional(Boolean(query));
      return;
    }

    const data = await response.json();
    setResults(data.results ?? []);
    setTotal(data.total ?? 0);
    setShowProvisional((data.total ?? 0) === 0 && Boolean(query));
  }

  async function saveLocation(cityOrPostal: string) {
    await fetch("/api/users/me/location", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city_or_postal: cityOrPostal }),
    });
    if (climateFilter) {
      await runSearch();
    }
  }

  async function createProvisional(payload: {
    common_name: string;
    plant_category: string;
    spacing_cm: { row: number; plant: number };
    days_to_maturity: number;
  }) {
    await fetch("/api/users/me/provisionals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setShowProvisional(false);
    setQuery(payload.common_name);
    await runSearch();
  }

  useEffect(() => {
    void runSearch();
  }, []);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/users/me/provisionals");
      if (!response.ok) return;
      const data = await response.json();
      const offers = (data.provisionals ?? [])
        .filter((item: { linkStatus: string }) => item.linkStatus === "link_offered")
        .map((item: { id: string; commonName: string }) => ({
          id: item.id,
          commonName: item.commonName,
        }));
      setLinkOffers(offers);
    })();
  }, []);

  return (
    <main className="stack">
      <h1>Plant catalog</h1>
      <div className="row">
        <ClimateFilter onSave={saveLocation} />
      </div>
      <PlantSearch
        query={query}
        category={category}
        climateFilter={climateFilter}
        onQueryChange={setQuery}
        onCategoryChange={setCategory}
        onClimateFilterChange={setClimateFilter}
        onSearch={runSearch}
      />
      <p className="field-label">{total} results</p>
      <div className="grid">
        {results.map((plant) => (
          <PlantCard key={plant.id} plant={plant} />
        ))}
      </div>
      {showProvisional ? (
        <ProvisionalPlantForm defaultName={query} onCreate={createProvisional} />
      ) : null}
      <ProvisionalLinkOffer
        offers={linkOffers}
        canonicalPlantId={results[0]?.id ?? ""}
        onConfirm={async (provisionalId, canonicalPlantId) => {
          await fetch(`/api/users/me/provisionals/${provisionalId}/link`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ canonical_plant_id: canonicalPlantId, confirm: true }),
          });
          await runSearch();
        }}
      />
    </main>
  );
}
