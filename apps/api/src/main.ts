import 'reflect-metadata';
import { AppModule } from './app.module';
import { loadEnvFromProcess } from './core/config/env.provider';
import { createApi } from './core/http/create-api';

async function main(): Promise<void> {
  const env = loadEnvFromProcess();
  const app = await createApi(AppModule, env);
  await app.listen(env.PORT, '0.0.0.0');
}

main().catch((error: unknown) => {
  // The logger may not exist yet (bad env, failed module init): write the cause and exit.
  process.stderr.write(`lending-core failed to start: ${String(error)}\n`);
  process.exit(1);
});
