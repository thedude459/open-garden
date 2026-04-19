import { useMemo, useState } from "react";
import {
  CalendarDays,
  CloudSun,
  LayoutGrid,
  Leaf,
  ListChecks,
  Ruler,
  Shovel,
  Sprout,
} from "lucide-react";
import { AppPage } from "../app/types";
import { ClimatePlantingWindow, Garden, GardenClimate, Task } from "../types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type WeatherDay = { date: string; low: number; high: number; rain: number };

type HomeHeroProps = {
  garden: Garden;
  beds: { id: number }[];
  placements: { id: number }[];
  tasks: Task[];
  cropTemplateCount: number;
  gardenClimate: GardenClimate | null;
  homeTaskPreview: Task[];
  overdueTaskCount: number;
  upcomingTaskCount: number;
  weatherPreview: WeatherDay[];
  isLoadingWeather: boolean;
  actionablePlantingWindows: ClimatePlantingWindow[];
  weatherRiskCues: string[];
  onNavigate: (page: AppPage) => void;
};

const PREVIEW_LIMIT = 3;

function startOfDayLocal(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayDiff(dateText: string, today = new Date()): number | null {
  const parsed = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const diffMs = startOfDayLocal(parsed).getTime() - startOfDayLocal(today).getTime();
  return Math.round(diffMs / 86400000);
}

function formatRelativeDay(dateText: string, today = new Date()): string {
  const diffDays = dayDiff(dateText, today);
  if (diffDays === null) return dateText;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
  return dateText;
}

function formatWindowRange(start: string, end: string): string {
  return `${formatRelativeDay(start)} to ${formatRelativeDay(end)}`;
}

type ProtectCue = {
  id: string;
  title: string;
  detail: string;
  why: string;
  confidence: "high" | "medium";
  source: "planting" | "protection";
  urgency: "now" | "soon" | "plan";
  actionLabel: string;
  actionPage: AppPage;
};

function getUrgencyLabel(urgency: ProtectCue["urgency"]): string {
  if (urgency === "now") return "Act now";
  if (urgency === "soon") return "Watch soon";
  return "Plan ahead";
}

function getUrgencyBadgeVariant(urgency: ProtectCue["urgency"]): "default" | "secondary" | "destructive" | "outline" {
  if (urgency === "now") return "destructive";
  if (urgency === "soon") return "default";
  return "secondary";
}

function getPlantingCueAction(status: ClimatePlantingWindow["status"]): Pick<ProtectCue, "actionLabel" | "actionPage"> {
  if (status === "open" || status === "closing") {
    return {
      actionLabel: "Schedule planting",
      actionPage: "calendar",
    };
  }
  if (status === "watch" || status === "upcoming") {
    return {
      actionLabel: "Review in planner",
      actionPage: "planner",
    };
  }
  return {
    actionLabel: "Review in crops",
    actionPage: "crops",
  };
}

function getPlantingCueUrgency(status: ClimatePlantingWindow["status"]): ProtectCue["urgency"] {
  if (status === "open" || status === "closing") return "now";
  if (status === "watch" || status === "upcoming") return "soon";
  return "plan";
}

type StatTileProps = {
  label: string;
  value: number;
  page: AppPage;
  onNavigate: (page: AppPage) => void;
  ariaLabel: string;
  Icon: typeof Sprout;
};

function StatTile({ label, value, page, onNavigate, ariaLabel, Icon }: StatTileProps) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(page)}
      aria-label={ariaLabel}
      className="home-stat relative"
    >
      <Icon className="home-stat__icon" aria-hidden />
      <div className="home-stat__value">{value}</div>
      <div className="home-stat__label">{label}</div>
    </button>
  );
}

type TaskRowProps = {
  task: Task;
  today: Date;
};

function TaskRow({ task, today }: TaskRowProps) {
  const diff = dayDiff(task.due_on, today);
  const isOverdue = diff !== null && diff < 0;
  const relative = formatRelativeDay(task.due_on, today);
  return (
    <li className="pb-3 border-b last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold">{task.title}</div>
        {isOverdue ? (
          <Badge variant="destructive" className="text-xs whitespace-nowrap">Overdue</Badge>
        ) : (
          <span className="text-xs text-muted-foreground whitespace-nowrap">{relative}</span>
        )}
      </div>
      {task.notes && <div className="text-sm text-muted-foreground mt-1">{task.notes}</div>}
    </li>
  );
}

export function HomeHero({
  garden,
  beds,
  placements,
  tasks,
  cropTemplateCount,
  gardenClimate,
  homeTaskPreview,
  overdueTaskCount,
  upcomingTaskCount,
  weatherPreview,
  isLoadingWeather,
  actionablePlantingWindows,
  weatherRiskCues,
  onNavigate,
}: HomeHeroProps) {
  const [showAllWeather, setShowAllWeather] = useState(false);
  const [showAllProtect, setShowAllProtect] = useState(false);
  const today = useMemo(() => new Date(), []);

  const visibleWeatherPreview = showAllWeather
    ? weatherPreview
    : weatherPreview.slice(0, PREVIEW_LIMIT);

  const protectCues = useMemo<ProtectCue[]>(() => {
    const plantingCues = actionablePlantingWindows.map((window) => {
      const confidence: ProtectCue["confidence"] =
        window.status === "open" || window.status === "closing" ? "high" : "medium";
      const cueAction = getPlantingCueAction(window.status);
      const urgency = getPlantingCueUrgency(window.status);
      return {
        id: `window-${window.crop_template_id}-${window.window_start}-${window.status}`,
        title: window.crop_name,
        detail: `${window.status}: ${formatWindowRange(window.window_start, window.window_end)}`,
        why: window.reason || "Window timing is based on local temperature and soil conditions.",
        confidence,
        source: "planting" as const,
        urgency,
        actionLabel: cueAction.actionLabel,
        actionPage: cueAction.actionPage,
      };
    });

    const riskCues = weatherRiskCues.map((cue, index) => {
      const actionPage: AppPage = "calendar";
      return {
        id: `risk-${index}`,
        title: "Protection cue",
        detail: cue,
        why: "Generated from your short-range forecast and climate profile.",
        confidence: "medium" as const,
        source: "protection" as const,
        urgency: "soon" as const,
        actionLabel: "Plan protection task",
        actionPage,
      };
    });

    return [...plantingCues, ...riskCues];
  }, [actionablePlantingWindows, weatherRiskCues]);

  const visibleProtectCues = showAllProtect
    ? protectCues
    : protectCues.slice(0, PREVIEW_LIMIT);

  const hasTasksToShow = homeTaskPreview.length > 0;
  const promoteTodos = hasTasksToShow || overdueTaskCount > 0;

  const todosCard = (
    <Card className="home-hero-card home-hero-card--tasks">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <ListChecks size={18} className="text-[color:var(--accent-2)]" aria-hidden />
            This week's to-dos
          </CardTitle>
          <Badge variant={overdueTaskCount > 0 ? "destructive" : "default"}>
            {overdueTaskCount > 0 ? `${overdueTaskCount} overdue` : `${upcomingTaskCount} open`}
          </Badge>
        </div>
        <CardDescription>Tasks auto-generated from your plantings and seasonal plan</CardDescription>
      </CardHeader>
      <CardContent>
        {hasTasksToShow ? (
          <>
            <ul className="space-y-3">
              {homeTaskPreview.map((task) => (
                <TaskRow key={task.id} task={task} today={today} />
              ))}
            </ul>
            <div className="mt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onNavigate("calendar")}
                aria-label="See all tasks in calendar"
              >
                See all in calendar →
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No open tasks yet. Schedule a planting in the calendar and tasks will appear here automatically.
          </p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Garden header with goal-first primary action and quick jumps */}
      <Card className="card--raised">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-1 inline-flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm"
                style={{
                  background: "linear-gradient(135deg, var(--accent), var(--accent-dark))",
                }}
              >
                <Leaf size={22} strokeWidth={2.25} />
              </span>
              <div>
                <CardTitle
                  className="text-3xl md:text-4xl mb-1"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {garden.name}
                </CardTitle>
                <CardDescription className="text-base flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1">
                    <CloudSun size={14} className="opacity-80" aria-hidden />
                    Zone {garden.growing_zone}
                  </span>
                  <span className="text-muted-foreground/60">·</span>
                  <span>{garden.zip_code}</span>
                  <span className="text-muted-foreground/60">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Ruler size={14} className="opacity-80" aria-hidden />
                    {garden.yard_width_ft} × {garden.yard_length_ft} ft
                  </span>
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onNavigate("calendar")} variant="default">
                This week's to-dos
              </Button>
              <Button onClick={() => onNavigate("planner")} variant="outline">
                Design my beds
              </Button>
              <Button onClick={() => onNavigate("crops")} variant="outline">
                Browse crops
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Clickable stat tiles — each jumps to where that number lives */}
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile
              label="Beds"
              value={beds.length}
              page="planner"
              onNavigate={onNavigate}
              ariaLabel={`${beds.length} beds, open bed planner`}
              Icon={Shovel}
            />
            <StatTile
              label="Plantings"
              value={placements.length}
              page="planner"
              onNavigate={onNavigate}
              ariaLabel={`${placements.length} plantings, open bed planner`}
              Icon={LayoutGrid}
            />
            <StatTile
              label="Tasks"
              value={tasks.length}
              page="calendar"
              onNavigate={onNavigate}
              ariaLabel={`${tasks.length} tasks, open calendar`}
              Icon={CalendarDays}
            />
            <StatTile
              label="Crops"
              value={cropTemplateCount}
              page="crops"
              onNavigate={onNavigate}
              ariaLabel={`${cropTemplateCount} crops in library, browse crops`}
              Icon={Sprout}
            />
          </div>
        </CardContent>
      </Card>

      {/* When the user has urgent work, promote To-Dos to a full-width hero row */}
      {promoteTodos && todosCard}

      {/* Dashboard row: include To-Dos only when not already promoted */}
      <div
        className={
          promoteTodos
            ? "grid grid-cols-1 md:grid-cols-2 gap-6"
            : "grid grid-cols-1 md:grid-cols-3 gap-6"
        }
      >
        {!promoteTodos && todosCard}

        {/* Weather Snapshot */}
        <Card className="home-hero-card home-hero-card--weather">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CloudSun size={18} className="text-[color:var(--accent-3)]" aria-hidden />
                Weather
              </CardTitle>
              {gardenClimate && <Badge variant="outline">{gardenClimate.microclimate_band}</Badge>}
            </div>
            <CardDescription>Confidence improves as local forecast + microclimate signals stay in sync</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingWeather ? (
              <div className="space-y-2 py-1" aria-busy="true" aria-label="Loading forecast">
                <div className="skeleton-line w-full max-w-[14rem]" />
                <div className="skeleton-line w-full max-w-[11rem]" />
                <div className="skeleton-line w-full max-w-[9rem]" />
              </div>
            ) : weatherPreview.length > 0 ? (
              <div className="space-y-3">
                <ul className="space-y-3">
                  {visibleWeatherPreview.map((day) => (
                    <li key={day.date} className="pb-3 border-b last:border-b-0">
                      <div className="font-semibold">{formatRelativeDay(day.date, today)}</div>
                      <div className="text-sm text-muted-foreground">
                        {day.low}° — {day.high}° F · {day.rain} in rain
                      </div>
                      <div className="text-xs text-muted-foreground italic">Based on forecast issued for {day.date}.</div>
                    </li>
                  ))}
                </ul>
                {weatherPreview.length > PREVIEW_LIMIT && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowAllWeather((value) => !value)}
                  >
                    {showAllWeather ? "Show fewer forecast days" : "View all forecast days"}
                  </Button>
                )}
                {gardenClimate && (
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground border-t pt-3">
                    <div>Soil: ~{gardenClimate.soil_temperature_estimate_f}°F</div>
                    <div>Frost risk: {gardenClimate.frost_risk_next_10_days}</div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No weather data loaded yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Plant and Protect cues */}
        <Card className="home-hero-card home-hero-card--cues">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sprout size={18} className="text-[color:var(--accent)]" aria-hidden />
                Plant & Protect
              </CardTitle>
              {protectCues.length > 0 && (
                <Badge variant="default">{protectCues.length} cues</Badge>
              )}
            </div>
            <CardDescription>Climate guidance & planting windows</CardDescription>
          </CardHeader>
          <CardContent>
            {visibleProtectCues.length > 0 ? (
              <div className="space-y-4">
                {visibleProtectCues.map((cue) => (
                  <div key={cue.id} className="pb-4 border-b last:border-b-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={getUrgencyBadgeVariant(cue.urgency)}>
                        {getUrgencyLabel(cue.urgency)}
                      </Badge>
                    <span className="text-xs px-2 py-1 bg-muted rounded" title={cue.source === "planting" ? "Planting cue" : "Protection cue"}>
                        {cue.source === "planting" ? "Planting" : "Protection"}
                      </span>
                    </div>
                    <div className="font-semibold">{cue.title}</div>
                    <div className="text-sm text-muted-foreground">{cue.detail}</div>
                    <div className="text-xs text-muted-foreground italic">Why: {cue.why}</div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {cue.confidence === "high" ? "High confidence" : "Medium confidence"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onNavigate(cue.actionPage)}
                      >
                        {cue.actionLabel}
                      </Button>
                    </div>
                  </div>
                ))}
                {protectCues.length > PREVIEW_LIMIT && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowAllProtect((value) => !value)}
                  >
                    {showAllProtect ? "Show fewer cues" : "View all cues"}
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No urgent planting windows yet. Climate guidance will surface here when conditions shift.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
