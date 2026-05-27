type OnboardingWizardProps = {
  open: boolean;
  onDismiss: (remember: boolean) => void;
};

export function OnboardingWizard({ open, onDismiss }: OnboardingWizardProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="presentation">
      <section
        className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 shadow-lg space-y-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-wizard-title"
      >
        <h3 id="onboarding-wizard-title" className="font-serif text-xl font-semibold">
          Welcome to open-garden
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Start by naming your garden with its ZIP code — we&apos;ll pin frost timing and forecasts automatically,
          then drop beds onto the planner, schedule plantings on the calendar, and let templates spawn upkeep tasks for you.
        </p>
        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
          <li>Bootstrap layouts faster using Bed Planner&apos;s yard canvas.</li>
          <li>Bookmark any tab once your garden is active — URLs stay stable.</li>
          <li>Use the Observation Journal alongside Pest Log for general scouting notes.</li>
        </ul>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <button type="button" className="secondary-btn w-full sm:w-auto" onClick={() => onDismiss(false)}>
            Hide for now
          </button>
          <button type="button" className="w-full sm:w-auto" onClick={() => onDismiss(true)}>
            Got it
          </button>
        </div>
      </section>
    </div>
  );
}
