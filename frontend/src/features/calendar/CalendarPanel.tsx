import { FormEvent, useState } from "react";
import { weekdayLabels } from "../app/constants";
import { cropBaseName } from "../app/cropUtils";
import { useCalendarContext } from "./CalendarContext";

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

export function CalendarPanel() {
  const {
    monthCursor,
    setMonthCursor,
    selectedDate,
    setSelectedDate,
    today,
    beds,
    taskActions,
    cropFormState,
    derived,
    selectedCropName,
    isLoadingPlantingWindows,
  } = useCalendarContext();

  const hasCalendarCropOptions = cropFormState.filteredCropTemplates.length > 0;
  const [taskDoneFilter, setTaskDoneFilter] = useState<"all" | "todo" | "done">("all");
  const [taskEditId, setTaskEditId] = useState<number | null>(null);
  const [taskEditDraft, setTaskEditDraft] = useState({ title: "", due_on: "", notes: "" });
  const [harvestEditId, setHarvestEditId] = useState<number | null>(null);
  const [harvestDraft, setHarvestDraft] = useState({ harvested_on: "", yield_notes: "" });
  const [taskFormErrors, setTaskFormErrors] = useState<{ title: string; due_on: string }>({ title: "", due_on: "" });
  const [plantingFormErrors, setPlantingFormErrors] = useState<{ bed_id: string; crop_name: string; planted_on: string }>({ bed_id: "", crop_name: "", planted_on: "" });

  const hasTasks = derived.selectedDayEvents.some((e) => e.kind === "task");
  const filteredDayEvents = derived.selectedDayEvents.filter((event) => {
    if (event.kind !== "task") return true;
    if (taskDoneFilter === "todo") return !event.is_done;
    if (taskDoneFilter === "done") return event.is_done;
    return true;
  });

  function validateTaskField(field: "title" | "due_on", value: string) {
    if (field === "title") {
      return value.trim() ? "" : "Task title is required.";
    }
    return value.trim() ? "" : "Due date is required.";
  }

  function validatePlantingField(field: "bed_id" | "crop_name" | "planted_on", value: string) {
    if (field === "bed_id") {
      return value.trim() ? "" : "Choose a bed for this planting.";
    }
    if (field === "crop_name") {
      return value.trim() ? "" : "Choose a vegetable before adding a planting.";
    }
    return value.trim() ? "" : "Planting date is required.";
  }

  function handleTaskFieldBlur(field: "title" | "due_on", value: string) {
    setTaskFormErrors((current) => ({ ...current, [field]: validateTaskField(field, value) }));
  }

  function handlePlantingFieldBlur(field: "bed_id" | "crop_name" | "planted_on", value: string) {
    setPlantingFormErrors((current) => ({ ...current, [field]: validatePlantingField(field, value) }));
  }

  function handleTaskSubmit(e: FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const nextErrors = {
      title: validateTaskField("title", String(fd.get("title") || "")),
      due_on: validateTaskField("due_on", String(fd.get("due_on") || "")),
    };
    setTaskFormErrors(nextErrors);
    if (nextErrors.title || nextErrors.due_on) {
      e.preventDefault();
      return;
    }
    taskActions.createTask(e);
  }

  function handlePlantingSubmit(e: FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const nextErrors = {
      bed_id: validatePlantingField("bed_id", String(fd.get("bed_id") || "")),
      crop_name: validatePlantingField("crop_name", selectedCropName),
      planted_on: validatePlantingField("planted_on", String(fd.get("planted_on") || "")),
    };
    setPlantingFormErrors(nextErrors);
    if (nextErrors.bed_id || nextErrors.crop_name || nextErrors.planted_on) {
      e.preventDefault();
      return;
    }
    taskActions.createPlanting(e);
  }

  return (
    <article className="card calendar-card">
      <div className="calendar-head">
        <h2>Season Calendar {derived.selectedGardenName ? `- ${derived.selectedGardenName}` : ""}</h2>
        <div className="month-nav">
          <button onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>Previous</button>
          <strong>{monthTitle(monthCursor)}</strong>
          <button onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>Next</button>
        </div>
      </div>

      <div className="calendar-layout">
        <div className="month-grid" role="grid" aria-label="Month view">
          {weekdayLabels.map((label) => (
            <div key={label} className="weekday">
              {label}
            </div>
          ))}
          {derived.monthCells.map((day) => {
            const dayIso = isoDate(day);
            const dayEvents = derived.eventsByDate.get(dayIso) || [];
            const outsideMonth = day.getMonth() !== monthCursor.getMonth();

            return (
              <button
                key={dayIso}
                className={`day-cell${outsideMonth ? " muted" : ""}${dayIso === selectedDate ? " selected" : ""}${dayIso === today ? " today" : ""}`}
                onClick={() => setSelectedDate(dayIso)}
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
            {derived.selectedDayEvents.length === 0 && <li className="hint">No events scheduled.</li>}
            {derived.selectedDayEvents.length > 0 && filteredDayEvents.length === 0 && (
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
                        taskActions.editTask(event.taskId!, { title: taskEditDraft.title, due_on: taskEditDraft.due_on, notes: taskEditDraft.notes });
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
                        onChange={(e) => taskActions.toggleTaskDone(event.taskId!, e.target.checked)}
                        aria-label={`Mark "${event.title}" as ${event.is_done ? "incomplete" : "complete"}`}
                      />
                      <span className="event-pill-title">{event.title}</span>
                      <span className="event-pill-actions">
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
                          onClick={() => taskActions.deleteTask(event.taskId!)}
                        >&#10005;</button>
                      </span>
                    </>
                  )
                ) : event.kind === "harvest" && event.plantingId !== undefined ? (
                  harvestEditId === event.plantingId ? (
                    <form
                      className="task-edit-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        taskActions.logHarvest(event.plantingId!, harvestDraft.harvested_on, harvestDraft.yield_notes);
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
                          <span className="event-pill-meta">
                            <span className="harvest-logged">&#10003; {event.harvested_on}</span>
                            {event.yield_notes && <span className="harvest-yield-notes">{event.yield_notes}</span>}
                          </span>
                          <span className="event-pill-actions">
                            <button
                              type="button"
                              className="event-pill-action"
                              aria-label="Edit harvest"
                              onClick={() => { setHarvestEditId(event.plantingId!); setHarvestDraft({ harvested_on: event.harvested_on!, yield_notes: event.yield_notes || "" }); }}
                            >&#9998;</button>
                          </span>
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
            <input id="task-filter-query" value={taskActions.taskQuery} onChange={(e) => taskActions.setTaskQuery(e.target.value)} placeholder="Filter tasks" />
          </div>
          {taskActions.isLoadingTasks && <p className="hint">Refreshing task list...</p>}
          <form onSubmit={handleTaskSubmit} className="stack compact">
            <div className="stack compact">
              <label className="field-label" htmlFor="task-title">Task Title</label>
              <input id="task-title" name="title" placeholder="Task title" aria-invalid={Boolean(taskFormErrors.title)} aria-describedby={taskFormErrors.title ? "task-title-error" : undefined} onBlur={(event) => handleTaskFieldBlur("title", event.currentTarget.value)} required />
              {taskFormErrors.title && <p id="task-title-error" className="field-error">{taskFormErrors.title}</p>}
            </div>
            <div className="stack compact">
              <label className="field-label" htmlFor="task-due-on">Due Date</label>
              <input id="task-due-on" name="due_on" type="date" defaultValue={selectedDate} aria-invalid={Boolean(taskFormErrors.due_on)} aria-describedby={taskFormErrors.due_on ? "task-due-error" : undefined} onBlur={(event) => handleTaskFieldBlur("due_on", event.currentTarget.value)} required />
              {taskFormErrors.due_on && <p id="task-due-error" className="field-error">{taskFormErrors.due_on}</p>}
            </div>
            <div className="stack compact">
              <label className="field-label" htmlFor="task-notes">Task Notes</label>
              <input id="task-notes" name="notes" placeholder="Notes" />
            </div>
            <button type="submit">Add task</button>
          </form>

          <h4>Add Planting</h4>
          <form onSubmit={handlePlantingSubmit} className="stack compact">
            <div className="stack compact">
              <label className="field-label" htmlFor="planting-bed">Bed</label>
              <select id="planting-bed" name="bed_id" defaultValue={beds[0]?.id || ""} aria-invalid={Boolean(plantingFormErrors.bed_id)} aria-describedby={plantingFormErrors.bed_id ? "planting-bed-error" : undefined} onBlur={(event) => handlePlantingFieldBlur("bed_id", event.currentTarget.value)} required>
                {beds.map((bed) => (
                  <option key={bed.id} value={bed.id}>
                    {bed.name}
                  </option>
                ))}
              </select>
              {plantingFormErrors.bed_id && <p id="planting-bed-error" className="field-error">{plantingFormErrors.bed_id}</p>}
            </div>
            <input type="hidden" name="crop_name" value={selectedCropName} />
            <div className="crop-picker">
              <label className="field-label" htmlFor="calendar-crop-search">Search Vegetable</label>
              <input
                id="calendar-crop-search"
                value={cropFormState.cropSearchQuery}
                onChange={(e) => cropFormState.setCropSearchQuery(e.target.value)}
                onKeyDown={cropFormState.handleCropSearchKeyDown}
                onBlur={() => handlePlantingFieldBlur("crop_name", selectedCropName)}
                placeholder="Search by vegetable, variety, or family"
                role="combobox"
                aria-autocomplete="list"
                aria-haspopup="listbox"
                aria-controls="calendar-crop-list"
                aria-expanded={hasCalendarCropOptions}
                aria-activedescendant={hasCalendarCropOptions && cropFormState.filteredCropTemplates[cropFormState.cropSearchActiveIndex] ? `calendar-crop-option-${cropFormState.filteredCropTemplates[cropFormState.cropSearchActiveIndex].id}` : undefined}
              />
              <div id="calendar-crop-list" className="crop-picker-list" role="listbox" aria-label="Vegetable search results">
                {cropFormState.filteredCropTemplates.slice(0, 15).map((crop, index) => (
                  (() => {
                    const isSelected = selectedCropName === crop.name;
                    const isFocused = cropFormState.cropSearchActiveIndex === index;
                    return (
                  <button
                    key={crop.id}
                    id={`calendar-crop-option-${crop.id}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`crop-option${isSelected ? " active" : ""}${!isSelected && isFocused ? " focused" : ""}`}
                    onClick={() => {
                      cropFormState.selectCrop(crop);
                      setPlantingFormErrors((current) => ({ ...current, crop_name: "" }));
                    }}
                  >
                    <strong>{cropBaseName(crop)}</strong>
                    <small>{crop.variety || crop.family || "Vegetable"}</small>
                  </button>
                    );
                  })()
                ))}
                {cropFormState.filteredCropTemplates.length === 0 && <p className="hint">No vegetables match that search.</p>}
              </div>
              {plantingFormErrors.crop_name && <p className="field-error">{plantingFormErrors.crop_name}</p>}
            </div>
            {derived.selectedCrop && (
              <div className="crop-card">
                <div className="crop-card-row">
                  <span>
                    <strong>{cropBaseName(derived.selectedCrop)}</strong>
                    {derived.selectedCrop.variety && <span className="crop-tag variety">{derived.selectedCrop.variety}</span>}
                    {derived.selectedCrop.family && <span className="crop-tag family">{derived.selectedCrop.family}</span>}
                  </span>
                  <span>
                    {derived.selectedCrop.frost_hardy ? <span className="crop-tag frost">Frost hardy</span> : <span className="crop-tag warm">Warm season</span>}
                    {derived.selectedCrop.direct_sow ? <span className="crop-tag sow">Direct sow</span> : <span className="crop-tag transplant">Start indoors {derived.selectedCrop.weeks_to_transplant} wks ahead</span>}
                  </span>
                </div>
                <p className="hint"><strong>When to plant:</strong> {derived.selectedCrop.planting_window}</p>
                {isLoadingPlantingWindows && <p className="hint">Loading dynamic window...</p>}
                {derived.selectedCropWindow && (
                  <>
                    <p className="hint">
                      <strong>Dynamic window:</strong> {derived.selectedCropWindow.window_start} to {derived.selectedCropWindow.window_end} {" "}
                      <span className={`status-pill ${derived.selectedCropWindow.status}`}>{derived.selectedCropWindow.status}</span>
                    </p>
                    {derived.selectedCropWindow.indoor_seed_start && derived.selectedCropWindow.indoor_seed_end && (
                      <p className="hint">
                        <strong>Indoor start:</strong> {derived.selectedCropWindow.indoor_seed_start} to {derived.selectedCropWindow.indoor_seed_end}
                      </p>
                    )}
                    <p className="hint">{derived.selectedCropWindow.reason}</p>
                  </>
                )}
                <p className="hint">Spacing {derived.selectedCrop.spacing_in} in &middot; Harvest in ~{derived.selectedCrop.days_to_harvest} days</p>
                {derived.selectedCrop.notes && <p className="hint crop-notes">{derived.selectedCrop.notes}</p>}
              </div>
            )}
            <div className="stack compact">
              <label className="field-label" htmlFor="planting-date">Planting Date</label>
              <input id="planting-date" name="planted_on" type="date" defaultValue={selectedDate} aria-invalid={Boolean(plantingFormErrors.planted_on)} aria-describedby={plantingFormErrors.planted_on ? "planting-date-error" : undefined} onBlur={(event) => handlePlantingFieldBlur("planted_on", event.currentTarget.value)} required />
              {plantingFormErrors.planted_on && <p id="planting-date-error" className="field-error">{plantingFormErrors.planted_on}</p>}
            </div>
            <div className="stack compact">
              <label className="field-label" htmlFor="planting-source">Source</label>
              <input id="planting-source" name="source" placeholder="Source (seed, transplant...)" />
            </div>
            <button type="submit" disabled={cropFormState.filteredCropTemplates.length === 0 || !selectedCropName}>Add planting</button>
          </form>
        </aside>
      </div>
    </article>
  );
}
