import { FormEvent } from "react";
import { NotebookPen, PenSquare } from "lucide-react";
import { SectionHeader } from "@/components/SectionHeader";
import { GardenObservation } from "../types";

type JournalPanelProps = {
  observations: GardenObservation[];
  isLoading: boolean;
  onCreateObservation: (e: FormEvent<HTMLFormElement>) => void;
  onDeleteObservation: (id: number) => void;
  selectedDate: string;
};

export function JournalPanel({
  observations,
  isLoading,
  onCreateObservation,
  onDeleteObservation,
  selectedDate,
}: JournalPanelProps) {
  return (
    <div className="pest-layout">
      <section className="card">
        <SectionHeader
          icon={NotebookPen}
          title="Observation Journal"
          subtitle={`${observations.length} entr${observations.length !== 1 ? "ies" : "y"} for this garden — notes and photos you attach here stay private to your account.`}
        />
        {isLoading && <p className="hint">Loading...</p>}
        {!isLoading && observations.length === 0 && (
          <p className="hint">
            No entries yet. Capture what you see in the beds each week — growth milestones, weather impacts,
            or experiments worth revisiting next season.
          </p>
        )}
        <ul className="pest-log-list">
          {[...observations].sort((a, b) => b.observed_on.localeCompare(a.observed_on)).map((entry) => (
            <li key={entry.id} className="pest-log-item">
              <div className="pest-log-header">
                <strong>{entry.title}</strong>
                <span className="hint">{entry.observed_on}</span>
                <button type="button" className="danger-sm" onClick={() => onDeleteObservation(entry.id)}>
                  Delete
                </button>
              </div>
              {entry.notes && <p className="hint">{entry.notes}</p>}
              {entry.photo_url && (
                <p className="hint">
                  <a href={entry.photo_url} target="_blank" rel="noreferrer">
                    Linked photo
                  </a>
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <form onSubmit={onCreateObservation} className="card stack compact">
        <SectionHeader
          icon={PenSquare}
          title="Add entry"
          subtitle="Optional photo URL can point to any image host you trust."
        />
        <label className="field-label" htmlFor="journal-title">Title</label>
        <input id="journal-title" name="title" placeholder="First tomato flowers" required />
        <label className="field-label" htmlFor="journal-date">Date observed</label>
        <input id="journal-date" name="observed_on" type="date" defaultValue={selectedDate} required />
        <label className="field-label" htmlFor="journal-notes">Notes</label>
        <textarea
          id="journal-notes"
          name="notes"
          className="notes-area"
          placeholder="Soil still damp 2 inches down; skipped watering."
          rows={4}
        />
        <label className="field-label" htmlFor="journal-photo">Photo URL (optional)</label>
        <input id="journal-photo" name="photo_url" type="url" placeholder="https://..." />
        <button type="submit">Save entry</button>
      </form>
    </div>
  );
}
