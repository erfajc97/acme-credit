import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { WorkerModule } from './worker.module';

/** Second entrypoint (P2): `node dist/worker.js`, its own container, no HTTP server. */
async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
}

main().catch((error: unknown) => {
  // The logger may not exist yet (bad env, failed module init): write the cause and exit.
  process.stderr.write(`lending-core worker failed to start: ${String(error)}\n`);
  process.exit(1);
});
