import type { ApplicationConfig } from '@loopback/core';
import { EntityPersistenceApplication } from './application';
import { EnvConfigHelper } from './extensions/config-helpers/env-config-helper';

/**
 * Export the OpenAPI spec from the application
 */
async function exportOpenApiSpec(): Promise<void> {
  const env = EnvConfigHelper.getInstance();

  const config: ApplicationConfig = {
    rest: {
      port: +(env.PORT ?? 3000),
      host: env.HOST ?? 'localhost',
    },
  };
  const outFile = process.argv[2] ?? '';
  const app = new EntityPersistenceApplication(config);
  await app.boot();
  await app.exportOpenApiSpec(outFile);
}

exportOpenApiSpec().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fail to export OpenAPI spec from the application.', err);
  process.exit(1);
});
