import { ChevronDown } from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { AppPage } from "../features/app/types";
import { Garden } from "../features/types";

const SECONDARY_NAV_PAGES: AppPage[] = ["timeline", "coach", "sensors", "pests"];

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
  const moreMenuActive = SECONDARY_NAV_PAGES.includes(activePage);

  function navigateAndCloseNav(page: AppPage) {
    onNavigate(page);
    setIsNavOpen(false);
  }

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
            onClick={() => navigateAndCloseNav("home")}
          >
            My Gardens
          </Button>
          {selectedGarden && (
            <>
              <Button
                variant={activePage === "calendar" ? "default" : "secondary"}
                size="sm"
                onClick={() => navigateAndCloseNav("calendar")}
              >
                Calendar
              </Button>
              <Button
                variant={activePage === "seasonal" ? "default" : "secondary"}
                size="sm"
                onClick={() => navigateAndCloseNav("seasonal")}
              >
                Seasonal Plan
              </Button>
              <Button
                variant={activePage === "planner" ? "default" : "secondary"}
                size="sm"
                onClick={() => navigateAndCloseNav("planner")}
              >
                Bed Planner
              </Button>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant={moreMenuActive ? "default" : "secondary"}
                    size="sm"
                    className="app-nav-more-trigger"
                    aria-label="More tools"
                  >
                    More
                    <ChevronDown className="h-3.5 w-3.5 opacity-80" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="app-nav-more-menu">
                  <DropdownMenuItem onSelect={() => navigateAndCloseNav("timeline")}>
                    Timeline
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigateAndCloseNav("coach")}>
                    AI Coach
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigateAndCloseNav("sensors")}>
                    Sensors
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigateAndCloseNav("pests")}>
                    Pest Log
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          <Button
            variant={activePage === "crops" ? "default" : "secondary"}
            size="sm"
            onClick={() => navigateAndCloseNav("crops")}
          >
            Crop Library
          </Button>
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
