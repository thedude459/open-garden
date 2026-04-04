import { FormEvent, useMemo, useState } from "react";
import { Bed, GardenSensorsSummary, SensorKind } from "../types";

type SensorsPanelProps = {
  selectedGardenName?: string;
  beds: Bed[];
  summary: GardenSensorsSummary | null;
  isLoading: boolean;
  onRefresh: () => void;
  onRegisterSensor: (payload: {
    bed_id: number | null;
    name: string;
    sensor_kind: SensorKind;
    unit: string;
    location_label: string;
    hardware_id: string;
  }) => Promise<void>;
  onIngestReading: (sensorId: number, value: number) => Promise<void>;
};

function formatSeriesLabel(value: string) {
  const date = new Date(value);
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00`;
}

function SensorLineChart({ title, points, color }: { title: string; points: { captured_at: string; value: number }[]; color: string }) {
  const width = 560;
  const height = 180;
  const pad = 28;

  const plotted = useMemo(() => {
    if (points.length === 0) {
      return { path: "", min: 0, max: 1, ticks: [] as number[] };
    }

    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(1e-6, max - min);

    const path = points
      .map((point, index) => {
        const x = pad + (index / Math.max(1, points.length - 1)) * (width - pad * 2);
        const y = height - pad - ((point.value - min) / span) * (height - pad * 2);
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");

    const ticks = [min, min + span * 0.5, max];
    return { path, min, max, ticks };
  }, [points]);

  return (
    <section className="sensor-chart-card">
      <h4>{title}</h4>
      {points.length === 0 ? (
        <p className="hint">No telemetry points yet.</p>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title} className="sensor-chart-svg">
          <rect x={0} y={0} width={width} height={height} fill="#f8fbf6" />
          {plotted.ticks.map((tick) => {
            const y = height - pad - ((tick - plotted.min) / Math.max(1e-6, plotted.max - plotted.min)) * (height - pad * 2);
            return <line key={tick} x1={pad} y1={y} x2={width - pad} y2={y} stroke="#d2e0d1" strokeWidth={1} />;
          })}
          <path d={plotted.path} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          <text x={pad} y={height - 6} fill="#4b5f4c" fontSize={10}>{formatSeriesLabel(points[0].captured_at)}</text>
          <text x={width - pad} y={height - 6} fill="#4b5f4c" fontSize={10} textAnchor="end">
            {formatSeriesLabel(points[points.length - 1].captured_at)}
          </text>
        </svg>
      )}
    </section>
  );
}

export function SensorsPanel({
  selectedGardenName,
  beds,
  summary,
  isLoading,
  onRefresh,
  onRegisterSensor,
  onIngestReading,
}: SensorsPanelProps) {
  const [name, setName] = useState("");
  const [sensorKind, setSensorKind] = useState<SensorKind>("soil_moisture");
  const [unit, setUnit] = useState("%");
  const [locationLabel, setLocationLabel] = useState("");
  const [hardwareId, setHardwareId] = useState("");
  const [bedId, setBedId] = useState<number | null>(null);
  const [ingestSensorId, setIngestSensorId] = useState<number | null>(null);
  const [readingValue, setReadingValue] = useState<number>(0);

  async function registerSensor(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) {
      return;
    }

    await onRegisterSensor({
      bed_id: bedId,
      name: name.trim(),
      sensor_kind: sensorKind,
      unit: unit.trim(),
      location_label: locationLabel.trim(),
      hardware_id: hardwareId.trim(),
    });

    setName("");
    setLocationLabel("");
    setHardwareId("");
  }

  async function ingestReading(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ingestSensorId) {
      return;
    }
    await onIngestReading(ingestSensorId, Number(readingValue));
  }

  return (
    <article className="card sensor-dashboard-card">
      <div className="crop-card-row">
        <div>
          <h2>Sensor Dashboard {selectedGardenName ? `- ${selectedGardenName}` : ""}</h2>
          <p className="subhead">IoT telemetry for moisture, temperature, and automation-ready irrigation guidance.</p>
        </div>
        <button type="button" className="secondary-btn" onClick={onRefresh}>Refresh</button>
      </div>

      {isLoading && <p className="hint">Loading sensor telemetry...</p>}

      <div className="sensor-layout">
        <section className="sensor-register card">
          <h3>Register Sensor</h3>
          <form className="stack compact" onSubmit={registerSensor}>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Bed A Moisture Probe" required />
            <select
              value={sensorKind}
              onChange={(event) => {
                const next = event.target.value as SensorKind;
                setSensorKind(next);
                if (next === "soil_moisture") {
                  setUnit("%");
                } else if (next === "soil_temperature" || next === "air_temperature") {
                  setUnit("F");
                }
              }}
            >
              <option value="soil_moisture">Soil moisture</option>
              <option value="soil_temperature">Soil temperature</option>
              <option value="air_temperature">Air temperature</option>
              <option value="humidity">Humidity</option>
            </select>
            <input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="Unit (%, F)" />
            <input value={locationLabel} onChange={(event) => setLocationLabel(event.target.value)} placeholder="Location label" />
            <input value={hardwareId} onChange={(event) => setHardwareId(event.target.value)} placeholder="Hardware ID (optional)" />
            <select value={bedId || ""} onChange={(event) => setBedId(Number(event.target.value) || null)}>
              <option value="">Garden-wide sensor</option>
              {beds.map((bed) => (
                <option key={bed.id} value={bed.id}>{bed.name}</option>
              ))}
            </select>
            <button type="submit">Register sensor</button>
          </form>
        </section>

        <section className="sensor-ingest card">
          <h3>Ingest Reading</h3>
          <form className="stack compact" onSubmit={ingestReading}>
            <select value={ingestSensorId || ""} onChange={(event) => setIngestSensorId(Number(event.target.value) || null)}>
              <option value="">Select sensor</option>
              {summary?.sensors.map((sensor) => (
                <option key={sensor.id} value={sensor.id}>{sensor.name} ({sensor.sensor_kind})</option>
              ))}
            </select>
            <input type="number" step="0.1" value={readingValue} onChange={(event) => setReadingValue(Number(event.target.value))} />
            <button type="submit">Push reading</button>
          </form>

          <h4>Irrigation Suggestions</h4>
          <ul className="climate-signal-list">
            {(summary?.irrigation_suggestions || []).map((item, index) => (
              <li key={`${item.title}-${index}`} className="climate-signal">
                <div className="crop-card-row">
                  <strong>{item.title}</strong>
                  <span className={`status-pill ${item.status}`}>{item.status.replace("_", " ")}</span>
                </div>
                <p className="hint">{item.detail}</p>
              </li>
            ))}
            {(!summary || summary.irrigation_suggestions.length === 0) && <li className="hint">No irrigation guidance yet.</li>}
          </ul>
        </section>
      </div>

      <section className="sensor-table card">
        <h3>Registered Sensors</h3>
        <ul className="chip-list">
          {(summary?.sensors || []).map((sensor) => (
            <li key={sensor.id} className="sensor-row">
              <strong>{sensor.name}</strong>
              <span className="hint">{sensor.sensor_kind.replace("_", " ")} {sensor.location_label ? `· ${sensor.location_label}` : ""}</span>
              <span className="hint">Latest: {sensor.latest_value == null ? "-" : `${sensor.latest_value} ${sensor.unit}`}</span>
            </li>
          ))}
          {(!summary || summary.sensors.length === 0) && <li className="hint">No sensors registered yet.</li>}
        </ul>
      </section>

      <div className="sensor-chart-grid">
        <SensorLineChart title="Soil Moisture (%)" points={summary?.soil_moisture_series || []} color="#2f8f4e" />
        <SensorLineChart title="Soil Temperature" points={summary?.soil_temperature_series || []} color="#d46a1f" />
      </div>
    </article>
  );
}
