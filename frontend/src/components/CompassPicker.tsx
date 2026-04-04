type CompassPickerProps = {
  value: string;
  onChange: (value: string) => void;
};

export function CompassPicker({ value, onChange }: CompassPickerProps) {
  return (
    <div className="compass-picker" role="group" aria-label="Garden orientation - choose the direction your garden faces">
      <button type="button" className={`compass-btn compass-n${value === "north" ? " active" : ""}`} onClick={() => onChange("north")} aria-pressed={value === "north"} title="North-facing">N</button>
      <button type="button" className={`compass-btn compass-e${value === "east" ? " active" : ""}`} onClick={() => onChange("east")} aria-pressed={value === "east"} title="East-facing">E</button>
      <div className="compass-rose" aria-hidden="true" />
      <button type="button" className={`compass-btn compass-w${value === "west" ? " active" : ""}`} onClick={() => onChange("west")} aria-pressed={value === "west"} title="West-facing">W</button>
      <button type="button" className={`compass-btn compass-s${value === "south" ? " active" : ""}`} onClick={() => onChange("south")} aria-pressed={value === "south"} title="South-facing">S</button>
    </div>
  );
}
