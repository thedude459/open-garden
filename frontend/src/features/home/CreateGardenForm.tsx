import { FormEvent } from "react";

type GardenDraft = {
  name: string;
  description: string;
  zip_code: string;
  yard_width_ft: number;
  yard_length_ft: number;
  address_private: string;
  is_shared: boolean;
};

type GardenFormErrors = {
  name?: string;
  zip_code?: string;
  yard_width_ft?: string;
  yard_length_ft?: string;
};

type CreateGardenFormProps = {
  gardenDraft: GardenDraft;
  setGardenDraft: (updater: (current: GardenDraft) => GardenDraft) => void;
  showGardenValidation: boolean;
  gardenFormErrors: GardenFormErrors;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
};

export function CreateGardenForm({
  gardenDraft,
  setGardenDraft,
  showGardenValidation,
  gardenFormErrors,
  onSubmit,
}: CreateGardenFormProps) {
  return (
    <article className="card home-create-card">
      <h3>Create Garden</h3>
      <form onSubmit={onSubmit} className="stack">
        <div className="stack compact">
          <label className="field-label" htmlFor="garden-name">Garden Name</label>
          <input
            id="garden-name"
            name="name"
            value={gardenDraft.name}
            onChange={(e) => setGardenDraft((c) => ({ ...c, name: e.target.value }))}
            placeholder="Garden name"
            aria-invalid={Boolean(showGardenValidation && gardenFormErrors.name)}
            aria-describedby={showGardenValidation && gardenFormErrors.name ? "garden-name-error" : undefined}
            required
          />
          {showGardenValidation && gardenFormErrors.name && <p id="garden-name-error" className="field-error">{gardenFormErrors.name}</p>}
        </div>
        <div className="stack compact">
          <label className="field-label" htmlFor="garden-description">Description</label>
          <input id="garden-description" name="description" value={gardenDraft.description} onChange={(e) => setGardenDraft((c) => ({ ...c, description: e.target.value }))} placeholder="Description" />
        </div>
        <div className="stack compact">
          <label className="field-label" htmlFor="garden-zip-code">ZIP Code</label>
          <input
            id="garden-zip-code"
            name="zip_code"
            value={gardenDraft.zip_code}
            onChange={(e) => setGardenDraft((c) => ({ ...c, zip_code: e.target.value }))}
            inputMode="numeric"
            pattern="[0-9]{5}"
            maxLength={5}
            placeholder="ZIP code (US)"
            aria-invalid={Boolean(showGardenValidation && gardenFormErrors.zip_code)}
            aria-describedby={showGardenValidation && gardenFormErrors.zip_code ? "garden-zip-error" : "garden-zip-hint"}
            required
          />
          {showGardenValidation && gardenFormErrors.zip_code
            ? <p id="garden-zip-error" className="field-error">{gardenFormErrors.zip_code}</p>
            : <p id="garden-zip-hint" className="field-hint">Used to calculate zone, weather, and planting guidance.</p>
          }
        </div>
        <div className="mini-row">
          <div className="stack compact">
            <label className="field-label" htmlFor="garden-yard-width">Yard Width (ft)</label>
            <input
              id="garden-yard-width"
              name="yard_width_ft"
              type="number"
              min="4"
              value={gardenDraft.yard_width_ft}
              onChange={(e) => setGardenDraft((c) => ({ ...c, yard_width_ft: Number(e.target.value) }))}
              aria-invalid={Boolean(showGardenValidation && gardenFormErrors.yard_width_ft)}
              aria-describedby={showGardenValidation && gardenFormErrors.yard_width_ft ? "garden-yard-width-error" : undefined}
              required
            />
            {showGardenValidation && gardenFormErrors.yard_width_ft && <p id="garden-yard-width-error" className="field-error">{gardenFormErrors.yard_width_ft}</p>}
          </div>
          <div className="stack compact">
            <label className="field-label" htmlFor="garden-yard-length">Yard Length (ft)</label>
            <input
              id="garden-yard-length"
              name="yard_length_ft"
              type="number"
              min="4"
              value={gardenDraft.yard_length_ft}
              onChange={(e) => setGardenDraft((c) => ({ ...c, yard_length_ft: Number(e.target.value) }))}
              aria-invalid={Boolean(showGardenValidation && gardenFormErrors.yard_length_ft)}
              aria-describedby={showGardenValidation && gardenFormErrors.yard_length_ft ? "garden-yard-length-error" : undefined}
              required
            />
            {showGardenValidation && gardenFormErrors.yard_length_ft && <p id="garden-yard-length-error" className="field-error">{gardenFormErrors.yard_length_ft}</p>}
          </div>
        </div>
        <div className="stack compact">
          <label className="field-label" htmlFor="garden-private-address">Private Address</label>
          <input
            id="garden-private-address"
            name="address_private"
            value={gardenDraft.address_private}
            onChange={(e) => setGardenDraft((c) => ({ ...c, address_private: e.target.value }))}
            placeholder="Street address (optional, never public)"
          />
          <p className="field-hint">Optional. Enter a full street address to enable precise weather location later.</p>
        </div>
        <label className="inline">
          <input
            type="checkbox"
            name="is_shared"
            checked={gardenDraft.is_shared}
            onChange={(e) => setGardenDraft((c) => ({ ...c, is_shared: e.target.checked }))}
          />
          Share publicly
        </label>
        <button type="submit">Create garden</button>
      </form>
    </article>
  );
}
