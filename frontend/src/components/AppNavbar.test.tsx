import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppNavbar } from "./AppNavbar";

function defaultProps(overrides: Partial<Parameters<typeof AppNavbar>[0]> = {}) {
  return {
    activePage: "home" as const,
    selectedGarden: null,
    selectedGardenRecord: undefined,
    isNavOpen: false,
    setIsNavOpen: vi.fn(),
    onNavigate: vi.fn(),
    onLogout: vi.fn(),
    onHelpOpen: vi.fn(),
    ...overrides,
  };
}

describe("AppNavbar", () => {
  it("renders brand title always", () => {
    render(<AppNavbar {...defaultProps()} />);
    expect(screen.getByText("open-garden")).toBeInTheDocument();
  });

  it("shows garden name and zone when selectedGardenRecord is provided", () => {
    const selectedGardenRecord = {
      id: 1,
      name: "Back Garden",
      description: "",
      zip_code: "80301",
      growing_zone: "6a",
      yard_width_ft: 20,
      yard_length_ft: 15,
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
    } as const;
    render(<AppNavbar {...defaultProps({ selectedGarden: 1, selectedGardenRecord })} />);
    expect(screen.getByText(/Back Garden.*Zone 6a/)).toBeInTheDocument();
  });

  it("shows primary garden nav links and More menu when selectedGarden is set", () => {
    render(<AppNavbar {...defaultProps({ selectedGarden: 1 })} />);
    expect(screen.getByRole("button", { name: "Calendar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Seasonal Plan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bed Planner" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More tools" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Timeline" })).not.toBeInTheDocument();
  });

  it("hides garden-specific nav links when selectedGarden is null", () => {
    render(<AppNavbar {...defaultProps({ selectedGarden: null })} />);
    expect(screen.queryByRole("button", { name: "Calendar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crop Library" })).toBeInTheDocument();
  });

  it("always shows Crop Library and My Gardens links", () => {
    render(<AppNavbar {...defaultProps()} />);
    expect(screen.getByRole("button", { name: "Crop Library" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "My Gardens" })).toBeInTheDocument();
  });

  it("calls onNavigate from More menu for secondary destinations", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<AppNavbar {...defaultProps({ selectedGarden: 1, onNavigate })} />);

    await user.click(screen.getByRole("button", { name: "More tools" }));
    await user.click(await screen.findByRole("menuitem", { name: "Timeline" }));
    expect(onNavigate).toHaveBeenCalledWith("timeline");
  });

  it("calls onNavigate when primary nav buttons are clicked", () => {
    const onNavigate = vi.fn();
    render(<AppNavbar {...defaultProps({ selectedGarden: 1, onNavigate })} />);

    fireEvent.click(screen.getByRole("button", { name: "Calendar" }));
    expect(onNavigate).toHaveBeenCalledWith("calendar");

    fireEvent.click(screen.getByRole("button", { name: "Bed Planner" }));
    expect(onNavigate).toHaveBeenCalledWith("planner");

    fireEvent.click(screen.getByRole("button", { name: "My Gardens" }));
    expect(onNavigate).toHaveBeenCalledWith("home");

    fireEvent.click(screen.getByRole("button", { name: "Crop Library" }));
    expect(onNavigate).toHaveBeenCalledWith("crops");

    fireEvent.click(screen.getByRole("button", { name: "Seasonal Plan" }));
    expect(onNavigate).toHaveBeenCalledWith("seasonal");
  });

  it("toggles nav open state via menu button", () => {
    const setIsNavOpen = vi.fn();
    render(<AppNavbar {...defaultProps({ isNavOpen: false, setIsNavOpen })} />);
    fireEvent.click(screen.getByRole("button", { name: /menu/i }));
    expect(setIsNavOpen).toHaveBeenCalledWith(true);
  });

  it("shows Close label when nav is open", () => {
    render(<AppNavbar {...defaultProps({ isNavOpen: true })} />);
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  it("applies active variant to the current page button", () => {
    render(<AppNavbar {...defaultProps({ activePage: "crops" })} />);
    const cropsBtn = screen.getByRole("button", { name: "Crop Library" });
    expect(cropsBtn).toBeInTheDocument();
  });
});
