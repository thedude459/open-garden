const DENY_PATTERNS = [
  /\burea\b/i,
  /\bammonium nitrate\b/i,
  /\b10-10-10\b/i,
  /\bsynthetic\b/i,
  /\bchemical fertilizer\b/i,
  /\broundup\b/i,
  /\bpesticide\b/i,
];

const ALLOW_PATTERNS = [
  /\bcompost\b/i,
  /\borganic\b/i,
  /\bmanure\b/i,
  /\bfish emulsion\b/i,
  /\bbone meal\b/i,
  /\bblood meal\b/i,
  /\bkelp\b/i,
  /\bworm castings\b/i,
];

export function filterOrganicFertilizer(raw: string | null | undefined): {
  value: string | null;
  dataGap: boolean;
} {
  if (!raw || !raw.trim()) {
    return { value: null, dataGap: true };
  }

  const text = raw.trim();

  if (DENY_PATTERNS.some((pattern) => pattern.test(text))) {
    return { value: null, dataGap: true };
  }

  if (ALLOW_PATTERNS.some((pattern) => pattern.test(text))) {
    return { value: text, dataGap: false };
  }

  // Unknown guidance — store only if no deny signals; flag as gap for review.
  return { value: text, dataGap: true };
}
