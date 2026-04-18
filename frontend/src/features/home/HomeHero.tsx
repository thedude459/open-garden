import { useMemo, useState } from "react";
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

function formatRelativeDay(dateText: string, today = new Date()): string {
  const parsed = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateText;
  const diffMs = startOfDayLocal(parsed).getTime() - startOfDayLocal(today).getTime();
  const diffDays = Math.round(diffMs / 86400000);
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

  return (
    <div className="space-y-6">
      {/* Header with garden info and action buttons */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <CardTitle className="text-4xl font-serif mb-2">{garden.name}</CardTitle>
              <CardDescription className="text-base">
                Zone {garden.growing_zone} · {garden.zip_code} · {garden.yard_width_ft} × {garden.yard_length_ft} ft yard
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onNavigate("calendar")} variant="default">
                Open Calendar
              </Button>
              <Button onClick={() => onNavigate("planner")} variant="default">
                Open Bed Planner
              </Button>
              <Button onClick={() => onNavigate("crops")} variant="secondary">
                Manage Crops
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Garden stats grid */}
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted rounded-md">
              <div className="text-3xl font-bold font-serif text-accent">{beds.length}</div>
              <div className="text-sm text-muted-foreground">Beds</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-md">
              <div className="text-3xl font-bold font-serif text-accent">{placements.length}</div>
              <div className="text-sm text-muted-foreground">Placements</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-md">
              <div className="text-3xl font-bold font-serif text-accent">{tasks.length}</div>
              <div className="text-sm text-muted-foreground">Tasks</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-md">
              <div className="text-3xl font-bold font-serif text-accent">{cropTemplateCount}</div>
              <div className="text-sm text-muted-foreground">Crops</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard grid - three columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Today and Next Up */}
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Today & Next Up</CardTitle>
              <Badge variant={overdueTaskCount > 0 ? "destructive" : "default"}>
                {overdueTaskCount > 0 ? `${overdueTaskCount} overdue` : `${upcomingTaskCount} open`}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {homeTaskPreview.length > 0 ? (
              <ul className="space-y-3">
                {homeTaskPreview.map((task) => (
                  <li key={task.id} className="pb-3 border-b last:border-b-0">
                    <div className="font-semibold">{task.title}</div>
                    <div className="text-sm text-muted-foreground">{task.due_on}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No open tasks. Use the calendar to add plantings or tasks for this garden.</p>
            )}
          </CardContent>
        </Card>

        {/* Weather Snapshot */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Weather</CardTitle>
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
                      <div className="font-semibold">{formatRelativeDay(day.date)}</div>
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
        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Plant & Protect</CardTitle>
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
