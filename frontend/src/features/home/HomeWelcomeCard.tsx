import { CalendarDays, LayoutGrid, MapPin, Sprout } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type HomeWelcomeCardProps = {
  hasAnyGarden: boolean;
};

type Step = {
  title: string;
  body: string;
  Icon: typeof Sprout;
};

const STEPS: Step[] = [
  {
    title: "Tell us about your yard",
    body: "Your ZIP code gives us your zone, frost dates, and local weather. Yard size lets us plan beds that fit.",
    Icon: MapPin,
  },
  {
    title: "Add beds and lay them out",
    body: "Use the Bed Planner to drop beds into your yard and place crops on a square-foot grid.",
    Icon: LayoutGrid,
  },
  {
    title: "Schedule plantings — we handle the to-dos",
    body: "Pick a crop and date on the Calendar. Sowing, transplanting, and harvest tasks are generated for you.",
    Icon: CalendarDays,
  },
];

export function HomeWelcomeCard({ hasAnyGarden }: HomeWelcomeCardProps) {
  return (
    <Card className="card--raised">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white"
              style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-dark))" }}
            >
              <Sprout size={20} strokeWidth={2.25} />
            </span>
            <CardTitle
              className="text-2xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {hasAnyGarden ? "Pick a garden to get started" : "Welcome to open-garden"}
            </CardTitle>
          </div>
          <Badge variant="outline">3-step setup</Badge>
        </div>
        <CardDescription>
          {hasAnyGarden
            ? "Select a garden from the list on the left to unlock the calendar, bed planner, and weather guidance."
            : "Personalized planting schedule, visual bed layout, and climate-aware to-dos. Start by creating your first garden."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="welcome-steps">
          {STEPS.map((step, index) => {
            const Icon = step.Icon;
            return (
              <li key={step.title} className="welcome-step">
                <span aria-hidden className="welcome-step__num">
                  {index + 1}
                </span>
                <div>
                  <div className="welcome-step__title flex items-center gap-2">
                    <Icon size={16} className="text-[color:var(--accent-dark)]" aria-hidden />
                    {step.title}
                  </div>
                  <div className="welcome-step__body">{step.body}</div>
                </div>
              </li>
            );
          })}
        </ol>
        {!hasAnyGarden && (
          <p className="text-sm text-muted-foreground mt-4 border-t pt-4">
            Use the <strong>Create Garden</strong> form on the left to begin. You can edit any detail later.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
