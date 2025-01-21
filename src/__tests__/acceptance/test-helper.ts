import { RestBindings } from '@loopback/rest';
import type { Client } from '@loopback/testlab';
import { createRestAppClient, givenHttpServerConfig } from '@loopback/testlab';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { EntityPersistenceApplication } from '../..';

export interface TestEnvironmentVariables {
  list_kinds?: string;
  default_list_kind?: string;
  autoapprove_list?: string;
  visibility_list?: string;
  idempotency_list?: string;
  [key: string]: string | undefined;
}

export async function setupApplication(
  envVars?: TestEnvironmentVariables,
): Promise<AppWithClient> {
  // Store original env vars
  const originalEnv = {
    list_kinds: process.env.list_kinds,
    default_list_kind: process.env.default_list_kind,
    autoapprove_list: process.env.autoapprove_list,
    visibility_list: process.env.visibility_list,
    idempotency_list: process.env.idempotency_list,
    mongodb_url: process.env.mongodb_url,
    mongodb_database: process.env.mongodb_database,
  };

  // Set test env vars
  if (envVars) {
    Object.entries(envVars).forEach(([key, value]) => {
      if (value !== undefined) {
        process.env[key] = value;
      }
    });
  }

  const mongod = await MongoMemoryServer.create();

  // Set MongoDB environment variables
  process.env.mongodb_url = mongod.getUri();
  process.env.mongodb_database = 'testdb';

  const app = new EntityPersistenceApplication({
    rest: {
      ...givenHttpServerConfig(),
      port: 0, // Let the OS pick an available port
    },
  });

  // Set project root and boot options for test environment
  app.projectRoot = __dirname;
  app.bootOptions = {
    controllers: {
      dirs: ['../../controllers'],
      extensions: ['.controller.ts'],
      nested: true,
    },
    repositories: {
      dirs: ['../../repositories'],
      extensions: ['.repository.ts'],
      nested: true,
    },
  };

  // Configure the app to use the in-memory MongoDB
  app.bind('datasources.config.EntityDb').to({
    name: 'EntityDb',
    connector: 'mongodb',
    url: mongod.getUri(),
    database: 'testdb',
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  app.bind(RestBindings.ERROR_WRITER_OPTIONS).to({
    debug: true,
    safeFields: ['errorCode', 'message'],
  });

  await app.boot();
  await app.start();

  const client = createRestAppClient(app);

  // Debug log
  console.log('App configuration:', {
    port: app.restServer.config.port,
    url: app.restServer.url,
    mongodb: mongod.getUri(),
  });

  return { app, client, mongod, originalEnv };
}

export interface AppWithClient {
  app: EntityPersistenceApplication;
  client: Client;
  mongod: MongoMemoryServer;
  originalEnv: TestEnvironmentVariables;
}

export async function teardownApplication(appWithClient: AppWithClient) {
  // Restore original env vars
  Object.entries(appWithClient.originalEnv).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });

  if (appWithClient.app) {
    await appWithClient.app.stop();
  }

  if (appWithClient.mongod) {
    await appWithClient.mongod.stop();
  }
}
