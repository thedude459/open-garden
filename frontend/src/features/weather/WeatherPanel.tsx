import { GardenClimate, Task } from "../types";

type WeatherPanelProps = {
  weather: any;
  climate: GardenClimate | null;
  tasks: Task[];
  isLoadingClimate: boolean;
  isLoadingWeather: boolean;
  isLoadingTasks: boolean;
};

export function WeatherPanel({ climate, weather, tasks, isLoadingClimate, isLoadingWeather, isLoadingTasks }: WeatherPanelProps) {
  return (
    <article className="card weather-card">
      <h2>Weather Outlook</h2>
      {isLoadingClimate && <p className="hint">Loading climate guidance...</p>}
      {climate ? (
        <>
          <div className="climate-kpis">
            <span className="climate-kpi">{climate.microclimate_band}</span>
            <span className="climate-kpi">Soil ~ {climate.soil_temperature_estimate_f}F</span>
            <span className="climate-kpi">Frost risk {climate.frost_risk_next_10_days}</span>
          </div>
          <p className="hint">
            Adjusted last spring frost {climate.adjusted_last_spring_frost}. First fall frost {climate.adjusted_first_fall_frost}. Estimated frost-free season {climate.growing_season_days} days.
          </p>
          <h3>Climate Signals</h3>
          <ul className="climate-signal-list">
            {climate.recommendations.map((item) => (
              <li key={item.key} className="climate-signal">
                <div className="crop-card-row">
                  <strong>{item.title}</strong>
                  <span className={`status-pill ${item.status}`}>{item.status}</span>
                </div>
                <p className="hint">{item.detail}</p>
              </li>
            ))}
          </ul>
        </>
      ) : isLoadingWeather ? (
        <p className="hint">Loading weather forecast...</p>
      ) : weather?.daily ? (
        <ul>
          {weather.daily.time.slice(0, 5).map((day: string, idx: number) => (
            <li key={day}>
              {day}: {weather.daily.temperature_2m_min[idx]}F to {weather.daily.temperature_2m_max[idx]}F, rain {weather.daily.precipitation_sum[idx]} in
            </li>
          ))}
        </ul>
      ) : (
        <p>No weather loaded yet.</p>
      )}

      <h3>Task Queue</h3>
      {isLoadingTasks && <p className="hint">Loading tasks...</p>}
      <ul>
        {tasks.slice(0, 8).map((task) => (
          <li key={task.id}>
            {task.due_on}: {task.title}
          </li>
        ))}
      </ul>
    </article>
  );
}
