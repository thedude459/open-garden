import { FormEvent } from "react";
import { CompassPicker } from "../../components/CompassPicker";
import {
  frostPocketOptions,
  slopePositionOptions,
  sunExposureOptions,
  thermalMassOptions,
  windExposureOptions,
} from "../app/constants";
import { MicroclimateFormState, MicroclimateSuggestion } from "../app/types";
import { Garden, GardenClimate } from "../types";

type MicroclimateProfileCardProps = {
  selectedGardenRecord: Garden;
  gardenClimate: GardenClimate | null;
  isLoadingClimate: boolean;
  microclimateDraft: MicroclimateFormState;
  setMicroclimateDraft: (updater: (current: MicroclimateFormState) => MicroclimateFormState) => void;
  microclimateSuggestion: MicroclimateSuggestion | null;
  isGeocodingAddress: boolean;
  isSuggestingMicroclimate: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onGeocode: () => void;
  onSuggest: () => void;
};

export function MicroclimateProfileCard({
  selectedGardenRecord,
  gardenClimate,
  isLoadingClimate,
  microclimateDraft,
  setMicroclimateDraft,
  microclimateSuggestion,
  isGeocodingAddress,
  isSuggestingMicroclimate,
  onSubmit,
  onGeocode,
  onSuggest,
}: MicroclimateProfileCardProps) {
  return (
    <article className="card home-summary">
      <div className="crop-card-row">
        <h3>Climate and Site Profile</h3>
        {gardenClimate && <span className="climate-kpi">{gardenClimate.microclimate_band}</span>}
      </div>
      <p className="subhead">Fine-tune the site profile so planting windows and climate guidance stay accurate for this garden.</p>
      <form className="microclimate-form" onSubmit={onSubmit}>
        <div className="map-reference">
          <div className="map-reference-head">
            <span className="field-label">Satellite Reference</span>
            <div className="map-ref-links">
              <a
                href={`https://maps.google.com/?q=${selectedGardenRecord.latitude},${selectedGardenRecord.longitude}&z=19&t=k`}
                target="_blank"
                rel="noopener noreferrer"
                className="map-ref-link"
              >Google Maps ↗</a>
              <a
                href={`https://earth.google.com/web/@${selectedGardenRecord.latitude},${selectedGardenRecord.longitude},0a,200d,35y,0h,0t,0r`}
                target="_blank"
                rel="noopener noreferrer"
                className="map-ref-link"
              >Google Earth ↗</a>
            </div>
          </div>
          <iframe
            title="Garden location"
            className="garden-location-map"
            loading="lazy"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedGardenRecord.longitude - 0.002},${selectedGardenRecord.latitude - 0.0014},${selectedGardenRecord.longitude + 0.002},${selectedGardenRecord.latitude + 0.0014}&layer=mapnik&marker=${selectedGardenRecord.latitude},${selectedGardenRecord.longitude}`}
          />
          <p className="field-hint">Open satellite imagery to see your yard's orientation, tree canopy, nearby structures, and slope — then fill in the profile below.</p>
        </div>

        <div className="microclimate-grid">
          <div className="stack compact">
            <span className="field-label">Orientation</span>
            <CompassPicker
              value={microclimateDraft.orientation}
              onChange={(v) => setMicroclimateDraft((c) => ({ ...c, orientation: v as MicroclimateFormState["orientation"] }))}
            />
            {microclimateSuggestion ? (
              <p className="field-hint suggestion-note needs-input">⚠ {microclimateSuggestion.orientation.note}</p>
            ) : (
              <p className="field-hint">Which direction your garden faces — south-facing gets the most sun.</p>
            )}
          </div>
          <div className="stack compact">
            <label className="field-label" htmlFor="garden-sun-exposure">Sun Exposure</label>
            <select
              id="garden-sun-exposure"
              value={microclimateDraft.sun_exposure}
              onChange={(e) => setMicroclimateDraft((c) => ({ ...c, sun_exposure: e.target.value as MicroclimateFormState["sun_exposure"] }))}
            >
              {sunExposureOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {microclimateSuggestion?.sun_exposure.value ? (
              <p className="field-hint suggestion-note auto-set">✓ {microclimateSuggestion.sun_exposure.note}</p>
            ) : (
              <p className="field-hint">Full sun = 6+ hrs/day; Part sun = 4–6 hrs; Part shade = 2–4 hrs; Full shade = &lt;2 hrs.</p>
            )}
          </div>
          <div className="stack compact">
            <label className="field-label" htmlFor="garden-wind-exposure">Wind Exposure</label>
            <select
              id="garden-wind-exposure"
              value={microclimateDraft.wind_exposure}
              onChange={(e) => setMicroclimateDraft((c) => ({ ...c, wind_exposure: e.target.value as MicroclimateFormState["wind_exposure"] }))}
            >
              {windExposureOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {microclimateSuggestion?.wind_exposure.value ? (
              <p className="field-hint suggestion-note auto-set">✓ {microclimateSuggestion.wind_exposure.note}</p>
            ) : (
              <p className="field-hint">Sheltered = hedges or fences block wind; Exposed = open hillside or roof.</p>
            )}
          </div>
          <div className="stack compact">
            <label className="field-label" htmlFor="garden-thermal-mass">Thermal Mass</label>
            <select
              id="garden-thermal-mass"
              value={microclimateDraft.thermal_mass}
              onChange={(e) => setMicroclimateDraft((c) => ({ ...c, thermal_mass: e.target.value as MicroclimateFormState["thermal_mass"] }))}
            >
              {thermalMassOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {microclimateSuggestion ? (
              <p className="field-hint suggestion-note needs-input">⚠ {microclimateSuggestion.thermal_mass.note}</p>
            ) : (
              <p className="field-hint">Nearby stone, brick, or pavement absorbs daytime heat and buffers overnight frosts.</p>
            )}
          </div>
          <div className="stack compact">
            <label className="field-label" htmlFor="garden-slope-position">Slope Position</label>
            <select
              id="garden-slope-position"
              value={microclimateDraft.slope_position}
              onChange={(e) => setMicroclimateDraft((c) => ({ ...c, slope_position: e.target.value as MicroclimateFormState["slope_position"] }))}
            >
              {slopePositionOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {microclimateSuggestion?.slope_position.value ? (
              <p className="field-hint suggestion-note auto-set">✓ {microclimateSuggestion.slope_position.note}</p>
            ) : microclimateSuggestion ? (
              <p className="field-hint suggestion-note needs-input">⚠ {microclimateSuggestion.slope_position.note}</p>
            ) : (
              <p className="field-hint">Low spots collect cold air; high ground sheds cold air and drains faster.</p>
            )}
          </div>
          <div className="stack compact">
            <label className="field-label" htmlFor="garden-frost-pocket-risk">Frost Pocket Risk</label>
            <select
              id="garden-frost-pocket-risk"
              value={microclimateDraft.frost_pocket_risk}
              onChange={(e) => setMicroclimateDraft((c) => ({ ...c, frost_pocket_risk: e.target.value as MicroclimateFormState["frost_pocket_risk"] }))}
            >
              {frostPocketOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {microclimateSuggestion?.frost_pocket_risk.value ? (
              <p className="field-hint suggestion-note auto-set">✓ {microclimateSuggestion.frost_pocket_risk.note}</p>
            ) : microclimateSuggestion ? (
              <p className="field-hint suggestion-note needs-input">⚠ {microclimateSuggestion.frost_pocket_risk.note}</p>
            ) : (
              <p className="field-hint">Bottoms of slopes near walls trap cold air — high risk means later last frosts.</p>
            )}
          </div>
        </div>

        <div className="stack compact">
          <label className="field-label" htmlFor="climate-address-private">Private Address</label>
          <input
            id="climate-address-private"
            type="text"
            value={microclimateDraft.address_private}
            onChange={(e) => setMicroclimateDraft((c) => ({ ...c, address_private: e.target.value }))}
            placeholder="Street address (optional, never public)"
          />
          <p className="field-hint">Used only to improve weather precision. Never shared publicly.</p>
        </div>

        <div className="stack compact">
          <label className="field-label" htmlFor="garden-edge-buffer">Bed Edge Buffer (inches)</label>
          <input
            id="garden-edge-buffer"
            type="number"
            min="0"
            max="24"
            step="1"
            value={microclimateDraft.edge_buffer_in}
            onChange={(e) => setMicroclimateDraft((c) => ({ ...c, edge_buffer_in: Number(e.target.value) }))}
          />
          <p className="field-hint">Minimum clearance from bed edges. Default is 6 inches to allow maintenance access.</p>
        </div>

        {isLoadingClimate && <p className="hint">Refreshing climate guidance...</p>}
        {gardenClimate && (
          <div className="climate-metrics">
            <div className="planner-stat">
              <strong>{gardenClimate.adjusted_last_spring_frost}</strong>
              <span>Adjusted last spring frost</span>
            </div>
            <div className="planner-stat">
              <strong>{gardenClimate.adjusted_first_fall_frost}</strong>
              <span>Adjusted first fall frost</span>
            </div>
            <div className="planner-stat">
              <strong>{gardenClimate.soil_temperature_estimate_f}F</strong>
              <span>Estimated soil temperature</span>
            </div>
          </div>
        )}

        <div className="microclimate-actions">
          <button type="submit">Save climate profile</button>
          {selectedGardenRecord.latitude && (
            <button
              type="button"
              className="secondary-btn suggest-btn"
              disabled={isSuggestingMicroclimate}
              onClick={onSuggest}
              title="Analyse your location's sunshine, wind, and terrain to auto-fill detectable fields"
            >
              {isSuggestingMicroclimate ? "Analysing location…" : "✦ Suggest from location"}
            </button>
          )}
          {microclimateDraft.address_private.trim() && (
            <button
              type="button"
              className="secondary-btn"
              disabled={isGeocodingAddress}
              onClick={onGeocode}
              title="Use your address to get a more precise weather location than the ZIP code centroid"
            >
              {isGeocodingAddress ? "Refining location…" : "Refine location from address"}
            </button>
          )}
        </div>
      </form>
    </article>
  );
}
