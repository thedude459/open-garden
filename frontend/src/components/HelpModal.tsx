type HelpModalProps = {
  isOpen: boolean;
  onClose: (remember: boolean) => void;
};

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null;
  return (
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
          <button type="button" className="secondary-btn" onClick={() => onClose(false)}>Close</button>
          <button type="button" onClick={() => onClose(true)}>Got it</button>
        </div>
      </section>
    </div>
  );
}
