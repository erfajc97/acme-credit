import { Module } from '@nestjs/common';
import { AccountLifecycleService } from './account-lifecycle.service';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { ActivityRepository } from './activity.repository';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService, AccountLifecycleService, ActivityRepository],
  exports: [AccountsService, AccountLifecycleService],
})
export class AccountsModule {}
