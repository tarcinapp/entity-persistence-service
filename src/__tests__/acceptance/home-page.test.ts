import type { Client } from '@loopback/testlab';
import type { AppWithClient } from './test-helper';
import { setupApplication, teardownApplication } from './test-helper';

describe('HomePage', () => {
  let client: Client;
  let appWithClient: AppWithClient;

  before('setupApplication', async () => {
    appWithClient = await setupApplication();
    ({ client } = appWithClient);
  });

  after(async () => {
    await teardownApplication(appWithClient);
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
