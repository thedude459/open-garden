import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { ReminderScheduler } from './reminder-scheduler';

@Module({
  controllers: [NotificationsController],
  providers: [ReminderScheduler],
})
export class NotificationsModule {}
