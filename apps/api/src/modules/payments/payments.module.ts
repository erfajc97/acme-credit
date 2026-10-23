import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { PaymentRequestsService } from './payment-requests.service';
import { PaymentSettlementService } from './payment-settlement.service';
import { PaymentsController } from './payments.controller';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [AccountsModule, PayoutsModule],
  controllers: [PaymentsController, WebhooksController],
  providers: [PaymentRequestsService, PaymentSettlementService],
  exports: [PaymentSettlementService, PaymentRequestsService],
})
export class PaymentsModule {}
