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
import { CareReminderService } from '@open-garden/care-reminders';
import { CalendarService } from '@open-garden/planting-calendar';
import { overlapsThisWeek } from '@open-garden/planting-calendar/this-week';
import {
  CalendarEntryRepository,
  CareEventRepository,
  GardenMembershipRepository,
  GardenRepository,
  PlantingRepository,
  PlantRepository,
  type AppDatabase,
} from '@open-garden/plant-catalog-data';
import type { TodayDto } from '@open-garden/shared-types';
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
  private readonly calendar: CalendarService;
  private readonly reminders: CareReminderService;

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    const climate =
      process.env['PLACE_PROVIDER'] === 'live' ? new LiveClimateLookup() : new FixtureClimateLookup();
    const memberships = new GardenMembershipRepository(bundle.db);
    const plantings = new PlantingRepository(bundle.db);
    const events = new CareEventRepository(bundle.db);
    this.gardens = new GardenService(new GardenRepository(bundle.db), memberships, climate);
    this.calendar = new CalendarService(
      new GardenRepository(bundle.db),
      memberships,
      new PlantRepository(bundle.db),
      new CalendarEntryRepository(bundle.db),
    );
    this.reminders = new CareReminderService(
      {
        getMembership: async (gardenId, userId) => {
          const row = await memberships.get(gardenId, userId);
          return row ? { role: row.role } : null;
        },
      },
      plantings,
      {
        listForGarden: (gardenId) => events.listForGarden(gardenId),
        upsert: (plantingId, kind, occurrenceOn, action) =>
          events.upsertEvent(plantingId, kind, occurrenceOn, action),
      },
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

  @Get('today')
  async today(@CurrentUser() user: AuthUser, @Query('asOf') asOfRaw?: string): Promise<TodayDto> {
    const asOf = /^\d{4}-\d{2}-\d{2}$/.test(asOfRaw ?? '')
      ? asOfRaw!
      : new Date().toISOString().slice(0, 10);
    const [year, month, day] = asOf.split('-').map(Number);
    const today = new Date(year!, (month ?? 1) - 1, day ?? 1);
    const page = await this.gardens.list(user.id, 1, 100);
    const tasks: TodayDto['tasks'] = [];
    const gardens: TodayDto['gardens'] = [];
    for (const garden of page.items) {
      let overdue = 0;
      let thisWeek = 0;
      try {
        const reminders = await this.reminders.list(garden.id, user.id, asOf);
        for (const item of reminders.items) {
          if (item.required === false) continue;
          if (item.urgency === 'overdue') overdue += 1;
          if (item.urgency !== 'overdue' && item.urgency !== 'dueToday') continue;
          tasks.push({
            gardenId: garden.id,
            gardenName: garden.name,
            kind: item.urgency,
            title: `${item.commonName} · ${item.kind}`,
            bedName: item.bedName ?? null,
          });
        }
      } catch {
        /* a garden the member can no longer open is skipped */
      }
      try {
        const calendar = await this.calendar.list(user.id, garden.id, 1, 200);
        for (const entry of calendar.entries) {
          if (
            !overlapsThisWeek(
              [entry.windows.outdoorSow, entry.windows.transplant],
              today,
            )
          ) {
            continue;
          }
          thisWeek += 1;
          tasks.push({
            gardenId: garden.id,
            gardenName: garden.name,
            kind: 'thisWeek',
            title: `Start ${entry.commonName}`,
            bedName: null,
          });
        }
      } catch {
        /* calendar windows are optional for the household list */
      }
      gardens.push({ id: garden.id, overdue, thisWeek });
    }
    return { tasks, gardens };
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
