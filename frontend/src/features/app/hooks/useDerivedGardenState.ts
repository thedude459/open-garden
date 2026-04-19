import { useMemo } from "react";
import {
  CalendarEvent,
  ClimatePlantingWindow,
  CropTemplate,
  Garden,
  GardenClimate,
  GardenClimatePlantingWindows,
  Planting,
  Task,
} from "../../types";

interface WeatherData {
  daily?: {
    time: string[];
    temperature_2m_min: number[];
    temperature_2m_max: number[];
    precipitation_sum: number[];
  };
}

/** Local Monday–Sunday week bounds as YYYY-MM-DD (matches calendar month grid week start). */
export function getLocalIsoWeekRange(todayStr: string): { start: string; end: string } {
  const ref = new Date(`${todayStr}T12:00:00`);
  const mondayOffset = (ref.getDay() + 6) % 7;
  const startDate = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - mondayOffset);
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6);
  const toYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  return { start: toYmd(startDate), end: toYmd(endDate) };
}

interface UseDerivedGardenStateParams {
  today: string;
  tasks: Task[];
  plantings: Planting[];
  monthCursor: Date;
  selectedDate: string;
  cropTemplates: CropTemplate[];
  plantingWindows: GardenClimatePlantingWindows | null;
  weather: WeatherData | null;
  gardenClimate: GardenClimate | null;
  selectedCropName: string;
  selectedGardenRecord: Garden | undefined;
}

export function useDerivedGardenState({
  today,
  tasks,
  plantings,
  monthCursor,
  selectedDate,
  cropTemplates,
  plantingWindows,
  weather,
  gardenClimate,
  selectedCropName,
  selectedGardenRecord,
}: UseDerivedGardenStateParams) {
  const calendarEvents = useMemo(() => {
    const events: CalendarEvent[] = tasks.map((task) => ({
      id: `task-${task.id}`,
      date: task.due_on,
      title: task.title,
      kind: "task",
      taskId: task.id,
      is_done: task.is_done,
      notes: task.notes,
    }));
    plantings.forEach((planting) => {
      events.push({
        id: `planting-${planting.id}`,
        date: planting.planted_on,
        title: `Plant ${planting.crop_name}`,
        kind: "planting",
      });
      events.push({
        id: `harvest-${planting.id}`,
        date: planting.expected_harvest_on,
        title: `Harvest ${planting.crop_name}`,
        kind: "harvest",
        plantingId: planting.id,
        harvested_on: planting.harvested_on,
        yield_notes: planting.yield_notes,
      });
    });
    return events;
  }, [tasks, plantings]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    calendarEvents.forEach((event) => {
      const list = map.get(event.date) || [];
      list.push(event);
      map.set(event.date, list);
    });
    return map;
  }, [calendarEvents]);

  const monthCells = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const offset = (firstDay.getDay() + 6) % 7;
    const cells: Date[] = [];
    for (let i = 0; i < 42; i += 1) {
      cells.push(new Date(year, month, i - offset + 1));
    }
    return cells;
  }, [monthCursor]);

  const cropMap = useMemo(
    () => new Map(cropTemplates.map((crop) => [crop.name, crop])),
    [cropTemplates],
  );

  const selectedCrop = cropMap.get(selectedCropName);

  const selectedCropWindow = useMemo<ClimatePlantingWindow | undefined>(() => {
    if (!plantingWindows || !selectedCropName) return undefined;
    return plantingWindows.windows.find((w) => w.crop_name === selectedCropName);
  }, [plantingWindows, selectedCropName]);

  const pendingTasks = useMemo(
    () =>
      [...tasks]
        .filter((task) => !task.is_done)
        .sort((left, right) => left.due_on.localeCompare(right.due_on)),
    [tasks],
  );

  const weekEndYmd = useMemo(() => getLocalIsoWeekRange(today).end, [today]);

  /** Open tasks due by end of this calendar week (includes overdue); excludes due dates after Sunday. */
  const pendingTasksThisWeekOrOverdue = useMemo(
    () => pendingTasks.filter((task) => task.due_on <= weekEndYmd),
    [pendingTasks, weekEndYmd],
  );

  const homeTaskPreview = useMemo(
    () => pendingTasksThisWeekOrOverdue.slice(0, 4),
    [pendingTasksThisWeekOrOverdue],
  );

  const overdueTaskCount = useMemo(
    () => pendingTasks.filter((task) => task.due_on < today).length,
    [pendingTasks, today],
  );

  const upcomingTaskCount = pendingTasksThisWeekOrOverdue.length;

  const weatherPreview = useMemo(() => {
    if (!weather?.daily?.time) {
      return [] as Array<{ date: string; low: number; high: number; rain: number }>;
    }
    return weather.daily.time.slice(0, 3).map((date: string, index: number) => ({
      date,
      low: weather.daily!.temperature_2m_min[index],
      high: weather.daily!.temperature_2m_max[index],
      rain: weather.daily!.precipitation_sum[index],
    }));
  }, [weather]);

  const actionablePlantingWindows = useMemo(() => {
    const priority = new Map([
      ["open", 0],
      ["closing", 1],
      ["watch", 2],
      ["upcoming", 3],
      ["stable", 4],
      ["wait", 5],
    ]);
    return (plantingWindows?.windows || [])
      .filter((w) =>
        ["open", "closing", "watch", "upcoming", "stable"].includes(w.status),
      )
      .sort((a, b) => (priority.get(a.status) ?? 99) - (priority.get(b.status) ?? 99))
      .slice(0, 3);
  }, [plantingWindows]);

  const weatherRiskCues = useMemo(() => {
    const cues: string[] = [];
    if (gardenClimate && gardenClimate.frost_risk_next_10_days !== "low") {
      cues.push(
        `Frost risk is ${gardenClimate.frost_risk_next_10_days} over the next 10 days.`,
      );
    }
    if (weatherPreview.some((day) => day.rain >= 0.5)) {
      cues.push(
        "Heavy rain is in the short-range forecast. Check drainage and delay direct sowing if beds stay wet.",
      );
    }
    if (weatherPreview.some((day) => day.high >= 85)) {
      cues.push(
        "Heat is approaching. Prioritize watering and transplant timing early in the day.",
      );
    }
    return cues.slice(0, 3);
  }, [gardenClimate, weatherPreview]);

  const selectedDayEvents = eventsByDate.get(selectedDate) || [];
  const selectedGardenName = selectedGardenRecord?.name;
  const yardWidthFt = Math.max(4, selectedGardenRecord?.yard_width_ft || 20);
  const yardLengthFt = Math.max(4, selectedGardenRecord?.yard_length_ft || 20);

  return {
    calendarEvents,
    eventsByDate,
    monthCells,
    cropMap,
    selectedCrop,
    selectedCropWindow,
    pendingTasks,
    homeTaskPreview,
    overdueTaskCount,
    upcomingTaskCount,
    weatherPreview,
    actionablePlantingWindows,
    weatherRiskCues,
    selectedDayEvents,
    selectedGardenName,
    yardWidthFt,
    yardLengthFt,
  };
}
