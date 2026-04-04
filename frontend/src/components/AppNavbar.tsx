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
    <nav className="navbar" aria-label="Primary navigation">
      <div className="navbar-top">
        <div className="navbar-brand">
          <h1>open-garden</h1>
          {selectedGardenRecord && (
            <span className="navbar-garden">{selectedGardenRecord.name} · Zone {selectedGardenRecord.growing_zone}</span>
          )}
        </div>
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={isNavOpen}
          aria-controls="primary-navigation"
          onClick={() => setIsNavOpen(!isNavOpen)}
        >
          {isNavOpen ? "Close menu" : "Menu"}
        </button>
      </div>
      <div id="primary-navigation" className={isNavOpen ? "navbar-content open" : "navbar-content"}>
        <div className="navbar-nav">
          <button className={activePage === "home" ? "nav-btn active" : "nav-btn"} onClick={() => onNavigate("home")}>My Gardens</button>
          {selectedGarden && (
            <>
              <button className={activePage === "timeline" ? "nav-btn active" : "nav-btn"} onClick={() => onNavigate("timeline")}>Timeline</button>
              <button className={activePage === "calendar" ? "nav-btn active" : "nav-btn"} onClick={() => onNavigate("calendar")}>Calendar</button>
              <button className={activePage === "seasonal" ? "nav-btn active" : "nav-btn"} onClick={() => onNavigate("seasonal")}>Seasonal Plan</button>
              <button className={activePage === "planner" ? "nav-btn active" : "nav-btn"} onClick={() => onNavigate("planner")}>Bed Planner</button>
              <button className={activePage === "coach" ? "nav-btn active" : "nav-btn"} onClick={() => onNavigate("coach")}>AI Coach</button>
              <button className={activePage === "sensors" ? "nav-btn active" : "nav-btn"} onClick={() => onNavigate("sensors")}>Sensors</button>
            </>
          )}
          <button className={activePage === "crops" ? "nav-btn active" : "nav-btn"} onClick={() => onNavigate("crops")}>Crop Library</button>
          {selectedGarden && (
            <button className={activePage === "pests" ? "nav-btn active" : "nav-btn"} onClick={() => onNavigate("pests")}>Pest Log</button>
          )}
        </div>
        <div className="navbar-actions">
          <button type="button" className="secondary-btn" onClick={() => { setIsNavOpen(false); onHelpOpen(); }}>Help</button>
          <button type="button" className="secondary-btn" onClick={onLogout}>Log out</button>
        </div>
      </div>
    </nav>
  );
}
