import type { Client } from '@loopback/testlab';
import type { EntityPersistenceApplication } from '../..';
import { setupApplication, teardownApplication } from './test-helper';

describe('HomePage', () => {
  let app: EntityPersistenceApplication;
  let client: Client;

  before('setupApplication', async () => {
    ({ app, client } = await setupApplication());
  });

  after(async () => {
    await teardownApplication(app);
  });

  it('exposes a default home page', async () => {
    await client
      .get('/')
      .expect(200)
      .expect('Content-Type', /text\/html/);
  });

  it('exposes self-hosted explorer', async () => {
    await client
      .get('/explorer/')
      .expect(200)
      .expect('Content-Type', /text\/html/)
      .expect(/<title>LoopBack API Explorer/);
  });
});
