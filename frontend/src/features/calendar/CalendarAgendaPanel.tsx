import { Dispatch, FormEvent, SetStateAction } from "react";
import { CalendarEvent } from "../types";
import { TaskActions } from "./CalendarContext";
import { CalendarAgendaEventsList } from "./CalendarAgendaEventsList";
import { CalendarTaskForm } from "./CalendarTaskForm";

type TaskDraft = { title: string; due_on: string; notes: string };
type HarvestDraft = { harvested_on: string; yield_notes: string };

type CalendarAgendaPanelProps = {
  selectedDateLabel: string;
  selectedDayEvents: CalendarEvent[];
  filteredDayEvents: CalendarEvent[];
  hasTasks: boolean;
  taskDoneFilter: "all" | "todo" | "done";
  setTaskDoneFilter: (value: "all" | "todo" | "done") => void;
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
  taskFormErrors: { title: string; due_on: string };
  handleTaskFieldBlur: (field: "title" | "due_on", value: string) => void;
  handleTaskSubmit: (event: FormEvent<HTMLFormElement>) => void;
  selectedDate: string;
};

export function CalendarAgendaPanel(props: CalendarAgendaPanelProps) {
  return (
    <aside className="agenda-panel">
      <CalendarAgendaEventsList
        selectedDateLabel={props.selectedDateLabel}
        hasTasks={props.hasTasks}
        taskDoneFilter={props.taskDoneFilter}
        setTaskDoneFilter={props.setTaskDoneFilter}
        selectedDayEvents={props.selectedDayEvents}
        filteredDayEvents={props.filteredDayEvents}
        taskEditId={props.taskEditId}
        taskEditDraft={props.taskEditDraft}
        setTaskEditDraft={props.setTaskEditDraft}
        setTaskEditId={props.setTaskEditId}
        harvestEditId={props.harvestEditId}
        harvestDraft={props.harvestDraft}
        setHarvestDraft={props.setHarvestDraft}
        setHarvestEditId={props.setHarvestEditId}
        taskActions={props.taskActions}
        beginTaskEdit={props.beginTaskEdit}
        saveTaskEdit={props.saveTaskEdit}
        beginHarvestEdit={props.beginHarvestEdit}
        beginHarvestLog={props.beginHarvestLog}
        saveHarvestEdit={props.saveHarvestEdit}
        today={props.today}
      />

      <CalendarTaskForm
        taskQuery={props.taskActions.taskQuery}
        setTaskQuery={props.taskActions.setTaskQuery}
        isLoadingTasks={props.taskActions.isLoadingTasks}
        selectedDate={props.selectedDate}
        taskFormErrors={props.taskFormErrors}
        handleTaskFieldBlur={props.handleTaskFieldBlur}
        handleTaskSubmit={props.handleTaskSubmit}
      />
    </aside>
  );
}
