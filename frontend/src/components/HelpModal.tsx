import { Button } from "./ui/button";

type HelpModalProps = {
  isOpen: boolean;
  onClose: (remember: boolean) => void;
};

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
      <section
        className="w-full max-w-lg rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 shadow-lg max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        aria-describedby="help-body"
      >
        <h3 id="help-title" className="font-serif text-xl font-semibold">How open-garden works</h3>
        <div id="help-body" className="mt-4 space-y-4 text-sm">
          <section>
            <h4 className="font-semibold mb-1">The 3-step flow</h4>
            <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
              <li><strong>Create a garden</strong> with your ZIP code — this sets your zone, frost dates, and microclimate.</li>
              <li><strong>Lay out beds</strong> in the Bed Planner, then drop crops onto the square-foot grid.</li>
              <li><strong>Schedule plantings</strong> on the Calendar. Sowing, transplanting, and harvest tasks appear automatically.</li>
            </ol>
          </section>

          <section>
            <h4 className="font-semibold mb-1">Pages at a glance</h4>
            <ul className="space-y-1 text-muted-foreground">
              <li><strong>My Gardens</strong> — create and pick your active garden; review to-dos, weather, and planting cues.</li>
              <li><strong>Calendar</strong> — month view with your tasks, plantings, and harvests.</li>
              <li><strong>Seasonal Plan</strong> — a generated plan tuned to your zone and site.</li>
              <li><strong>Bed Planner</strong> — design beds and place crops visually.</li>
              <li><strong>Crops</strong> — browse the crop library and tune custom spacing / dates.</li>
              <li><strong>More</strong> — Timeline, AI Coach, Sensors, Pest Log.</li>
            </ul>
          </section>

          <details className="group">
            <summary className="cursor-pointer font-semibold">Keyboard shortcuts</summary>
            <div className="mt-2 space-y-1 text-muted-foreground pl-1">
              <p><strong>Crop search:</strong> Up/Down to pick, Enter to select, Escape to restore the selected crop.</p>
              <p><strong>Bed Planner:</strong> focus a bed in Yard Layout and use Arrow keys to nudge it.</p>
              <p><strong>Placements:</strong> focus a placement chip and use Arrow keys to move one square. Enter removes it.</p>
            </div>
          </details>
        </div>
        <div className="mt-6 flex flex-row-reverse gap-2">
          <Button onClick={() => onClose(true)}>Got it</Button>
          <Button variant="outline" onClick={() => onClose(false)}>Close</Button>
        </div>
      </section>
    </div>
  );
}
