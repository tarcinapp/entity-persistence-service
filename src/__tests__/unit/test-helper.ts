import { juggler } from '@loopback/repository';
import { givenHttpServerConfig } from '@loopback/testlab';
import { EntityPersistenceApplication } from '../..';

export async function setupApplication(): Promise<AppWithClient> {
  // Set test environment
  process.env.NODE_ENV = 'test';

  // Create test-specific datasource config
  const testConfig = {
    name: 'EntityDb',
    connector: 'memory',
    useNewUrlParser: true,
    useUnifiedTopology: true,
  };

  const app = new EntityPersistenceApplication({
    rest: givenHttpServerConfig({}),
  });

  // Bind the test datasource configuration
  app.bind('datasources.EntityDb').to(new juggler.DataSource(testConfig));

  await app.boot();
  await app.start();

  return { app };
}

export async function teardownApplication(app: EntityPersistenceApplication) {
  // Stop the app
  await app.stop();

  // Reset environment
  delete process.env.NODE_ENV;
}

export interface AppWithClient {
  app: EntityPersistenceApplication;
}
