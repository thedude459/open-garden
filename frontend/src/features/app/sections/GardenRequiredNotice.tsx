type GardenRequiredNoticeProps = {
  onGoHome: () => void;
};

export function GardenRequiredNotice({ onGoHome }: GardenRequiredNoticeProps) {
  return (
    <article className="card page-empty-state">
      <h2>Pick a garden first</h2>
      <p className="subhead">
        This page uses your garden's location, beds, and plantings. Head to My Gardens to pick
        one, or create a new garden in under a minute.
      </p>
      <div className="panel-actions">
        <button type="button" onClick={onGoHome}>Go to My Gardens</button>
      </div>
    </article>
  );
}
