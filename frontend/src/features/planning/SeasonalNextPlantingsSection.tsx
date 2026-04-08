import { useMemo, useState } from "react";
import { NextPlanting } from "../types";
import { Badge } from "@/components/ui/badge";

type VegetableGroup = { baseName: string; varieties: NextPlanting[] };

interface SeasonalNextPlantingsSectionProps {
  recommendedNextPlantings: NextPlanting[];
  maxFeaturedPerCategory?: number;
}

function baseVegetableName(cropName: string): string {
  const name = cropName.trim();
  const parenIdx = name.indexOf(" (");
  return parenIdx !== -1 ? name.slice(0, parenIdx).trim() : name;
}

function isDateWithinInclusiveRange(value: string, start: string, end: string): boolean {
  const valueTime = Date.parse(value);
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  if (Number.isNaN(valueTime) || Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return false;
  }
  return valueTime >= startTime && valueTime <= endTime;
}

function isDirectToGround(item: NextPlanting): boolean {
  return item.method === "direct_sow" || (item.method === "transplant" && !item.indoor_seed_start && !item.indoor_seed_end);
}

function isSeedStartNow(item: NextPlanting, todayIso: string): boolean {
  return (
    item.method === "transplant"
    && !!item.indoor_seed_start
    && !!item.indoor_seed_end
    && isDateWithinInclusiveRange(todayIso, item.indoor_seed_start, item.indoor_seed_end)
  );
}

export function SeasonalNextPlantingsSection({
  recommendedNextPlantings,
  maxFeaturedPerCategory = 5,
}: SeasonalNextPlantingsSectionProps) {
  const [selectedVarietyIdx, setSelectedVarietyIdx] = useState<Record<string, number>>({});
  const todayIso = new Date().toISOString().slice(0, 10);

  const nextPlantingGroups = useMemo<VegetableGroup[]>(() => {
    const groups = new Map<string, NextPlanting[]>();
    for (const item of recommendedNextPlantings) {
      const base = baseVegetableName(item.crop_name);
      if (!groups.has(base)) groups.set(base, []);
      groups.get(base)!.push(item);
    }
    return Array.from(groups.entries()).map(([baseName, varieties]) => ({ baseName, varieties }));
  }, [recommendedNextPlantings]);

  const directToGroundCandidateGroups = useMemo(
    () => nextPlantingGroups.filter(({ varieties }) => varieties.some((item) => (
      isDirectToGround(item) && (item.status === "open" || item.status === "watch")
    ))),
    [nextPlantingGroups],
  );

  const seedStartCandidateGroups = useMemo(
    () => nextPlantingGroups.filter(({ varieties }) => varieties.some((item) => isSeedStartNow(item, todayIso))),
    [nextPlantingGroups, todayIso],
  );

  const directToGroundNowGroups = useMemo(
    () => directToGroundCandidateGroups.slice(0, maxFeaturedPerCategory),
    [directToGroundCandidateGroups, maxFeaturedPerCategory],
  );

  const seedStartNowGroups = useMemo(
    () => seedStartCandidateGroups.slice(0, maxFeaturedPerCategory),
    [seedStartCandidateGroups, maxFeaturedPerCategory],
  );

  const featuredBaseNames = useMemo(
    () => new Set([...directToGroundNowGroups, ...seedStartNowGroups].map((group) => group.baseName)),
    [directToGroundNowGroups, seedStartNowGroups],
  );

  const additionalSuggestionGroups = useMemo(
    () => nextPlantingGroups.filter(({ baseName }) => !featuredBaseNames.has(baseName)),
    [featuredBaseNames, nextPlantingGroups],
  );

  const hasCategorySuggestions =
    directToGroundNowGroups.length > 0 ||
    seedStartNowGroups.length > 0 ||
    additionalSuggestionGroups.length > 0;

  function renderGroup(baseName: string, varieties: NextPlanting[]) {
    const idx = selectedVarietyIdx[baseName] ?? 0;
    const item = varieties[idx] ?? varieties[0];

    return (
      <li key={baseName} className="py-3 border-b last:border-b-0">
        <div className="crop-card-row">
          <strong>{baseName}</strong>
          <Badge variant="outline">{item.status}</Badge>
        </div>
        {varieties.length > 1 && (
          <select
            value={idx}
            onChange={(e) => setSelectedVarietyIdx((prev) => ({ ...prev, [baseName]: Number(e.target.value) }))}
          >
            {varieties.map((v, i) => (
              <option key={i} value={i}>{v.variety || v.crop_name}</option>
            ))}
          </select>
        )}
        {item.method === "direct_sow" ? (
          <p className="hint">Direct sow outdoors: {item.window_start} - {item.window_end}</p>
        ) : !item.indoor_seed_start && !item.indoor_seed_end ? (
          <p className="hint">Plant directly outdoors (crowns/starts): {item.window_start} - {item.window_end}</p>
        ) : (
          <>
            {item.indoor_seed_start && (
              <p className="hint">Start indoors: {item.indoor_seed_start} - {item.indoor_seed_end ?? "?"}</p>
            )}
            <p className="hint">Transplant outdoors: {item.window_start} - {item.window_end}</p>
          </>
        )}
        <p className="hint">Family {item.family} · Priority {item.priority}</p>
        <p className="hint">{item.reason}</p>
      </li>
    );
  }

  return (
    <section className="card seasonal-next-plantings">
      <h3>Recommended Next Plantings</h3>
      {!hasCategorySuggestions && <p className="hint">No immediate next plantings suggested yet.</p>}
      {hasCategorySuggestions && (
        <p className="hint">
          Showing top {maxFeaturedPerCategory} immediate options per category, plus {additionalSuggestionGroups.length} more suggestions in Up Next.
        </p>
      )}

      {directToGroundNowGroups.length > 0 && (
        <>
          <h4>Plant Outdoors Now ({directToGroundNowGroups.length}{directToGroundCandidateGroups.length > directToGroundNowGroups.length ? ` of ${directToGroundCandidateGroups.length}` : ""})</h4>
          <ul>
            {directToGroundNowGroups.map(({ baseName, varieties }) => renderGroup(baseName, varieties))}
          </ul>
        </>
      )}

      {seedStartNowGroups.length > 0 && (
        <>
          <h4>Start Seeds Now for Post-Frost Transplant ({seedStartNowGroups.length}{seedStartCandidateGroups.length > seedStartNowGroups.length ? ` of ${seedStartCandidateGroups.length}` : ""})</h4>
          <ul>
            {seedStartNowGroups.map(({ baseName, varieties }) => renderGroup(baseName, varieties))}
          </ul>
        </>
      )}

      {additionalSuggestionGroups.length > 0 && (
        <>
          <h4>Up Next</h4>
          <ul>
            {additionalSuggestionGroups.map(({ baseName, varieties }) => renderGroup(baseName, varieties))}
          </ul>
        </>
      )}
    </section>
  );
}
