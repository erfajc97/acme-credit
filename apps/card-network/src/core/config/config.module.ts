import { Global, Module } from '@nestjs/common';
import { ENV, loadEnvFromProcess } from './env.provider';

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: loadEnvFromProcess }],
  exports: [ENV],
})
export class ConfigModule {}
