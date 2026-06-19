import type { GardenDetail } from "./types";

export class ConflictError extends Error {
  readonly name = "ConflictError";

  constructor(public readonly current: GardenDetail) {
    super("Garden version conflict");
  }
}

export function checkVersion(expected: number | undefined, current: number): void {
  if (expected == null) {
    return;
  }
  if (expected !== current) {
    throw new Error(`Version mismatch: expected ${expected}, current ${current}`);
  }
}

export function bumpVersion(current: number): number {
  return current + 1;
}
