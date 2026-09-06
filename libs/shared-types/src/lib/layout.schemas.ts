import { z } from 'zod';

export const bedOrientationSchema = z.union([
  z.literal(0),
  z.literal(90),
  z.literal(180),
  z.literal(270),
]);

const inch = z.number().int();

const areaBody = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, 'Area name is required').max(120, 'Area name must be at most 120 characters'),
  originXInches: inch,
  originYInches: inch,
  lengthInches: inch.min(1, 'Area length and width must be at least 1 inch'),
  widthInches: inch.min(1, 'Area length and width must be at least 1 inch'),
});

export const layoutPutSchema = z.object({
  beds: z.array(
    z.object({
      id: z.uuid(),
      originXInches: inch,
      originYInches: inch,
      lengthInches: inch.min(1, 'Bed length and width must be at least 1 inch'),
      widthInches: inch.min(1, 'Bed length and width must be at least 1 inch'),
      orientation: bedOrientationSchema,
    }),
  ),
  areas: z.array(areaBody).default([]),
  placements: z.array(
    z.object({
      plantingId: z.uuid(),
      bedId: z.uuid(),
      xInches: inch,
      yInches: inch,
    }),
  ),
});

export type LayoutPutParsed = z.infer<typeof layoutPutSchema>;
