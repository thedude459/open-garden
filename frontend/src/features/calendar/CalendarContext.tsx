import {
  Dispatch,
  FormEvent,
  KeyboardEvent,
  ReactNode,
  SetStateAction,
  createContext,
  useContext,
} from "react";
import { Bed, CropTemplate, ClimatePlantingWindow, GardenClimate, Task, CalendarEvent } from "../types";

export interface TaskActions {
  tasks: Task[];
  taskQuery: string;
  setTaskQuery: (value: string) => void;
  isLoadingTasks: boolean;
  createTask: (e: FormEvent<HTMLFormElement>) => void;
  toggleTaskDone: (taskId: number, done: boolean) => void;
  deleteTask: (taskId: number) => void;
  editTask: (taskId: number, update: { title?: string; due_on?: string; notes?: string }) => void;
  logHarvest: (plantingId: number, harvested_on: string, yield_notes: string) => void;
}

export interface CropFormState {
  cropSearchQuery: string;
  setCropSearchQuery: (value: string) => void;
  handleCropSearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  filteredCropTemplates: CropTemplate[];
  cropSearchActiveIndex: number;
  selectCrop: (crop: CropTemplate) => void;
}

export interface CalendarDerivedState {
  selectedGardenName?: string;
  monthCells: Date[];
  eventsByDate: Map<string, CalendarEvent[]>;
  selectedDayEvents: CalendarEvent[];
  selectedCrop?: CropTemplate;
  selectedCropWindow?: ClimatePlantingWindow;
}

type WeatherResponse = {
  [key: string]: unknown;
};

export interface CalendarContextType {
  // Date state
  monthCursor: Date;
  setMonthCursor: Dispatch<SetStateAction<Date>>;
  selectedDate: string;
  setSelectedDate: (value: string) => void;
  today: string;
  
  // Data
  beds: Bed[];
  weather: WeatherResponse | null;
  gardenClimate: GardenClimate | null;
  
  // State management
  taskActions: TaskActions;
  cropFormState: CropFormState;
  derived: CalendarDerivedState;
  selectedCropName: string;
  
  // Loading states
  isLoadingPlantingWindows: boolean;
  isLoadingClimate: boolean;
  isLoadingWeather: boolean;
  
  // Utilities
  pushNotice: (message: string, kind: "info" | "success" | "error") => void;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

/**
 * Provider component for calendar feature
 * Consolidates calendar-specific state to avoid prop drilling
 */
export function CalendarProvider({ children, value }: { children: ReactNode; value: CalendarContextType }) {
  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
}

/**
 * Hook to access calendar context
 */
export function useCalendarContext(): CalendarContextType {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error("useCalendarContext must be used within CalendarProvider");
  }
  return context;
}
