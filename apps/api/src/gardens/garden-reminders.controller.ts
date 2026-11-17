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
import { PlantingService } from '@open-garden/seasonal-plantings';
import type { AppDatabase } from '@open-garden/plant-catalog-data';
import { asOfQuerySchema, reminderMutationSchema } from '@open-garden/shared-types';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import { DATABASE } from '../database/database.tokens';
import { GardenMembershipGuard } from './garden-membership.guard';
import { openCareReminderService } from './care-reminder-service.factory';
import { openPlantingService } from './planting-service.factory';

@Controller('gardens/:id/reminders')
@UseGuards(SessionGuard, GardenMembershipGuard)
export class GardenRemindersController {
  private readonly reminders: CareReminderService;
  private readonly plantings: PlantingService;

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    this.plantings = openPlantingService(bundle.db);
    this.reminders = openCareReminderService(bundle.db);
  }

  /** Watering follows the property's weather; rain covers a wet due day (ADR 0035). */
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
    if (parsed.data.kind === 'harvest') {
      try {
        await this.plantings.update(user.id, id, parsed.data.plantingId, {
          harvestedOn: parsed.data.dueOn,
        });
      } catch {
        /* the care event still stands when the harvest date cannot be stored */
      }
    }
  }

  @Post('undo')
  @HttpCode(204)
  async undo(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown) {
    const parsed = reminderMutationSchema.safeParse(body);
    if (!parsed.success) {
      throw domainError('VALIDATION_ERROR', 'Date must be YYYY-MM-DD');
    }
    await this.reminders.undo(
      id,
      user.id,
      parsed.data.plantingId,
      parsed.data.kind,
      parsed.data.dueOn,
    );
    if (parsed.data.kind === 'harvest') {
      await this.plantings.update(user.id, id, parsed.data.plantingId, { harvestedOn: null });
    }
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
