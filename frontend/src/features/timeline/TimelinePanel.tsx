import { useMemo, useState } from "react";
import { GardenTimeline, GardenTimelineEvent, TimelineCategory } from "../types";

const CATEGORY_LABELS: Record<TimelineCategory, string> = {
  task: "Tasks",
  weather: "Weather",
  planting_window: "Planting Windows",
  sensor_alert: "Sensor Alerts",
  ai_recommendation: "AI Recommendations",
};

function baseVegetableName(cropName: string): string {
  const name = cropName.trim();
  const parenIdx = name.indexOf(" (");
  return parenIdx !== -1 ? name.slice(0, parenIdx).trim() : name;
}

type PlantingWindowGroup = { baseName: string; events: GardenTimelineEvent[] };

type TimelinePanelProps = {
  selectedGardenName?: string;
  timeline: GardenTimeline | null;
  isLoading: boolean;
  onRefresh: () => void;
};

export function TimelinePanel({ selectedGardenName, timeline, isLoading, onRefresh }: TimelinePanelProps) {
  const [activeCategories, setActiveCategories] = useState<Record<TimelineCategory, boolean>>({
    task: true,
    weather: true,
    planting_window: true,
    sensor_alert: true,
    ai_recommendation: true,
  });
  const [selectedEvent, setSelectedEvent] = useState<GardenTimelineEvent | null>(null);
  const [selectedVarietyIdx, setSelectedVarietyIdx] = useState<Record<string, number>>({});

  const filteredEvents = useMemo(() => {
    if (!timeline) {
      return [];
    }
    return timeline.events.filter((event) => activeCategories[event.category]);
  }, [timeline, activeCategories]);

  const plantingWindowGroups = useMemo<PlantingWindowGroup[]>(() => {
    const groups = new Map<string, GardenTimelineEvent[]>();
    for (const event of filteredEvents) {
      if (event.category !== "planting_window") continue;
      const cropName = String(event.drilldown.crop_name ?? "");
      const base = baseVegetableName(cropName);
      if (!groups.has(base)) groups.set(base, []);
      groups.get(base)!.push(event);
    }
    return Array.from(groups.entries()).map(([baseName, events]) => ({ baseName, events }));
  }, [filteredEvents]);

  const otherFilteredEvents = useMemo(
    () => filteredEvents.filter((e) => e.category !== "planting_window"),
    [filteredEvents]
  );

  function toggleCategory(category: TimelineCategory) {
    setActiveCategories((current) => ({ ...current, [category]: !current[category] }));
  }

  return (
    <article className="card timeline-panel-card">
      <div className="crop-card-row">
        <div>
          <h2>Unified Timeline {selectedGardenName ? `- ${selectedGardenName}` : ""}</h2>
          <p className="subhead">Daily and weekly command center across tasks, weather, planting windows, sensors, and AI guidance.</p>
        </div>
        <button type="button" className="secondary-btn" onClick={onRefresh}>Refresh</button>
      </div>

      <section className="timeline-filters card">
        <h3>Filters</h3>
        <div className="timeline-filter-grid">
          {(Object.keys(CATEGORY_LABELS) as TimelineCategory[]).map((category) => (
            <label key={category} className="timeline-filter-pill">
              <input
                type="checkbox"
                checked={activeCategories[category]}
                onChange={() => toggleCategory(category)}
              />
              {CATEGORY_LABELS[category]}
              {timeline && <span className="hint">({timeline.counts_by_category[category] || 0})</span>}
            </label>
          ))}
        </div>
      </section>

      <div className="timeline-layout">
        <section className="timeline-list card">
          <h3>Timeline Events</h3>
          {isLoading && <p className="hint">Loading timeline...</p>}
          {!isLoading && filteredEvents.length === 0 && <p className="hint">No timeline events match the selected filters.</p>}

          {activeCategories.planting_window && plantingWindowGroups.length > 0 && (
            <>
              <h4 className="hint" style={{ marginBottom: "0.25rem" }}>Planting Windows</h4>
              <ul className="timeline-event-list">
                {plantingWindowGroups.map(({ baseName, events: groupEvents }) => {
                  const idx = selectedVarietyIdx[baseName] ?? 0;
                  const event = groupEvents[idx];
                  return (
                    <li key={baseName}>
                      <button
                        type="button"
                        className={`timeline-event-row ${selectedEvent === event ? "active" : ""}`}
                        onClick={() => setSelectedEvent(event)}
                      >
                        <div className="crop-card-row">
                          <strong>Planting window: {baseName}</strong>
                          <span className={`status-pill ${event.severity}`}>{event.severity}</span>
                        </div>
                        {groupEvents.length > 1 && (
                          <select
                            value={idx}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              const newIdx = Number(e.target.value);
                              setSelectedVarietyIdx((prev) => ({ ...prev, [baseName]: newIdx }));
                              setSelectedEvent(groupEvents[newIdx]);
                            }}
                          >
                            {groupEvents.map((ev, i) => (
                              <option key={i} value={i}>
                                {String(ev.drilldown.variety || ev.drilldown.crop_name)}
                              </option>
                            ))}
                          </select>
                        )}
                        {(() => {
                          const d = event.drilldown;
                          if (d.method === "transplant" && d.indoor_seed_start) {
                            return (
                              <>
                                <p className="hint">Start indoors: {String(d.indoor_seed_start)} – {String(d.indoor_seed_end || "?")}</p>
                                <p className="hint">Transplant outdoors: {String(d.outdoor_window_start)} – {String(d.outdoor_window_end)}</p>
                              </>
                            );
                          }
                          return <p className="hint">Direct sow outdoors: {String(d.outdoor_window_start)} – {String(d.outdoor_window_end)}</p>;
                        })()}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {otherFilteredEvents.length > 0 && (
            <>
              {activeCategories.planting_window && plantingWindowGroups.length > 0 && (
                <h4 className="hint" style={{ marginBottom: "0.25rem", marginTop: "0.75rem" }}>Other Events</h4>
              )}
              <ul className="timeline-event-list">
                {otherFilteredEvents.map((event, index) => (
                  <li key={`${event.category}-${event.event_date}-${index}`}>
                    <button
                      type="button"
                      className={`timeline-event-row ${selectedEvent === event ? "active" : ""}`}
                      onClick={() => setSelectedEvent(event)}
                    >
                      <div className="crop-card-row">
                        <strong>{event.title}</strong>
                        <span className={`status-pill ${event.severity}`}>{event.severity}</span>
                      </div>
                      <p className="hint">{event.event_date} · {CATEGORY_LABELS[event.category]}</p>
                      <p className="hint">{event.detail}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="timeline-drilldown card">
          <h3>Drill-down</h3>
          {!selectedEvent && <p className="hint">Select an event to inspect details.</p>}
          {selectedEvent && (
            <div className="stack compact">
              <p><strong>{selectedEvent.title}</strong></p>
              <p className="hint">{selectedEvent.event_date} · {CATEGORY_LABELS[selectedEvent.category]} · {selectedEvent.source}</p>
              <p>{selectedEvent.detail}</p>
              <h4>Event Data</h4>
              <ul className="chip-list">
                {Object.entries(selectedEvent.drilldown).map(([key, value]) => (
                  <li key={key} className="timeline-drilldown-row">
                    <strong>{key}:</strong> <span>{value === null ? "-" : String(value)}</span>
                  </li>
                ))}
                {Object.keys(selectedEvent.drilldown).length === 0 && <li className="hint">No additional fields.</li>}
              </ul>
            </div>
          )}
        </section>
      </div>
    </article>
  );
}
