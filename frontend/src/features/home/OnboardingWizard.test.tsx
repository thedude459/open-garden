import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OnboardingWizard } from "./OnboardingWizard";

afterEach(() => {
  cleanup();
});

describe("OnboardingWizard", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<OnboardingWizard open={false} onDismiss={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("forwards dismiss actions with remember flag", () => {
    const onDismiss = vi.fn();

    render(<OnboardingWizard open onDismiss={onDismiss} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Welcome to open-garden/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide for now" }));
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));

    expect(onDismiss).toHaveBeenNthCalledWith(1, false);
    expect(onDismiss).toHaveBeenNthCalledWith(2, true);
  });
});
