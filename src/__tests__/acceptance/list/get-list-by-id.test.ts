import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestList,
} from '../test-helper';

describe('GET /lists/{id}', () => {
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

  it('returns list by id', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
    });
    ({ client } = appWithClient);

    // Create test list
    const listId = await createTestList(client, {
      _name: 'Test Reading List',
      _kind: 'reading',
      description: 'A test reading list',
      _visibility: 'public',
    });

    // Get list by id
    const response = await client.get(`/lists/${listId}`).expect(200);

    // Verify response
    expect(response.body).to.have.property('_id', listId);
    expect(response.body).to.have.property('_name', 'Test Reading List');
    expect(response.body).to.have.property('_kind', 'reading');
    expect(response.body).to.have.property(
      'description',
      'A test reading list',
    );
    expect(response.body).to.have.property('_visibility', 'public');
    expect(response.body).to.have.property('_version', 1);
    expect(response.body).to.have.property('_validFromDateTime');
    expect(response.body).to.have.property('_createdDateTime');
    expect(response.body).to.have.property('_lastUpdatedDateTime');
  });

  it('returns 404 when list is not found', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
    });
    ({ client } = appWithClient);

    // Try to get a non-existent list
    const nonExistentId = 'non-existent-id';
    const response = await client.get(`/lists/${nonExistentId}`).expect(404);

    // Verify error response
    expect(response.body.error).to.have.property('statusCode', 404);
    expect(response.body.error).to.have.property('name', 'NotFoundError');
    expect(response.body.error).to.have.property(
      'message',
      `List with id '${nonExistentId}' could not be found.`,
    );
    expect(response.body.error).to.have.property('code', 'LIST-NOT-FOUND');
    expect(response.body.error).to.have.property('status', 404);
  });
});
