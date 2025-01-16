import { givenHttpServerConfig } from '@loopback/testlab';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { EntityPersistenceApplication } from '../..';

let mongod: MongoMemoryServer;

export async function setupApplication(): Promise<AppWithClient> {
  // Create an in-memory MongoDB instance
  mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();

  // Set environment variables for MongoDB connection
  process.env.mongodb_url = mongoUri;
  process.env.mongodb_database = 'testdb';

  const restConfig = givenHttpServerConfig({});

  const app = new EntityPersistenceApplication({
    rest: restConfig,
  });

  await app.boot();
  await app.start();

  return { app };
}

export async function teardownApplication(app: EntityPersistenceApplication) {
  await app.stop();
  await mongod.stop();
}

export interface AppWithClient {
  app: EntityPersistenceApplication;
}
