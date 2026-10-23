import { Module } from '@nestjs/common';
import { PayoutsRepository } from './payouts.repository';
import { PayoutsService } from './payouts.service';

/** Payouts to customers: sent and retried by the worker, listed in the back office. */
@Module({
  providers: [PayoutsService, PayoutsRepository],
  exports: [PayoutsService],
})
export class PayoutsModule {}
