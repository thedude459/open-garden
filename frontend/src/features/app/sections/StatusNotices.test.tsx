import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EmailVerificationNotice } from "./EmailVerificationNotice";
import { GardenRequiredNotice } from "./GardenRequiredNotice";

describe("status notices", () => {
  it("forwards notice actions", () => {
    const onResend = vi.fn();
    const onGoHome = vi.fn();

    render(
      <>
        <EmailVerificationNotice onResend={onResend} />
        <GardenRequiredNotice onGoHome={onGoHome} />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Resend email" }));
    fireEvent.click(screen.getByRole("button", { name: "Go to My Gardens" }));

    expect(onResend).toHaveBeenCalledTimes(1);
    expect(onGoHome).toHaveBeenCalledTimes(1);
  });
});