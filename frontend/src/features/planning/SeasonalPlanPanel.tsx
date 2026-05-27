import { useCallback, useState } from "react";
import {
  ListChecks,
  RefreshCw,
  Sparkles,
  Thermometer,
  Snowflake,
  Sprout,
  Repeat,
  Users,
  TrendingUp,
  MapPin,
} from "lucide-react";
import { useSeasonalPlanContext } from "./SeasonalPlanContext";
import { SeasonalNextPlantingsSection } from "./SeasonalNextPlantingsSection";
import { SeasonalSuggestionKindChips } from "./SeasonalSuggestionKindChips";
import {
  ALL_PLANT_KINDS,
  type PlantKind,
  readStoredSuggestionKinds,
} from "./suggestionKindsStorage";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/SectionHeader";

export function SeasonalPlanPanel() {
  const {
    selectedGardenName,
    selectedGardenId,
    seasonalPlan,
    isLoadingSeasonalPlan,
    selectedRecommendationPlantingId,
    plantingRecommendation,
    isLoadingPlantingRecommendation,
    setSelectedRecommendationPlantingId,
    refreshSeasonalPlan,
    applySeasonalSuggestionKinds,
    pushNotice,
  } = useSeasonalPlanContext();

  const [suggestionKinds, setSuggestionKinds] = useState<PlantKind[]>(() => [...ALL_PLANT_KINDS]);
  const [trackedGardenId, setTrackedGardenId] = useState(selectedGardenId);

  if (selectedGardenId !== trackedGardenId) {
    setTrackedGardenId(selectedGardenId);
    setSuggestionKinds(
      selectedGardenId == null ? [...ALL_PLANT_KINDS] : readStoredSuggestionKinds(selectedGardenId),
    );
  }

  const handleToggleSuggestionKind = useCallback(
    async (kind: PlantKind) => {
      if (selectedGardenId == null) {
        return;
      }
      const next = suggestionKinds.includes(kind)
        ? suggestionKinds.filter((k) => k !== kind)
        : [...suggestionKinds, kind].sort();
      if (next.length === 0) {
        pushNotice("Select at least one category for suggestions.", "error");
        return;
      }
      setSuggestionKinds(next);
      await applySeasonalSuggestionKinds(next);
    },
    [applySeasonalSuggestionKinds, pushNotice, selectedGardenId, suggestionKinds],
  );

  return (
    <article className="card">
      <SectionHeader
        icon={ListChecks}
        title={`Seasonal Plan ${selectedGardenName ? `- ${selectedGardenName}` : ""}`}
        subtitle="Succession, rotation, companion, and growth-stage intelligence for your current conditions."
        actions={
          <button
            type="button"
            className="secondary-btn"
            onClick={() => refreshSeasonalPlan().catch(() => undefined)}
          >
            <RefreshCw className="inline-block h-3.5 w-3.5 mr-1.5 align-[-1px]" aria-hidden />
            Refresh Plan
          </button>
        }
      />

      {selectedGardenId != null && (
        <div className="mt-4">
          <SeasonalSuggestionKindChips
            selected={suggestionKinds}
            disabled={isLoadingSeasonalPlan}
            onToggle={handleToggleSuggestionKind}
          />
        </div>
      )}

      {isLoadingSeasonalPlan && <p className="hint">Building seasonal plan...</p>}
      {!isLoadingSeasonalPlan && !seasonalPlan && <p className="hint">No seasonal plan data yet.</p>}

      {seasonalPlan && (
        <div className="space-y-6 mt-4">
          <details className="card">
            <summary className="cursor-pointer font-semibold text-sm">
              Why this seasonal snapshot updates as conditions change
            </summary>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <p>
                Rotation and companion rows react to <strong>current plantings</strong>, crop families already occupying each bed,
                and catalog companion hints for overlapping crops.
              </p>
              <p>
                Signals blend your saved microclimate profile with runtime estimates such as soil temperature pace,
                frost language from the next ten forecast days, and live planting counts for growth-stage summaries.
              </p>
              <p className="text-xs italic">
                Zone label {seasonalPlan.zone} · Microclimate band {seasonalPlan.microclimate_band} · Generated {seasonalPlan.generated_on}
              </p>
            </div>
          </details>

          <section className="card">
            <SectionHeader
              variant="section"
              headingLevel="h3"
              icon={Sparkles}
              title="Current Signals"
            />
            <div className="signal-tiles">
              <div className="signal-tile signal-tile--microclimate">
                <span className="signal-tile__icon" aria-hidden><MapPin /></span>
                <div className="signal-tile__value">{seasonalPlan.microclimate_band}</div>
                <div className="signal-tile__label">Microclimate</div>
              </div>
              <div className="signal-tile signal-tile--soil">
                <span className="signal-tile__icon" aria-hidden><Thermometer /></span>
                <div className="signal-tile__value">{seasonalPlan.soil_temperature_estimate_f}&deg;F</div>
                <div className="signal-tile__label">Est. soil temperature</div>
              </div>
              <div className="signal-tile signal-tile--frost">
                <span className="signal-tile__icon" aria-hidden><Snowflake /></span>
                <div className="signal-tile__value">{seasonalPlan.frost_risk_next_10_days}</div>
                <div className="signal-tile__label">10-day frost risk</div>
              </div>
              <div className="signal-tile signal-tile--plantings">
                <span className="signal-tile__icon" aria-hidden><Sprout /></span>
                <div className="signal-tile__value">{seasonalPlan.growth_stages.length}</div>
                <div className="signal-tile__label">Total plantings</div>
              </div>
            </div>
          </section>

          <SeasonalNextPlantingsSection
            recommendedNextPlantings={seasonalPlan.recommended_next_plantings}
          />

          <section className="card">
            <SectionHeader
              variant="section"
              headingLevel="h3"
              icon={TrendingUp}
              title="Growth Stage Tracking"
              subtitle="Track each planting's progress and pull up tailored recommendations."
            />
            <ul>
              {seasonalPlan.growth_stages.length === 0 && <li className="hint">No plantings found for this garden yet.</li>}
              {seasonalPlan.growth_stages.map((stage) => (
                <li key={stage.planting_id} className="flex items-start justify-between py-3 border-b last:border-b-0">
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

          <section className="card">
            <SectionHeader
              variant="section"
              headingLevel="h3"
              icon={Repeat}
              title="Crop Rotation Guidance"
              subtitle="What to plant next in each bed to avoid repeating a family."
            />
            <ul>
              {seasonalPlan.rotation_recommendations.length === 0 && <li className="hint">No rotation guidance yet. Add plantings to start rotation planning.</li>}
              {seasonalPlan.rotation_recommendations.map((item) => (
                <li key={item.bed_id} className="py-3 border-b last:border-b-0">
                  <strong>Bed {item.bed_id}: rotate after {item.last_crop}</strong>
                  <p className="hint">Avoid family {item.avoid_family || "unknown"}. Suggested families: {item.recommended_families.join(", ") || "none"}.</p>
                  {item.reason ? (
                    <details className="mt-2 text-xs text-muted-foreground">
                      <summary className="cursor-pointer font-semibold text-[color:inherit]">Why</summary>
                      <p className="mt-1 pl-1">{item.reason}</p>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <SectionHeader
              variant="section"
              headingLevel="h3"
              icon={Users}
              title="Companion Insights"
              subtitle="Which crops pair well (or poorly) in each of your beds right now."
            />
            <ul>
              {seasonalPlan.companion_insights.length === 0 && <li className="hint">No companion pairings detected yet.</li>}
              {seasonalPlan.companion_insights.map((item, index) => (
                <li key={`${item.bed_id}-${item.crop}-${index}`} className="py-3 border-b last:border-b-0">
                  <strong>Bed {item.bed_id}: {item.crop}</strong>
                  <p className="hint">Good with: {item.good_matches.join(", ") || "none"}</p>
                  <p className="hint">Watch with: {item.risk_matches.join(", ") || "none"}</p>
                  {item.reason ? (
                    <details className="mt-2 text-xs text-muted-foreground">
                      <summary className="cursor-pointer font-semibold text-[color:inherit]">Why</summary>
                      <p className="mt-1 pl-1">{item.reason}</p>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <SectionHeader
              variant="section"
              headingLevel="h3"
              icon={Sparkles}
              title="Selected Planting Recommendations"
            />
            {!selectedRecommendationPlantingId && <p className="hint">Select a planting from Growth Stage Tracking to view targeted recommendations.</p>}
            {isLoadingPlantingRecommendation && <p className="hint">Loading planting recommendations...</p>}
            {plantingRecommendation && (
              <div className="stack compact">
                <p><strong>{plantingRecommendation.crop_name}</strong> · Stage {plantingRecommendation.stage.replace("_", " ")} ({plantingRecommendation.progress_pct}%)</p>
                <p className="hint">Expected harvest {plantingRecommendation.expected_harvest_on}</p>
                <p className="hint">Companion positives: {plantingRecommendation.companion.good_matches.join(", ") || "none"}</p>
                <p className="hint">Companion risks: {plantingRecommendation.companion.risk_matches.join(", ") || "none"}</p>
                <p className="hint">
                  Ideas to add near this crop: {(plantingRecommendation.companion.suggested_additions ?? []).join(", ") || "none"}
                </p>
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
                    <li key={`${candidate.crop_name}-${index}`} className="py-3 border-b last:border-b-0">
                      <div className="crop-card-row">
                        <strong>{candidate.crop_name}</strong>
                        <Badge variant="outline">{candidate.status}</Badge>
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
