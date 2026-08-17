import { LAYOUT_ERRORS } from './domain-error';
import type { BedOrientation } from '@open-garden/shared-types';

export function isOrientation(value: number): value is BedOrientation {
  return value === 0 || value === 90 || value === 180 || value === 270;
}

export function assertCompleteGeometry(input: {
  originXInches: number;
  originYInches: number;
  lengthInches: number;
  widthInches: number;
  orientation: number;
}): void {
  const { originXInches, originYInches, lengthInches, widthInches, orientation } = input;
  if (
    !Number.isInteger(originXInches) ||
    !Number.isInteger(originYInches) ||
    !Number.isInteger(lengthInches) ||
    !Number.isInteger(widthInches)
  ) {
    throw LAYOUT_ERRORS.geometryRequired();
  }
  if (lengthInches < 1 || widthInches < 1) {
    throw LAYOUT_ERRORS.sizeMin();
  }
  if (!isOrientation(orientation)) {
    throw LAYOUT_ERRORS.rotationInvalid();
  }
}
