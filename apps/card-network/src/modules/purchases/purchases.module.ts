import { Module } from '@nestjs/common';
import { CaptureService } from './capture.service';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';

@Module({
  controllers: [PurchasesController, CheckoutController],
  providers: [PurchasesService, CaptureService, CheckoutService],
})
export class PurchasesModule {}
