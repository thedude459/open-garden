import { Task } from "../types";

type WeatherPanelProps = {
  weather: any;
  tasks: Task[];
  isLoadingWeather: boolean;
  isLoadingTasks: boolean;
};

export function WeatherPanel({ weather, tasks, isLoadingWeather, isLoadingTasks }: WeatherPanelProps) {
  return (
    <article className="card weather-card">
      <h2>Weather Outlook</h2>
      {isLoadingWeather && <p className="hint">Loading weather forecast...</p>}
      {weather?.daily ? (
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
