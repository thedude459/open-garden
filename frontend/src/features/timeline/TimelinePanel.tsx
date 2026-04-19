import { useMemo, useState } from "react";
import { History, Filter, Rss, Info, RefreshCw } from "lucide-react";
import { GardenTimeline, GardenTimelineEvent, TimelineCategory } from "../types";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/SectionHeader";

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
    <article className="card">
      <SectionHeader
        icon={History}
        title={`Unified Timeline ${selectedGardenName ? `- ${selectedGardenName}` : ""}`}
        subtitle="Daily and weekly command center across tasks, weather, planting windows, sensors, and AI guidance."
        actions={
          <button type="button" className="secondary-btn" onClick={onRefresh}>
            <RefreshCw className="inline-block h-3.5 w-3.5 mr-1.5 align-[-1px]" aria-hidden />
            Refresh
          </button>
        }
      />

      <section className="card timeline-filter-panel">
        <SectionHeader variant="section" headingLevel="h3" icon={Filter} title="Filters" />
        <div className="flex flex-wrap gap-3 mt-2">
          {(Object.keys(CATEGORY_LABELS) as TimelineCategory[]).map((category) => (
            <label key={category} className="flex items-center gap-1.5 text-sm cursor-pointer">
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

      <div className="timeline-columns">
        <section className="card timeline-events-col">
          <SectionHeader variant="section" headingLevel="h3" icon={Rss} title="Timeline Events" />
          {isLoading && <p className="hint">Loading timeline...</p>}
          {!isLoading && filteredEvents.length === 0 && <p className="hint">No timeline events match the selected filters.</p>}

          {activeCategories.planting_window && plantingWindowGroups.length > 0 && (
            <>
              <h4 className="hint timeline-group-heading">Planting Windows</h4>
              <ul className="space-y-1 mt-2">
                {plantingWindowGroups.map(({ baseName, events: groupEvents }) => {
                  const idx = selectedVarietyIdx[baseName] ?? 0;
                  const event = groupEvents[idx];
                  return (
                    <li key={baseName}>
                      <button
                        type="button"
                        className={`timeline-event-btn${selectedEvent === event ? " selected" : ""}`}
                        onClick={() => setSelectedEvent(event)}
                      >
                        <div className="crop-card-row">
                          <strong>Planting window: {baseName}</strong>
                          <Badge variant="outline">{event.severity}</Badge>
                        </div>
                        {groupEvents.length > 1 && (
                          <select
                            className="timeline-variety-select"
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
                                <p className="hint timeline-event-meta">Start indoors: {String(d.indoor_seed_start)} – {String(d.indoor_seed_end || "?")}</p>
                                <p className="hint timeline-event-meta">Transplant outdoors: {String(d.outdoor_window_start)} – {String(d.outdoor_window_end)}</p>
                              </>
                            );
                          }
                          return <p className="hint timeline-event-meta">Direct sow outdoors: {String(d.outdoor_window_start)} – {String(d.outdoor_window_end)}</p>;
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
                <h4 className="hint timeline-group-heading timeline-group-heading-spaced">Other Events</h4>
              )}
              <ul className="space-y-1 mt-2">
                {otherFilteredEvents.map((event, index) => (
                  <li key={`${event.category}-${event.event_date}-${index}`}>
                    <button
                      type="button"
                      className={`timeline-event-btn${selectedEvent === event ? " selected" : ""}`}
                      onClick={() => setSelectedEvent(event)}
                    >
                      <div className="crop-card-row">
                        <strong>{event.title}</strong>
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{event.severity}</span>
                      </div>
                      <p className="hint timeline-event-meta">{event.event_date} · {CATEGORY_LABELS[event.category]}</p>
                      <p className="hint timeline-event-detail">{event.detail}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="card timeline-drilldown-col">
          <SectionHeader variant="section" headingLevel="h3" icon={Info} title="Drill-down" />
          {!selectedEvent && <p className="hint">Select an event to inspect details.</p>}
          {selectedEvent && (
            <div className="stack compact">
              <p><strong>{selectedEvent.title}</strong></p>
              <p className="hint">{selectedEvent.event_date} · {CATEGORY_LABELS[selectedEvent.category]} · {selectedEvent.source}</p>
              <p>{selectedEvent.detail}</p>
              <h4>Event Data</h4>
              <ul className="space-y-1">
                {Object.entries(selectedEvent.drilldown).map(([key, value]) => (
                  <li key={key} className="flex gap-2 py-1 text-sm border-b last:border-b-0">
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
