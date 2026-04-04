import { useMemo, useState } from "react";
import { NextPlanting } from "../types";
import { useSeasonalPlanContext } from "./SeasonalPlanContext";

function baseVegetableName(cropName: string): string {
  const name = cropName.trim();
  const parenIdx = name.indexOf(" (");
  return parenIdx !== -1 ? name.slice(0, parenIdx).trim() : name;
}

type VegetableGroup = { baseName: string; varieties: NextPlanting[] };

function isDateWithinInclusiveRange(value: string, start: string, end: string): boolean {
  const valueTime = Date.parse(value);
  const startTime = Date.parse(start);
  const endTime = Date.parse(end);
  if (Number.isNaN(valueTime) || Number.isNaN(startTime) || Number.isNaN(endTime)) {
    return false;
  }
  return valueTime >= startTime && valueTime <= endTime;
}

export function SeasonalPlanPanel() {
  const {
    selectedGardenName,
    seasonalPlan,
    isLoadingSeasonalPlan,
    selectedRecommendationPlantingId,
    plantingRecommendation,
    isLoadingPlantingRecommendation,
    setSelectedRecommendationPlantingId,
    refreshSeasonalPlan,
  } = useSeasonalPlanContext();

  const [selectedVarietyIdx, setSelectedVarietyIdx] = useState<Record<string, number>>({});
  const todayIso = new Date().toISOString().slice(0, 10);
  const MAX_FEATURED_PER_CATEGORY = 5;

  function isDirectToGround(item: NextPlanting): boolean {
    return item.method === "direct_sow" || (item.method === "transplant" && !item.indoor_seed_start && !item.indoor_seed_end);
  }

  function isSeedStartNow(item: NextPlanting): boolean {
    return (
      item.method === "transplant"
      && !!item.indoor_seed_start
      && !!item.indoor_seed_end
      && isDateWithinInclusiveRange(todayIso, item.indoor_seed_start, item.indoor_seed_end)
    );
  }

  const nextPlantingGroups = useMemo<VegetableGroup[]>(() => {
    if (!seasonalPlan) return [];
    const groups = new Map<string, NextPlanting[]>();
    for (const item of seasonalPlan.recommended_next_plantings) {
      const base = baseVegetableName(item.crop_name);
      if (!groups.has(base)) groups.set(base, []);
      groups.get(base)!.push(item);
    }
    return Array.from(groups.entries()).map(([baseName, varieties]) => ({ baseName, varieties }));
  }, [seasonalPlan]);

  const directToGroundCandidateGroups = useMemo(
    () => nextPlantingGroups.filter(({ varieties }) => varieties.some((item) => (
      isDirectToGround(item) && (item.status === "open" || item.status === "watch")
    ))),
    [nextPlantingGroups],
  );

  const seedStartCandidateGroups = useMemo(
    () => nextPlantingGroups.filter(({ varieties }) => varieties.some((item) => isSeedStartNow(item))),
    [nextPlantingGroups],
  );

  const directToGroundNowGroups = useMemo(
    () => directToGroundCandidateGroups.slice(0, MAX_FEATURED_PER_CATEGORY),
    [directToGroundCandidateGroups],
  );

  const seedStartNowGroups = useMemo(
    () => seedStartCandidateGroups.slice(0, MAX_FEATURED_PER_CATEGORY),
    [seedStartCandidateGroups],
  );

  const featuredBaseNames = useMemo(
    () => new Set([...directToGroundNowGroups, ...seedStartNowGroups].map((group) => group.baseName)),
    [directToGroundNowGroups, seedStartNowGroups],
  );

  const additionalSuggestionGroups = useMemo(
    () => nextPlantingGroups.filter(({ baseName }) => !featuredBaseNames.has(baseName)),
    [featuredBaseNames, nextPlantingGroups],
  );

  const hasCategorySuggestions = directToGroundNowGroups.length > 0 || seedStartNowGroups.length > 0 || additionalSuggestionGroups.length > 0;

  function renderGroup(baseName: string, varieties: NextPlanting[]) {
    const idx = selectedVarietyIdx[baseName] ?? 0;
    const item = varieties[idx] ?? varieties[0];

    return (
      <li key={baseName} className="climate-signal">
        <div className="crop-card-row">
          <strong>{baseName}</strong>
          <span className={`status-pill ${item.status}`}>{item.status}</span>
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
          <p className="hint">Direct sow outdoors: {item.window_start} – {item.window_end}</p>
        ) : !item.indoor_seed_start && !item.indoor_seed_end ? (
          <p className="hint">Plant directly outdoors (crowns/starts): {item.window_start} – {item.window_end}</p>
        ) : (
          <>
            {item.indoor_seed_start && (
              <p className="hint">Start indoors: {item.indoor_seed_start} – {item.indoor_seed_end ?? "?"}</p>
            )}
            <p className="hint">Transplant outdoors: {item.window_start} – {item.window_end}</p>
          </>
        )}
        <p className="hint">Family {item.family} · Priority {item.priority}</p>
        <p className="hint">{item.reason}</p>
      </li>
    );
  }

  return (
    <article className="card seasonal-plan-card">
      <div className="crop-card-row">
        <div>
          <h2>Seasonal Plan {selectedGardenName ? `- ${selectedGardenName}` : ""}</h2>
          <p className="subhead">Succession, rotation, companion, and growth-stage intelligence for current conditions.</p>
        </div>
        <button type="button" className="secondary-btn" onClick={() => refreshSeasonalPlan().catch(() => undefined)}>Refresh Plan</button>
      </div>

      {isLoadingSeasonalPlan && <p className="hint">Building seasonal plan...</p>}
      {!isLoadingSeasonalPlan && !seasonalPlan && <p className="hint">No seasonal plan data yet.</p>}

      {seasonalPlan && (
        <div className="seasonal-layout">
          <section className="card seasonal-metrics">
            <h3>Current Signals</h3>
            <div className="home-summary-stats">
              <div className="planner-stat">
                <strong>{seasonalPlan.microclimate_band}</strong>
                <span>Microclimate</span>
              </div>
              <div className="planner-stat">
                <strong>{seasonalPlan.soil_temperature_estimate_f}F</strong>
                <span>Estimated soil temperature</span>
              </div>
              <div className="planner-stat">
                <strong>{seasonalPlan.frost_risk_next_10_days}</strong>
                <span>10-day frost risk</span>
              </div>
              <div className="planner-stat">
                <strong>{seasonalPlan.growth_stages.length}</strong>
                <span>Total plantings</span>
              </div>
            </div>
          </section>

          <section className="card seasonal-next-plantings">
            <h3>Recommended Next Plantings</h3>
            {!hasCategorySuggestions && <p className="hint">No immediate next plantings suggested yet.</p>}
            {hasCategorySuggestions && (
              <p className="hint">
                Showing top {MAX_FEATURED_PER_CATEGORY} immediate options per category, plus {additionalSuggestionGroups.length} more suggestions in Up Next.
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

          <section className="card seasonal-growth-stages">
            <h3>Growth Stage Tracking</h3>
            <ul>
              {seasonalPlan.growth_stages.length === 0 && <li className="hint">No plantings found for this garden yet.</li>}
              {seasonalPlan.growth_stages.map((stage) => (
                <li key={stage.planting_id} className="seasonal-growth-row">
                  <div>
                    <strong>{stage.crop_name}</strong>
                    <p className="hint">Bed {stage.bed_id} · Stage {stage.stage.replace("_", " ")} · {stage.progress_pct}%</p>
                    <p className="hint">Expected harvest {stage.expected_harvest_on}</p>
                  </div>
                  <button type="button" className={selectedRecommendationPlantingId === stage.planting_id ? "active" : "secondary-btn"} onClick={() => setSelectedRecommendationPlantingId(stage.planting_id)}>
                    Recommendations
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="card seasonal-rotation">
            <h3>Crop Rotation Guidance</h3>
            <ul>
              {seasonalPlan.rotation_recommendations.length === 0 && <li className="hint">No rotation guidance yet. Add plantings to start rotation planning.</li>}
              {seasonalPlan.rotation_recommendations.map((item) => (
                <li key={item.bed_id} className="climate-signal">
                  <strong>Bed {item.bed_id}: rotate after {item.last_crop}</strong>
                  <p className="hint">Avoid family {item.avoid_family || "unknown"}. Suggested families: {item.recommended_families.join(", ") || "none"}.</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="card seasonal-companion">
            <h3>Companion Insights</h3>
            <ul>
              {seasonalPlan.companion_insights.length === 0 && <li className="hint">No companion pairings detected yet.</li>}
              {seasonalPlan.companion_insights.map((item, index) => (
                <li key={`${item.bed_id}-${item.crop}-${index}`} className="climate-signal">
                  <strong>Bed {item.bed_id}: {item.crop}</strong>
                  <p className="hint">Good with: {item.good_matches.join(", ") || "none"}</p>
                  <p className="hint">Watch with: {item.risk_matches.join(", ") || "none"}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="card seasonal-planting-recs">
            <h3>Selected Planting Recommendations</h3>
            {!selectedRecommendationPlantingId && <p className="hint">Select a planting from Growth Stage Tracking to view targeted recommendations.</p>}
            {isLoadingPlantingRecommendation && <p className="hint">Loading planting recommendations...</p>}
            {plantingRecommendation && (
              <div className="stack compact">
                <p><strong>{plantingRecommendation.crop_name}</strong> · Stage {plantingRecommendation.stage.replace("_", " ")} ({plantingRecommendation.progress_pct}%)</p>
                <p className="hint">Expected harvest {plantingRecommendation.expected_harvest_on}</p>
                <p className="hint">Companion positives: {plantingRecommendation.companion.good_matches.join(", ") || "none"}</p>
                <p className="hint">Companion risks: {plantingRecommendation.companion.risk_matches.join(", ") || "none"}</p>
                <h4>Next Actions</h4>
                <ul>
                  {plantingRecommendation.next_actions.map((action, index) => (
                    <li key={`${action.title}-${index}`}>
                      <strong>{action.title}</strong>
                      <p className="hint">{action.detail}</p>
                    </li>
                  ))}
                </ul>
                <h4>Succession Candidates</h4>
                <ul>
                  {plantingRecommendation.succession_candidates.length === 0 && <li className="hint">No succession candidates currently available.</li>}
                  {plantingRecommendation.succession_candidates.map((candidate, index) => (
                    <li key={`${candidate.crop_name}-${index}`} className="climate-signal">
                      <div className="crop-card-row">
                        <strong>{candidate.crop_name}</strong>
                        <span className={`status-pill ${candidate.status}`}>{candidate.status}</span>
                      </div>
                      <p className="hint">{candidate.method === "direct_sow" ? "Direct sow" : "Transplant"} {candidate.window_start} to {candidate.window_end}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      )}
    </article>
  );
}
