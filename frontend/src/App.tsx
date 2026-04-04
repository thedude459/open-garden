import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ToastNotice, ToastRegion } from "./components/ToastRegion";
import { CoachPanel } from "./features/coach/CoachPanel";
import { CalendarPanel } from "./features/calendar/CalendarPanel";
import { CropsPanel } from "./features/crops/CropsPanel";
import { SeasonalPlanPanel } from "./features/planning/SeasonalPlanPanel";
import { PlannerPanel } from "./features/planner/PlannerPanel";
import { TimelinePanel } from "./features/timeline/TimelinePanel";
import { WeatherPanel } from "./features/weather/WeatherPanel";
import { PestLogPanel } from "./features/pests/PestLogPanel";
import { SensorsPanel } from "./features/sensors/SensorsPanel";
import { AiCoachResponse, AiCoachScenario, Bed, CalendarEvent, ClimatePlantingWindow, CoachMessage, CropTemplate, CropTemplateSyncStatus, Garden, GardenClimate, GardenClimatePlantingWindows, GardenSeasonalPlan, GardenSensorsSummary, GardenSunPath, GardenTimeline, PestLog, Placement, Planting, PlantingRecommendations, SensorKind, Task } from "./features/types";
import { useDebouncedValue } from "./hooks/useDebouncedValue";

type TokenResponse = { access_token: string; token_type: string };
type AppPage = "home" | "timeline" | "calendar" | "seasonal" | "planner" | "coach" | "crops" | "pests" | "sensors";
type ConfirmState = {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
};

type MicroclimateFormState = Pick<
  Garden,
  "orientation" | "sun_exposure" | "wind_exposure" | "thermal_mass" | "slope_position" | "frost_pocket_risk" | "address_private" | "edge_buffer_in"
>;

type MicroclimateSignalNote = { value: string | null; note: string };
type MicroclimateSuggestion = {
  sun_exposure: MicroclimateSignalNote;
  wind_exposure: MicroclimateSignalNote;
  slope_position: MicroclimateSignalNote;
  frost_pocket_risk: MicroclimateSignalNote;
  orientation: MicroclimateSignalNote;
  thermal_mass: MicroclimateSignalNote;
};

type GardenFormState = {
  name: string;
  description: string;
  zip_code: string;
  yard_width_ft: number;
  yard_length_ft: number;
  address_private: string;
  is_shared: boolean;
};

type BedFormState = {
  name: string;
  width_ft: number;
  length_ft: number;
};

type PlannerHistoryEntry = {
  label: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
};

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const palette = ["#ed7b49", "#57a773", "#2f6fba", "#c95f90", "#8979ff", "#1c8c84"];
const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const YARD_CELL_PX = 24;
const orientationOptions = [
  { value: "north", label: "North-facing" },
  { value: "east", label: "East-facing" },
  { value: "south", label: "South-facing" },
  { value: "west", label: "West-facing" },
] as const;
const sunExposureOptions = [
  { value: "full_sun", label: "Full sun" },
  { value: "part_sun", label: "Part sun" },
  { value: "part_shade", label: "Part shade" },
  { value: "full_shade", label: "Full shade" },
] as const;
const windExposureOptions = [
  { value: "sheltered", label: "Sheltered" },
  { value: "moderate", label: "Moderate" },
  { value: "exposed", label: "Exposed" },
] as const;
const thermalMassOptions = [
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
] as const;
const slopePositionOptions = [
  { value: "low", label: "Low spot" },
  { value: "mid", label: "Mid-slope" },
  { value: "high", label: "High ground" },
] as const;
const frostPocketOptions = [
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
] as const;

function CompassPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="compass-picker" role="group" aria-label="Garden orientation — choose the direction your garden faces">
      <button type="button" className={`compass-btn compass-n${value === "north" ? " active" : ""}`} onClick={() => onChange("north")} aria-pressed={value === "north"} title="North-facing">N</button>
      <button type="button" className={`compass-btn compass-e${value === "east" ? " active" : ""}`} onClick={() => onChange("east")} aria-pressed={value === "east"} title="East-facing">E</button>
      <div className="compass-rose" aria-hidden="true" />
      <button type="button" className={`compass-btn compass-w${value === "west" ? " active" : ""}`} onClick={() => onChange("west")} aria-pressed={value === "west"} title="West-facing">W</button>
      <button type="button" className={`compass-btn compass-s${value === "south" ? " active" : ""}`} onClick={() => onChange("south")} aria-pressed={value === "south"} title="South-facing">S</button>
    </div>
  );
}

function isoDate(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hasValidationErrors(errors: Record<string, string>) {
  return Object.values(errors).some(Boolean);
}

function App() {
  const today = useMemo(() => isoDate(new Date()), []);

  const [token, setToken] = useState<string>(localStorage.getItem("open-garden-token") || "");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginMode, setLoginMode] = useState<"signin" | "register">("signin");
  const [authPane, setAuthPane] = useState<"login" | "forgot-password" | "forgot-username" | "reset">("login");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [isEmailVerified, setIsEmailVerified] = useState<boolean | null>(null);

  const [gardens, setGardens] = useState<Garden[]>([]);
  const [publicGardens, setPublicGardens] = useState<Garden[]>([]);
  const [selectedGarden, setSelectedGarden] = useState<number | null>(null);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [plantings, setPlantings] = useState<Planting[]>([]);
  const [cropTemplates, setCropTemplates] = useState<CropTemplate[]>([]);
  const [taskQuery, setTaskQuery] = useState("");
  const [weather, setWeather] = useState<any>(null);
  const [gardenClimate, setGardenClimate] = useState<GardenClimate | null>(null);
  const [plantingWindows, setPlantingWindows] = useState<GardenClimatePlantingWindows | null>(null);
  const [gardenSunPath, setGardenSunPath] = useState<GardenSunPath | null>(null);
  const [seasonalPlan, setSeasonalPlan] = useState<GardenSeasonalPlan | null>(null);
  const [sensorSummary, setSensorSummary] = useState<GardenSensorsSummary | null>(null);
  const [gardenTimeline, setGardenTimeline] = useState<GardenTimeline | null>(null);
  const [plantingRecommendation, setPlantingRecommendation] = useState<PlantingRecommendations | null>(null);
  const [selectedRecommendationPlantingId, setSelectedRecommendationPlantingId] = useState<number | null>(null);
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedCropName, setSelectedCropName] = useState("");
  const [placementBedId, setPlacementBedId] = useState<number | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [activePage, setActivePage] = useState<AppPage>("home");
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [gardenDraft, setGardenDraft] = useState<GardenFormState>({
    name: "",
    description: "",
    zip_code: "",
    yard_width_ft: 20,
    yard_length_ft: 20,
    address_private: "",
    is_shared: false,
  });
  const [bedDraft, setBedDraft] = useState<BedFormState>({ name: "", width_ft: 4, length_ft: 8 });
  const [showGardenValidation, setShowGardenValidation] = useState(false);
  const [showBedValidation, setShowBedValidation] = useState(false);
  const [showCropValidation, setShowCropValidation] = useState(false);
  const [showYardValidation, setShowYardValidation] = useState(false);
  const [newCropName, setNewCropName] = useState("");
  const [newCropVariety, setNewCropVariety] = useState("");
  const [newCropFamily, setNewCropFamily] = useState("");
  const [newCropSpacing, setNewCropSpacing] = useState(12);
  const [newCropDays, setNewCropDays] = useState(60);
  const [newCropPlantingWindow, setNewCropPlantingWindow] = useState("Spring");
  const [newCropDirectSow, setNewCropDirectSow] = useState(true);
  const [newCropFrostHardy, setNewCropFrostHardy] = useState(false);
  const [newCropWeeksToTransplant, setNewCropWeeksToTransplant] = useState(6);
  const [newCropNotes, setNewCropNotes] = useState("");
  const [newCropImageUrl, setNewCropImageUrl] = useState("");
  const [cropSearchQuery, setCropSearchQuery] = useState("");
  const [cropSearchActiveIndex, setCropSearchActiveIndex] = useState(0);
  const [editingCropId, setEditingCropId] = useState<number | null>(null);
  const [yardWidthDraft, setYardWidthDraft] = useState(20);
  const [yardLengthDraft, setYardLengthDraft] = useState(20);
  const [notices, setNotices] = useState<ToastNotice[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [isLoadingGardenData, setIsLoadingGardenData] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [isLoadingClimate, setIsLoadingClimate] = useState(false);
  const [isLoadingPlantingWindows, setIsLoadingPlantingWindows] = useState(false);
  const [isLoadingSunPath, setIsLoadingSunPath] = useState(false);
  const [isLoadingSeasonalPlan, setIsLoadingSeasonalPlan] = useState(false);
  const [isLoadingSensorSummary, setIsLoadingSensorSummary] = useState(false);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [isLoadingPlantingRecommendation, setIsLoadingPlantingRecommendation] = useState(false);
  const [isLoadingCoach, setIsLoadingCoach] = useState(false);
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [isSuggestingMicroclimate, setIsSuggestingMicroclimate] = useState(false);
  const [microclimateSuggestion, setMicroclimateSuggestion] = useState<MicroclimateSuggestion | null>(null);
  const [plannerUndoCount, setPlannerUndoCount] = useState(0);
  const [plannerRedoCount, setPlannerRedoCount] = useState(0);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [pestLogs, setPestLogs] = useState<PestLog[]>([]);
  const [isLoadingPestLogs, setIsLoadingPestLogs] = useState(false);
  const [isRefreshingCropLibrary, setIsRefreshingCropLibrary] = useState(false);
  const [isCleaningLegacyCropLibrary, setIsCleaningLegacyCropLibrary] = useState(false);
  const [cropTemplateSyncStatus, setCropTemplateSyncStatus] = useState<CropTemplateSyncStatus | null>(null);
  const [microclimateDraft, setMicroclimateDraft] = useState<MicroclimateFormState>({
    orientation: "south",
    sun_exposure: "part_sun",
    wind_exposure: "moderate",
    thermal_mass: "moderate",
    slope_position: "mid",
    frost_pocket_risk: "low",
    address_private: "",
    edge_buffer_in: 6,
  });
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [coachDraftMessage, setCoachDraftMessage] = useState("");
  const [coachLatestResponse, setCoachLatestResponse] = useState<AiCoachResponse | null>(null);
  const [coachScenario, setCoachScenario] = useState<AiCoachScenario>({
    days_ahead: 7,
    rain_outlook: "normal",
    labor_hours: 2,
    water_budget: "normal",
  });

  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  const yardGridRef = useRef<HTMLDivElement>(null);
  const weatherCacheRef = useRef<Map<number, any>>(new Map());
  const weatherCacheTimeRef = useRef<Map<number, number>>(new Map());
  const climateCacheRef = useRef<Map<number, GardenClimate>>(new Map());
  const plantingWindowCacheRef = useRef<Map<number, GardenClimatePlantingWindows>>(new Map());
  const sunPathCacheRef = useRef<Map<number, GardenSunPath>>(new Map());
  const seasonalPlanCacheRef = useRef<Map<number, GardenSeasonalPlan>>(new Map());
  const sensorSummaryCacheRef = useRef<Map<number, GardenSensorsSummary>>(new Map());
  const timelineCacheRef = useRef<Map<number, GardenTimeline>>(new Map());
  const plantingRecommendationCacheRef = useRef<Map<number, PlantingRecommendations>>(new Map());
  const authParamsHandledRef = useRef(false);
  const cropSyncWasRunningRef = useRef(false);
  const plannerUndoStackRef = useRef<PlannerHistoryEntry[]>([]);
  const plannerRedoStackRef = useRef<PlannerHistoryEntry[]>([]);
  const debouncedTaskQuery = useDebouncedValue(taskQuery, 320);

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" }),
    [token]
  );

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

  const selectedDayEvents = eventsByDate.get(selectedDate) || [];
  const selectedGardenRecord = gardens.find((garden) => garden.id === selectedGarden);
  const selectedGardenName = selectedGardenRecord?.name;
  const yardWidthFt = Math.max(4, selectedGardenRecord?.yard_width_ft || 20);
  const yardLengthFt = Math.max(4, selectedGardenRecord?.yard_length_ft || 20);
  const cropMap = useMemo(() => new Map(cropTemplates.map((crop) => [crop.name, crop])), [cropTemplates]);
  const selectedCrop = cropMap.get(selectedCropName);
  const selectedCropWindow = useMemo<ClimatePlantingWindow | undefined>(() => {
    if (!plantingWindows || !selectedCropName) {
      return undefined;
    }
    return plantingWindows.windows.find((window) => window.crop_name === selectedCropName);
  }, [plantingWindows, selectedCropName]);
  const filteredCropTemplates = useMemo(() => {
    const query = cropSearchQuery.trim().toLowerCase();
    if (!query) {
      return cropTemplates;
    }

    return cropTemplates.filter((crop) => {
      const haystack = [crop.name, crop.variety, crop.family].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [cropSearchQuery, cropTemplates]);

  const pendingTasks = useMemo(
    () =>
      [...tasks]
        .filter((task) => !task.is_done)
        .sort((left, right) => left.due_on.localeCompare(right.due_on)),
    [tasks],
  );

  const homeTaskPreview = useMemo(() => pendingTasks.slice(0, 4), [pendingTasks]);
  const overdueTaskCount = useMemo(
    () => pendingTasks.filter((task) => task.due_on < today).length,
    [pendingTasks, today],
  );
  const upcomingTaskCount = pendingTasks.length;
  const weatherPreview = useMemo(() => {
    if (!weather?.daily?.time) {
      return [] as Array<{ date: string; low: number; high: number; rain: number }>;
    }

    return weather.daily.time.slice(0, 3).map((date: string, index: number) => ({
      date,
      low: weather.daily.temperature_2m_min[index],
      high: weather.daily.temperature_2m_max[index],
      rain: weather.daily.precipitation_sum[index],
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
      .filter((window) => ["open", "closing", "watch", "upcoming", "stable"].includes(window.status))
      .sort((left, right) => (priority.get(left.status) ?? 99) - (priority.get(right.status) ?? 99))
      .slice(0, 3);
  }, [plantingWindows]);
  const weatherRiskCues = useMemo(() => {
    const cues: string[] = [];
    if (gardenClimate && gardenClimate.frost_risk_next_10_days !== "low") {
      cues.push(`Frost risk is ${gardenClimate.frost_risk_next_10_days} over the next 10 days.`);
    }
    if (weatherPreview.some((day) => day.rain >= 0.5)) {
      cues.push("Heavy rain is in the short-range forecast. Check drainage and delay direct sowing if beds stay wet.");
    }
    if (weatherPreview.some((day) => day.high >= 85)) {
      cues.push("Heat is approaching. Prioritize watering and transplant timing early in the day.");
    }
    return cues.slice(0, 3);
  }, [gardenClimate, weatherPreview]);
  const gardenFormErrors = useMemo(
    () => ({
      name: gardenDraft.name.trim() ? "" : "Garden name is required.",
      zip_code: /^[0-9]{5}$/.test(gardenDraft.zip_code.trim()) ? "" : "Enter a 5-digit US ZIP code.",
      yard_width_ft: gardenDraft.yard_width_ft >= 4 ? "" : "Yard width must be at least 4 ft.",
      yard_length_ft: gardenDraft.yard_length_ft >= 4 ? "" : "Yard length must be at least 4 ft.",
    }),
    [gardenDraft],
  );
  const bedFormErrors = useMemo(
    () => ({
      name: bedDraft.name.trim() ? "" : "Bed name is required.",
      width_ft: bedDraft.width_ft >= 1 ? "" : "Bed width must be at least 1 ft.",
      length_ft: bedDraft.length_ft >= 1 ? "" : "Bed length must be at least 1 ft.",
    }),
    [bedDraft],
  );
  const cropFormErrors = useMemo(
    () => ({
      name: newCropName.trim() ? "" : "Crop name is required.",
      spacing: newCropSpacing >= 1 ? "" : "Spacing must be at least 1 inch.",
      days: newCropDays >= 1 ? "" : "Days to harvest must be at least 1.",
      planting_window: newCropPlantingWindow.trim() ? "" : "Add a planting window.",
      weeks_to_transplant: newCropDirectSow || newCropWeeksToTransplant >= 1 ? "" : "Indoor starts need at least 1 week.",
    }),
    [newCropDays, newCropDirectSow, newCropName, newCropPlantingWindow, newCropSpacing, newCropWeeksToTransplant],
  );
  const yardFormErrors = useMemo(
    () => ({
      yard_width_ft: yardWidthDraft >= 4 ? "" : "Yard width must be at least 4 ft.",
      yard_length_ft: yardLengthDraft >= 4 ? "" : "Yard length must be at least 4 ft.",
    }),
    [yardLengthDraft, yardWidthDraft],
  );

  function toFeet(inches: number) {
    return `${(inches / 12).toFixed(1)} ft`;
  }

  function cropBaseName(crop: CropTemplate) {
    if (crop.variety && crop.name.endsWith(`(${crop.variety})`)) {
      return crop.name.slice(0, -(crop.variety.length + 3)).trim();
    }
    return crop.name;
  }

  function cropDisplayName(crop: CropTemplate) {
    const baseName = cropBaseName(crop);
    if (!crop.variety) {
      return baseName;
    }
    return `${baseName} • ${crop.variety}`;
  }

  function selectCrop(crop: CropTemplate) {
    setSelectedCropName(crop.name);
    setCropSearchQuery(cropDisplayName(crop));
  }

  function resetCropForm() {
    setShowCropValidation(false);
    setEditingCropId(null);
    setNewCropName("");
    setNewCropVariety("");
    setNewCropFamily("");
    setNewCropSpacing(12);
    setNewCropDays(60);
    setNewCropPlantingWindow("Spring");
    setNewCropDirectSow(true);
    setNewCropFrostHardy(false);
    setNewCropWeeksToTransplant(6);
    setNewCropNotes("");
    setNewCropImageUrl("");
  }

  function populateCropForm(crop: CropTemplate) {
    setShowCropValidation(false);
    setEditingCropId(crop.id);
    setNewCropName(cropBaseName(crop));
    setNewCropVariety(crop.variety);
    setNewCropFamily(crop.family);
    setNewCropSpacing(crop.spacing_in);
    setNewCropDays(crop.days_to_harvest);
    setNewCropPlantingWindow(crop.planting_window);
    setNewCropDirectSow(crop.direct_sow);
    setNewCropFrostHardy(crop.frost_hardy);
    setNewCropWeeksToTransplant(crop.weeks_to_transplant);
    setNewCropNotes(crop.notes);
    setNewCropImageUrl(crop.image_url || "");
  }

  function handleCropSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (filteredCropTemplates.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCropSearchActiveIndex((prev) => Math.min(prev + 1, filteredCropTemplates.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCropSearchActiveIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      selectCrop(filteredCropTemplates[cropSearchActiveIndex] || filteredCropTemplates[0]);
      return;
    }

    if (event.key === "Escape" && selectedCrop) {
      event.preventDefault();
      setCropSearchQuery(cropDisplayName(selectedCrop));
    }
  }

  function colorForCrop(name: string) {
    if (!name.trim()) {
      return palette[0];
    }
    const sum = name
      .trim()
      .toLowerCase()
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return palette[sum % palette.length];
  }

  function dismissNotice(id: number) {
    setNotices((prev) => prev.filter((notice) => notice.id !== id));
  }

  function pushNotice(message: string, kind: ToastNotice["kind"], actionLabel?: string, onAction?: () => void) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setNotices((prev) => [...prev, { id, message, kind, actionLabel, onAction }]);
    window.setTimeout(() => {
      setNotices((prev) => prev.filter((notice) => notice.id !== id));
    }, 6500);
  }

  function syncPlannerHistoryCounts() {
    setPlannerUndoCount(plannerUndoStackRef.current.length);
    setPlannerRedoCount(plannerRedoStackRef.current.length);
  }

  function pushPlannerHistory(entry: PlannerHistoryEntry) {
    plannerUndoStackRef.current.push(entry);
    plannerRedoStackRef.current = [];
    syncPlannerHistoryCounts();
  }

  async function undoPlannerChange() {
    const entry = plannerUndoStackRef.current.pop();
    if (!entry) {
      return;
    }
    await entry.undo();
    plannerRedoStackRef.current.push(entry);
    syncPlannerHistoryCounts();
    pushNotice(`Undo: ${entry.label}.`, "info");
  }

  async function redoPlannerChange() {
    const entry = plannerRedoStackRef.current.pop();
    if (!entry) {
      return;
    }
    await entry.redo();
    plannerUndoStackRef.current.push(entry);
    syncPlannerHistoryCounts();
    pushNotice(`Redo: ${entry.label}.`, "info");
  }

  async function runConfirmedAction() {
    if (!confirmState) {
      return;
    }

    try {
      setIsConfirmingAction(true);
      await confirmState.onConfirm();
    } catch (err: any) {
      pushNotice(err?.message || "Unable to complete action.", "error");
    } finally {
      setIsConfirmingAction(false);
      setConfirmState(null);
    }
  }

  async function fetchAuthed(path: string, opts: RequestInit = {}) {
    const response = await fetch(`${API}${path}`, {
      ...opts,
      headers: { ...authHeaders, ...(opts.headers || {}) },
    });
    if (response.status === 401) {
      localStorage.removeItem("open-garden-token");
      setToken("");
      throw Object.assign(new Error("Session expired. Please sign in again."), { sessionExpired: true });
    }
    if (!response.ok) {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const payload = await response.json();
        throw new Error(payload?.detail || payload?.message || JSON.stringify(payload));
      }
      throw new Error((await response.text()).trim() || `Request failed with status ${response.status}`);
    }
    if (response.status === 204) {
      return null;
    }
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }
    return response.text();
  }

  function noticeUnlessExpired(msg: string) {
    return (err: unknown) => {
      if ((err as any)?.sessionExpired) return;
      pushNotice(msg, "error");
    };
  }

  async function handleAuth(e: FormEvent) {
    e.preventDefault();

    if (loginMode === "register") {
      if (!email.trim()) {
        pushNotice("Email is required to create an account.", "error");
        return;
      }
      try {
        const registerResp = await fetch(`${API}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), username, password }),
        });
        if (!registerResp.ok) {
          const message = (await registerResp.text()).trim();
          if (registerResp.status === 400 && message.toLowerCase().includes("already exists")) {
            pushNotice("Username already taken. Try a different one or sign in.", "error");
          } else {
            pushNotice(message || "Registration failed.", "error");
          }
          return;
        }
      } catch {
        pushNotice("Unable to reach the server.", "error");
        return;
      }
    }

    const body = new URLSearchParams();
    body.append("username", username);
    body.append("password", password);

    const loginResp = await fetch(`${API}/auth/login`, {
      method: "POST",
      body,
    });
    if (!loginResp.ok) {
      pushNotice(
        loginMode === "signin"
          ? "Invalid username or password."
          : "Account created but sign-in failed. Please try signing in.",
        "error"
      );
      return;
    }
    const tokenData: TokenResponse = await loginResp.json();
    setToken(tokenData.access_token);
    localStorage.setItem("open-garden-token", tokenData.access_token);
    pushNotice(
      loginMode === "register"
        ? "Account created! Check your email to verify your address."
        : "Signed in successfully.",
      "success"
    );
  }

  async function verifyEmailToken(tokenToVerify: string) {
    const response = await fetch(`${API}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: tokenToVerify }),
    });
    if (!response.ok) {
      throw new Error((await response.text()) || "Verification failed");
    }
  }

  async function requestPasswordReset(emailAddress: string) {
    const response = await fetch(`${API}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailAddress.trim() }),
    });
    if (!response.ok) {
      throw new Error((await response.text()) || "Unable to send reset email");
    }
  }

  async function requestUsernameRecovery(emailAddress: string) {
    const response = await fetch(`${API}/auth/forgot-username`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailAddress.trim() }),
    });
    if (!response.ok) {
      throw new Error((await response.text()) || "Unable to send username");
    }
  }

  async function resendVerificationEmail() {
    const response = await fetch(`${API}/auth/resend-verification`, {
      method: "POST",
      headers: authHeaders,
    });
    if (!response.ok) {
      throw new Error((await response.text()) || "Unable to resend verification email");
    }
  }

  async function submitPasswordReset(e: FormEvent) {
    e.preventDefault();
    if (!resetToken) {
      pushNotice("Reset token is missing.", "error");
      return;
    }
    if (resetPassword.length < 8) {
      pushNotice("Password must be at least 8 characters.", "error");
      return;
    }
    try {
      const response = await fetch(`${API}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, new_password: resetPassword }),
      });
      if (!response.ok) {
        throw new Error((await response.text()) || "Unable to reset password");
      }
      setResetPassword("");
      setResetToken(null);
      setAuthPane("login");
      pushNotice("Password reset successful. Please sign in.", "success");
    } catch (err: any) {
      pushNotice(err?.message || "Unable to reset password.", "error");
    }
  }

  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      pushNotice("Enter your email to request a reset.", "error");
      return;
    }
    try {
      await requestPasswordReset(email);
      pushNotice("If the account exists, reset instructions were sent.", "success");
      setAuthPane("login");
    } catch (err: any) {
      pushNotice(err?.message || "Unable to request password reset.", "error");
    }
  }

  async function handleForgotUsername(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      pushNotice("Enter your email to request your username.", "error");
      return;
    }
    try {
      await requestUsernameRecovery(email);
      pushNotice("If the account exists, username recovery instructions were sent.", "success");
      setAuthPane("login");
    } catch (err: any) {
      pushNotice(err?.message || "Unable to request username.", "error");
    }
  }

  async function loadGardens() {
    const mine: Garden[] = await fetchAuthed("/gardens");
    setGardens(mine);
    weatherCacheRef.current.clear();
    climateCacheRef.current.clear();
    plantingWindowCacheRef.current.clear();
    sunPathCacheRef.current.clear();
    seasonalPlanCacheRef.current.clear();
    sensorSummaryCacheRef.current.clear();
    timelineCacheRef.current.clear();
    plantingRecommendationCacheRef.current.clear();
    if (mine.length === 0) {
      setSelectedGarden(null);
      setGardenClimate(null);
      setPlantingWindows(null);
      setGardenSunPath(null);
      setSeasonalPlan(null);
      setSensorSummary(null);
      setGardenTimeline(null);
      setPlantingRecommendation(null);
      setSelectedRecommendationPlantingId(null);
      setWeather(null);
    } else if (!selectedGarden || !mine.some((garden) => garden.id === selectedGarden)) {
      setSelectedGarden(mine[0].id);
    }
    const publicList = await (await fetch(`${API}/gardens/public`)).json();
    setPublicGardens(publicList);
  }

  async function loadMe() {
    const me = await fetchAuthed("/users/me");
    setIsEmailVerified(Boolean(me.email_verified));
  }

  async function loadCropTemplates(preferredCropName?: string) {
    const templates: CropTemplate[] = await fetchAuthed("/crop-templates");
    setCropTemplates(templates);
    if (templates.length > 0) {
      const preferredCrop = templates.find((crop) => crop.name === preferredCropName);
      const hasCurrent = templates.some((crop) => crop.name === selectedCropName);
      if (preferredCrop) {
        selectCrop(preferredCrop);
      } else if (!hasCurrent) {
        selectCrop(templates[0]);
      }
    }
  }

  async function loadCropTemplateSyncStatus(notifyOnCompletion = true) {
    const status: CropTemplateSyncStatus = await fetchAuthed("/crop-templates/sync-status");
    const wasRunning = cropSyncWasRunningRef.current;
    cropSyncWasRunningRef.current = status.is_running;
    setCropTemplateSyncStatus(status);

    if (wasRunning && !status.is_running) {
      await loadCropTemplates(selectedCropName || undefined);
      if (notifyOnCompletion) {
        if (status.status === "failed") {
          pushNotice(status.error || status.message || "Crop database sync failed.", "error");
        } else {
          pushNotice(status.message || "Crop database sync completed.", "success");
        }
      }
    }
  }

  async function refreshCropTemplateDatabase() {
    try {
      setIsRefreshingCropLibrary(true);
      const result: { message: string } = await fetchAuthed("/crop-templates/refresh", {
        method: "POST",
      });
      await loadCropTemplateSyncStatus(false);
      pushNotice(result.message || "Crop database updated.", "success");
    } catch (err: any) {
      pushNotice(err?.message || "Unable to update crop database.", "error");
    } finally {
      setIsRefreshingCropLibrary(false);
    }
  }

  function requestLegacyCropCleanup() {
    setConfirmState({
      title: "Remove legacy starter crops?",
      message: "This removes only the old hard-coded starter crop templates and keeps Johnny's imports plus true manual entries.",
      confirmLabel: "Remove legacy crops",
      onConfirm: async () => {
        try {
          setIsCleaningLegacyCropLibrary(true);
          const result: { message: string } = await fetchAuthed("/crop-templates/cleanup-legacy", {
            method: "POST",
          });
          await loadCropTemplates(selectedCropName || undefined);
          await loadCropTemplateSyncStatus(false);
          pushNotice(result.message || "Legacy starter crops removed.", "success");
        } catch (err: any) {
          pushNotice(err?.message || "Unable to remove legacy starter crops.", "error");
        } finally {
          setIsCleaningLegacyCropLibrary(false);
        }
      },
    });
  }

  async function createGarden(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setShowGardenValidation(true);
    if (hasValidationErrors(gardenFormErrors)) {
      return;
    }

    try {
      await fetchAuthed("/gardens", {
        method: "POST",
        body: JSON.stringify({
          name: gardenDraft.name.trim(),
          description: gardenDraft.description.trim(),
          zip_code: gardenDraft.zip_code.trim(),
          yard_width_ft: Math.max(4, Number(gardenDraft.yard_width_ft || 20)),
          yard_length_ft: Math.max(4, Number(gardenDraft.yard_length_ft || 20)),
          address_private: gardenDraft.address_private.trim(),
          is_shared: gardenDraft.is_shared,
        }),
      });
      setGardenDraft({
        name: "",
        description: "",
        zip_code: "",
        yard_width_ft: 20,
        yard_length_ft: 20,
        address_private: "",
        is_shared: false,
      });
      setShowGardenValidation(false);
      await loadGardens();
      pushNotice("Garden created.", "success");
    } catch (err: any) {
      pushNotice(err?.message || "Unable to create garden.", "error");
    }
  }

  async function createBed(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedGarden) {
      return;
    }

    setShowBedValidation(true);
    if (hasValidationErrors(bedFormErrors)) {
      return;
    }

    try {
      const widthFt = bedDraft.width_ft;
      const lengthFt = bedDraft.length_ft;
      await fetchAuthed(`/gardens/${selectedGarden}/beds`, {
        method: "POST",
        body: JSON.stringify({
          name: bedDraft.name.trim(),
          width_in: Math.max(12, Math.round(widthFt * 12)),
          height_in: Math.max(12, Math.round(lengthFt * 12)),
          grid_x: 0,
          grid_y: 0,
        }),
      });
      setBedDraft({ name: "", width_ft: 4, length_ft: 8 });
      setShowBedValidation(false);
      await loadGardenData();
      pushNotice("Bed added to yard layout.", "success");
    } catch (err: any) {
      pushNotice(err?.message || "Unable to create bed.", "error");
    }
  }

  async function createTask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedGarden) {
      return;
    }

    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      await fetchAuthed("/tasks", {
        method: "POST",
        body: JSON.stringify({
          garden_id: selectedGarden,
          title: fd.get("title"),
          due_on: fd.get("due_on"),
          notes: fd.get("notes") || "",
        }),
      });
      form.reset();
      await loadTasks(selectedGarden, debouncedTaskQuery);
      pushNotice("Task added.", "success");
    } catch (err: any) {
      pushNotice(err?.message || "Unable to create task.", "error");
    }
  }

  async function toggleTaskDone(taskId: number, done: boolean) {
    try {
      const updated: Task = await fetchAuthed(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ is_done: done }),
      });
      setTasks((prev) => prev.map((t) => t.id === taskId ? updated : t));
    } catch (err: any) {
      pushNotice(err?.message || "Unable to update task.", "error");
    }
  }

  async function deleteTask(taskId: number) {
    try {
      await fetchAuthed(`/tasks/${taskId}`, { method: "DELETE" });
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err: any) {
      pushNotice(err?.message || "Unable to delete task.", "error");
    }
  }

  async function editTask(taskId: number, update: { title?: string; due_on?: string; notes?: string }) {
    try {
      const updated: Task = await fetchAuthed(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(update),
      });
      setTasks((prev) => prev.map((t) => t.id === taskId ? updated : t));
    } catch (err: any) {
      pushNotice(err?.message || "Unable to update task.", "error");
    }
  }

  async function logHarvest(plantingId: number, harvested_on: string, yield_notes: string) {
    try {
      const updated: Planting = await fetchAuthed(`/plantings/${plantingId}/harvest`, {
        method: "PATCH",
        body: JSON.stringify({ harvested_on, yield_notes }),
      });
      setPlantings((prev) => prev.map((p) => p.id === plantingId ? updated : p));
      if (selectedGarden) {
        seasonalPlanCacheRef.current.delete(selectedGarden);
      }
      pushNotice("Harvest logged!", "success");
    } catch (err: any) {
      pushNotice(err?.message || "Unable to log harvest.", "error");
    }
  }

  async function createPlanting(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedGarden || beds.length === 0 || cropTemplates.length === 0) {
      return;
    }

    const form = e.currentTarget;
    const fd = new FormData(form);
    const bedId = Number(fd.get("bed_id"));
    const cropName = String(fd.get("crop_name") || "");

    try {
      await fetchAuthed("/plantings", {
        method: "POST",
        body: JSON.stringify({
          garden_id: selectedGarden,
          bed_id: bedId,
          crop_name: cropName,
          planted_on: fd.get("planted_on"),
          source: fd.get("source") || "manual",
        }),
      });

      setSelectedCropName(cropName);
      form.reset();
      await loadGardenData();
      await loadTasks(selectedGarden, debouncedTaskQuery);
      seasonalPlanCacheRef.current.delete(selectedGarden);
      pushNotice(`Planting added: ${cropName}.`, "success");
    } catch (err: any) {
      pushNotice(err?.message || "Unable to create planting.", "error");
    }
  }

  async function upsertCropTemplate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setShowCropValidation(true);
    if (hasValidationErrors(cropFormErrors)) {
      return;
    }

    try {
      const targetPath = editingCropId ? `/crop-templates/${editingCropId}` : "/crop-templates";
      const method = editingCropId ? "PATCH" : "POST";
      const savedCrop: CropTemplate = await fetchAuthed(targetPath, {
        method,
        body: JSON.stringify({
          name: newCropName.trim(),
          variety: newCropVariety.trim(),
          family: newCropFamily.trim(),
          spacing_in: Math.max(1, Math.round(newCropSpacing)),
          days_to_harvest: Math.max(1, Math.round(newCropDays)),
          planting_window: newCropPlantingWindow.trim() || "Spring",
          image_url: newCropImageUrl.trim(),
          direct_sow: newCropDirectSow,
          frost_hardy: newCropFrostHardy,
          weeks_to_transplant: Math.max(1, Math.round(newCropWeeksToTransplant)),
          notes: newCropNotes.trim(),
        }),
      });

      await loadCropTemplates(savedCrop.name);
      if (selectedGarden) {
        await loadGardenData();
        await loadTasks(selectedGarden, debouncedTaskQuery);
      }
      resetCropForm();
      pushNotice(editingCropId ? "Vegetable updated." : "Vegetable added.", "success");
    } catch (err: any) {
      pushNotice(err?.message || `Unable to ${editingCropId ? "update" : "add"} vegetable.`, "error");
    }
  }

  async function updateYardSize(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedGarden) {
      return;
    }

    setShowYardValidation(true);
    if (hasValidationErrors(yardFormErrors)) {
      return;
    }

    try {
      await fetchAuthed(`/gardens/${selectedGarden}/yard`, {
        method: "PATCH",
        body: JSON.stringify({
          yard_width_ft: Math.max(4, Math.round(yardWidthDraft)),
          yard_length_ft: Math.max(4, Math.round(yardLengthDraft)),
        }),
      });
      setShowYardValidation(false);
      await loadGardens();
      await loadGardenData();
      pushNotice("Yard size updated.", "success");
    } catch (err: any) {
      pushNotice(err?.message || "Unable to update yard size.", "error");
    }
  }

  async function apiMoveBedInYard(bedId: number, nextX: number, nextY: number) {
    const updated: Bed = await fetchAuthed(`/beds/${bedId}/position`, {
      method: "PATCH",
      body: JSON.stringify({ grid_x: nextX, grid_y: nextY }),
    });
    setBeds((prev) => prev.map((item) => item.id === bedId ? updated : item));
    return updated;
  }

  async function apiRotateBedInYard(bedId: number) {
    const rotated: Bed = await fetchAuthed(`/beds/${bedId}/rotate`, {
      method: "PATCH",
    });
    setBeds((prev) => prev.map((item) => item.id === bedId ? rotated : item));
    return rotated;
  }

  async function moveBedInYard(bedId: number, nextX: number, nextY: number, options?: { recordHistory?: boolean }) {
    const bed = beds.find((item) => item.id === bedId);
    if (!bed) {
      return;
    }

    const updated = await apiMoveBedInYard(bedId, nextX, nextY);
    if (options?.recordHistory !== false && (bed.grid_x !== updated.grid_x || bed.grid_y !== updated.grid_y)) {
      pushPlannerHistory({
        label: `Move ${bed.name}`,
        undo: () => apiMoveBedInYard(bedId, bed.grid_x, bed.grid_y).then(() => undefined),
        redo: () => apiMoveBedInYard(bedId, updated.grid_x, updated.grid_y).then(() => undefined),
      });
    }
  }

  async function nudgeBedByDelta(bedId: number, dx: number, dy: number) {
    const bed = beds.find((item) => item.id === bedId);
    if (!bed) {
      return;
    }

    const bedWidthFt = Math.max(1, Math.ceil(bed.width_in / 12));
    const bedLengthFt = Math.max(1, Math.ceil(bed.height_in / 12));
    const maxX = Math.max(0, yardWidthFt - bedWidthFt);
    const maxY = Math.max(0, yardLengthFt - bedLengthFt);
    const nextX = Math.min(maxX, Math.max(0, bed.grid_x + dx));
    const nextY = Math.min(maxY, Math.max(0, bed.grid_y + dy));

    if (nextX === bed.grid_x && nextY === bed.grid_y) {
      return;
    }

    try {
      await moveBedInYard(bedId, nextX, nextY);
      pushNotice(`Moved ${bed.name} to (${nextX + 1}, ${nextY + 1}).`, "info");
    } catch (err: any) {
      pushNotice(err?.message || "Unable to move bed.", "error");
    }
  }

  async function rotateBedInYard(bedId: number, autoFit = false) {
    const bed = beds.find((item) => item.id === bedId);
    if (!bed) {
      return;
    }

    try {
      const rotatedWidthFt = Math.max(1, Math.ceil(bed.height_in / 12));
      const rotatedLengthFt = Math.max(1, Math.ceil(bed.width_in / 12));
      const exceedsBounds = bed.grid_x + rotatedWidthFt > yardWidthFt || bed.grid_y + rotatedLengthFt > yardLengthFt;
      let rotatedFromX = bed.grid_x;
      let rotatedFromY = bed.grid_y;
      let rotatedToX = bed.grid_x;
      let rotatedToY = bed.grid_y;

      if (exceedsBounds && autoFit) {
        rotatedToX = Math.min(Math.max(0, bed.grid_x), Math.max(0, yardWidthFt - rotatedWidthFt));
        rotatedToY = Math.min(Math.max(0, bed.grid_y), Math.max(0, yardLengthFt - rotatedLengthFt));
        await apiMoveBedInYard(bed.id, rotatedToX, rotatedToY);
      } else if (exceedsBounds) {
        throw new Error("Bed cannot rotate at its current position. Use Auto-fit rotate or move the bed first.");
      }

      await apiRotateBedInYard(bedId);
      pushPlannerHistory({
        label: `Rotate ${bed.name}`,
        undo: async () => {
          await apiRotateBedInYard(bedId);
          if (rotatedFromX !== rotatedToX || rotatedFromY !== rotatedToY) {
            await apiMoveBedInYard(bedId, rotatedFromX, rotatedFromY);
          }
        },
        redo: async () => {
          if (rotatedFromX !== rotatedToX || rotatedFromY !== rotatedToY) {
            await apiMoveBedInYard(bedId, rotatedToX, rotatedToY);
          }
          await apiRotateBedInYard(bedId);
        },
      });
      pushNotice(`Rotated ${bed.name}.`, "success");
    } catch (err: any) {
      pushNotice(err?.message || "Unable to rotate bed.", "error");
      throw err;
    }
  }

  async function loadTasks(gardenId: number, query: string) {
    try {
      setIsLoadingTasks(true);
      const tasksData = await fetchAuthed(`/tasks?garden_id=${gardenId}&q=${encodeURIComponent(query)}`);
      setTasks(tasksData);
    } finally {
      setIsLoadingTasks(false);
    }
  }

  async function loadWeatherForGarden(garden: Garden) {
    const cached = weatherCacheRef.current.get(garden.id);
    const cachedAt = weatherCacheTimeRef.current.get(garden.id) ?? 0;
    if (cached && Date.now() - cachedAt < CACHE_TTL_MS) {
      setWeather(cached);
      return;
    }

    setIsLoadingWeather(true);
    try {
      const res = await fetch(`${API}/weather?latitude=${garden.latitude}&longitude=${garden.longitude}`);
      if (!res.ok) {
        pushNotice("Weather data is temporarily unavailable.", "error");
        return;
      }
      const weatherData = await res.json();
      weatherCacheRef.current.set(garden.id, weatherData);
      weatherCacheTimeRef.current.set(garden.id, Date.now());
      setWeather(weatherData);
    } finally {
      setIsLoadingWeather(false);
    }
  }

  async function loadClimateForGarden(garden: Garden) {
    if (climateCacheRef.current.has(garden.id)) {
      setGardenClimate(climateCacheRef.current.get(garden.id) || null);
      return;
    }

    setIsLoadingClimate(true);
    try {
      const climateData: GardenClimate = await fetchAuthed(`/gardens/${garden.id}/climate`);
      climateCacheRef.current.set(garden.id, climateData);
      setGardenClimate(climateData);
    } finally {
      setIsLoadingClimate(false);
    }
  }

  async function loadPlantingWindowsForGarden(garden: Garden) {
    if (plantingWindowCacheRef.current.has(garden.id)) {
      setPlantingWindows(plantingWindowCacheRef.current.get(garden.id) || null);
      return;
    }

    setIsLoadingPlantingWindows(true);
    try {
      const windowsData: GardenClimatePlantingWindows = await fetchAuthed(`/gardens/${garden.id}/climate/planting-windows`);
      plantingWindowCacheRef.current.set(garden.id, windowsData);
      setPlantingWindows(windowsData);
    } finally {
      setIsLoadingPlantingWindows(false);
    }
  }

  async function loadSunPathForGarden(garden: Garden) {
    if (sunPathCacheRef.current.has(garden.id)) {
      setGardenSunPath(sunPathCacheRef.current.get(garden.id) || null);
      return;
    }

    setIsLoadingSunPath(true);
    try {
      const sunPathData: GardenSunPath = await fetchAuthed(`/gardens/${garden.id}/layout/sun-path`);
      sunPathCacheRef.current.set(garden.id, sunPathData);
      setGardenSunPath(sunPathData);
    } finally {
      setIsLoadingSunPath(false);
    }
  }

  async function loadSeasonalPlanForGarden(garden: Garden, forceRefresh = false) {
    if (!forceRefresh && seasonalPlanCacheRef.current.has(garden.id)) {
      setSeasonalPlan(seasonalPlanCacheRef.current.get(garden.id) || null);
      return;
    }

    setIsLoadingSeasonalPlan(true);
    try {
      const planData: GardenSeasonalPlan = await fetchAuthed(`/gardens/${garden.id}/plan/seasonal`);
      seasonalPlanCacheRef.current.set(garden.id, planData);
      setSeasonalPlan(planData);
    } finally {
      setIsLoadingSeasonalPlan(false);
    }
  }

  async function loadSensorSummaryForGarden(garden: Garden, forceRefresh = false) {
    if (!forceRefresh && sensorSummaryCacheRef.current.has(garden.id)) {
      setSensorSummary(sensorSummaryCacheRef.current.get(garden.id) || null);
      return;
    }

    setIsLoadingSensorSummary(true);
    try {
      const summaryData: GardenSensorsSummary = await fetchAuthed(`/gardens/${garden.id}/sensors/summary`);
      sensorSummaryCacheRef.current.set(garden.id, summaryData);
      setSensorSummary(summaryData);
    } finally {
      setIsLoadingSensorSummary(false);
    }
  }

  async function loadTimelineForGarden(garden: Garden, forceRefresh = false) {
    if (!forceRefresh && timelineCacheRef.current.has(garden.id)) {
      setGardenTimeline(timelineCacheRef.current.get(garden.id) || null);
      return;
    }

    setIsLoadingTimeline(true);
    try {
      const timelineData: GardenTimeline = await fetchAuthed(`/gardens/${garden.id}/timeline`);
      timelineCacheRef.current.set(garden.id, timelineData);
      setGardenTimeline(timelineData);
    } finally {
      setIsLoadingTimeline(false);
    }
  }

  async function registerSensor(payload: {
    bed_id: number | null;
    name: string;
    sensor_kind: SensorKind;
    unit: string;
    location_label: string;
    hardware_id: string;
  }) {
    if (!selectedGardenRecord) {
      return;
    }

    await fetchAuthed("/sensors/register", {
      method: "POST",
      body: JSON.stringify({
        garden_id: selectedGardenRecord.id,
        bed_id: payload.bed_id,
        name: payload.name,
        sensor_kind: payload.sensor_kind,
        unit: payload.unit,
        location_label: payload.location_label,
        hardware_id: payload.hardware_id,
      }),
    });

    sensorSummaryCacheRef.current.delete(selectedGardenRecord.id);
    timelineCacheRef.current.delete(selectedGardenRecord.id);
    await loadSensorSummaryForGarden(selectedGardenRecord, true);
    pushNotice("Sensor registered.", "success");
  }

  async function ingestSensorData(sensorId: number, value: number) {
    if (!selectedGardenRecord) {
      return;
    }

    await fetchAuthed(`/sensors/${sensorId}/data`, {
      method: "POST",
      body: JSON.stringify({ value }),
    });

    sensorSummaryCacheRef.current.delete(selectedGardenRecord.id);
    timelineCacheRef.current.delete(selectedGardenRecord.id);
    await loadSensorSummaryForGarden(selectedGardenRecord, true);
    pushNotice("Sensor reading ingested.", "success");
  }

  async function askCoach(message: string, scenario: AiCoachScenario) {
    if (!selectedGardenRecord || !message.trim()) {
      return;
    }

    const userMessage: CoachMessage = {
      id: Date.now(),
      role: "user",
      content: message.trim(),
    };
    setCoachMessages((current) => [...current, userMessage]);
    setCoachDraftMessage("");

    setIsLoadingCoach(true);
    try {
      const response: AiCoachResponse = await fetchAuthed("/ai/coach", {
        method: "POST",
        body: JSON.stringify({
          garden_id: selectedGardenRecord.id,
          message: message.trim(),
          scenario,
        }),
      });

      setCoachLatestResponse(response);
      setCoachMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "coach",
          content: response.reply,
        },
      ]);
    } finally {
      setIsLoadingCoach(false);
    }
  }

  async function loadPlantingRecommendation(plantingId: number) {
    if (plantingRecommendationCacheRef.current.has(plantingId)) {
      setPlantingRecommendation(plantingRecommendationCacheRef.current.get(plantingId) || null);
      return;
    }

    setIsLoadingPlantingRecommendation(true);
    try {
      const recData: PlantingRecommendations = await fetchAuthed(`/plantings/${plantingId}/recommendations`);
      plantingRecommendationCacheRef.current.set(plantingId, recData);
      setPlantingRecommendation(recData);
    } finally {
      setIsLoadingPlantingRecommendation(false);
    }
  }

  async function refreshSeasonalPlan() {
    if (!selectedGardenRecord) {
      return;
    }

    seasonalPlanCacheRef.current.delete(selectedGardenRecord.id);
    await loadSeasonalPlanForGarden(selectedGardenRecord, true);
    if (selectedRecommendationPlantingId) {
      plantingRecommendationCacheRef.current.delete(selectedRecommendationPlantingId);
      await loadPlantingRecommendation(selectedRecommendationPlantingId);
    }
  }

  async function loadGardenData() {
    if (!selectedGarden) {
      return;
    }

    try {
      setIsLoadingGardenData(true);
      const [bedsData, plantingsData, placementData] = await Promise.all([
        fetchAuthed(`/gardens/${selectedGarden}/beds`),
        fetchAuthed(`/plantings?garden_id=${selectedGarden}`),
        fetchAuthed(`/placements?garden_id=${selectedGarden}`),
      ]);

      setBeds(bedsData);
      setPlantings(plantingsData);
      setPlacements(placementData);
    } finally {
      setIsLoadingGardenData(false);
    }

    const garden = gardens.find((item) => item.id === selectedGarden);
    if (garden) {
      loadWeatherForGarden(garden).catch(() => {
        pushNotice("Unable to load weather right now.", "error");
      });
    }
  }

  async function saveMicroclimateProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedGarden) {
      return;
    }

    try {
      const updatedGarden: Garden = await fetchAuthed(`/gardens/${selectedGarden}/microclimate`, {
        method: "PATCH",
        body: JSON.stringify(microclimateDraft),
      });

      setGardens((current) => current.map((garden) => (garden.id === updatedGarden.id ? { ...garden, ...updatedGarden } : garden)));
      climateCacheRef.current.delete(selectedGarden);
      plantingWindowCacheRef.current.delete(selectedGarden);
      sunPathCacheRef.current.delete(selectedGarden);
      seasonalPlanCacheRef.current.delete(selectedGarden);
      await loadClimateForGarden(updatedGarden);
      await loadPlantingWindowsForGarden(updatedGarden);
      await loadSunPathForGarden(updatedGarden);
      pushNotice("Microclimate profile updated.", "success");
    } catch (err: any) {
      pushNotice(err?.message || "Unable to update the microclimate profile.", "error");
    }
  }

  async function geocodeGardenAddress() {
    if (!selectedGarden) return;
    setIsGeocodingAddress(true);
    try {
      const updatedGarden: Garden = await fetchAuthed(`/gardens/${selectedGarden}/geocode`, {
        method: "PATCH",
      });
      setGardens((current) => current.map((g) => (g.id === updatedGarden.id ? { ...g, ...updatedGarden } : g)));
      climateCacheRef.current.delete(selectedGarden);
      plantingWindowCacheRef.current.delete(selectedGarden);
      sunPathCacheRef.current.delete(selectedGarden);
      seasonalPlanCacheRef.current.delete(selectedGarden);
      await loadClimateForGarden(updatedGarden);
      pushNotice("Location refined — weather and climate guidance now use your precise address.", "success");
    } catch (err: any) {
      pushNotice(err?.message || "Unable to refine location from address.", "error");
    } finally {
      setIsGeocodingAddress(false);
    }
  }

  async function suggestMicrocliamateProfile() {
    if (!selectedGarden) return;
    setIsSuggestingMicroclimate(true);
    setMicroclimateSuggestion(null);
    try {
      const suggestion: MicroclimateSuggestion = await fetchAuthed(
        `/gardens/${selectedGarden}/microclimate/suggest`
      );
      setMicroclimateSuggestion(suggestion);
      // Auto-fill whichever fields have a suggested value
      setMicroclimateDraft((current) => ({
        ...current,
        ...(suggestion.sun_exposure.value ? { sun_exposure: suggestion.sun_exposure.value as MicroclimateFormState["sun_exposure"] } : {}),
        ...(suggestion.wind_exposure.value ? { wind_exposure: suggestion.wind_exposure.value as MicroclimateFormState["wind_exposure"] } : {}),
        ...(suggestion.slope_position.value ? { slope_position: suggestion.slope_position.value as MicroclimateFormState["slope_position"] } : {}),
        ...(suggestion.frost_pocket_risk.value ? { frost_pocket_risk: suggestion.frost_pocket_risk.value as MicroclimateFormState["frost_pocket_risk"] } : {}),
      }));
      pushNotice("Fields updated from location data — review and save.", "success");
    } catch (err: any) {
      pushNotice(err?.message || "Unable to fetch location suggestions.", "error");
    } finally {
      setIsSuggestingMicroclimate(false);
    }
  }

  async function apiCreatePlacement(payload: {
    garden_id: number;
    bed_id: number;
    crop_name: string;
    grid_x: number;
    grid_y: number;
    planted_on: string;
    color: string;
  }) {
    const created: Placement = await fetchAuthed("/placements", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setPlacements((prev) => [...prev, created]);
    return created;
  }

  async function apiDeletePlacement(placementId: number) {
    await fetchAuthed(`/placements/${placementId}`, { method: "DELETE" });
    setPlacements((prev) => prev.filter((item) => item.id !== placementId));
  }

  async function apiMovePlacement(placementId: number, bedId: number, x: number, y: number) {
    const updated: Placement = await fetchAuthed(`/placements/${placementId}/move`, {
      method: "PATCH",
      body: JSON.stringify({ bed_id: bedId, grid_x: x, grid_y: y }),
    });
    setPlacements((prev) => prev.map((item) => item.id === placementId ? updated : item));
    return updated;
  }

  async function addPlacement(bedId: number, x: number, y: number) {
    if (!selectedGarden || !selectedCropName.trim()) {
      return;
    }

    const spacingIssue = placementSpacingConflict(bedId, x, y, selectedCropName);
    if (spacingIssue) {
      pushNotice(spacingIssue, "error");
      return;
    }

    const created = await apiCreatePlacement({
        garden_id: selectedGarden,
        bed_id: bedId,
        crop_name: selectedCropName.trim(),
        grid_x: x,
        grid_y: y,
        planted_on: selectedDate,
        color: colorForCrop(selectedCropName),
    });
    let trackedPlacementId = created.id;
    pushPlannerHistory({
      label: `Add ${created.crop_name}`,
      undo: async () => {
        await apiDeletePlacement(trackedPlacementId);
      },
      redo: async () => {
        const recreated = await apiCreatePlacement({
          garden_id: selectedGarden,
          bed_id: bedId,
          crop_name: selectedCropName.trim(),
          grid_x: x,
          grid_y: y,
          planted_on: selectedDate,
          color: colorForCrop(selectedCropName),
        });
        trackedPlacementId = recreated.id;
      },
    });
    pushNotice("Placement added to bed sheet.", "success");
  }

  async function removePlacement(placementId: number) {
    const placement = placements.find((item) => item.id === placementId);
    if (!placement || !selectedGarden) {
      return;
    }
    await apiDeletePlacement(placementId);
    let trackedPlacementId = placement.id;
    pushPlannerHistory({
      label: `Remove ${placement.crop_name}`,
      undo: async () => {
        const recreated = await apiCreatePlacement({
          garden_id: selectedGarden,
          bed_id: placement.bed_id,
          crop_name: placement.crop_name,
          grid_x: placement.grid_x,
          grid_y: placement.grid_y,
          planted_on: placement.planted_on,
          color: placement.color,
        });
        trackedPlacementId = recreated.id;
      },
      redo: async () => {
        await apiDeletePlacement(trackedPlacementId);
      },
    });
    pushNotice("Placement removed.", "info");
  }

  async function deleteBed(bedId: number) {
    setConfirmState({
      title: "Delete bed?",
      message: "This removes the bed and all crop placements in it.",
      confirmLabel: "Delete bed",
      onConfirm: async () => {
        await fetchAuthed(`/beds/${bedId}`, { method: "DELETE" });
        await loadGardenData();
        pushNotice("Bed deleted.", "info");
      },
    });
  }

  async function deleteGarden(gardenId: number) {
    setConfirmState({
      title: "Delete garden?",
      message: "This permanently removes this garden and all related data.",
      confirmLabel: "Delete garden",
      onConfirm: async () => {
        await fetchAuthed(`/gardens/${gardenId}`, { method: "DELETE" });
        setSelectedGarden(null);
        setBeds([]);
        setTasks([]);
        setPlantings([]);
        setPlacements([]);
        setWeather(null);
        await loadGardens();
        pushNotice("Garden deleted.", "info");
      },
    });
  }

  async function loadPestLogs(gardenId: number) {
    try {
      setIsLoadingPestLogs(true);
      const data: PestLog[] = await fetchAuthed(`/pest-logs?garden_id=${gardenId}`);
      setPestLogs(data);
    } finally {
      setIsLoadingPestLogs(false);
    }
  }

  async function createPestLog(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedGarden) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      await fetchAuthed("/pest-logs", {
        method: "POST",
        body: JSON.stringify({
          garden_id: selectedGarden,
          title: fd.get("title"),
          observed_on: fd.get("observed_on"),
          treatment: fd.get("treatment") || "",
        }),
      });
      form.reset();
      await loadPestLogs(selectedGarden);
      pushNotice("Observation logged.", "success");
    } catch (err: any) {
      pushNotice(err?.message || "Unable to log observation.", "error");
    }
  }

  async function deletePestLog(logId: number) {
    setConfirmState({
      title: "Delete observation?",
      message: "This permanently removes this pest/disease record.",
      confirmLabel: "Delete",
      onConfirm: async () => {
        await fetchAuthed(`/pest-logs/${logId}`, { method: "DELETE" });
        if (selectedGarden) await loadPestLogs(selectedGarden);
        pushNotice("Observation deleted.", "info");
      },
    });
  }

  async function movePlacement(placementId: number, bedId: number, x: number, y: number) {
    const moving = placements.find((placement) => placement.id === placementId);
    if (!moving) {
      return;
    }

    const spacingIssue = placementSpacingConflict(bedId, x, y, moving.crop_name, placementId);
    if (spacingIssue) {
      pushNotice(spacingIssue, "error");
      return;
    }

    const fromBedId = moving.bed_id;
    const fromX = moving.grid_x;
    const fromY = moving.grid_y;
    const updated = await apiMovePlacement(placementId, bedId, x, y);
    pushPlannerHistory({
      label: `Move ${moving.crop_name}`,
      undo: () => apiMovePlacement(placementId, fromBedId, fromX, fromY).then(() => undefined),
      redo: () => apiMovePlacement(placementId, updated.bed_id, updated.grid_x, updated.grid_y).then(() => undefined),
    });
    pushNotice("Placement moved.", "success");
  }

  async function movePlacementsByDelta(placementIds: number[], dx: number, dy: number) {
    if (placementIds.length === 0) {
      return;
    }

    const movingPlacements = placements.filter((placement) => placementIds.includes(placement.id));
    if (movingPlacements.length !== placementIds.length) {
      return;
    }

    const bedId = movingPlacements[0].bed_id;
    if (!movingPlacements.every((placement) => placement.bed_id === bedId)) {
      pushNotice("Bulk move currently supports selections in one bed at a time.", "error");
      return;
    }

    const bed = beds.find((item) => item.id === bedId);
    if (!bed) {
      return;
    }

    const cols = Math.max(1, Math.ceil(bed.width_in / 3));
    const rows = Math.max(1, Math.ceil(bed.height_in / 3));
    const fromState = movingPlacements.map((placement) => ({
      placementId: placement.id,
      bedId: placement.bed_id,
      x: placement.grid_x,
      y: placement.grid_y,
      cropName: placement.crop_name,
    }));

    const target = fromState.map((placement) => ({
      ...placement,
      x: placement.x + dx,
      y: placement.y + dy,
    }));

    if (target.some((placement) => placement.x < 0 || placement.y < 0 || placement.x >= cols || placement.y >= rows)) {
      pushNotice("Bulk move would push one or more crops outside the bed.", "error");
      return;
    }

    for (const candidate of target) {
      const spacingIssue = placementSpacingConflict(candidate.bedId, candidate.x, candidate.y, candidate.cropName, candidate.placementId);
      if (spacingIssue) {
        pushNotice(spacingIssue, "error");
        return;
      }
    }

    for (const candidate of target) {
      await apiMovePlacement(candidate.placementId, candidate.bedId, candidate.x, candidate.y);
    }

    pushPlannerHistory({
      label: `Move ${target.length} placement${target.length === 1 ? "" : "s"}`,
      undo: async () => {
        for (const placement of fromState) {
          await apiMovePlacement(placement.placementId, placement.bedId, placement.x, placement.y);
        }
      },
      redo: async () => {
        for (const placement of target) {
          await apiMovePlacement(placement.placementId, placement.bedId, placement.x, placement.y);
        }
      },
    });
    pushNotice(`Moved ${target.length} placement${target.length === 1 ? "" : "s"}.`, "success");
  }

  async function removePlacementsBulk(placementIds: number[]) {
    if (!selectedGarden || placementIds.length === 0) {
      return;
    }

    const targets = placements.filter((placement) => placementIds.includes(placement.id));
    if (targets.length === 0) {
      return;
    }

    for (const placement of targets) {
      await apiDeletePlacement(placement.id);
    }

    let tracked = targets.map((placement) => ({ ...placement }));
    pushPlannerHistory({
      label: `Remove ${targets.length} placement${targets.length === 1 ? "" : "s"}`,
      undo: async () => {
        const recreated: Placement[] = [];
        for (const placement of tracked) {
          recreated.push(
            await apiCreatePlacement({
              garden_id: selectedGarden,
              bed_id: placement.bed_id,
              crop_name: placement.crop_name,
              grid_x: placement.grid_x,
              grid_y: placement.grid_y,
              planted_on: placement.planted_on,
              color: placement.color,
            }),
          );
        }
        tracked = recreated;
      },
      redo: async () => {
        for (const placement of tracked) {
          await apiDeletePlacement(placement.id);
        }
      },
    });

    pushNotice(`Removed ${targets.length} placement${targets.length === 1 ? "" : "s"}.`, "info");
  }

  async function nudgePlacementByDelta(placementId: number, dx: number, dy: number) {
    const placement = placements.find((item) => item.id === placementId);
    if (!placement) {
      return;
    }

    const bed = beds.find((item) => item.id === placement.bed_id);
    if (!bed) {
      return;
    }

    const cols = Math.max(1, Math.ceil(bed.width_in / 12));
    const rows = Math.max(1, Math.ceil(bed.height_in / 12));
    const nextX = Math.min(cols - 1, Math.max(0, placement.grid_x + dx));
    const nextY = Math.min(rows - 1, Math.max(0, placement.grid_y + dy));

    if (nextX === placement.grid_x && nextY === placement.grid_y) {
      return;
    }

    try {
      await movePlacement(placementId, placement.bed_id, nextX, nextY);
    } catch (err: any) {
      pushNotice(err?.message || "Unable to move placement.", "error");
    }
  }

  function closeHelpModal(remember: boolean) {
    setIsHelpOpen(false);
    if (remember) {
      localStorage.setItem("open-garden-help-seen", "1");
    }
  }

  function isCellInBuffer(bedId: number, x: number, y: number): boolean {
    if (!selectedGardenRecord) {
      return false;
    }
    const bed = beds.find((b) => b.id === bedId);
    if (!bed) {
      return false;
    }

    // Calculate buffer cells (each cell is 3 inches)
    const bufferCells = Math.ceil(selectedGardenRecord.edge_buffer_in / 3);
    const bedCols = Math.max(1, Math.ceil(bed.width_in / 3));
    const bedRows = Math.max(1, Math.ceil(bed.height_in / 3));

    // Check if cell is in the buffer zone
    return (
      x < bufferCells ||
      x >= bedCols - bufferCells ||
      y < bufferCells ||
      y >= bedRows - bufferCells
    );
  }

  function placementSpacingConflict(bedId: number, x: number, y: number, cropName: string, ignorePlacementId?: number) {
    // Check edge buffer constraint
    if (isCellInBuffer(bedId, x, y)) {
      return `Placement is too close to the bed edge. Required buffer is ${selectedGardenRecord?.edge_buffer_in ?? 6} inches.`;
    }

    const newSpacing = cropMap.get(cropName)?.spacing_in || 12;
    const bedPlacements = placements.filter((placement) => placement.bed_id === bedId && placement.id !== ignorePlacementId);

    for (const existing of bedPlacements) {
      const existingSpacing = cropMap.get(existing.crop_name)?.spacing_in || 12;
      const required = Math.max(newSpacing, existingSpacing);
      const dx = (x - existing.grid_x) * 3;
      const dy = (y - existing.grid_y) * 3;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < required) {
        return `Too close to ${existing.crop_name}. Required spacing is ${required} inches.`;
      }
    }

    return null;
  }

  function isCellBlockedForSelectedCrop(bedId: number, x: number, y: number, occupant: Placement | undefined) {
    if (occupant || !selectedCropName) {
      return false;
    }
    return Boolean(placementSpacingConflict(bedId, x, y, selectedCropName));
  }

  useEffect(() => {
    if (authParamsHandledRef.current) {
      return;
    }
    authParamsHandledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get("verify_token");
    const reset = params.get("reset_token");
    if (verifyToken) {
      verifyEmailToken(verifyToken)
        .then(() => {
          setIsEmailVerified(true);
          pushNotice("Email verified. Password reset is now available.", "success");
        })
        .catch((err: any) => {
          pushNotice(err?.message || "Verification link is invalid or expired.", "error");
        })
        .finally(() => {
          params.delete("verify_token");
          const query = params.toString();
          const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}`;
          window.history.replaceState(null, "", nextUrl);
        });
    }
    if (reset) {
      setResetToken(reset);
      setAuthPane("reset");
      params.delete("reset_token");
      const query = params.toString();
      const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}`;
      window.history.replaceState(null, "", nextUrl);
    }
  }, []);

  useEffect(() => {
    if (token) {
      loadGardens().catch(noticeUnlessExpired("Unable to load your gardens."));
      loadCropTemplates().catch(noticeUnlessExpired("Unable to load crop templates."));
      loadMe().catch(noticeUnlessExpired("Unable to load profile details."));
      loadCropTemplateSyncStatus(false).catch(noticeUnlessExpired("Unable to load crop sync status."));
    }
  }, [token]);

  useEffect(() => {
    if (!token || !cropTemplateSyncStatus?.is_running) {
      return;
    }

    const intervalId = window.setInterval(() => {
      loadCropTemplateSyncStatus().catch(() => undefined);
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [token, cropTemplateSyncStatus?.is_running, selectedCropName]);

  useEffect(() => {
    if (token && selectedGarden) {
      loadGardenData().catch(noticeUnlessExpired("Unable to refresh garden layout data."));
    }
  }, [token, selectedGarden]);

  useEffect(() => {
    if (token && selectedGarden) {
      loadTasks(selectedGarden, debouncedTaskQuery).catch(noticeUnlessExpired("Unable to load tasks."));
    }
  }, [token, selectedGarden, debouncedTaskQuery]);

  useEffect(() => {
    if (selectedGardenRecord) {
      setYardWidthDraft(selectedGardenRecord.yard_width_ft);
      setYardLengthDraft(selectedGardenRecord.yard_length_ft);
      setMicroclimateDraft({
        orientation: selectedGardenRecord.orientation,
        sun_exposure: selectedGardenRecord.sun_exposure,
        wind_exposure: selectedGardenRecord.wind_exposure,
        thermal_mass: selectedGardenRecord.thermal_mass,
        slope_position: selectedGardenRecord.slope_position,
        frost_pocket_risk: selectedGardenRecord.frost_pocket_risk,
        address_private: selectedGardenRecord.address_private ?? "",
        edge_buffer_in: selectedGardenRecord.edge_buffer_in,
      });
      setMicroclimateSuggestion(null);
    }
  }, [selectedGardenRecord]);

  useEffect(() => {
    if (!token || !selectedGardenRecord) {
      setGardenClimate(null);
      setPlantingWindows(null);
      setGardenSunPath(null);
      setSeasonalPlan(null);
      setSensorSummary(null);
      setGardenTimeline(null);
      setPlantingRecommendation(null);
      setSelectedRecommendationPlantingId(null);
      return;
    }

    loadClimateForGarden(selectedGardenRecord).catch(noticeUnlessExpired("Unable to load climate guidance."));
    loadPlantingWindowsForGarden(selectedGardenRecord).catch(noticeUnlessExpired("Unable to load dynamic planting windows."));
    loadSunPathForGarden(selectedGardenRecord).catch(noticeUnlessExpired("Unable to load sun-path layout guidance."));
  }, [token, selectedGardenRecord]);

  useEffect(() => {
    if (!token || !selectedGardenRecord || activePage !== "timeline") {
      return;
    }

    loadTimelineForGarden(selectedGardenRecord).catch(noticeUnlessExpired("Unable to load unified timeline."));
  }, [token, selectedGardenRecord, activePage]);

  useEffect(() => {
    if (!token || !selectedGardenRecord || activePage !== "seasonal") {
      return;
    }

    loadSeasonalPlanForGarden(selectedGardenRecord).catch(noticeUnlessExpired("Unable to load seasonal plan."));
  }, [token, selectedGardenRecord, activePage]);

  useEffect(() => {
    if (!token || !selectedGardenRecord || activePage !== "sensors") {
      return;
    }

    loadSensorSummaryForGarden(selectedGardenRecord).catch(noticeUnlessExpired("Unable to load sensor telemetry."));
  }, [token, selectedGardenRecord, activePage]);

  useEffect(() => {
    if (!token || activePage !== "seasonal" || !selectedRecommendationPlantingId) {
      return;
    }

    loadPlantingRecommendation(selectedRecommendationPlantingId).catch(() => {
      pushNotice("Unable to load planting recommendations.", "error");
    });
  }, [token, activePage, selectedRecommendationPlantingId]);

  useEffect(() => {
    setCropSearchActiveIndex(0);
  }, [cropSearchQuery]);

  useEffect(() => {
    if (cropSearchActiveIndex > Math.max(0, filteredCropTemplates.length - 1)) {
      setCropSearchActiveIndex(0);
    }
  }, [cropSearchActiveIndex, filteredCropTemplates.length]);

  useEffect(() => {
    if (token && !localStorage.getItem("open-garden-help-seen")) {
      setIsHelpOpen(true);
    }
  }, [token]);

  useEffect(() => {
    if (!selectedGarden && (activePage === "timeline" || activePage === "calendar" || activePage === "seasonal" || activePage === "planner" || activePage === "coach" || activePage === "pests" || activePage === "sensors")) {
      setActivePage("home");
    }
  }, [selectedGarden, activePage]);

  useEffect(() => {
    setCoachMessages([]);
    setCoachLatestResponse(null);
    setCoachDraftMessage("");
    plannerUndoStackRef.current = [];
    plannerRedoStackRef.current = [];
    syncPlannerHistoryCounts();
  }, [selectedGarden]);

  useEffect(() => {
    if (token && selectedGarden && activePage === "pests") {
      loadPestLogs(selectedGarden).catch(() => {
        pushNotice("Unable to load pest log.", "error");
      });
    }
  }, [token, selectedGarden, activePage]);

  useEffect(() => {
    setIsNavOpen(false);
  }, [activePage, selectedGarden]);

  function navigateTo(page: AppPage) {
    setActivePage(page);
    setIsNavOpen(false);
  }

  if (!token) {
    return (
      <main className="shell center">
        <section className="card login-card">
          <h1>open-garden</h1>
          <p>Calendar-driven garden planning with visual bed design.</p>
          {authPane === "login" && (
            <>
              <div className="auth-tabs" role="tablist">
                <button
                  role="tab"
                  aria-selected={loginMode === "signin"}
                  className={loginMode === "signin" ? "auth-tab active" : "auth-tab"}
                  type="button"
                  onClick={() => setLoginMode("signin")}
                >
                  Sign in
                </button>
                <button
                  role="tab"
                  aria-selected={loginMode === "register"}
                  className={loginMode === "register" ? "auth-tab active" : "auth-tab"}
                  type="button"
                  onClick={() => setLoginMode("register")}
                >
                  Create account
                </button>
              </div>
              <form onSubmit={handleAuth} className="stack">
                {loginMode === "register" && (
                  <div className="stack compact">
                    <label className="field-label" htmlFor="login-email">Email</label>
                    <input
                      id="login-email"
                      name="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      placeholder="you@example.com"
                      required
                      autoComplete="email"
                    />
                  </div>
                )}
                <div className="stack compact">
                  <label className="field-label" htmlFor="login-username">Username</label>
                  <input id="login-username" name="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" required autoComplete="username" />
                </div>
                <div className="stack compact">
                  <label className="field-label" htmlFor="login-password">Password</label>
                  <input id="login-password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="password" required autoComplete={loginMode === "register" ? "new-password" : "current-password"} />
                </div>
                <button type="submit">{loginMode === "register" ? "Create account" : "Sign in"}</button>
                {loginMode === "signin" && (
                  <>
                    <button type="button" className="link-btn" onClick={() => setAuthPane("forgot-password")}>
                      Forgot password?
                    </button>
                    <button type="button" className="link-btn" onClick={() => setAuthPane("forgot-username")}>
                      Forgot username?
                    </button>
                  </>
                )}
              </form>
            </>
          )}

          {authPane === "forgot-password" && (
            <form onSubmit={handleForgotPassword} className="stack">
              <h3>Password reset</h3>
              <p className="subhead">Enter your verified account email to request a reset link.</p>
              <div className="stack compact">
                <label className="field-label" htmlFor="forgot-email">Email</label>
                <input id="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
              </div>
              <button type="submit">Send reset link</button>
              <button type="button" className="link-btn" onClick={() => setAuthPane("login")}>Back to sign in</button>
            </form>
          )}

          {authPane === "forgot-username" && (
            <form onSubmit={handleForgotUsername} className="stack">
              <h3>Recover username</h3>
              <p className="subhead">Enter your verified account email to receive your username.</p>
              <div className="stack compact">
                <label className="field-label" htmlFor="forgot-username-email">Email</label>
                <input id="forgot-username-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
              </div>
              <button type="submit">Send username</button>
              <button type="button" className="link-btn" onClick={() => setAuthPane("login")}>Back to sign in</button>
            </form>
          )}

          {authPane === "reset" && (
            <form onSubmit={submitPasswordReset} className="stack">
              <h3>Set new password</h3>
              <p className="subhead">Enter a new password for your account.</p>
              <div className="stack compact">
                <label className="field-label" htmlFor="reset-password">New password</label>
                <input id="reset-password" type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="new password" required autoComplete="new-password" />
              </div>
              <button type="submit">Reset password</button>
              <button type="button" className="link-btn" onClick={() => { setAuthPane("login"); setResetToken(null); }}>Back to sign in</button>
            </form>
          )}
        </section>
        <ToastRegion notices={notices} onDismiss={dismissNotice} onAction={dismissNotice} />
      </main>
    );
  }

  return (
    <main className="shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <nav className="navbar" aria-label="Primary navigation">
        <div className="navbar-top">
          <div className="navbar-brand">
            <h1>open-garden</h1>
            {selectedGardenRecord && (
              <span className="navbar-garden">{selectedGardenRecord.name} · Zone {selectedGardenRecord.growing_zone}</span>
            )}
          </div>
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={isNavOpen}
            aria-controls="primary-navigation"
            onClick={() => setIsNavOpen((open) => !open)}
          >
            {isNavOpen ? "Close menu" : "Menu"}
          </button>
        </div>
        <div id="primary-navigation" className={isNavOpen ? "navbar-content open" : "navbar-content"}>
          <div className="navbar-nav">
            <button className={activePage === "home" ? "nav-btn active" : "nav-btn"} onClick={() => navigateTo("home")}>My Gardens</button>
            {selectedGarden && (
              <>
                <button className={activePage === "timeline" ? "nav-btn active" : "nav-btn"} onClick={() => navigateTo("timeline")}>Timeline</button>
                <button className={activePage === "calendar" ? "nav-btn active" : "nav-btn"} onClick={() => navigateTo("calendar")}>Calendar</button>
                <button className={activePage === "seasonal" ? "nav-btn active" : "nav-btn"} onClick={() => navigateTo("seasonal")}>Seasonal Plan</button>
                <button className={activePage === "planner" ? "nav-btn active" : "nav-btn"} onClick={() => navigateTo("planner")}>Bed Planner</button>
                <button className={activePage === "coach" ? "nav-btn active" : "nav-btn"} onClick={() => navigateTo("coach")}>AI Coach</button>
                <button className={activePage === "sensors" ? "nav-btn active" : "nav-btn"} onClick={() => navigateTo("sensors")}>Sensors</button>
              </>
            )}
            <button className={activePage === "crops" ? "nav-btn active" : "nav-btn"} onClick={() => navigateTo("crops")}>Crop Library</button>
            {selectedGarden && (
              <button className={activePage === "pests" ? "nav-btn active" : "nav-btn"} onClick={() => navigateTo("pests")}>Pest Log</button>
            )}
          </div>
          <div className="navbar-actions">
            <button type="button" className="secondary-btn" onClick={() => { setIsNavOpen(false); setIsHelpOpen(true); }}>Help</button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                localStorage.removeItem("open-garden-token");
                setIsNavOpen(false);
                setToken("");
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </nav>

      <div className="page-body" id="main-content" tabIndex={-1}>
        {isEmailVerified === false && (
          <article className="card notice-card">
            <h3>Verify your email</h3>
            <p className="subhead">Password reset requires a verified email address.</p>
            <div className="panel-actions">
              <button
                type="button"
                onClick={() => {
                  resendVerificationEmail()
                    .then(() => pushNotice("Verification email sent.", "success"))
                    .catch((err: any) => pushNotice(err?.message || "Unable to resend verification email.", "error"));
                }}
              >
                Resend verification email
              </button>
            </div>
          </article>
        )}
        {!selectedGarden && (activePage === "timeline" || activePage === "calendar" || activePage === "seasonal" || activePage === "planner" || activePage === "coach" || activePage === "sensors") && (
          <article className="card page-empty-state">
            <h2>Select or Create a Garden</h2>
            <p className="subhead">Timeline, Calendar, Seasonal Plan, Bed Planner, AI Coach, Sensors, and Pest Log need an active garden. Choose one from My Gardens first.</p>
            <div className="panel-actions">
              <button type="button" onClick={() => setActivePage("home")}>Go to My Gardens</button>
            </div>
          </article>
        )}

        {activePage === "timeline" && selectedGarden && (
          <TimelinePanel
            selectedGardenName={selectedGardenName}
            timeline={gardenTimeline}
            isLoading={isLoadingTimeline}
            onRefresh={() => {
              if (selectedGardenRecord) {
                timelineCacheRef.current.delete(selectedGardenRecord.id);
                loadTimelineForGarden(selectedGardenRecord, true).catch(() => undefined);
              }
            }}
          />
        )}

        {activePage === "home" && (
          <>
            {selectedGarden && selectedGardenRecord && (
              <article className="card home-hero">
                <div className="home-hero-head">
                  <div>
                    <h2>{selectedGardenRecord.name}</h2>
                    <p className="subhead">Zone {selectedGardenRecord.growing_zone} &middot; {selectedGardenRecord.zip_code} &middot; {selectedGardenRecord.yard_width_ft} x {selectedGardenRecord.yard_length_ft} ft yard</p>
                  </div>
                  <div className="panel-actions">
                    <button type="button" onClick={() => setActivePage("calendar")}>Open Calendar</button>
                    <button type="button" onClick={() => setActivePage("planner")}>Open Bed Planner</button>
                    <button type="button" className="secondary-btn" onClick={() => setActivePage("crops")}>Manage Crops</button>
                  </div>
                </div>

                <div className="home-summary-stats">
                  <div className="planner-stat">
                    <strong>{beds.length}</strong>
                    <span>Beds</span>
                  </div>
                  <div className="planner-stat">
                    <strong>{placements.length}</strong>
                    <span>Placements</span>
                  </div>
                  <div className="planner-stat">
                    <strong>{tasks.length}</strong>
                    <span>Tasks</span>
                  </div>
                  <div className="planner-stat">
                    <strong>{cropTemplates.length}</strong>
                    <span>Crops</span>
                  </div>
                </div>

                <div className="home-dashboard-grid">
                  <section className="home-dashboard-card">
                    <div className="crop-card-row">
                      <h3>Today and Next Up</h3>
                      <span className={`status-pill ${overdueTaskCount > 0 ? "act" : "stable"}`}>
                        {overdueTaskCount > 0 ? `${overdueTaskCount} overdue` : `${upcomingTaskCount} open`}
                      </span>
                    </div>
                    {homeTaskPreview.length > 0 ? (
                      <ul className="home-dashboard-list">
                        {homeTaskPreview.map((task) => (
                          <li key={task.id} className="home-dashboard-list-item">
                            <strong>{task.title}</strong>
                            <span className="hint">{task.due_on}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="hint">No open tasks. Use the calendar to add plantings or tasks for this garden.</p>
                    )}
                  </section>

                  <section className="home-dashboard-card">
                    <div className="crop-card-row">
                      <h3>Weather Snapshot</h3>
                      {gardenClimate && <span className="climate-kpi">{gardenClimate.microclimate_band}</span>}
                    </div>
                    {isLoadingWeather ? (
                      <p className="hint">Refreshing weather forecast...</p>
                    ) : weatherPreview.length > 0 ? (
                      <ul className="home-dashboard-list compact-list">
                        {weatherPreview.map((day) => (
                          <li key={day.date} className="home-dashboard-list-item">
                            <strong>{day.date}</strong>
                            <span className="hint">{day.low}F to {day.high}F &middot; rain {day.rain} in</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="hint">No weather data loaded yet for this garden.</p>
                    )}
                    {gardenClimate && (
                      <div className="climate-kpis">
                        <span className="climate-kpi">Soil ~ {gardenClimate.soil_temperature_estimate_f}F</span>
                        <span className="climate-kpi">Frost risk {gardenClimate.frost_risk_next_10_days}</span>
                      </div>
                    )}
                  </section>

                  <section className="home-dashboard-card">
                    <div className="crop-card-row">
                      <h3>Plant and Protect</h3>
                      {actionablePlantingWindows.length > 0 && <span className="status-pill open">{actionablePlantingWindows.length} active cues</span>}
                    </div>
                    {actionablePlantingWindows.length > 0 ? (
                      <ul className="home-dashboard-list compact-list">
                        {actionablePlantingWindows.map((window) => (
                          <li key={`${window.crop_template_id}-${window.status}`} className="home-dashboard-list-item">
                            <strong>{window.crop_name}</strong>
                            <span className="hint">{window.status}: {window.window_start} to {window.window_end}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="hint">No urgent planting windows yet. Climate guidance will surface here when conditions shift.</p>
                    )}
                    {weatherRiskCues.length > 0 && (
                      <ul className="home-dashboard-list compact-list">
                        {weatherRiskCues.map((cue) => (
                          <li key={cue} className="home-dashboard-list-item home-dashboard-warning">
                            <span className="hint">{cue}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              </article>
            )}

            <div className="home-layout">
              <div className="home-management-column">
                <article className="card">
                  <h2>Your Gardens</h2>

                  {gardens.length === 0 && (
                    <ol className="workflow-guide">
                      <li>Create a garden with your ZIP &amp; yard size below</li>
                      <li>Use <strong>Bed Planner</strong> to add beds and drag them into your yard</li>
                      <li>Use <strong>Calendar</strong> to add plantings — tasks generate automatically</li>
                    </ol>
                  )}

                  <ul className="garden-card-list">
                    {gardens.map((garden) => (
                      <li key={garden.id} className={`garden-card-item${selectedGarden === garden.id ? " selected" : ""}`}>
                        <button className="garden-card-select" onClick={() => setSelectedGarden(garden.id)}>
                          <span className="garden-card-name">{garden.name}</span>
                          <span className="garden-card-meta">Zone {garden.growing_zone} &middot; {garden.zip_code} &middot; {garden.yard_width_ft}&times;{garden.yard_length_ft} ft {garden.is_shared ? "· shared" : ""}</span>
                        </button>
                        <button
                          className="danger-sm"
                          title="Delete garden"
                          onClick={() => deleteGarden(garden.id).catch(() => undefined)}
                        >
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                </article>

                <article className="card home-community-card">
                  <div className="crop-card-row">
                    <h3>Community Shared Gardens</h3>
                    <span className="status-pill upcoming">{publicGardens.length} shared</span>
                  </div>
                  {publicGardens.length > 0 ? (
                    <ul className="home-dashboard-list compact-list">
                      {publicGardens.slice(0, 6).map((garden) => (
                        <li key={garden.id} className="home-dashboard-list-item">
                          <strong>{garden.name}</strong>
                          <span className="hint">Zone {garden.growing_zone}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="hint">No shared gardens yet.</p>
                  )}
                </article>
              </div>

              <div className="home-main-column">
                <article className="card home-create-card">
                  <h3>Create Garden</h3>
                  <form onSubmit={createGarden} className="stack">
                    <div className="stack compact">
                      <label className="field-label" htmlFor="garden-name">Garden Name</label>
                      <input id="garden-name" name="name" value={gardenDraft.name} onChange={(event) => setGardenDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Garden name" aria-invalid={Boolean(showGardenValidation && gardenFormErrors.name)} aria-describedby={showGardenValidation && gardenFormErrors.name ? "garden-name-error" : undefined} required />
                      {showGardenValidation && gardenFormErrors.name && <p id="garden-name-error" className="field-error">{gardenFormErrors.name}</p>}
                    </div>
                    <div className="stack compact">
                      <label className="field-label" htmlFor="garden-description">Description</label>
                      <input id="garden-description" name="description" value={gardenDraft.description} onChange={(event) => setGardenDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Description" />
                    </div>
                    <div className="stack compact">
                      <label className="field-label" htmlFor="garden-zip-code">ZIP Code</label>
                      <input id="garden-zip-code" name="zip_code" value={gardenDraft.zip_code} onChange={(event) => setGardenDraft((current) => ({ ...current, zip_code: event.target.value }))} inputMode="numeric" pattern="[0-9]{5}" maxLength={5} placeholder="ZIP code (US)" aria-invalid={Boolean(showGardenValidation && gardenFormErrors.zip_code)} aria-describedby={showGardenValidation && gardenFormErrors.zip_code ? "garden-zip-error" : "garden-zip-hint"} required />
                      {showGardenValidation && gardenFormErrors.zip_code ? <p id="garden-zip-error" className="field-error">{gardenFormErrors.zip_code}</p> : <p id="garden-zip-hint" className="field-hint">Used to calculate zone, weather, and planting guidance.</p>}
                    </div>
                    <div className="mini-row">
                      <div className="stack compact">
                        <label className="field-label" htmlFor="garden-yard-width">Yard Width (ft)</label>
                        <input id="garden-yard-width" name="yard_width_ft" type="number" min="4" value={gardenDraft.yard_width_ft} onChange={(event) => setGardenDraft((current) => ({ ...current, yard_width_ft: Number(event.target.value) }))} aria-invalid={Boolean(showGardenValidation && gardenFormErrors.yard_width_ft)} aria-describedby={showGardenValidation && gardenFormErrors.yard_width_ft ? "garden-yard-width-error" : undefined} required />
                        {showGardenValidation && gardenFormErrors.yard_width_ft && <p id="garden-yard-width-error" className="field-error">{gardenFormErrors.yard_width_ft}</p>}
                      </div>
                      <div className="stack compact">
                        <label className="field-label" htmlFor="garden-yard-length">Yard Length (ft)</label>
                        <input id="garden-yard-length" name="yard_length_ft" type="number" min="4" value={gardenDraft.yard_length_ft} onChange={(event) => setGardenDraft((current) => ({ ...current, yard_length_ft: Number(event.target.value) }))} aria-invalid={Boolean(showGardenValidation && gardenFormErrors.yard_length_ft)} aria-describedby={showGardenValidation && gardenFormErrors.yard_length_ft ? "garden-yard-length-error" : undefined} required />
                        {showGardenValidation && gardenFormErrors.yard_length_ft && <p id="garden-yard-length-error" className="field-error">{gardenFormErrors.yard_length_ft}</p>}
                      </div>
                    </div>
                    <div className="stack compact">
                      <label className="field-label" htmlFor="garden-private-address">Private Address</label>
                      <input id="garden-private-address" name="address_private" value={gardenDraft.address_private} onChange={(event) => setGardenDraft((current) => ({ ...current, address_private: event.target.value }))} placeholder="Street address (optional, never public)" />
                      <p className="field-hint">Optional. Enter a full street address to enable precise weather location later.</p>
                    </div>
                    <label className="inline">
                      <input type="checkbox" name="is_shared" checked={gardenDraft.is_shared} onChange={(event) => setGardenDraft((current) => ({ ...current, is_shared: event.target.checked }))} />
                      Share publicly
                    </label>
                    <button type="submit">Create garden</button>
                  </form>
                </article>

                {selectedGarden && selectedGardenRecord && (
                  <article className="card home-summary">
                    <div className="crop-card-row">
                      <h3>Climate and Site Profile</h3>
                      {gardenClimate && <span className="climate-kpi">{gardenClimate.microclimate_band}</span>}
                    </div>
                    <p className="subhead">Fine-tune the site profile so planting windows and climate guidance stay accurate for this garden.</p>
                    <form className="microclimate-form" onSubmit={saveMicroclimateProfile}>
                  <div className="map-reference">
                    <div className="map-reference-head">
                      <span className="field-label">Satellite Reference</span>
                      <div className="map-ref-links">
                        <a
                          href={`https://maps.google.com/?q=${selectedGardenRecord.latitude},${selectedGardenRecord.longitude}&z=19&t=k`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="map-ref-link"
                        >Google Maps ↗</a>
                        <a
                          href={`https://earth.google.com/web/@${selectedGardenRecord.latitude},${selectedGardenRecord.longitude},0a,200d,35y,0h,0t,0r`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="map-ref-link"
                        >Google Earth ↗</a>
                      </div>
                    </div>
                    <iframe
                      title="Garden location"
                      className="garden-location-map"
                      loading="lazy"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedGardenRecord.longitude - 0.002},${selectedGardenRecord.latitude - 0.0014},${selectedGardenRecord.longitude + 0.002},${selectedGardenRecord.latitude + 0.0014}&layer=mapnik&marker=${selectedGardenRecord.latitude},${selectedGardenRecord.longitude}`}
                    />
                    <p className="field-hint">Open satellite imagery to see your yard's orientation, tree canopy, nearby structures, and slope — then fill in the profile below.</p>
                  </div>

                  <div className="microclimate-grid">
                    <div className="stack compact">
                      <span className="field-label">Orientation</span>
                      <CompassPicker
                        value={microclimateDraft.orientation}
                        onChange={(v) => setMicroclimateDraft((current) => ({ ...current, orientation: v as MicroclimateFormState["orientation"] }))}
                      />
                      {microclimateSuggestion ? (
                        <p className="field-hint suggestion-note needs-input">⚠ {microclimateSuggestion.orientation.note}</p>
                      ) : (
                        <p className="field-hint">Which direction your garden faces — south-facing gets the most sun.</p>
                      )}
                    </div>
                    <div className="stack compact">
                      <label className="field-label" htmlFor="garden-sun-exposure">Sun Exposure</label>
                      <select
                        id="garden-sun-exposure"
                        value={microclimateDraft.sun_exposure}
                        onChange={(event) => setMicroclimateDraft((current) => ({ ...current, sun_exposure: event.target.value as MicroclimateFormState["sun_exposure"] }))}
                      >
                        {sunExposureOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      {microclimateSuggestion?.sun_exposure.value ? (
                        <p className="field-hint suggestion-note auto-set">✓ {microclimateSuggestion.sun_exposure.note}</p>
                      ) : (
                        <p className="field-hint">Full sun = 6+ hrs/day; Part sun = 4–6 hrs; Part shade = 2–4 hrs; Full shade = &lt;2 hrs.</p>
                      )}
                    </div>
                    <div className="stack compact">
                      <label className="field-label" htmlFor="garden-wind-exposure">Wind Exposure</label>
                      <select
                        id="garden-wind-exposure"
                        value={microclimateDraft.wind_exposure}
                        onChange={(event) => setMicroclimateDraft((current) => ({ ...current, wind_exposure: event.target.value as MicroclimateFormState["wind_exposure"] }))}
                      >
                        {windExposureOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      {microclimateSuggestion?.wind_exposure.value ? (
                        <p className="field-hint suggestion-note auto-set">✓ {microclimateSuggestion.wind_exposure.note}</p>
                      ) : (
                        <p className="field-hint">Sheltered = hedges or fences block wind; Exposed = open hillside or roof.</p>
                      )}
                    </div>
                    <div className="stack compact">
                      <label className="field-label" htmlFor="garden-thermal-mass">Thermal Mass</label>
                      <select
                        id="garden-thermal-mass"
                        value={microclimateDraft.thermal_mass}
                        onChange={(event) => setMicroclimateDraft((current) => ({ ...current, thermal_mass: event.target.value as MicroclimateFormState["thermal_mass"] }))}
                      >
                        {thermalMassOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      {microclimateSuggestion ? (
                        <p className="field-hint suggestion-note needs-input">⚠ {microclimateSuggestion.thermal_mass.note}</p>
                      ) : (
                        <p className="field-hint">Nearby stone, brick, or pavement absorbs daytime heat and buffers overnight frosts.</p>
                      )}
                    </div>
                    <div className="stack compact">
                      <label className="field-label" htmlFor="garden-slope-position">Slope Position</label>
                      <select
                        id="garden-slope-position"
                        value={microclimateDraft.slope_position}
                        onChange={(event) => setMicroclimateDraft((current) => ({ ...current, slope_position: event.target.value as MicroclimateFormState["slope_position"] }))}
                      >
                        {slopePositionOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      {microclimateSuggestion?.slope_position.value ? (
                        <p className="field-hint suggestion-note auto-set">✓ {microclimateSuggestion.slope_position.note}</p>
                      ) : microclimateSuggestion ? (
                        <p className="field-hint suggestion-note needs-input">⚠ {microclimateSuggestion.slope_position.note}</p>
                      ) : (
                        <p className="field-hint">Low spots collect cold air; high ground sheds cold air and drains faster.</p>
                      )}
                    </div>
                    <div className="stack compact">
                      <label className="field-label" htmlFor="garden-frost-pocket-risk">Frost Pocket Risk</label>
                      <select
                        id="garden-frost-pocket-risk"
                        value={microclimateDraft.frost_pocket_risk}
                        onChange={(event) => setMicroclimateDraft((current) => ({ ...current, frost_pocket_risk: event.target.value as MicroclimateFormState["frost_pocket_risk"] }))}
                      >
                        {frostPocketOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      {microclimateSuggestion?.frost_pocket_risk.value ? (
                        <p className="field-hint suggestion-note auto-set">✓ {microclimateSuggestion.frost_pocket_risk.note}</p>
                      ) : microclimateSuggestion ? (
                        <p className="field-hint suggestion-note needs-input">⚠ {microclimateSuggestion.frost_pocket_risk.note}</p>
                      ) : (
                        <p className="field-hint">Bottoms of slopes near walls trap cold air — high risk means later last frosts.</p>
                      )}
                    </div>
                  </div>

                  <div className="stack compact">
                    <label className="field-label" htmlFor="climate-address-private">Private Address</label>
                    <input
                      id="climate-address-private"
                      type="text"
                      value={microclimateDraft.address_private}
                      onChange={(event) => setMicroclimateDraft((current) => ({ ...current, address_private: event.target.value }))}
                      placeholder="Street address (optional, never public)"
                    />
                    <p className="field-hint">Used only to improve weather precision. Never shared publicly.</p>
                  </div>

                  <div className="stack compact">
                    <label className="field-label" htmlFor="garden-edge-buffer">Bed Edge Buffer (inches)</label>
                    <input
                      id="garden-edge-buffer"
                      type="number"
                      min="0"
                      max="24"
                      step="1"
                      value={microclimateDraft.edge_buffer_in}
                      onChange={(event) => setMicroclimateDraft((current) => ({ ...current, edge_buffer_in: Number(event.target.value) }))}
                    />
                    <p className="field-hint">Minimum clearance from bed edges. Default is 6 inches to allow maintenance access.</p>
                  </div>

                  {isLoadingClimate && <p className="hint">Refreshing climate guidance...</p>}
                  {gardenClimate && (
                    <div className="climate-metrics">
                      <div className="planner-stat">
                        <strong>{gardenClimate.adjusted_last_spring_frost}</strong>
                        <span>Adjusted last spring frost</span>
                      </div>
                      <div className="planner-stat">
                        <strong>{gardenClimate.adjusted_first_fall_frost}</strong>
                        <span>Adjusted first fall frost</span>
                      </div>
                      <div className="planner-stat">
                        <strong>{gardenClimate.soil_temperature_estimate_f}F</strong>
                        <span>Estimated soil temperature</span>
                      </div>
                    </div>
                  )}
                  <div className="microclimate-actions">
                    <button type="submit">Save climate profile</button>
                    {selectedGardenRecord?.latitude && (
                      <button
                        type="button"
                        className="secondary-btn suggest-btn"
                        disabled={isSuggestingMicroclimate}
                        onClick={suggestMicrocliamateProfile}
                        title="Analyse your location's sunshine, wind, and terrain to auto-fill detectable fields"
                      >
                        {isSuggestingMicroclimate ? "Analysing location…" : "✦ Suggest from location"}
                      </button>
                    )}
                    {microclimateDraft.address_private.trim() && (
                      <button
                        type="button"
                        className="secondary-btn"
                        disabled={isGeocodingAddress}
                        onClick={geocodeGardenAddress}
                        title="Use your address to get a more precise weather location than the ZIP code centroid"
                      >
                        {isGeocodingAddress ? "Refining location…" : "Refine location from address"}
                      </button>
                    )}
                  </div>
                    </form>
                  </article>
                )}
              </div>
            </div>
          </>
        )}

        {activePage === "calendar" && selectedGarden && (
          <>
            <CalendarPanel
              selectedGardenName={selectedGardenName}
              monthCursor={monthCursor}
              onPrevMonth={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              onNextMonth={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              monthCells={monthCells}
              weekdayLabels={weekdayLabels}
              selectedDate={selectedDate}
              today={today}
              eventsByDate={eventsByDate}
              selectedDayEvents={selectedDayEvents}
              onSelectDate={setSelectedDate}
              taskQuery={taskQuery}
              onTaskQueryChange={setTaskQuery}
              isLoadingTasks={isLoadingTasks}
              onCreateTask={createTask}
              onCreatePlanting={createPlanting}
              beds={beds}
              cropSearchQuery={cropSearchQuery}
              onCropSearchQueryChange={setCropSearchQuery}
              onCropSearchKeyDown={handleCropSearchKeyDown}
              filteredCropTemplates={filteredCropTemplates}
              cropSearchActiveIndex={cropSearchActiveIndex}
              selectedCropName={selectedCropName}
              onSelectCrop={selectCrop}
              cropBaseName={cropBaseName}
              selectedCrop={selectedCrop}
              selectedCropWindow={selectedCropWindow}
              isLoadingPlantingWindows={isLoadingPlantingWindows}
              onToggleTaskDone={toggleTaskDone}
              onDeleteTask={deleteTask}
              onEditTask={editTask}
              onLogHarvest={logHarvest}
            />
            <WeatherPanel
              climate={gardenClimate}
              weather={weather}
              tasks={tasks}
              isLoadingClimate={isLoadingClimate}
              isLoadingWeather={isLoadingWeather}
              isLoadingTasks={isLoadingTasks}
            />
          </>
        )}

        {activePage === "planner" && selectedGarden && (
          <PlannerPanel
            isLoadingGardenData={isLoadingGardenData}
            beds={beds}
            placements={placements}
            cropTemplates={cropTemplates}
            yardWidthFt={yardWidthFt}
            yardLengthFt={yardLengthFt}
            yardWidthDraft={yardWidthDraft}
            yardLengthDraft={yardLengthDraft}
            onYardWidthDraftChange={setYardWidthDraft}
            onYardLengthDraftChange={setYardLengthDraft}
            onCreateBed={createBed}
            onUpdateYardSize={updateYardSize}
            onGoToCrops={() => setActivePage("crops")}
            cropSearchQuery={cropSearchQuery}
            onCropSearchQueryChange={setCropSearchQuery}
            onCropSearchKeyDown={handleCropSearchKeyDown}
            bedName={bedDraft.name}
            bedWidthFt={bedDraft.width_ft}
            bedLengthFt={bedDraft.length_ft}
            onBedNameChange={(value) => setBedDraft((current) => ({ ...current, name: value }))}
            onBedWidthFtChange={(value) => setBedDraft((current) => ({ ...current, width_ft: value }))}
            onBedLengthFtChange={(value) => setBedDraft((current) => ({ ...current, length_ft: value }))}
            bedErrors={{
              name: showBedValidation ? bedFormErrors.name : "",
              width_ft: showBedValidation ? bedFormErrors.width_ft : "",
              length_ft: showBedValidation ? bedFormErrors.length_ft : "",
            }}
            yardErrors={{
              yard_width_ft: showYardValidation ? yardFormErrors.yard_width_ft : "",
              yard_length_ft: showYardValidation ? yardFormErrors.yard_length_ft : "",
            }}
            filteredCropTemplates={filteredCropTemplates}
            cropSearchActiveIndex={cropSearchActiveIndex}
            selectedCropName={selectedCropName}
            selectedCrop={selectedCrop}
            selectedCropWindow={selectedCropWindow}
            isLoadingPlantingWindows={isLoadingPlantingWindows}
            gardenSunPath={gardenSunPath}
            isLoadingSunPath={isLoadingSunPath}
            gardenOrientation={selectedGardenRecord?.orientation || "south"}
            gardenSatelliteUrl={
              selectedGardenRecord?.latitude && selectedGardenRecord?.longitude
                ? `https://maps.google.com/?q=${selectedGardenRecord.latitude},${selectedGardenRecord.longitude}&z=19&t=k`
                : undefined
            }
            onSelectCrop={selectCrop}
            cropBaseName={cropBaseName}
            placementBedId={placementBedId}
            onPlacementBedIdChange={setPlacementBedId}
            yardGridRef={yardGridRef}
            yardCellPx={YARD_CELL_PX}
            toFeet={toFeet}
            onMoveBedInYard={(bedId, x, y) => {
              moveBedInYard(bedId, x, y).catch(() => undefined);
            }}
            onNudgeBed={nudgeBedByDelta}
            onRotateBed={(bedId, autoFit) => rotateBedInYard(bedId, autoFit)}
            onDeleteBed={(bedId) => {
              deleteBed(bedId).catch(() => undefined);
            }}
            onAddPlacement={(bedId, x, y) => {
              addPlacement(bedId, x, y).catch(() => undefined);
            }}
            onMovePlacement={(placementId, bedId, x, y) => {
              movePlacement(placementId, bedId, x, y).catch(() => undefined);
            }}
            onNudgePlacement={nudgePlacementByDelta}
            onBulkMovePlacements={(placementIds, dx, dy) => {
              movePlacementsByDelta(placementIds, dx, dy).catch(() => undefined);
            }}
            onBulkRemovePlacements={(placementIds) => {
              removePlacementsBulk(placementIds).catch(() => undefined);
            }}
            canUndoPlanner={plannerUndoCount > 0}
            canRedoPlanner={plannerRedoCount > 0}
            onUndoPlanner={() => {
              undoPlannerChange().catch(() => undefined);
            }}
            onRedoPlanner={() => {
              redoPlannerChange().catch(() => undefined);
            }}
            onRequestRemovePlacement={(placementId, cropName) => {
              setConfirmState({
                title: "Remove placement?",
                message: `Remove ${cropName} from this bed?`,
                confirmLabel: "Remove",
                onConfirm: async () => {
                  await removePlacement(placementId);
                },
              });
            }}
            onBlockedPlacementMove={(cropName) => {
              pushNotice(`Too close to another plant for ${cropName}.`, "error");
            }}
            placementSpacingConflict={placementSpacingConflict}
            isCellBlockedForSelectedCrop={isCellBlockedForSelectedCrop}
            isCellInBuffer={isCellInBuffer}
          />
        )}

        {activePage === "seasonal" && selectedGarden && (
          <SeasonalPlanPanel
            selectedGardenName={selectedGardenName}
            plan={seasonalPlan}
            isLoading={isLoadingSeasonalPlan}
            selectedPlantingId={selectedRecommendationPlantingId}
            plantingRecommendation={plantingRecommendation}
            isLoadingPlantingRecommendation={isLoadingPlantingRecommendation}
            onSelectPlanting={(plantingId) => {
              setSelectedRecommendationPlantingId(plantingId);
            }}
            onRefresh={() => {
              refreshSeasonalPlan().catch(() => undefined);
            }}
          />
        )}

        {activePage === "sensors" && selectedGarden && (
          <SensorsPanel
            selectedGardenName={selectedGardenName}
            beds={beds}
            summary={sensorSummary}
            isLoading={isLoadingSensorSummary}
            onRefresh={() => {
              if (selectedGardenRecord) {
                sensorSummaryCacheRef.current.delete(selectedGardenRecord.id);
                loadSensorSummaryForGarden(selectedGardenRecord, true).catch(() => undefined);
              }
            }}
            onRegisterSensor={async (payload) => {
              try {
                await registerSensor(payload);
              } catch (err: any) {
                pushNotice(err?.message || "Unable to register sensor.", "error");
              }
            }}
            onIngestReading={async (sensorId, value) => {
              try {
                await ingestSensorData(sensorId, value);
              } catch (err: any) {
                pushNotice(err?.message || "Unable to ingest sensor reading.", "error");
              }
            }}
          />
        )}

        {activePage === "coach" && selectedGarden && (
          <CoachPanel
            selectedGardenName={selectedGardenName}
            messages={coachMessages}
            isLoading={isLoadingCoach}
            draftMessage={coachDraftMessage}
            onDraftMessageChange={setCoachDraftMessage}
            scenario={coachScenario}
            onScenarioChange={setCoachScenario}
            latestResponse={coachLatestResponse}
            onAskCoach={async (message, scenario) => {
              try {
                await askCoach(message, scenario);
              } catch (err: any) {
                pushNotice(err?.message || "Unable to get coach response.", "error");
              }
            }}
          />
        )}

        {activePage === "crops" && (
          <CropsPanel
            cropTemplates={cropTemplates}
            isRefreshingLibrary={isRefreshingCropLibrary}
            isCleaningLegacyLibrary={isCleaningLegacyCropLibrary}
            syncStatus={cropTemplateSyncStatus}
            onRefreshLibrary={() => {
              refreshCropTemplateDatabase().catch(() => undefined);
            }}
            onCleanupLegacyLibrary={requestLegacyCropCleanup}
            editingCropId={editingCropId}
            newCropName={newCropName}
            onNewCropNameChange={setNewCropName}
            newCropVariety={newCropVariety}
            onNewCropVarietyChange={setNewCropVariety}
            newCropFamily={newCropFamily}
            onNewCropFamilyChange={setNewCropFamily}
            newCropSpacing={newCropSpacing}
            onNewCropSpacingChange={setNewCropSpacing}
            newCropDays={newCropDays}
            onNewCropDaysChange={setNewCropDays}
            newCropPlantingWindow={newCropPlantingWindow}
            onNewCropPlantingWindowChange={setNewCropPlantingWindow}
            newCropDirectSow={newCropDirectSow}
            onNewCropDirectSowChange={setNewCropDirectSow}
            newCropFrostHardy={newCropFrostHardy}
            onNewCropFrostHardyChange={setNewCropFrostHardy}
            newCropWeeksToTransplant={newCropWeeksToTransplant}
            onNewCropWeeksToTransplantChange={setNewCropWeeksToTransplant}
            newCropNotes={newCropNotes}
            onNewCropNotesChange={setNewCropNotes}
            newCropImageUrl={newCropImageUrl}
            onNewCropImageUrlChange={setNewCropImageUrl}
            cropErrors={{
              name: showCropValidation ? cropFormErrors.name : "",
              spacing: showCropValidation ? cropFormErrors.spacing : "",
              days: showCropValidation ? cropFormErrors.days : "",
              planting_window: showCropValidation ? cropFormErrors.planting_window : "",
              weeks_to_transplant: showCropValidation ? cropFormErrors.weeks_to_transplant : "",
            }}
            onUpsertCropTemplate={upsertCropTemplate}
            onResetCropForm={resetCropForm}
            onPopulateCropForm={populateCropForm}
            cropBaseName={cropBaseName}
          />
        )}

        {activePage === "pests" && selectedGarden && (
          <PestLogPanel
            pestLogs={pestLogs}
            isLoading={isLoadingPestLogs}
            onCreatePestLog={createPestLog}
            onDeletePestLog={(id) => deletePestLog(id).catch(() => undefined)}
            selectedDate={selectedDate}
          />
        )}
      </div>

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title || "Confirm action"}
        message={confirmState?.message || "Are you sure?"}
        confirmLabel={isConfirmingAction ? "Working..." : confirmState?.confirmLabel || "Confirm"}
        onConfirm={() => {
          if (!isConfirmingAction) {
            runConfirmedAction();
          }
        }}
        onCancel={() => {
          if (!isConfirmingAction) {
            setConfirmState(null);
          }
        }}
      />

      {isHelpOpen && (
        <div className="confirm-overlay" role="presentation">
          <section className="help-dialog card" role="dialog" aria-modal="true" aria-labelledby="help-title" aria-describedby="help-body">
            <h3 id="help-title">Keyboard Controls</h3>
            <div id="help-body" className="stack compact">
              <p><strong>Navigation:</strong> use the nav bar at the top to switch pages.</p>
              <p><strong>Crop search:</strong> use Up/Down to pick results, Enter to select, Escape to restore the selected crop.</p>
              <p><strong>Bed Planner:</strong> focus a bed in Yard Layout and use Arrow keys to nudge it.</p>
              <p><strong>Placements:</strong> focus a placement chip and use Arrow keys to move one square. Press Enter to remove.</p>
            </div>
            <div className="panel-actions">
              <button type="button" className="secondary-btn" onClick={() => closeHelpModal(false)}>Close</button>
              <button type="button" onClick={() => closeHelpModal(true)}>Got it</button>
            </div>
          </section>
        </div>
      )}

      <ToastRegion
        notices={notices}
        onDismiss={dismissNotice}
        onAction={(id) => {
          const selectedNotice = notices.find((notice) => notice.id === id);
          if (selectedNotice?.onAction) {
            selectedNotice.onAction();
          }
          dismissNotice(id);
        }}
      />
    </main>
  );
}

export default App;
