import { FormEvent } from "react";
import { SquarePlus } from "lucide-react";
import { SectionHeader } from "@/components/SectionHeader";

type PlannerCreateBedFormProps = {
  bedName: string;
  bedWidthFt: number;
  bedLengthFt: number;
  bedErrors: { name: string; width_ft: string; length_ft: string };
  onBedNameChange: (value: string) => void;
  onBedWidthFtChange: (value: number) => void;
  onBedLengthFtChange: (value: number) => void;
  onCreateBed: (e: FormEvent<HTMLFormElement>) => void;
};

export function PlannerCreateBedForm({
  bedName,
  bedWidthFt,
  bedLengthFt,
  bedErrors,
  onBedNameChange,
  onBedWidthFtChange,
  onBedLengthFtChange,
  onCreateBed,
}: PlannerCreateBedFormProps) {
  return (
    <form onSubmit={onCreateBed} className="stack compact planner-panel">
      <SectionHeader
        variant="section"
        headingLevel="h3"
        icon={SquarePlus}
        title="Create Bed"
        subtitle="Add a raised bed to the yard grid."
      />
      <label className="field-label" htmlFor="bed-name">Bed Name</label>
      <input id="bed-name" name="name" value={bedName} onChange={(e) => onBedNameChange(e.target.value)} placeholder="Backyard North Bed" aria-invalid={Boolean(bedErrors.name)} aria-describedby={bedErrors.name ? "bed-name-error" : undefined} required />
      {bedErrors.name && <p id="bed-name-error" className="field-error">{bedErrors.name}</p>}
      <div className="mini-row">
        <div className="stack compact">
          <label className="field-label" htmlFor="bed-width-ft">Width (ft)</label>
          <input id="bed-width-ft" name="width_ft" type="number" step="0.5" min="1" value={bedWidthFt} onChange={(e) => onBedWidthFtChange(Number(e.target.value))} placeholder="4" aria-invalid={Boolean(bedErrors.width_ft)} aria-describedby={bedErrors.width_ft ? "bed-width-error" : undefined} required />
          {bedErrors.width_ft && <p id="bed-width-error" className="field-error">{bedErrors.width_ft}</p>}
        </div>
        <div className="stack compact">
          <label className="field-label" htmlFor="bed-length-ft">Length (ft)</label>
          <input id="bed-length-ft" name="length_ft" type="number" step="0.5" min="1" value={bedLengthFt} onChange={(e) => onBedLengthFtChange(Number(e.target.value))} placeholder="8" aria-invalid={Boolean(bedErrors.length_ft)} aria-describedby={bedErrors.length_ft ? "bed-length-error" : undefined} required />
          {bedErrors.length_ft && <p id="bed-length-error" className="field-error">{bedErrors.length_ft}</p>}
        </div>
      </div>
      <p className="hint">Beds start in the top-left corner. Drag each bed in Yard Layout to place it.</p>
      <button type="submit">Add bed</button>
    </form>
  );
}
