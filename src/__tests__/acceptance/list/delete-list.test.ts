import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestList,
} from '../test-helper';

describe('DELETE /lists/{id}', () => {
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

  it('deletes list by id', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
    });
    ({ client } = appWithClient);

    // Create test list
    const listId = await createTestList(client, {
      _name: 'Test List',
      _kind: 'reading',
      description: 'A test list',
    });

    // Delete list
    await client.delete(`/lists/${listId}`).expect(204);

    // Verify list is deleted by trying to fetch it
    const response = await client.get(`/lists/${listId}`).expect(404);
    expect(response.body).to.have.property('error');
    expect(response.body.error).to.have.property('statusCode', 404);
    expect(response.body.error).to.have.property('code', 'LIST-NOT-FOUND');
  });
}); 
