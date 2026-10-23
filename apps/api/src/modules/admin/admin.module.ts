import { Module } from '@nestjs/common';
import { LedgerReconciliation } from '../../core/ledger/reconciliation';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthorizationsModule } from '../authorizations/authorizations.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { AdminController } from './admin.controller';
import { AdminRepository } from './admin.repository';
import { AdminService } from './admin.service';

@Module({
  imports: [AccountsModule, AuthorizationsModule, PayoutsModule],
  controllers: [AdminController],
  providers: [AdminService, AdminRepository, LedgerReconciliation],
})
export class AdminModule {}
