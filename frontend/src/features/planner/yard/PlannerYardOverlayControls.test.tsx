import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlannerYardOverlayControls } from "./PlannerYardOverlayControls";

function defaultProps(overrides: Partial<Parameters<typeof PlannerYardOverlayControls>[0]> = {}) {
  return {
    showSunOverlay: false,
    showShadeOverlay: false,
    showGrowthPreview: false,
    setShowSunOverlay: vi.fn(),
    setShowShadeOverlay: vi.fn(),
    setShowGrowthPreview: vi.fn(),
    setOverlayPreset: vi.fn(),
    gardenSunPath: null,
    sunHour: 12,
    setSunHour: vi.fn(),
    growthDayOffset: 30,
    setGrowthDayOffset: vi.fn(),
    ...overrides,
  };
}

describe("PlannerYardOverlayControls", () => {
  it("renders the four preset buttons", () => {
    render(<PlannerYardOverlayControls {...defaultProps()} />);
    expect(screen.getByRole("button", { name: /layout only/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sun$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^shade$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^growth$/i })).toBeInTheDocument();
  });

  it("calls setOverlayPreset('layout') when Layout Only is clicked", () => {
    const setOverlayPreset = vi.fn();
    render(<PlannerYardOverlayControls {...defaultProps({ setOverlayPreset })} />);
    fireEvent.click(screen.getByRole("button", { name: /layout only/i }));
    expect(setOverlayPreset).toHaveBeenCalledWith("layout");
  });

  it("calls setOverlayPreset('sun') when Sun is clicked", () => {
    const setOverlayPreset = vi.fn();
    render(<PlannerYardOverlayControls {...defaultProps({ setOverlayPreset })} />);
    fireEvent.click(screen.getByRole("button", { name: /^sun$/i }));
    expect(setOverlayPreset).toHaveBeenCalledWith("sun");
  });

  it("calls setOverlayPreset('shade') when Shade is clicked", () => {
    const setOverlayPreset = vi.fn();
    render(<PlannerYardOverlayControls {...defaultProps({ setOverlayPreset })} />);
    fireEvent.click(screen.getByRole("button", { name: /^shade$/i }));
    expect(setOverlayPreset).toHaveBeenCalledWith("shade");
  });

  it("calls setOverlayPreset('growth') when Growth is clicked", () => {
    const setOverlayPreset = vi.fn();
    render(<PlannerYardOverlayControls {...defaultProps({ setOverlayPreset })} />);
    fireEvent.click(screen.getByRole("button", { name: /^growth$/i }));
    expect(setOverlayPreset).toHaveBeenCalledWith("growth");
  });

  it("calls setShowSunOverlay when the sun checkbox changes", () => {
    const setShowSunOverlay = vi.fn();
    render(<PlannerYardOverlayControls {...defaultProps({ setShowSunOverlay })} />);
    fireEvent.click(screen.getByLabelText(/sun exposure overlay/i));
    expect(setShowSunOverlay).toHaveBeenCalled();
  });

  it("calls setShowShadeOverlay when the shade checkbox changes", () => {
    const setShowShadeOverlay = vi.fn();
    render(<PlannerYardOverlayControls {...defaultProps({ setShowShadeOverlay })} />);
    fireEvent.click(screen.getByLabelText(/shade simulation/i));
    expect(setShowShadeOverlay).toHaveBeenCalled();
  });

  it("calls setShowGrowthPreview when the growth checkbox changes", () => {
    const setShowGrowthPreview = vi.fn();
    render(<PlannerYardOverlayControls {...defaultProps({ setShowGrowthPreview })} />);
    fireEvent.click(screen.getByLabelText(/plant canopy growth/i));
    expect(setShowGrowthPreview).toHaveBeenCalled();
  });

  it("calls setSunHour when the sun hour slider changes", () => {
    const setSunHour = vi.fn();
    render(<PlannerYardOverlayControls {...defaultProps({ showSunOverlay: true, setSunHour })} />);
    fireEvent.change(screen.getByLabelText(/sun hour/i), { target: { value: "14" } });
    expect(setSunHour).toHaveBeenCalledWith(14);
  });

  it("calls setGrowthDayOffset when the growth offset slider changes", () => {
    const setGrowthDayOffset = vi.fn();
    render(<PlannerYardOverlayControls {...defaultProps({ showGrowthPreview: true, setGrowthDayOffset })} />);
    fireEvent.change(screen.getByLabelText("Growth Preview (days)"), { target: { value: "60" } });
    expect(setGrowthDayOffset).toHaveBeenCalledWith(60);
  });

  it("disables the sun hour slider when no overlay is active", () => {
    render(<PlannerYardOverlayControls {...defaultProps({ showSunOverlay: false, showShadeOverlay: false })} />);
    expect(screen.getByLabelText(/sun hour/i)).toBeDisabled();
  });

  it("disables the growth offset slider when showGrowthPreview is false", () => {
    render(<PlannerYardOverlayControls {...defaultProps({ showGrowthPreview: false })} />);
    expect(screen.getByLabelText("Growth Preview (days)")).toBeDisabled();
  });
});
