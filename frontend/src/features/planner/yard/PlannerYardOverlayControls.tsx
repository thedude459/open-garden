import { Dispatch, SetStateAction } from "react";
import { GardenSunPath } from "../../types";

type PlannerYardOverlayControlsProps = {
  showSunOverlay: boolean;
  showShadeOverlay: boolean;
  showGrowthPreview: boolean;
  setShowSunOverlay: Dispatch<SetStateAction<boolean>>;
  setShowShadeOverlay: Dispatch<SetStateAction<boolean>>;
  setShowGrowthPreview: Dispatch<SetStateAction<boolean>>;
  setOverlayPreset: (preset: "layout" | "sun" | "shade" | "growth") => void;
  gardenSunPath: GardenSunPath | null;
  sunHour: number;
  setSunHour: Dispatch<SetStateAction<number>>;
  growthDayOffset: number;
  setGrowthDayOffset: Dispatch<SetStateAction<number>>;
};

export function PlannerYardOverlayControls({
  showSunOverlay,
  showShadeOverlay,
  showGrowthPreview,
  setShowSunOverlay,
  setShowShadeOverlay,
  setShowGrowthPreview,
  setOverlayPreset,
  gardenSunPath,
  sunHour,
  setSunHour,
  growthDayOffset,
  setGrowthDayOffset,
}: PlannerYardOverlayControlsProps) {
  return (
    <div className="spatial-controls">
      <div className="spatial-presets" role="group" aria-label="Planner overlay presets">
        <button type="button" className={!showSunOverlay && !showShadeOverlay && !showGrowthPreview ? "secondary-btn active" : "secondary-btn"} onClick={() => setOverlayPreset("layout")}>Layout only</button>
        <button type="button" className={showSunOverlay && !showShadeOverlay && !showGrowthPreview ? "secondary-btn active" : "secondary-btn"} onClick={() => setOverlayPreset("sun")}>Sun</button>
        <button type="button" className={showShadeOverlay && !showSunOverlay && !showGrowthPreview ? "secondary-btn active" : "secondary-btn"} onClick={() => setOverlayPreset("shade")}>Shade</button>
        <button type="button" className={showGrowthPreview && !showSunOverlay && !showShadeOverlay ? "secondary-btn active" : "secondary-btn"} onClick={() => setOverlayPreset("growth")}>Growth</button>
      </div>
      <div className="spatial-legend" aria-label="Planner overlay legend">
        <span className="spatial-legend-item"><span className="spatial-swatch bed" /> Beds</span>
        <span className="spatial-legend-item"><span className="spatial-swatch sun" /> Sun</span>
        <span className="spatial-legend-item"><span className="spatial-swatch shade" /> Shade</span>
        <span className="spatial-legend-item"><span className="spatial-swatch canopy" /> Canopy</span>
      </div>
      <label className="spatial-toggle">
        <input type="checkbox" checked={showSunOverlay} onChange={(event) => setShowSunOverlay(event.target.checked)} />
        Sun exposure overlay
      </label>
      <label className="spatial-toggle">
        <input type="checkbox" checked={showShadeOverlay} onChange={(event) => setShowShadeOverlay(event.target.checked)} />
        Shade simulation
      </label>
      <label className="spatial-toggle">
        <input type="checkbox" checked={showGrowthPreview} onChange={(event) => setShowGrowthPreview(event.target.checked)} />
        Plant canopy growth preview
      </label>
      <label className="field-label" htmlFor="planner-sun-hour">Sun Hour</label>
      <input
        id="planner-sun-hour"
        type="range"
        min={Math.max(5, Math.floor(gardenSunPath?.sunrise_hour || 6))}
        max={Math.min(20, Math.ceil(gardenSunPath?.sunset_hour || 19))}
        value={sunHour}
        disabled={!showSunOverlay && !showShadeOverlay}
        onChange={(event) => setSunHour(Number(event.target.value))}
      />
      <label className="field-label" htmlFor="planner-growth-offset">Growth Preview (days)</label>
      <input
        id="planner-growth-offset"
        type="range"
        min={0}
        max={90}
        value={growthDayOffset}
        disabled={!showGrowthPreview}
        onChange={(event) => setGrowthDayOffset(Number(event.target.value))}
      />
    </div>
  );
}
