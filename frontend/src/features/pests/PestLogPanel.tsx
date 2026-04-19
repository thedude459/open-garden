import { FormEvent } from "react";
import { Bug, PenSquare } from "lucide-react";
import { SectionHeader } from "@/components/SectionHeader";
import { PestLog } from "../types";

type PestLogPanelProps = {
  pestLogs: PestLog[];
  isLoading: boolean;
  onCreatePestLog: (e: FormEvent<HTMLFormElement>) => void;
  onDeletePestLog: (id: number) => void;
  selectedDate: string;
};

export function PestLogPanel({
  pestLogs,
  isLoading,
  onCreatePestLog,
  onDeletePestLog,
  selectedDate,
}: PestLogPanelProps) {
  return (
    <div className="pest-layout">
      <section className="card">
        <SectionHeader
          icon={Bug}
          title="Pest & Disease Log"
          subtitle={`${pestLogs.length} observation${pestLogs.length !== 1 ? "s" : ""} recorded for this garden.`}
        />
        {isLoading && <p className="hint">Loading...</p>}
        {!isLoading && pestLogs.length === 0 && (
          <p className="hint">No pest or disease observations yet. Use the form to record your first.</p>
        )}
        <ul className="pest-log-list">
          {[...pestLogs].sort((a, b) => b.observed_on.localeCompare(a.observed_on)).map((log) => (
            <li key={log.id} className="pest-log-item">
              <div className="pest-log-header">
                <strong>{log.title}</strong>
                <span className="hint">{log.observed_on}</span>
                <button
                  type="button"
                  className="danger-sm"
                  onClick={() => onDeletePestLog(log.id)}
                >
                  Delete
                </button>
              </div>
              {log.treatment && <p className="hint">{log.treatment}</p>}
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={onCreatePestLog} className="card stack compact">
        <SectionHeader
          icon={PenSquare}
          title="Record Observation"
          subtitle="Track pests, diseases, and what you tried to control them."
        />
        <label className="field-label" htmlFor="pest-title">What did you observe?</label>
        <input id="pest-title" name="title" placeholder="Aphids on tomato leaves" required />
        <label className="field-label" htmlFor="pest-date">Date observed</label>
        <input id="pest-date" name="observed_on" type="date" defaultValue={selectedDate} required />
        <label className="field-label" htmlFor="pest-treatment">Treatment / action taken</label>
        <textarea
          id="pest-treatment"
          name="treatment"
          className="notes-area"
          placeholder="Sprayed with diluted neem oil..."
          rows={3}
        />
        <button type="submit">Log observation</button>
      </form>
    </div>
  );
}
