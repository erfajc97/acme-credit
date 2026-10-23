import { Module } from '@nestjs/common';
import { PayPageController } from './pay-page.controller';
import { ProviderController } from './provider.controller';
import { ProviderService } from './provider.service';

@Module({
  controllers: [ProviderController, PayPageController],
  providers: [ProviderService],
})
export class ProviderModule {}
