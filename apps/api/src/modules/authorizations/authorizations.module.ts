import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthorizationsService } from './authorizations.service';
import { CustomerAuthorizationsController } from './customer-authorizations.controller';
import { NetworkController } from './network.controller';

@Module({
  imports: [AccountsModule],
  controllers: [NetworkController, CustomerAuthorizationsController],
  providers: [AuthorizationsService],
  exports: [AuthorizationsService],
})
export class AuthorizationsModule {}
