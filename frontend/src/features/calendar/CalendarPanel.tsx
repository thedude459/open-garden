import { useCalendarContext } from "./CalendarContext";
import { CalendarMonthGrid } from "./CalendarMonthGrid";
import { CalendarAgendaPanel } from "./CalendarAgendaPanel";
import { fromIsoDate, monthTitle } from "./utils/calendarDateUtils";
import { useCalendarAgendaState } from "./hooks/useCalendarAgendaState";

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
  const agendaState = useCalendarAgendaState({
    selectedDayEvents: derived.selectedDayEvents,
    selectedCropName,
    taskActions,
  });

  return (
    <article className="card calendar-card">
      <div className="calendar-layout">
        <CalendarMonthGrid
          title={`Season Calendar ${derived.selectedGardenName ? `- ${derived.selectedGardenName}` : ""}`}
          monthCursor={monthCursor}
          selectedDate={selectedDate}
          today={today}
          monthCells={derived.monthCells}
          eventsByDate={derived.eventsByDate}
          setSelectedDate={setSelectedDate}
          setMonthCursor={setMonthCursor}
          monthTitle={monthTitle}
        />

        <CalendarAgendaPanel
          selectedDateLabel={fromIsoDate(selectedDate).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
          selectedDayEvents={derived.selectedDayEvents}
          filteredDayEvents={agendaState.filteredDayEvents}
          hasTasks={agendaState.hasTasks}
          taskDoneFilter={agendaState.taskDoneFilter}
          setTaskDoneFilter={agendaState.setTaskDoneFilter}
          taskEditId={agendaState.taskEditId}
          taskEditDraft={agendaState.taskEditDraft}
          setTaskEditDraft={agendaState.setTaskEditDraft}
          setTaskEditId={agendaState.setTaskEditId}
          harvestEditId={agendaState.harvestEditId}
          harvestDraft={agendaState.harvestDraft}
          setHarvestDraft={agendaState.setHarvestDraft}
          setHarvestEditId={agendaState.setHarvestEditId}
          taskActions={taskActions}
          beginTaskEdit={agendaState.beginTaskEdit}
          saveTaskEdit={agendaState.saveTaskEdit}
          beginHarvestEdit={agendaState.beginHarvestEdit}
          beginHarvestLog={agendaState.beginHarvestLog}
          saveHarvestEdit={agendaState.saveHarvestEdit}
          today={today}
          taskFormErrors={agendaState.taskFormErrors}
          handleTaskFieldBlur={agendaState.handleTaskFieldBlur}
          handleTaskSubmit={agendaState.handleTaskSubmit}
          beds={beds}
          selectedDate={selectedDate}
          selectedCropName={selectedCropName}
          filteredCropTemplates={cropFormState.filteredCropTemplates}
          cropSearchQuery={cropFormState.cropSearchQuery}
          setCropSearchQuery={cropFormState.setCropSearchQuery}
          handleCropSearchKeyDown={cropFormState.handleCropSearchKeyDown}
          cropSearchActiveIndex={cropFormState.cropSearchActiveIndex}
          selectCrop={cropFormState.selectCrop}
          setPlantingCropCleared={() =>
            agendaState.setPlantingFormErrors((current) => ({ ...current, crop_name: "" }))
          }
          plantingFormErrors={agendaState.plantingFormErrors}
          handlePlantingFieldBlur={agendaState.handlePlantingFieldBlur}
          handlePlantingSubmit={agendaState.handlePlantingSubmit}
          selectedCrop={derived.selectedCrop}
          selectedCropWindow={derived.selectedCropWindow}
          isLoadingPlantingWindows={isLoadingPlantingWindows}
        />
      </div>
    </article>
  );
}
