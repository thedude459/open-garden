import { ALL_PLANT_KINDS, type PlantKind } from "./suggestionKindsStorage";

const LABELS: Record<PlantKind, string> = {
  vegetable: "Vegetables",
  herb: "Herbs",
  flower: "Flowers",
  fruit: "Fruits",
};

type SeasonalSuggestionKindChipsProps = {
  selected: PlantKind[];
  disabled?: boolean;
  onToggle: (kind: PlantKind) => void;
};

export function SeasonalSuggestionKindChips({
  selected,
  disabled = false,
  onToggle,
}: SeasonalSuggestionKindChipsProps) {
  const selectedSet = new Set(selected);

  return (
    <div className="stack compact">
      <p className="field-label">Suggestion categories</p>
      <p className="hint">
        Narrow recommended plantings and companion ideas. At least one category must stay selected.
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Plant categories for suggestions">
        {ALL_PLANT_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            disabled={disabled}
            className={selectedSet.has(kind) ? "secondary-btn active" : "secondary-btn"}
            aria-pressed={selectedSet.has(kind)}
            onClick={() => onToggle(kind)}
          >
            {LABELS[kind]}
          </button>
        ))}
      </div>
    </div>
  );
}
