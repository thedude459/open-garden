type GardenRequiredNoticeProps = {
  onGoHome: () => void;
};

export function GardenRequiredNotice({ onGoHome }: GardenRequiredNoticeProps) {
  return (
    <article className="card page-empty-state">
      <h2>Select or Create a Garden</h2>
      <p className="subhead">Timeline, Calendar, Seasonal Plan, Bed Planner, AI Coach, Sensors, and Pest Log need an active garden. Choose one from My Gardens first.</p>
      <div className="panel-actions">
        <button type="button" onClick={onGoHome}>Go to My Gardens</button>
      </div>
    </article>
  );
}
