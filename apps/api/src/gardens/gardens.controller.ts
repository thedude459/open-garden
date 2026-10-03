import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@open-garden/auth';
import { FixtureClimateLookup, LiveClimateLookup } from '@open-garden/garden-place';
import { GardenService, domainError } from '@open-garden/gardens';
import {
  GardenMembershipRepository,
  GardenRepository,
  type AppDatabase,
} from '@open-garden/plant-catalog-data';
import {
  gardenCreateSchema,
  gardenListQuerySchema,
  gardenPatchSchema,
} from '@open-garden/shared-types';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import { DATABASE } from '../database/database.tokens';
import { GardenMembershipGuard } from './garden-membership.guard';

@Controller('gardens')
@UseGuards(SessionGuard)
export class GardensController {
  private readonly logger = new Logger(GardensController.name);
  private readonly gardens: GardenService;

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    const climate =
      process.env['PLACE_PROVIDER'] === 'live' ? new LiveClimateLookup() : new FixtureClimateLookup();
    this.gardens = new GardenService(
      new GardenRepository(bundle.db),
      new GardenMembershipRepository(bundle.db),
      climate,
    );
  }

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ) {
    const parsed = gardenListQuerySchema.safeParse({ page: pageRaw, pageSize: pageSizeRaw });
    if (!parsed.success) {
      throw domainError('VALIDATION_ERROR', 'Invalid list query');
    }
    const started = Date.now();
    const result = await this.gardens.list(user.id, parsed.data.page, parsed.data.pageSize);
    this.logger.log(`garden.list.assembly_ms=${Date.now() - started}`);
    return result;
  }

  @Post()
  @HttpCode(201)
  async create(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const parsed = gardenCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw domainError('VALIDATION_ERROR', gardenIssueMessage(body, parsed.error.issues[0]));
    }
    return this.gardens.create(user.id, parsed.data);
  }

  @Get(':id')
  @UseGuards(GardenMembershipGuard)
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.gardens.get(user.id, id);
  }

  @Patch(':id')
  @UseGuards(GardenMembershipGuard)
  patch(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const parsed = gardenPatchSchema.safeParse(body);
    if (!parsed.success) {
      throw domainError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid garden');
    }
    return this.gardens.patch(user.id, id, parsed.data);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(GardenMembershipGuard)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.gardens.remove(user.id, id);
  }
}

function gardenIssueMessage(
  body: unknown,
  issue: { path: PropertyKey[]; message: string } | undefined,
): string {
  const place =
    body && typeof body === 'object' && 'place' in body ? (body as { place?: unknown }).place : undefined;
  if (issue?.path[0] === 'place' && place == null) return 'A garden address is required';
  return issue?.message ?? 'Invalid garden';
}
