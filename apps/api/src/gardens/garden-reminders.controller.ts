import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '@open-garden/auth';
import { CareReminderService, domainError } from '@open-garden/care-reminders';
import {
  CareEventRepository,
  GardenMembershipRepository,
  PlantingRepository,
  type AppDatabase,
} from '@open-garden/plant-catalog-data';
import {
  asOfQuerySchema,
  reminderMutationSchema,
} from '@open-garden/shared-types';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import { DATABASE } from '../database/database.tokens';
import { GardenMembershipGuard } from './garden-membership.guard';

@Controller('gardens/:id/reminders')
@UseGuards(SessionGuard, GardenMembershipGuard)
export class GardenRemindersController {
  private readonly reminders: CareReminderService;

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    const memberships = new GardenMembershipRepository(bundle.db);
    const plantings = new PlantingRepository(bundle.db);
    const events = new CareEventRepository(bundle.db);
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
  list(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('asOf') asOf: string) {
    const parsed = asOfQuerySchema.safeParse({ asOf });
    if (!parsed.success) {
      throw domainError('VALIDATION_ERROR', 'Date must be YYYY-MM-DD');
    }
    return this.reminders.list(id, user.id, parsed.data.asOf);
  }

  @Post('complete')
  @HttpCode(204)
  async complete(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const parsed = reminderMutationSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      if (issue?.path[0] === 'kind') {
        throw domainError('VALIDATION_ERROR', 'Care kind is required');
      }
      throw domainError('VALIDATION_ERROR', 'Date must be YYYY-MM-DD');
    }
    await this.reminders.complete(
      id,
      user.id,
      parsed.data.plantingId,
      parsed.data.kind,
      parsed.data.dueOn,
    );
  }

  @Post('dismiss')
  @HttpCode(204)
  async dismiss(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const parsed = reminderMutationSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      if (issue?.path[0] === 'kind') {
        throw domainError('VALIDATION_ERROR', 'Care kind is required');
      }
      throw domainError('VALIDATION_ERROR', 'Date must be YYYY-MM-DD');
    }
    await this.reminders.dismiss(
      id,
      user.id,
      parsed.data.plantingId,
      parsed.data.kind,
      parsed.data.dueOn,
    );
  }
}
