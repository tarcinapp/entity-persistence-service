import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';

import type { AppWithClient } from './test-helper';
import { setupApplication, teardownApplication } from './test-helper';

describe('PingController', () => {
  let client: Client;
  let appWithClient: AppWithClient;

  before('setupApplication', async () => {
    appWithClient = await setupApplication();
    ({ client } = appWithClient);
  });

  after(async () => {
    await teardownApplication(appWithClient);
  });

  it('invokes GET /ping', async () => {
    const res = await client.get('/ping?msg=world').expect(200);
    expect(res.body).to.containEql({ greeting: 'Hello from Tarcinapp' });
  });
});
