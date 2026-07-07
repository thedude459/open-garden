import { describe, expect, it } from "vitest";
import { formatViolation, formatWarning } from "@/lib/garden/messages";
import type { ValidationViolation, ValidationWarning } from "@/lib/garden/types";

describe("garden messages", () => {
  it("humanizes boundary violations", () => {
    const message = formatViolation({ code: "BOUNDARY", message: "Drop inside a bed" });
    expect(message).toContain("garden bed");
  });

  it("humanizes spacing violations", () => {
    const message = formatViolation({
      code: "SPACING",
      message: "Too close to neighbor",
    });
    expect(message.toLowerCase()).toContain("close");
  });

  it("humanizes incompatible violations", () => {
    const message = formatViolation({
      code: "INCOMPATIBLE",
      message: "Plants are incompatible",
    });
    expect(message.toLowerCase()).toContain("incompatible");
  });

  it("formats warnings", () => {
    const warning: ValidationWarning = {
      code: "CROP_ROTATION",
      message: "Same family planted recently",
    };
    expect(formatWarning(warning)).toBe("Same family planted recently");
  });

  it("falls back to violation message for unknown codes", () => {
    const violation = {
      code: "OTHER",
      message: "Custom error",
    } as unknown as ValidationViolation;
    expect(formatViolation(violation)).toBe("Custom error");
  });
});
