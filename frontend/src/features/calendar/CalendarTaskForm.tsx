import { FormEvent } from "react";

type CalendarTaskFormProps = {
  taskQuery: string;
  setTaskQuery: (value: string) => void;
  isLoadingTasks: boolean;
  selectedDate: string;
  taskFormErrors: { title: string; due_on: string };
  handleTaskFieldBlur: (field: "title" | "due_on", value: string) => void;
  handleTaskSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function CalendarTaskForm({
  taskQuery,
  setTaskQuery,
  isLoadingTasks,
  selectedDate,
  taskFormErrors,
  handleTaskFieldBlur,
  handleTaskSubmit,
}: CalendarTaskFormProps) {
  return (
    <>
      <h4>Add Task</h4>
      <div className="stack compact">
        <label className="field-label" htmlFor="task-filter-query">Filter Tasks</label>
        <input id="task-filter-query" value={taskQuery} onChange={(event) => setTaskQuery(event.target.value)} placeholder="Filter tasks" />
      </div>
      {isLoadingTasks && <p className="hint">Refreshing task list...</p>}
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
    </>
  );
}
