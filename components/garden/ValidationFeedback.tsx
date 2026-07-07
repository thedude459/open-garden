"use client";

import { formatViolation, formatWarning } from "@/lib/garden/messages";
import type { ValidationViolation, ValidationWarning } from "@/lib/garden/types";

interface ValidationFeedbackProps {
  violations: ValidationViolation[];
  warnings?: ValidationWarning[];
}

export function ValidationFeedback({ violations, warnings = [] }: ValidationFeedbackProps) {
  if (violations.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <div className="stack">
      {violations.length > 0 ? (
        <div className="card stack validation-feedback" role="alert">
          <h3>Cannot place plant</h3>
          <ul>
            {violations.map((violation, index) => (
              <li key={`${violation.code}-${index}`}>{formatViolation(violation)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <div className="card stack validation-warnings" role="status">
          <h3>Advisory warnings</h3>
          <ul>
            {warnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`}>{formatWarning(warning)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
