import { AppPage } from "../app/types";
import { ClimatePlantingWindow, Garden, GardenClimate, Task } from "../types";

type WeatherDay = { date: string; low: number; high: number; rain: number };

type HomeHeroProps = {
  garden: Garden;
  beds: { id: number }[];
  placements: { id: number }[];
  tasks: Task[];
  cropTemplateCount: number;
  gardenClimate: GardenClimate | null;
  homeTaskPreview: Task[];
  overdueTaskCount: number;
  upcomingTaskCount: number;
  weatherPreview: WeatherDay[];
  isLoadingWeather: boolean;
  actionablePlantingWindows: ClimatePlantingWindow[];
  weatherRiskCues: string[];
  onNavigate: (page: AppPage) => void;
};

export function HomeHero({
  garden,
  beds,
  placements,
  tasks,
  cropTemplateCount,
  gardenClimate,
  homeTaskPreview,
  overdueTaskCount,
  upcomingTaskCount,
  weatherPreview,
  isLoadingWeather,
  actionablePlantingWindows,
  weatherRiskCues,
  onNavigate,
}: HomeHeroProps) {
  return (
    <article className="card home-hero">
      <div className="home-hero-head">
        <div>
          <h2>{garden.name}</h2>
          <p className="subhead">Zone {garden.growing_zone} &middot; {garden.zip_code} &middot; {garden.yard_width_ft} x {garden.yard_length_ft} ft yard</p>
        </div>
        <div className="panel-actions">
          <button type="button" onClick={() => onNavigate("calendar")}>Open Calendar</button>
          <button type="button" onClick={() => onNavigate("planner")}>Open Bed Planner</button>
          <button type="button" className="secondary-btn" onClick={() => onNavigate("crops")}>Manage Crops</button>
        </div>
      </div>

      <div className="home-summary-stats">
        <div className="planner-stat"><strong>{beds.length}</strong><span>Beds</span></div>
        <div className="planner-stat"><strong>{placements.length}</strong><span>Placements</span></div>
        <div className="planner-stat"><strong>{tasks.length}</strong><span>Tasks</span></div>
        <div className="planner-stat"><strong>{cropTemplateCount}</strong><span>Crops</span></div>
      </div>

      <div className="home-dashboard-grid">
        <section className="home-dashboard-card">
          <div className="crop-card-row">
            <h3>Today and Next Up</h3>
            <span className={`status-pill ${overdueTaskCount > 0 ? "act" : "stable"}`}>
              {overdueTaskCount > 0 ? `${overdueTaskCount} overdue` : `${upcomingTaskCount} open`}
            </span>
          </div>
          {homeTaskPreview.length > 0 ? (
            <ul className="home-dashboard-list">
              {homeTaskPreview.map((task) => (
                <li key={task.id} className="home-dashboard-list-item">
                  <strong>{task.title}</strong>
                  <span className="hint">{task.due_on}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">No open tasks. Use the calendar to add plantings or tasks for this garden.</p>
          )}
        </section>

        <section className="home-dashboard-card">
          <div className="crop-card-row">
            <h3>Weather Snapshot</h3>
            {gardenClimate && <span className="climate-kpi">{gardenClimate.microclimate_band}</span>}
          </div>
          {isLoadingWeather ? (
            <p className="hint">Refreshing weather forecast...</p>
          ) : weatherPreview.length > 0 ? (
            <ul className="home-dashboard-list compact-list">
              {weatherPreview.map((day) => (
                <li key={day.date} className="home-dashboard-list-item">
                  <strong>{day.date}</strong>
                  <span className="hint">{day.low}F to {day.high}F &middot; rain {day.rain} in</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">No weather data loaded yet for this garden.</p>
          )}
          {gardenClimate && (
            <div className="climate-kpis">
              <span className="climate-kpi">Soil ~ {gardenClimate.soil_temperature_estimate_f}F</span>
              <span className="climate-kpi">Frost risk {gardenClimate.frost_risk_next_10_days}</span>
            </div>
          )}
        </section>

        <section className="home-dashboard-card">
          <div className="crop-card-row">
            <h3>Plant and Protect</h3>
            {actionablePlantingWindows.length > 0 && <span className="status-pill open">{actionablePlantingWindows.length} active cues</span>}
          </div>
          {actionablePlantingWindows.length > 0 ? (
            <ul className="home-dashboard-list compact-list">
              {actionablePlantingWindows.map((window) => (
                <li key={`${window.crop_template_id}-${window.status}`} className="home-dashboard-list-item">
                  <strong>{window.crop_name}</strong>
                  <span className="hint">{window.status}: {window.window_start} to {window.window_end}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint">No urgent planting windows yet. Climate guidance will surface here when conditions shift.</p>
          )}
          {weatherRiskCues.length > 0 && (
            <ul className="home-dashboard-list compact-list">
              {weatherRiskCues.map((cue) => (
                <li key={cue} className="home-dashboard-list-item home-dashboard-warning">
                  <span className="hint">{cue}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </article>
  );
}
