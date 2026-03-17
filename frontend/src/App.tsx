import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ToastNotice, ToastRegion } from "./components/ToastRegion";
import { CalendarPanel } from "./features/calendar/CalendarPanel";
import { CropsPanel } from "./features/crops/CropsPanel";
import { PlannerPanel } from "./features/planner/PlannerPanel";
import { WeatherPanel } from "./features/weather/WeatherPanel";
import { PestLogPanel } from "./features/pests/PestLogPanel";
import { Bed, CalendarEvent, CropTemplate, CropTemplateSyncStatus, Garden, PestLog, Placement, Planting, Task } from "./features/types";
import { useDebouncedValue } from "./hooks/useDebouncedValue";

type TokenResponse = { access_token: string; token_type: string };
type AppPage = "home" | "calendar" | "planner" | "crops" | "pests";
type ConfirmState = {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
};

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const palette = ["#ed7b49", "#57a773", "#2f6fba", "#c95f90", "#8979ff", "#1c8c84"];
const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const YARD_CELL_PX = 24;

function isoDate(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedCropName, setSelectedCropName] = useState("");
  const [placementBedId, setPlacementBedId] = useState<number | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [activePage, setActivePage] = useState<AppPage>("home");
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
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [pestLogs, setPestLogs] = useState<PestLog[]>([]);
  const [isLoadingPestLogs, setIsLoadingPestLogs] = useState(false);
  const [isRefreshingCropLibrary, setIsRefreshingCropLibrary] = useState(false);
  const [isCleaningLegacyCropLibrary, setIsCleaningLegacyCropLibrary] = useState(false);
  const [cropTemplateSyncStatus, setCropTemplateSyncStatus] = useState<CropTemplateSyncStatus | null>(null);

  const yardGridRef = useRef<HTMLDivElement>(null);
  const weatherCacheRef = useRef<Map<number, any>>(new Map());
  const authParamsHandledRef = useRef(false);
  const cropSyncWasRunningRef = useRef(false);
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
  }

  function populateCropForm(crop: CropTemplate) {
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
      throw new Error("Session expired. Please sign in again.");
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
    if (mine.length > 0 && !selectedGarden) {
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
    const form = e.currentTarget;
    const fd = new FormData(form);

    try {
      await fetchAuthed("/gardens", {
        method: "POST",
        body: JSON.stringify({
          name: fd.get("name"),
          description: fd.get("description"),
          zip_code: String(fd.get("zip_code") || "").trim(),
          yard_width_ft: Math.max(4, Number(fd.get("yard_width_ft") || 20)),
          yard_length_ft: Math.max(4, Number(fd.get("yard_length_ft") || 20)),
          address_private: fd.get("address_private"),
          is_shared: fd.get("is_shared") === "on",
        }),
      });
      form.reset();
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

    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      const widthFt = Number(fd.get("width_ft"));
      const lengthFt = Number(fd.get("length_ft"));
      await fetchAuthed(`/gardens/${selectedGarden}/beds`, {
        method: "POST",
        body: JSON.stringify({
          name: fd.get("name"),
          width_in: Math.max(12, Math.round(widthFt * 12)),
          height_in: Math.max(12, Math.round(lengthFt * 12)),
          grid_x: 0,
          grid_y: 0,
        }),
      });
      form.reset();
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
      pushNotice(`Planting added: ${cropName}.`, "success");
    } catch (err: any) {
      pushNotice(err?.message || "Unable to create planting.", "error");
    }
  }

  async function upsertCropTemplate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newCropName.trim()) {
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

    try {
      await fetchAuthed(`/gardens/${selectedGarden}/yard`, {
        method: "PATCH",
        body: JSON.stringify({
          yard_width_ft: Math.max(4, Math.round(yardWidthDraft)),
          yard_length_ft: Math.max(4, Math.round(yardLengthDraft)),
        }),
      });
      await loadGardens();
      await loadGardenData();
      pushNotice("Yard size updated.", "success");
    } catch (err: any) {
      pushNotice(err?.message || "Unable to update yard size.", "error");
    }
  }

  async function moveBedInYard(bedId: number, nextX: number, nextY: number) {
    await fetchAuthed(`/beds/${bedId}/position`, {
      method: "PATCH",
      body: JSON.stringify({ grid_x: nextX, grid_y: nextY }),
    });
    await loadGardenData();
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
    if (weatherCacheRef.current.has(garden.id)) {
      setWeather(weatherCacheRef.current.get(garden.id));
      return;
    }

    setIsLoadingWeather(true);
    try {
      const weatherData = await (await fetch(`${API}/weather?latitude=${garden.latitude}&longitude=${garden.longitude}`)).json();
      weatherCacheRef.current.set(garden.id, weatherData);
      setWeather(weatherData);
    } finally {
      setIsLoadingWeather(false);
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

  async function addPlacement(bedId: number, x: number, y: number) {
    if (!selectedGarden || !selectedCropName.trim()) {
      return;
    }

    const spacingIssue = placementSpacingConflict(bedId, x, y, selectedCropName);
    if (spacingIssue) {
      pushNotice(spacingIssue, "error");
      return;
    }

    await fetchAuthed("/placements", {
      method: "POST",
      body: JSON.stringify({
        garden_id: selectedGarden,
        bed_id: bedId,
        crop_name: selectedCropName.trim(),
        grid_x: x,
        grid_y: y,
        planted_on: selectedDate,
        color: colorForCrop(selectedCropName),
      }),
    });
    await loadGardenData();
    pushNotice("Placement added to bed sheet.", "success");
  }

  async function removePlacement(placementId: number) {
    await fetchAuthed(`/placements/${placementId}`, { method: "DELETE" });
    await loadGardenData();
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

    await fetchAuthed(`/placements/${placementId}/move`, {
      method: "PATCH",
      body: JSON.stringify({ bed_id: bedId, grid_x: x, grid_y: y }),
    });
    await loadGardenData();
    pushNotice("Placement moved.", "success");
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

  function placementSpacingConflict(bedId: number, x: number, y: number, cropName: string, ignorePlacementId?: number) {
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
      loadGardens().catch(() => {
        pushNotice("Unable to load your gardens.", "error");
      });
      loadCropTemplates().catch(() => {
        pushNotice("Unable to load crop templates.", "error");
      });
      loadMe().catch(() => {
        pushNotice("Unable to load profile details.", "error");
      });
      loadCropTemplateSyncStatus(false).catch(() => {
        pushNotice("Unable to load crop sync status.", "error");
      });
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
      loadGardenData().catch(() => {
        pushNotice("Unable to refresh garden layout data.", "error");
      });
    }
  }, [token, selectedGarden]);

  useEffect(() => {
    if (token && selectedGarden) {
      loadTasks(selectedGarden, debouncedTaskQuery).catch(() => {
        pushNotice("Unable to load tasks.", "error");
      });
    }
  }, [token, selectedGarden, debouncedTaskQuery]);

  useEffect(() => {
    if (selectedGardenRecord) {
      setYardWidthDraft(selectedGardenRecord.yard_width_ft);
      setYardLengthDraft(selectedGardenRecord.yard_length_ft);
    }
  }, [selectedGardenRecord]);

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
    if (!selectedGarden && (activePage === "calendar" || activePage === "planner" || activePage === "pests")) {
      setActivePage("home");
    }
  }, [selectedGarden, activePage]);

  useEffect(() => {
    if (token && selectedGarden && activePage === "pests") {
      loadPestLogs(selectedGarden).catch(() => {
        pushNotice("Unable to load pest log.", "error");
      });
    }
  }, [token, selectedGarden, activePage]);

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
      <nav className="navbar">
        <div className="navbar-brand">
          <h1>open-garden</h1>
          {selectedGardenRecord && (
            <span className="navbar-garden">{selectedGardenRecord.name} · Zone {selectedGardenRecord.growing_zone}</span>
          )}
        </div>
        <div className="navbar-nav">
          <button className={activePage === "home" ? "nav-btn active" : "nav-btn"} onClick={() => setActivePage("home")}>My Gardens</button>
          {selectedGarden && (
            <>
              <button className={activePage === "calendar" ? "nav-btn active" : "nav-btn"} onClick={() => setActivePage("calendar")}>Calendar</button>
              <button className={activePage === "planner" ? "nav-btn active" : "nav-btn"} onClick={() => setActivePage("planner")}>Bed Planner</button>
            </>
          )}
          <button className={activePage === "crops" ? "nav-btn active" : "nav-btn"} onClick={() => setActivePage("crops")}>Crop Library</button>
          {selectedGarden && (
            <button className={activePage === "pests" ? "nav-btn active" : "nav-btn"} onClick={() => setActivePage("pests")}>Pest Log</button>
          )}
        </div>
        <div className="navbar-actions">
          <button type="button" className="secondary-btn" onClick={() => setIsHelpOpen(true)}>Help</button>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("open-garden-token");
              setToken("");
            }}
          >
            Log out
          </button>
        </div>
      </nav>

      <div className="page-body">
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
        {!selectedGarden && (activePage === "calendar" || activePage === "planner") && (
          <article className="card page-empty-state">
            <h2>Select or Create a Garden</h2>
            <p className="subhead">Calendar, Bed Planner, and Pest Log need an active garden. Choose one from My Gardens first.</p>
            <div className="panel-actions">
              <button type="button" onClick={() => setActivePage("home")}>Go to My Gardens</button>
            </div>
          </article>
        )}

        {activePage === "home" && (
          <div className="home-layout">
            <article className="card">
              <h2>Your Gardens</h2>

              {gardens.length === 0 && (
                <ol className="workflow-guide">
                  <li>Create a garden with your ZIP &amp; yard size below</li>
                  <li>Use <strong>Bed Planner</strong> to add beds and drag them into your yard</li>
                  <li>Use <strong>Calendar</strong> to add plantings — tasks generate automatically</li>
                </ol>
              )}

              <ul>
                {gardens.map((garden) => (
                  <li key={garden.id} className="garden-list-item">
                    <button className={selectedGarden === garden.id ? "active" : ""} onClick={() => setSelectedGarden(garden.id)}>
                      {garden.name} - {garden.zip_code} - Zone {garden.growing_zone} {garden.is_shared ? "(shared)" : "(private)"}
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

              <h3>Create Garden</h3>
              <form onSubmit={createGarden} className="stack">
                <div className="stack compact">
                  <label className="field-label" htmlFor="garden-name">Garden Name</label>
                  <input id="garden-name" name="name" placeholder="Garden name" required />
                </div>
                <div className="stack compact">
                  <label className="field-label" htmlFor="garden-description">Description</label>
                  <input id="garden-description" name="description" placeholder="Description" />
                </div>
                <div className="stack compact">
                  <label className="field-label" htmlFor="garden-zip-code">ZIP Code</label>
                  <input id="garden-zip-code" name="zip_code" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} placeholder="ZIP code (US)" required />
                </div>
                <div className="mini-row">
                  <div className="stack compact">
                    <label className="field-label" htmlFor="garden-yard-width">Yard Width (ft)</label>
                    <input id="garden-yard-width" name="yard_width_ft" type="number" min="4" defaultValue={20} required />
                  </div>
                  <div className="stack compact">
                    <label className="field-label" htmlFor="garden-yard-length">Yard Length (ft)</label>
                    <input id="garden-yard-length" name="yard_length_ft" type="number" min="4" defaultValue={20} required />
                  </div>
                </div>
                <div className="stack compact">
                  <label className="field-label" htmlFor="garden-private-address">Private Address</label>
                  <input id="garden-private-address" name="address_private" placeholder="Private address (never public)" />
                </div>
                <label className="inline">
                  <input type="checkbox" name="is_shared" />
                  Share publicly
                </label>
                <button type="submit">Create garden</button>
              </form>

              <h3>Community Shared Gardens</h3>
              <ul>
                {publicGardens.map((garden) => (
                  <li key={garden.id}>{garden.name}</li>
                ))}
              </ul>
            </article>

            {selectedGarden && selectedGardenRecord && (
              <article className="card home-summary">
                <h2>{selectedGardenRecord.name}</h2>
                <p className="subhead">Zone {selectedGardenRecord.growing_zone} &middot; {selectedGardenRecord.zip_code} &middot; {selectedGardenRecord.yard_width_ft} x {selectedGardenRecord.yard_length_ft} ft yard</p>
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
                <div className="panel-actions">
                  <button type="button" onClick={() => setActivePage("calendar")}>Open Calendar</button>
                  <button type="button" onClick={() => setActivePage("planner")}>Open Bed Planner</button>
                  <button type="button" className="secondary-btn" onClick={() => setActivePage("crops")}>Manage Crops</button>
                </div>
              </article>
            )}
          </div>
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
              onToggleTaskDone={toggleTaskDone}
              onDeleteTask={deleteTask}
              onEditTask={editTask}
              onLogHarvest={logHarvest}
            />
            <WeatherPanel
              weather={weather}
              tasks={tasks}
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
            filteredCropTemplates={filteredCropTemplates}
            cropSearchActiveIndex={cropSearchActiveIndex}
            selectedCropName={selectedCropName}
            selectedCrop={selectedCrop}
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
