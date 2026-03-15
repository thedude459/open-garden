import { FormEvent, KeyboardEvent, useState } from "react";
import { Bed, CalendarEvent, CropTemplate } from "../types";

type CalendarPanelProps = {
  selectedGardenName?: string;
  monthCursor: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  monthCells: Date[];
  weekdayLabels: string[];
  selectedDate: string;
  today: string;
  eventsByDate: Map<string, CalendarEvent[]>;
  selectedDayEvents: CalendarEvent[];
  onSelectDate: (date: string) => void;
  taskQuery: string;
  onTaskQueryChange: (value: string) => void;
  isLoadingTasks: boolean;
  onCreateTask: (e: FormEvent<HTMLFormElement>) => void;
  onCreatePlanting: (e: FormEvent<HTMLFormElement>) => void;
  beds: Bed[];
  cropSearchQuery: string;
  onCropSearchQueryChange: (value: string) => void;
  onCropSearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  filteredCropTemplates: CropTemplate[];
  cropSearchActiveIndex: number;
  selectedCropName: string;
  onSelectCrop: (crop: CropTemplate) => void;
  cropBaseName: (crop: CropTemplate) => string;
  selectedCrop?: CropTemplate;
  onToggleTaskDone: (taskId: number, done: boolean) => void;
  onDeleteTask: (taskId: number) => void;
  onEditTask: (taskId: number, update: { title?: string; due_on?: string; notes?: string }) => void;
  onLogHarvest: (plantingId: number, harvested_on: string, yield_notes: string) => void;
};

function isoDate(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromIsoDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function monthTitle(value: Date) {
  return value.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function CalendarPanel({
  selectedGardenName,
  monthCursor,
  onPrevMonth,
  onNextMonth,
  monthCells,
  weekdayLabels,
  selectedDate,
  today,
  eventsByDate,
  selectedDayEvents,
  onSelectDate,
  taskQuery,
  onTaskQueryChange,
  isLoadingTasks,
  onCreateTask,
  onCreatePlanting,
  beds,
  cropSearchQuery,
  onCropSearchQueryChange,
  onCropSearchKeyDown,
  filteredCropTemplates,
  cropSearchActiveIndex,
  selectedCropName,
  onSelectCrop,
  cropBaseName,
  selectedCrop,
  onToggleTaskDone,
  onDeleteTask,
  onEditTask,
  onLogHarvest,
}: CalendarPanelProps) {
  const hasCalendarCropOptions = filteredCropTemplates.length > 0;
  const [taskDoneFilter, setTaskDoneFilter] = useState<"all" | "todo" | "done">("all");
  const [taskEditId, setTaskEditId] = useState<number | null>(null);
  const [taskEditDraft, setTaskEditDraft] = useState({ title: "", due_on: "", notes: "" });
  const [harvestEditId, setHarvestEditId] = useState<number | null>(null);
  const [harvestDraft, setHarvestDraft] = useState({ harvested_on: "", yield_notes: "" });

  const hasTasks = selectedDayEvents.some((e) => e.kind === "task");
  const filteredDayEvents = selectedDayEvents.filter((event) => {
    if (event.kind !== "task") return true;
    if (taskDoneFilter === "todo") return !event.is_done;
    if (taskDoneFilter === "done") return event.is_done;
    return true;
  });

  return (
    <article className="card calendar-card">
      <div className="calendar-head">
        <h2>Season Calendar {selectedGardenName ? `- ${selectedGardenName}` : ""}</h2>
        <div className="month-nav">
          <button onClick={onPrevMonth}>Previous</button>
          <strong>{monthTitle(monthCursor)}</strong>
          <button onClick={onNextMonth}>Next</button>
        </div>
      </div>

      <div className="calendar-layout">
        <div className="month-grid" role="grid" aria-label="Month view">
          {weekdayLabels.map((label) => (
            <div key={label} className="weekday">
              {label}
            </div>
          ))}
          {monthCells.map((day) => {
            const dayIso = isoDate(day);
            const dayEvents = eventsByDate.get(dayIso) || [];
            const outsideMonth = day.getMonth() !== monthCursor.getMonth();

            return (
              <button
                key={dayIso}
                className={`day-cell${outsideMonth ? " muted" : ""}${dayIso === selectedDate ? " selected" : ""}${dayIso === today ? " today" : ""}`}
                onClick={() => onSelectDate(dayIso)}
              >
                <span>{day.getDate()}</span>
                <small>{dayEvents.length > 0 ? `${dayEvents.length} item${dayEvents.length === 1 ? "" : "s"}` : ""}</small>
              </button>
            );
          })}
        </div>

        <aside className="agenda-panel">
          <h3>{fromIsoDate(selectedDate).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</h3>
          {hasTasks && (
            <div className="task-filter-row" role="group" aria-label="Filter tasks by status">
              {(["all", "todo", "done"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`task-filter-btn${taskDoneFilter === f ? " active" : ""}`}
                  onClick={() => setTaskDoneFilter(f)}
                >
                  {f === "all" ? "All" : f === "todo" ? "To-do" : "Done"}
                </button>
              ))}
            </div>
          )}
          <ul>
            {selectedDayEvents.length === 0 && <li className="hint">No events scheduled.</li>}
            {selectedDayEvents.length > 0 && filteredDayEvents.length === 0 && (
              <li className="hint">No {taskDoneFilter === "todo" ? "pending" : "completed"} tasks today.</li>
            )}
            {filteredDayEvents.map((event) => (
              <li key={event.id} className={`event-pill ${event.kind}${event.is_done ? " done" : ""}`}>
                {event.kind === "task" && event.taskId !== undefined ? (
                  taskEditId === event.taskId ? (
                    <form
                      className="task-edit-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        onEditTask(event.taskId!, { title: taskEditDraft.title, due_on: taskEditDraft.due_on, notes: taskEditDraft.notes });
                        setTaskEditId(null);
                      }}
                    >
                      <input value={taskEditDraft.title} onChange={(e) => setTaskEditDraft((d) => ({ ...d, title: e.target.value }))} required className="task-edit-input" aria-label="Task title" />
                      <input type="date" value={taskEditDraft.due_on} onChange={(e) => setTaskEditDraft((d) => ({ ...d, due_on: e.target.value }))} required className="task-edit-input" aria-label="Due date" />
                      <input value={taskEditDraft.notes} onChange={(e) => setTaskEditDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Notes" className="task-edit-input" aria-label="Notes" />
                      <div className="task-edit-actions">
                        <button type="submit" className="task-edit-save">Save</button>
                        <button type="button" className="task-edit-cancel" onClick={() => setTaskEditId(null)}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <input
                        type="checkbox"
                        className="task-check"
                        checked={event.is_done ?? false}
                        onChange={(e) => onToggleTaskDone(event.taskId!, e.target.checked)}
                        aria-label={`Mark "${event.title}" as ${event.is_done ? "incomplete" : "complete"}`}
                      />
                      <span className="event-pill-title">{event.title}</span>
                      <button
                        type="button"
                        className="event-pill-action"
                        aria-label="Edit task"
                        onClick={() => { setTaskEditId(event.taskId!); setTaskEditDraft({ title: event.title, due_on: event.date, notes: event.notes || "" }); }}
                      >&#9998;</button>
                      <button
                        type="button"
                        className="event-pill-action delete"
                        aria-label="Delete task"
                        onClick={() => onDeleteTask(event.taskId!)}
                      >&#10005;</button>
                    </>
                  )
                ) : event.kind === "harvest" && event.plantingId !== undefined ? (
                  harvestEditId === event.plantingId ? (
                    <form
                      className="task-edit-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        onLogHarvest(event.plantingId!, harvestDraft.harvested_on, harvestDraft.yield_notes);
                        setHarvestEditId(null);
                      }}
                    >
                      <input type="date" value={harvestDraft.harvested_on} onChange={(e) => setHarvestDraft((d) => ({ ...d, harvested_on: e.target.value }))} required className="task-edit-input" aria-label="Harvest date" />
                      <input value={harvestDraft.yield_notes} onChange={(e) => setHarvestDraft((d) => ({ ...d, yield_notes: e.target.value }))} placeholder="Yield notes (optional)" className="task-edit-input" aria-label="Yield notes" />
                      <div className="task-edit-actions">
                        <button type="submit" className="task-edit-save">Save</button>
                        <button type="button" className="task-edit-cancel" onClick={() => setHarvestEditId(null)}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <span className="event-pill-title">{event.title}</span>
                      {event.harvested_on ? (
                        <>
                          <span className="harvest-logged">&#10003; {event.harvested_on}</span>
                          {event.yield_notes && <span className="harvest-yield-notes">{event.yield_notes}</span>}
                          <button
                            type="button"
                            className="event-pill-action"
                            aria-label="Edit harvest"
                            onClick={() => { setHarvestEditId(event.plantingId!); setHarvestDraft({ harvested_on: event.harvested_on!, yield_notes: event.yield_notes || "" }); }}
                          >&#9998;</button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="log-harvest-btn"
                          onClick={() => { setHarvestEditId(event.plantingId!); setHarvestDraft({ harvested_on: today, yield_notes: "" }); }}
                        >Log harvest</button>
                      )}
                    </>
                  )
                ) : (
                  <span className="event-pill-title">{event.title}</span>
                )}
              </li>
            ))}
          </ul>

          <h4>Add Task</h4>
          <div className="stack compact">
            <label className="field-label" htmlFor="task-filter-query">Filter Tasks</label>
            <input id="task-filter-query" value={taskQuery} onChange={(e) => onTaskQueryChange(e.target.value)} placeholder="Filter tasks" />
          </div>
          {isLoadingTasks && <p className="hint">Refreshing task list...</p>}
          <form onSubmit={onCreateTask} className="stack compact">
            <div className="stack compact">
              <label className="field-label" htmlFor="task-title">Task Title</label>
              <input id="task-title" name="title" placeholder="Task title" required />
            </div>
            <div className="stack compact">
              <label className="field-label" htmlFor="task-due-on">Due Date</label>
              <input id="task-due-on" name="due_on" type="date" defaultValue={selectedDate} required />
            </div>
            <div className="stack compact">
              <label className="field-label" htmlFor="task-notes">Task Notes</label>
              <input id="task-notes" name="notes" placeholder="Notes" />
            </div>
            <button type="submit">Add task</button>
          </form>

          <h4>Add Planting</h4>
          <form onSubmit={onCreatePlanting} className="stack compact">
            <div className="stack compact">
              <label className="field-label" htmlFor="planting-bed">Bed</label>
              <select id="planting-bed" name="bed_id" defaultValue={beds[0]?.id || ""} required>
                {beds.map((bed) => (
                  <option key={bed.id} value={bed.id}>
                    {bed.name}
                  </option>
                ))}
              </select>
            </div>
            <input type="hidden" name="crop_name" value={selectedCropName} />
            <div className="crop-picker">
              <label className="field-label" htmlFor="calendar-crop-search">Search Vegetable</label>
              <input
                id="calendar-crop-search"
                value={cropSearchQuery}
                onChange={(e) => onCropSearchQueryChange(e.target.value)}
                onKeyDown={onCropSearchKeyDown}
                placeholder="Search by vegetable, variety, or family"
                role="combobox"
                aria-autocomplete="list"
                aria-haspopup="listbox"
                aria-controls="calendar-crop-list"
                aria-expanded={hasCalendarCropOptions}
                aria-activedescendant={hasCalendarCropOptions && filteredCropTemplates[cropSearchActiveIndex] ? `calendar-crop-option-${filteredCropTemplates[cropSearchActiveIndex].id}` : undefined}
              />
              <div id="calendar-crop-list" className="crop-picker-list" role="listbox" aria-label="Vegetable search results">
                {filteredCropTemplates.slice(0, 8).map((crop, index) => (
                  <button
                    key={crop.id}
                    id={`calendar-crop-option-${crop.id}`}
                    type="button"
                    role="option"
                    aria-selected={selectedCropName === crop.name || cropSearchActiveIndex === index}
                    className={selectedCropName === crop.name || cropSearchActiveIndex === index ? "crop-option active" : "crop-option"}
                    onClick={() => onSelectCrop(crop)}
                  >
                    <strong>{cropBaseName(crop)}</strong>
                    <small>{crop.variety || crop.family || "Vegetable"}</small>
                  </button>
                ))}
                {filteredCropTemplates.length === 0 && <p className="hint">No vegetables match that search.</p>}
              </div>
            </div>
            {selectedCrop && (
              <div className="crop-card">
                <div className="crop-card-row">
                  <span>
                    <strong>{cropBaseName(selectedCrop)}</strong>
                    {selectedCrop.variety && <span className="crop-tag variety">{selectedCrop.variety}</span>}
                    {selectedCrop.family && <span className="crop-tag family">{selectedCrop.family}</span>}
                  </span>
                  <span>
                    {selectedCrop.frost_hardy ? <span className="crop-tag frost">Frost hardy</span> : <span className="crop-tag warm">Warm season</span>}
                    {selectedCrop.direct_sow ? <span className="crop-tag sow">Direct sow</span> : <span className="crop-tag transplant">Start indoors {selectedCrop.weeks_to_transplant} wks ahead</span>}
                  </span>
                </div>
                <p className="hint"><strong>When to plant:</strong> {selectedCrop.planting_window}</p>
                <p className="hint">Spacing {selectedCrop.spacing_in} in &middot; Harvest in ~{selectedCrop.days_to_harvest} days</p>
                {selectedCrop.notes && <p className="hint crop-notes">{selectedCrop.notes}</p>}
              </div>
            )}
            <div className="stack compact">
              <label className="field-label" htmlFor="planting-date">Planting Date</label>
              <input id="planting-date" name="planted_on" type="date" defaultValue={selectedDate} required />
            </div>
            <div className="stack compact">
              <label className="field-label" htmlFor="planting-source">Source</label>
              <input id="planting-source" name="source" placeholder="Source (seed, transplant...)" />
            </div>
            <button type="submit" disabled={filteredCropTemplates.length === 0 || !selectedCropName}>Add planting</button>
          </form>
        </aside>
      </div>
    </article>
  );
}
