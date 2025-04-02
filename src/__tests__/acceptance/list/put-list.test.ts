import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestList,
} from '../test-helper';

describe('PUT /lists/{id}', () => {
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

  it('replaces list with new data', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
    });
    ({ client } = appWithClient);

    // Create test list
    const listId = await createTestList(client, {
      _name: 'Original List',
      _kind: 'reading',
      description: 'Original description',
      _visibility: 'private',
    });

    // Replace list with new data
    await client
      .put(`/lists/${listId}`)
      .send({
        _name: 'Replaced List',
        _kind: 'reading',
        description: 'Replaced description',
        _visibility: 'public',
      })
      .expect(204);

    // Verify changes by getting the updated list
    const response = await client.get(`/lists/${listId}`).expect(200);

    // Verify response
    expect(response.body).to.have.property('_id', listId);
    expect(response.body).to.have.property('_name', 'Replaced List');
    expect(response.body).to.have.property('_kind', 'reading');
    expect(response.body).to.have.property(
      'description',
      'Replaced description',
    );
    expect(response.body).to.have.property('_visibility', 'public');
    expect(response.body).to.have.property('_version', 2); // Version should be incremented
    expect(response.body).to.have.property('_validFromDateTime');
    expect(response.body).to.have.property('_createdDateTime');
    expect(response.body).to.have.property('_lastUpdatedDateTime');
  });
});
