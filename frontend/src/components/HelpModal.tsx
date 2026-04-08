import { Button } from "./ui/button";

type HelpModalProps = {
  isOpen: boolean;
  onClose: (remember: boolean) => void;
};

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="presentation">
      <section className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 shadow-lg" role="dialog" aria-modal="true" aria-labelledby="help-title" aria-describedby="help-body">
        <h3 id="help-title" className="font-serif text-lg font-semibold">Keyboard Controls</h3>
        <div id="help-body" className="mt-4 space-y-2 text-sm">
          <p><strong>Navigation:</strong> use the nav bar at the top to switch pages.</p>
          <p><strong>Crop search:</strong> use Up/Down to pick results, Enter to select, Escape to restore the selected crop.</p>
          <p><strong>Bed Planner:</strong> focus a bed in Yard Layout and use Arrow keys to nudge it.</p>
          <p><strong>Placements:</strong> focus a placement chip and use Arrow keys to move one square. Press Enter to remove.</p>
        </div>
        <div className="mt-6 flex flex-row-reverse gap-2">
          <Button onClick={() => onClose(true)}>Got it</Button>
          <Button variant="outline" onClick={() => onClose(false)}>Close</Button>
        </div>
      </section>
    </div>
  );
}
