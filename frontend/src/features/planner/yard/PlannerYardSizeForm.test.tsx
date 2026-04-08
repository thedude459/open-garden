import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlannerYardSizeForm } from "./PlannerYardSizeForm";

function defaultProps(overrides: Partial<Parameters<typeof PlannerYardSizeForm>[0]> = {}) {
  return {
    yardWidthDraft: 20,
    yardLengthDraft: 30,
    yardErrors: { yard_width_ft: "", yard_length_ft: "" },
    onYardWidthDraftChange: vi.fn(),
    onYardLengthDraftChange: vi.fn(),
    onUpdateYardSize: vi.fn(),
    ...overrides,
  };
}

describe("PlannerYardSizeForm", () => {
  it("renders the yard width and length inputs with current values", () => {
    render(<PlannerYardSizeForm {...defaultProps()} />);
    expect(screen.getByLabelText(/yard width/i)).toHaveValue(20);
    expect(screen.getByLabelText(/yard length/i)).toHaveValue(30);
  });

  it("renders the save button", () => {
    render(<PlannerYardSizeForm {...defaultProps()} />);
    expect(screen.getByRole("button", { name: /save yard size/i })).toBeInTheDocument();
  });

  it("calls onYardWidthDraftChange when the width input changes", () => {
    const onYardWidthDraftChange = vi.fn();
    render(<PlannerYardSizeForm {...defaultProps({ onYardWidthDraftChange })} />);
    fireEvent.change(screen.getByLabelText(/yard width/i), { target: { value: "25" } });
    expect(onYardWidthDraftChange).toHaveBeenCalledWith(25);
  });

  it("calls onYardLengthDraftChange when the length input changes", () => {
    const onYardLengthDraftChange = vi.fn();
    render(<PlannerYardSizeForm {...defaultProps({ onYardLengthDraftChange })} />);
    fireEvent.change(screen.getByLabelText(/yard length/i), { target: { value: "40" } });
    expect(onYardLengthDraftChange).toHaveBeenCalledWith(40);
  });

  it("shows yard width error message when provided", () => {
    render(<PlannerYardSizeForm {...defaultProps({ yardErrors: { yard_width_ft: "Width too small", yard_length_ft: "" } })} />);
    expect(screen.getByText("Width too small")).toBeInTheDocument();
  });

  it("shows yard length error message when provided", () => {
    render(<PlannerYardSizeForm {...defaultProps({ yardErrors: { yard_width_ft: "", yard_length_ft: "Length required" } })} />);
    expect(screen.getByText("Length required")).toBeInTheDocument();
  });

  it("does not show error messages when errors are empty", () => {
    render(<PlannerYardSizeForm {...defaultProps()} />);
    expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
  });

  it("calls onUpdateYardSize on form submit", () => {
    const onUpdateYardSize = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(<PlannerYardSizeForm {...defaultProps({ onUpdateYardSize })} />);
    fireEvent.submit(screen.getByRole("button", { name: /save yard size/i }).closest("form")!);
    expect(onUpdateYardSize).toHaveBeenCalledTimes(1);
  });
});
