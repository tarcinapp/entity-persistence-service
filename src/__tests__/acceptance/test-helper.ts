import type { Client } from '@loopback/testlab';
import { createRestAppClient, givenHttpServerConfig } from '@loopback/testlab';
import { EntityPersistenceApplication } from '../..';

export async function setupApplication(): Promise<AppWithClient> {
  const restConfig = givenHttpServerConfig({
    // Customize the server configuration here.
    // Empty values (undefined, '') will be ignored by the helper.
    //
    // host: process.env.HOST,
    // port: +process.env.PORT,
  });

  const app = new EntityPersistenceApplication({
    rest: restConfig,
  });

  await app.boot();
  await app.start();

  const client = createRestAppClient(app);

  return { app, client };
}

export interface AppWithClient {
  app: EntityPersistenceApplication;
  client: Client;
}
