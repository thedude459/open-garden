import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppNavbar } from "./AppNavbar";
import { CompassPicker } from "./CompassPicker";
import { HelpModal } from "./HelpModal";

afterEach(() => {
  cleanup();
});

describe("AppNavbar", () => {
  it("renders garden-specific navigation and forwards actions", async () => {
    const setIsNavOpen = vi.fn();
    const onNavigate = vi.fn();
    const onLogout = vi.fn();
    const onHelpOpen = vi.fn();

    render(
      <AppNavbar
        activePage="calendar"
        selectedGarden={3}
        selectedGardenRecord={{
          id: 3,
          name: "Backyard",
          description: "",
          zip_code: "80301",
          growing_zone: "6a",
          yard_width_ft: 20,
          yard_length_ft: 30,
          latitude: 40,
          longitude: -105,
          orientation: "south",
          sun_exposure: "full_sun",
          wind_exposure: "moderate",
          thermal_mass: "moderate",
          slope_position: "mid",
          frost_pocket_risk: "low",
          address_private: "",
          is_shared: false,
          edge_buffer_in: 6,
        }}
        isNavOpen={false}
        setIsNavOpen={setIsNavOpen}
        onNavigate={onNavigate}
        onLogout={onLogout}
        onHelpOpen={onHelpOpen}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Menu" }));
    await user.click(screen.getByRole("button", { name: "More tools" }));
    await user.click(await screen.findByRole("menuitem", { name: "Timeline" }));
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(screen.getByText(/Backyard/i)).toBeInTheDocument();
    // Calendar button should exist (active state shown via variant prop, not class)
    expect(screen.getByRole("button", { name: "Calendar" })).toBeInTheDocument();
    expect(setIsNavOpen).toHaveBeenNthCalledWith(1, true);
    expect(setIsNavOpen).toHaveBeenNthCalledWith(2, false);
    expect(onNavigate).toHaveBeenCalledWith("timeline");
    expect(onHelpOpen).toHaveBeenCalledTimes(1);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("hides garden-only pages when no garden is selected", () => {
    render(
      <AppNavbar
        activePage="home"
        selectedGarden={null}
        selectedGardenRecord={undefined}
        isNavOpen
        setIsNavOpen={vi.fn()}
        onNavigate={vi.fn()}
        onLogout={vi.fn()}
        onHelpOpen={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Timeline" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crops" })).toBeInTheDocument();
  });
});

describe("HelpModal", () => {
  it("does not render while closed and returns remember flag on actions", () => {
    const onClose = vi.fn();
    const { rerender } = render(<HelpModal isOpen={false} onClose={onClose} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(<HelpModal isOpen onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));

    expect(screen.getByRole("dialog", { name: "How open-garden works" })).toBeInTheDocument();
    expect(onClose).toHaveBeenNthCalledWith(1, false);
    expect(onClose).toHaveBeenNthCalledWith(2, true);
  });
});

describe("CompassPicker", () => {
  it("updates the selected orientation", () => {
    const onChange = vi.fn();

    render(<CompassPicker value="east" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "N" }));

    expect(screen.getByRole("button", { name: "E" })).toHaveAttribute("aria-pressed", "true");
    expect(onChange).toHaveBeenCalledWith("north");
  });
});