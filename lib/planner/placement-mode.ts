import type { DragPlantPayload } from "@/components/planner/VisualCanvas";
import type { ArmedContext, PlacementModeKind, PlacementModeState } from "@/lib/planner/types";

export const INITIAL_PLACEMENT_MODE: PlacementModeState = {
  mode: "idle",
  armed_payload: null,
  armed_context: null,
  transplant_start_id: null,
};

export function armForPlant(
  state: PlacementModeState,
  payload: DragPlantPayload,
): PlacementModeState {
  return {
    mode: "armed",
    armed_payload: payload,
    armed_context: "direct_seed",
    transplant_start_id: null,
  };
}

export function armForTransplant(
  state: PlacementModeState,
  startId: string,
  payload: DragPlantPayload,
): PlacementModeState {
  return {
    mode: "armed",
    armed_payload: payload,
    armed_context: "transplant",
    transplant_start_id: startId,
  };
}

export function startDragging(state: PlacementModeState): PlacementModeState {
  if (state.mode === "idle") {
    return { ...state, mode: "dragging" };
  }
  return state;
}

export function disarm(state: PlacementModeState): PlacementModeState {
  return INITIAL_PLACEMENT_MODE;
}

export function isArmed(state: PlacementModeState): boolean {
  return state.mode === "armed" && state.armed_payload != null;
}

export function armedContext(state: PlacementModeState): ArmedContext {
  return state.armed_context;
}

export function modeKind(state: PlacementModeState): PlacementModeKind {
  return state.mode;
}
