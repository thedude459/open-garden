import { describe, expect, it } from "vitest";
import { formatViolation, formatWarning } from "@/lib/garden/messages";
import type { ValidationViolation, ValidationWarning } from "@/lib/garden/types";
import {
  INITIAL_PLACEMENT_MODE,
  armForPlant,
  armForTransplant,
  disarm,
  isArmed,
  startDragging,
} from "@/lib/planner/placement-mode";

describe("placement mode", () => {
  const payload = {
    plant_id: "p1",
    plant_provenance: "authoritative" as const,
    common_name: "Tomato",
    illustration_url: "/test.svg",
    spacing_radius: 0.75,
  };

  it("starts idle", () => {
    expect(INITIAL_PLACEMENT_MODE.mode).toBe("idle");
    expect(isArmed(INITIAL_PLACEMENT_MODE)).toBe(false);
  });

  it("arms for direct seed planting", () => {
    const armed = armForPlant(INITIAL_PLACEMENT_MODE, payload);
    expect(armed.mode).toBe("armed");
    expect(armed.armed_context).toBe("direct_seed");
    expect(isArmed(armed)).toBe(true);
  });

  it("arms for transplant", () => {
    const armed = armForTransplant(INITIAL_PLACEMENT_MODE, "start-1", payload);
    expect(armed.transplant_start_id).toBe("start-1");
    expect(armed.armed_context).toBe("transplant");
  });

  it("disarms back to idle", () => {
    const armed = armForPlant(INITIAL_PLACEMENT_MODE, payload);
    const idle = disarm(armed);
    expect(idle.mode).toBe("idle");
    expect(idle.armed_payload).toBeNull();
  });

  it("enters dragging from idle", () => {
    const dragging = startDragging(INITIAL_PLACEMENT_MODE);
    expect(dragging.mode).toBe("dragging");
  });
});

describe("garden messages", () => {
  it("humanizes boundary violations", () => {
    const message = formatViolation({ code: "BOUNDARY", message: "Drop inside a bed" });
    expect(message).toContain("garden bed");
    expect(message).not.toContain("BOUNDARY");
  });

  it("humanizes spacing violations", () => {
    const message = formatViolation({
      code: "SPACING",
      message: "Too close to neighbor",
    });
    expect(message.toLowerCase()).toContain("close");
  });

  it("passes through warning messages", () => {
    const warning: ValidationWarning = {
      code: "CLIMATE_DATE",
      message: "Late for your zone",
    };
    expect(formatWarning(warning)).toBe("Late for your zone");
  });

  it("formats unknown violation codes with message", () => {
    const violation = {
      code: "CUSTOM",
      message: "Something went wrong",
    } as unknown as ValidationViolation;
    expect(formatViolation(violation)).toBe("Something went wrong");
  });
});
