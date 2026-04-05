import { FormEvent } from "react";

type PlannerYardSizeFormProps = {
  yardWidthDraft: number;
  yardLengthDraft: number;
  yardErrors: { yard_width_ft: string; yard_length_ft: string };
  onYardWidthDraftChange: (value: number) => void;
  onYardLengthDraftChange: (value: number) => void;
  onUpdateYardSize: (e: FormEvent<HTMLFormElement>) => void;
};

export function PlannerYardSizeForm({
  yardWidthDraft,
  yardLengthDraft,
  yardErrors,
  onYardWidthDraftChange,
  onYardLengthDraftChange,
  onUpdateYardSize,
}: PlannerYardSizeFormProps) {
  return (
    <form onSubmit={onUpdateYardSize} className="yard-size-form">
      <div className="mini-row">
        <div className="stack compact">
          <label className="field-label" htmlFor="yard-width-draft">Yard Width (ft)</label>
          <input id="yard-width-draft" type="number" min="4" value={yardWidthDraft} onChange={(e) => onYardWidthDraftChange(Number(e.target.value))} aria-invalid={Boolean(yardErrors.yard_width_ft)} aria-describedby={yardErrors.yard_width_ft ? "yard-width-error" : undefined} required />
          {yardErrors.yard_width_ft && <p id="yard-width-error" className="field-error">{yardErrors.yard_width_ft}</p>}
        </div>
        <div className="stack compact">
          <label className="field-label" htmlFor="yard-length-draft">Yard Length (ft)</label>
          <input id="yard-length-draft" type="number" min="4" value={yardLengthDraft} onChange={(e) => onYardLengthDraftChange(Number(e.target.value))} aria-invalid={Boolean(yardErrors.yard_length_ft)} aria-describedby={yardErrors.yard_length_ft ? "yard-length-error" : undefined} required />
          {yardErrors.yard_length_ft && <p id="yard-length-error" className="field-error">{yardErrors.yard_length_ft}</p>}
        </div>
      </div>
      <button type="submit">Save Yard Size</button>
    </form>
  );
}
