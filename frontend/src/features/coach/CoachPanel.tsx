import { FormEvent } from "react";
import { Bot, MessageCircle, Target, Lightbulb, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/SectionHeader";
import { AiCoachResponse, AiCoachScenario, CoachMessage } from "../types";

type CoachPanelProps = {
  selectedGardenName?: string;
  messages: CoachMessage[];
  isLoading: boolean;
  draftMessage: string;
  onDraftMessageChange: (value: string) => void;
  scenario: AiCoachScenario;
  onScenarioChange: (scenario: AiCoachScenario) => void;
  latestResponse: AiCoachResponse | null;
  onAskCoach: (message: string, scenario: AiCoachScenario) => Promise<void>;
};

export function CoachPanel({
  selectedGardenName,
  messages,
  isLoading,
  draftMessage,
  onDraftMessageChange,
  scenario,
  onScenarioChange,
  latestResponse,
  onAskCoach,
}: CoachPanelProps) {
  async function submitChat(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draftMessage.trim()) {
      return;
    }
    await onAskCoach(draftMessage.trim(), scenario);
  }

  async function runScenarioPlan() {
    await onAskCoach("Run scenario planning for this garden.", scenario);
  }

  return (
    <article className="card">
      <SectionHeader
        icon={Bot}
        title={`AI Garden Coach ${selectedGardenName ? `- ${selectedGardenName}` : ""}`}
        subtitle="Context-aware coaching using your garden state, weather, tasks, plantings, and sensor telemetry."
      />

      <div className="flex flex-col lg:flex-row gap-4 mt-4">
        <section className="card flex-1">
          <SectionHeader variant="section" headingLevel="h3" icon={MessageCircle} title="Chat" />
          <div className="h-64 overflow-y-auto space-y-3 p-3 bg-muted rounded-md mb-3" role="log" aria-live="polite">
            {messages.length === 0 && <p className="hint">Ask about watering, task prioritization, planting timing, or what to do this week.</p>}
            {messages.map((message) => (
              <article key={message.id} className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}>
                <strong className="text-xs text-muted-foreground mb-0.5">{message.role === "user" ? "You" : "Coach"}</strong>
                <p className={`rounded-md px-3 py-2 text-sm ${message.role === "user" ? "bg-accent/10" : "bg-background border border-border"} max-w-[90%]`}>{message.content}</p>
              </article>
            ))}
            {isLoading && <p className="hint">Coach is thinking...</p>}
          </div>
          <form className="flex gap-2 mt-3" onSubmit={submitChat}>
            <input
              value={draftMessage}
              onChange={(event) => onDraftMessageChange(event.target.value)}
              placeholder="What should I focus on this week?"
            />
            <button type="submit" disabled={isLoading}>Send</button>
          </form>
        </section>

        <section className="card flex-1">
          <SectionHeader variant="section" headingLevel="h3" icon={Target} title="Scenario Planning Tools" />
          <div className="stack compact">
            <label className="field-label" htmlFor="coach-days-ahead">Planning horizon (days)</label>
            <input
              id="coach-days-ahead"
              type="number"
              min={1}
              max={30}
              value={scenario.days_ahead}
              onChange={(event) => onScenarioChange({ ...scenario, days_ahead: Math.max(1, Number(event.target.value) || 1) })}
            />

            <label className="field-label" htmlFor="coach-rain-outlook">Rain outlook</label>
            <select
              id="coach-rain-outlook"
              value={scenario.rain_outlook}
              onChange={(event) => onScenarioChange({ ...scenario, rain_outlook: event.target.value as AiCoachScenario["rain_outlook"] })}
            >
              <option value="dry">Dry</option>
              <option value="normal">Normal</option>
              <option value="wet">Wet</option>
            </select>

            <label className="field-label" htmlFor="coach-labor-hours">Available labor hours/day</label>
            <input
              id="coach-labor-hours"
              type="number"
              min={0.5}
              step={0.5}
              max={16}
              value={scenario.labor_hours}
              onChange={(event) => onScenarioChange({ ...scenario, labor_hours: Math.max(0.5, Number(event.target.value) || 0.5) })}
            />

            <label className="field-label" htmlFor="coach-water-budget">Water budget</label>
            <select
              id="coach-water-budget"
              value={scenario.water_budget}
              onChange={(event) => onScenarioChange({ ...scenario, water_budget: event.target.value as AiCoachScenario["water_budget"] })}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>
          <button type="button" className="secondary-btn" onClick={runScenarioPlan} disabled={isLoading}>Run Scenario Plan</button>
        </section>
      </div>

      <section className="card mt-4">
        <SectionHeader variant="section" headingLevel="h3" icon={Lightbulb} title="Suggested Actions" />
        <ul className="space-y-3">
          {(latestResponse?.suggested_actions || []).map((action, index) => (
            <li key={`${action.title}-${index}`} className="py-3 border-b last:border-b-0">
              <div className="crop-card-row">
                <strong>{action.title}</strong>
                <Badge variant="outline">{action.priority}</Badge>
              </div>
              <p className="hint">{action.detail}</p>
            </li>
          ))}
          {(!latestResponse || latestResponse.suggested_actions.length === 0) && <li className="hint">No suggested actions yet. Ask the coach a question.</li>}
        </ul>
      </section>

      <section className="card mt-4">
        <SectionHeader variant="section" headingLevel="h3" icon={GitBranch} title="Scenario Outcomes" />
        <ul className="space-y-3">
          {(latestResponse?.scenario_outcomes || []).map((outcome, index) => (
            <li key={`${outcome.title}-${index}`} className="py-3 border-b last:border-b-0">
              <strong>{outcome.title}</strong>
              <p className="hint">{outcome.detail}</p>
            </li>
          ))}
          {(!latestResponse || latestResponse.scenario_outcomes.length === 0) && <li className="hint">Run scenario planning to compare strategies.</li>}
        </ul>
      </section>
    </article>
  );
}
