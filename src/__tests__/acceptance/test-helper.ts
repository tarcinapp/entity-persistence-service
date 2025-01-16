import type { Client } from '@loopback/testlab';
import { createRestAppClient, givenHttpServerConfig } from '@loopback/testlab';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { EntityPersistenceApplication } from '../..';
import type { EntityDbDataSource } from '../../datasources';

let mongod: MongoMemoryServer;

export async function setupApplication(): Promise<AppWithClient> {
  // Create an in-memory MongoDB instance
  mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();

  // Set MongoDB connection environment variables
  process.env.mongodb_url = mongoUri;
  process.env.mongodb_database = 'testdb';

  const app = new EntityPersistenceApplication({
    rest: givenHttpServerConfig({}),
  });

  await app.boot();
  await app.start();

  const client = createRestAppClient(app);

  return { app, client };
}

export async function teardownApplication(app: EntityPersistenceApplication) {
  if (!app) {
    return;
  }

  try {
    // Get the datasource instance and disconnect
    const datasource = await app.get<EntityDbDataSource>(
      'datasources.EntityDb',
    );
    if (datasource?.disconnect) {
      await datasource.disconnect();
    }

    // Stop the app
    await app.stop();
  } finally {
    // Stop the in-memory MongoDB server
    if (mongod) {
      await mongod.stop();
    }

    // Clear MongoDB environment variables
    delete process.env.mongodb_url;
    delete process.env.mongodb_database;
  }
}

export interface AppWithClient {
  app: EntityPersistenceApplication;
  client: Client;
}
