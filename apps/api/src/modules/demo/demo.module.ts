import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthorizationsModule } from '../authorizations/authorizations.module';
import { PaymentsModule } from '../payments/payments.module';
import { DemoDataSeeder } from './demo-data.seeder';

/** Seed-only: the demo customer's history, built through the real services. */
@Module({
  imports: [AccountsModule, PaymentsModule, AuthorizationsModule],
  providers: [DemoDataSeeder],
  exports: [DemoDataSeeder],
})
export class DemoModule {}
