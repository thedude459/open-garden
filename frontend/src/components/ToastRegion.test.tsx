import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ToastRegion } from "./ToastRegion";

describe("ToastRegion", () => {
  it("renders nothing when there are no notices", () => {
    const { container } = render(<ToastRegion notices={[]} onDismiss={() => undefined} onAction={() => undefined} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows notices and forwards action and dismiss events", () => {
    const onDismiss = vi.fn();
    const onAction = vi.fn();

    render(
      <ToastRegion
        notices={[
          {
            id: 7,
            kind: "success",
            message: "Crop saved.",
            actionLabel: "Undo",
            onAction: () => undefined,
          },
        ]}
        onDismiss={onDismiss}
        onAction={onAction}
      />,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Crop saved.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(onAction).toHaveBeenCalledWith(7);
    expect(onDismiss).toHaveBeenCalledWith(7);
  });
});