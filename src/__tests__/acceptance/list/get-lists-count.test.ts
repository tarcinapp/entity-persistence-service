import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestList,
} from '../test-helper';

describe('GET /lists/count', () => {
  let client: Client;
  let appWithClient: AppWithClient | undefined;

  beforeEach(async () => {
    if (appWithClient) {
      await teardownApplication(appWithClient);
    }

    appWithClient = undefined;

    // Clear all environment variables
    Object.keys(process.env).forEach((key) => {
      delete process.env[key];
    });
  });

  afterEach(async () => {
    if (appWithClient) {
      await teardownApplication(appWithClient);
    }

    appWithClient = undefined;
  });

  after(async () => {
    if (appWithClient) {
      await teardownApplication(appWithClient);
    }

    appWithClient = undefined;
  });

  it('returns correct count of lists', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
    });
    ({ client } = appWithClient);

    // Create test lists
    await createTestList(client, {
      _name: 'Reading List 1',
      _kind: 'reading',
      description: 'First reading list',
    });

    await createTestList(client, {
      _name: 'Reading List 2',
      _kind: 'reading',
      description: 'Second reading list',
    });

    // Get count of lists
    const response = await client.get('/lists/count').expect(200);

    expect(response.body).to.have.property('count', 2);
  });
});
