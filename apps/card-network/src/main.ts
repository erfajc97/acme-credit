import 'reflect-metadata';
import { AppModule } from './app.module';
import { loadEnvFromProcess } from './core/config/env.provider';
import { createNetworkApi } from './core/http/create-network-api';

async function main(): Promise<void> {
  const env = loadEnvFromProcess();
  const app = await createNetworkApi(AppModule, env);
  await app.listen(env.PORT, '0.0.0.0');
}

main().catch((error: unknown) => {
  // The logger may not exist yet (bad env, failed module init): write the cause and exit.
  process.stderr.write(`card-network failed to start: ${String(error)}\n`);
  process.exit(1);
});
