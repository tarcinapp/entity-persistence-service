import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestList,
} from '../test-helper';

describe('PATCH /lists/{id}', () => {
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

  it('updates list properties', async () => {
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

    // Update list properties
    await client
      .patch(`/lists/${listId}`)
      .send({
        _name: 'Updated List',
        description: 'Updated description',
        _visibility: 'public',
      })
      .expect(204);

    // Verify changes by getting the updated list
    const response = await client.get(`/lists/${listId}`).expect(200);

    // Verify response
    expect(response.body).to.have.property('_id', listId);
    expect(response.body).to.have.property('_name', 'Updated List');
    expect(response.body).to.have.property('_kind', 'reading');
    expect(response.body).to.have.property(
      'description',
      'Updated description',
    );
    expect(response.body).to.have.property('_visibility', 'public');
    expect(response.body).to.have.property('_version', 2); // Version should be incremented
    expect(response.body).to.have.property('_validFromDateTime');
    expect(response.body).to.have.property('_createdDateTime');
    expect(response.body).to.have.property('_lastUpdatedDateTime');
  });

  it('should not allow modifying _kind field with PATCH operation', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading,shopping',
    });
    ({ client } = appWithClient);

    // Create test list
    const listId = await createTestList(client, {
      _name: 'Test Reading List',
      _kind: 'reading',
      description: 'Test description',
      _visibility: 'private',
    });

    // Attempt to update _kind field
    const response = await client
      .patch(`/lists/${listId}`)
      .send({
        _kind: 'shopping',
      })
      .expect(422);

    // Verify error response
    expect(response.body).to.have.property('error');
    expect(response.body.error).to.have.property('statusCode', 422);
    expect(response.body.error).to.have.property('name', 'ImmutableKindError');
    expect(response.body.error).to.have.property(
      'message',
      'List kind cannot be changed after creation. Current kind is \'reading\'.',
    );
    expect(response.body.error).to.have.property('code', 'IMMUTABLE-LIST-KIND');

    // Verify _kind remains unchanged by getting the list
    const getResponse = await client.get(`/lists/${listId}`).expect(200);
    expect(getResponse.body).to.have.property('_kind', 'reading');
  });

  it('should allow updating other fields while preserving _kind', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading,shopping',
    });
    ({ client } = appWithClient);

    // Create test list
    const listId = await createTestList(client, {
      _name: 'Test Reading List',
      _kind: 'reading',
      description: 'Test description',
      _visibility: 'private',
    });

    // Update other fields
    await client
      .patch(`/lists/${listId}`)
      .send({
        _name: 'Updated Reading List',
        description: 'Updated description',
        _visibility: 'public',
      })
      .expect(204);

    // Verify _kind remains unchanged while other fields are updated
    const response = await client.get(`/lists/${listId}`).expect(200);
    expect(response.body).to.have.property('_kind', 'reading');
    expect(response.body).to.have.property('_name', 'Updated Reading List');
    expect(response.body).to.have.property(
      'description',
      'Updated description',
    );
    expect(response.body).to.have.property('_visibility', 'public');
  });
});
