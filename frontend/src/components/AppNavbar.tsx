import { Button } from "./ui/button";
import { AppPage } from "../features/app/types";
import { Garden } from "../features/types";

type AppNavbarProps = {
  activePage: AppPage;
  selectedGarden: number | null;
  selectedGardenRecord: Garden | undefined;
  isNavOpen: boolean;
  setIsNavOpen: (open: boolean) => void;
  onNavigate: (page: AppPage) => void;
  onLogout: () => void;
  onHelpOpen: () => void;
};

export function AppNavbar({
  activePage,
  selectedGarden,
  selectedGardenRecord,
  isNavOpen,
  setIsNavOpen,
  onNavigate,
  onLogout,
  onHelpOpen,
}: AppNavbarProps) {
  return (
    <nav className="app-nav" aria-label="Primary navigation">
      <div className="app-nav-top">
        <div className="app-nav-brand">
          <h1 className="app-nav-title">open-garden</h1>
          {selectedGardenRecord && (
            <p className="app-nav-subtitle">{selectedGardenRecord.name} · Zone {selectedGardenRecord.growing_zone}</p>
          )}
        </div>
        <button
          type="button"
          className="app-nav-menu-btn"
          aria-expanded={isNavOpen}
          aria-controls="primary-navigation"
          onClick={() => setIsNavOpen(!isNavOpen)}
        >
          {isNavOpen ? "Close" : "Menu"}
        </button>
      </div>
      <div id="primary-navigation" className={`app-nav-content ${isNavOpen ? "open" : ""}`}>
        <div className="app-nav-links">
          <Button
            variant={activePage === "home" ? "default" : "secondary"}
            size="sm"
            onClick={() => onNavigate("home")}
          >
            My Gardens
          </Button>
          {selectedGarden && (
            <>
              <Button
                variant={activePage === "timeline" ? "default" : "secondary"}
                size="sm"
                onClick={() => onNavigate("timeline")}
              >
                Timeline
              </Button>
              <Button
                variant={activePage === "calendar" ? "default" : "secondary"}
                size="sm"
                onClick={() => onNavigate("calendar")}
              >
                Calendar
              </Button>
              <Button
                variant={activePage === "seasonal" ? "default" : "secondary"}
                size="sm"
                onClick={() => onNavigate("seasonal")}
              >
                Seasonal Plan
              </Button>
              <Button
                variant={activePage === "planner" ? "default" : "secondary"}
                size="sm"
                onClick={() => onNavigate("planner")}
              >
                Bed Planner
              </Button>
              <Button
                variant={activePage === "coach" ? "default" : "secondary"}
                size="sm"
                onClick={() => onNavigate("coach")}
              >
                AI Coach
              </Button>
              <Button
                variant={activePage === "sensors" ? "default" : "secondary"}
                size="sm"
                onClick={() => onNavigate("sensors")}
              >
                Sensors
              </Button>
            </>
          )}
          <Button
            variant={activePage === "crops" ? "default" : "secondary"}
            size="sm"
            onClick={() => onNavigate("crops")}
          >
            Crop Library
          </Button>
          {selectedGarden && (
            <Button
              variant={activePage === "pests" ? "default" : "secondary"}
              size="sm"
              onClick={() => onNavigate("pests")}
            >
              Pest Log
            </Button>
          )}
        </div>
        <div className="app-nav-actions">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsNavOpen(false);
              onHelpOpen();
            }}
          >
            Help
          </Button>
          <Button variant="outline" size="sm" onClick={onLogout}>
            Log out
          </Button>
        </div>
      </div>
    </nav>
  );
}
