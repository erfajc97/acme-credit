import { Global, Module } from '@nestjs/common';
import { CLOCK, systemClock } from '../clock/clock';
import { BackgroundTasks } from './background-tasks';

/** Process-wide time source and in-memory scheduler, shared by every module. */
@Global()
@Module({
  providers: [{ provide: CLOCK, useValue: systemClock }, BackgroundTasks],
  exports: [CLOCK, BackgroundTasks],
})
export class RuntimeModule {}
