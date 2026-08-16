import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { AuthUser } from '@open-garden/auth';
import { CalendarService, domainError } from '@open-garden/planting-calendar';
import {
  CalendarEntryRepository,
  GardenMembershipRepository,
  GardenRepository,
  PlantRepository,
  type AppDatabase,
} from '@open-garden/plant-catalog-data';
import { calendarAddSchema, calendarListQuerySchema } from '@open-garden/shared-types';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import { DATABASE } from '../database/database.tokens';
import { GardenMembershipGuard } from './garden-membership.guard';

@Controller('gardens/:id/calendar')
@UseGuards(SessionGuard, GardenMembershipGuard)
export class GardenCalendarController {
  private readonly calendar: CalendarService;

  constructor(@Inject(DATABASE) bundle: { db: AppDatabase }) {
    this.calendar = new CalendarService(
      new GardenRepository(bundle.db),
      new GardenMembershipRepository(bundle.db),
      new PlantRepository(bundle.db),
      new CalendarEntryRepository(bundle.db),
    );
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ) {
    const parsed = calendarListQuerySchema.safeParse({ page: pageRaw, pageSize: pageSizeRaw });
    if (!parsed.success) {
      throw domainError('VALIDATION_ERROR', 'Invalid list query');
    }
    return this.calendar.list(user.id, id, parsed.data.page, parsed.data.pageSize);
  }

  @Post()
  async add(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const parsed = calendarAddSchema.safeParse(body);
    if (!parsed.success) {
      throw domainError('VALIDATION_ERROR', 'Plant is required');
    }
    const result = await this.calendar.add(user.id, id, parsed.data.plantId);
    res.status(result.created ? 201 : 200);
    return result.calendar;
  }

  @Delete(':plantId')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('plantId') plantId: string,
  ) {
    return this.calendar.remove(user.id, id, plantId);
  }
}
