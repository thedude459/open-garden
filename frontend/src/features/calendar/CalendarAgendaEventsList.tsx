import { Dispatch, SetStateAction } from "react";
import { CalendarEvent } from "../types";
import { TaskActions } from "./CalendarContext";

type TaskDraft = { title: string; due_on: string; notes: string };
type HarvestDraft = { harvested_on: string; yield_notes: string };

type CalendarAgendaEventsListProps = {
  selectedDateLabel: string;
  hasTasks: boolean;
  taskDoneFilter: "all" | "todo" | "done";
  setTaskDoneFilter: (value: "all" | "todo" | "done") => void;
  selectedDayEvents: CalendarEvent[];
  filteredDayEvents: CalendarEvent[];
  taskEditId: number | null;
  taskEditDraft: TaskDraft;
  setTaskEditDraft: Dispatch<SetStateAction<TaskDraft>>;
  setTaskEditId: (value: number | null) => void;
  harvestEditId: number | null;
  harvestDraft: HarvestDraft;
  setHarvestDraft: Dispatch<SetStateAction<HarvestDraft>>;
  setHarvestEditId: (value: number | null) => void;
  taskActions: TaskActions;
  beginTaskEdit: (event: CalendarEvent) => void;
  saveTaskEdit: (taskId: number) => void;
  beginHarvestEdit: (event: CalendarEvent) => void;
  beginHarvestLog: (plantingId: number, today: string) => void;
  saveHarvestEdit: (plantingId: number) => void;
  today: string;
};

export function CalendarAgendaEventsList({
  selectedDateLabel,
  hasTasks,
  taskDoneFilter,
  setTaskDoneFilter,
  selectedDayEvents,
  filteredDayEvents,
  taskEditId,
  taskEditDraft,
  setTaskEditDraft,
  setTaskEditId,
  harvestEditId,
  harvestDraft,
  setHarvestDraft,
  setHarvestEditId,
  taskActions,
  beginTaskEdit,
  saveTaskEdit,
  beginHarvestEdit,
  beginHarvestLog,
  saveHarvestEdit,
  today,
}: CalendarAgendaEventsListProps) {
  return (
    <>
      <h3>{selectedDateLabel}</h3>
      {hasTasks && (
        <div className="task-filter-row" role="group" aria-label="Filter tasks by status">
          {(["all", "todo", "done"] as const).map((filterValue) => (
            <button
              key={filterValue}
              type="button"
              className={`task-filter-btn${taskDoneFilter === filterValue ? " active" : ""}`}
              onClick={() => setTaskDoneFilter(filterValue)}
            >
              {filterValue === "all" ? "All" : filterValue === "todo" ? "To-do" : "Done"}
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
                  onSubmit={(submitEvent) => {
                    submitEvent.preventDefault();
                    saveTaskEdit(event.taskId!);
                  }}
                >
                  <input value={taskEditDraft.title} onChange={(changeEvent) => setTaskEditDraft((draft) => ({ ...draft, title: changeEvent.target.value }))} required className="task-edit-input" aria-label="Task title" />
                  <input type="date" value={taskEditDraft.due_on} onChange={(changeEvent) => setTaskEditDraft((draft) => ({ ...draft, due_on: changeEvent.target.value }))} required className="task-edit-input" aria-label="Due date" />
                  <input value={taskEditDraft.notes} onChange={(changeEvent) => setTaskEditDraft((draft) => ({ ...draft, notes: changeEvent.target.value }))} placeholder="Notes" className="task-edit-input" aria-label="Notes" />
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
                    onChange={(changeEvent) => taskActions.toggleTaskDone(event.taskId!, changeEvent.target.checked)}
                    aria-label={`Mark "${event.title}" as ${event.is_done ? "incomplete" : "complete"}`}
                  />
                  <span className="event-pill-title">{event.title}</span>
                  <span className="event-pill-actions">
                    <button type="button" className="event-pill-action" aria-label="Edit task" onClick={() => beginTaskEdit(event)}>&#9998;</button>
                    <button type="button" className="event-pill-action delete" aria-label="Delete task" onClick={() => taskActions.deleteTask(event.taskId!)}>&#10005;</button>
                  </span>
                </>
              )
            ) : event.kind === "harvest" && event.plantingId !== undefined ? (
              harvestEditId === event.plantingId ? (
                <form
                  className="task-edit-form"
                  onSubmit={(submitEvent) => {
                    submitEvent.preventDefault();
                    saveHarvestEdit(event.plantingId!);
                  }}
                >
                  <input type="date" value={harvestDraft.harvested_on} onChange={(changeEvent) => setHarvestDraft((draft) => ({ ...draft, harvested_on: changeEvent.target.value }))} required className="task-edit-input" aria-label="Harvest date" />
                  <input value={harvestDraft.yield_notes} onChange={(changeEvent) => setHarvestDraft((draft) => ({ ...draft, yield_notes: changeEvent.target.value }))} placeholder="Yield notes (optional)" className="task-edit-input" aria-label="Yield notes" />
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
                        <button type="button" className="event-pill-action" aria-label="Edit harvest" onClick={() => beginHarvestEdit(event)}>&#9998;</button>
                      </span>
                    </>
                  ) : (
                    <button type="button" className="log-harvest-btn" onClick={() => beginHarvestLog(event.plantingId!, today)}>Log harvest</button>
                  )}
                </>
              )
            ) : (
              <span className="event-pill-title">{event.title}</span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
