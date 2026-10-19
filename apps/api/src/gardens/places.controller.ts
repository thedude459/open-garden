import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import {
  FixturePlaceLookup,
  NominatimPlaceLookup,
  PlaceLookupError,
  type PlaceLookup,
} from '@open-garden/garden-place';
import type { PlaceLookupDto } from '@open-garden/shared-types';
import { placeLookupBodySchema } from '@open-garden/shared-types';
import { domainError } from '@open-garden/gardens';
import { SessionGuard } from '../auth/session.guard';

@Controller('places')
@UseGuards(SessionGuard)
export class PlacesController {
  private readonly lookup: PlaceLookup;

  constructor() {
    this.lookup =
      process.env['PLACE_PROVIDER'] === 'live'
        ? new NominatimPlaceLookup()
        : new FixturePlaceLookup();
  }

  @Post('lookup')
  @HttpCode(200)
  async lookupPlace(@Body() body: unknown): Promise<PlaceLookupDto> {
    const query =
      body !== null && typeof body === 'object' && 'query' in body
        ? (body as { query: unknown }).query
        : undefined;
    if (typeof query !== 'string' || query.trim() === '') {
      throw domainError('VALIDATION_ERROR', 'A garden address is required');
    }
    const parsed = placeLookupBodySchema.safeParse(body);
    if (!parsed.success) {
      throw domainError('VALIDATION_ERROR', 'Type a street address. A city, region, or country is not a garden site.');
    }
    try {
      return await this.lookup.lookup(parsed.data.query);
    } catch (err) {
      if (err instanceof PlaceLookupError) throw err;
      throw err;
    }
  }
}
