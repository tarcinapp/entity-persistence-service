import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestList,
  createTestListReaction,
} from '../test-helper';

describe('PATCH /list-reactions/{id}', () => {
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

  it('updates list reaction properties', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like',
    });
    ({ client } = appWithClient);

    // Create test list first
    const listId = await createTestList(client, {
      _name: 'Test List',
      _kind: 'reading-list',
    });

    // Create test list reaction
    const reactionId = await createTestListReaction(client, {
      _name: 'Original Reaction',
      _listId: listId,
      _kind: 'like',
      description: 'Original description',
      _visibility: 'private',
    });

    // Update list reaction properties
    await client.patch(`/list-reactions/${reactionId}`).send({
      _name: 'Updated Reaction',
      description: 'Updated description',
      _visibility: 'public',
    });

    // Verify changes by getting the updated list reaction
    const response = await client
      .get(`/list-reactions/${reactionId}`)
      .expect(200);

    // Verify response
    expect(response.body).to.have.property('_id', reactionId);
    expect(response.body).to.have.property('_name', 'Updated Reaction');
    expect(response.body).to.have.property('_kind', 'like');
    expect(response.body).to.have.property('_listId', listId);
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
      list_reaction_kinds: 'like,comment',
    });
    ({ client } = appWithClient);

    // Create test list first
    const listId = await createTestList(client, {
      _name: 'Test List',
      _kind: 'reading-list',
    });

    // Create test list reaction
    const reactionId = await createTestListReaction(client, {
      _name: 'Test Reaction',
      _listId: listId,
      _kind: 'like',
    });

    // Try to update the _kind field (should be ignored or fail)
    await client
      .patch(`/list-reactions/${reactionId}`)
      .send({
        _kind: 'comment', // This should not be allowed
      })
      .expect(422);
  });

  it('should not allow modifying _listId field with PATCH operation', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({});
    ({ client } = appWithClient);

    // Create test lists
    const list1Id = await createTestList(client, {
      _name: 'Test List 1',
      description: 'First test list',
    });

    const list2Id = await createTestList(client, {
      _name: 'Test List 2',
      description: 'Second test list',
    });

    // Create test list reaction
    const reactionId = await createTestListReaction(client, {
      _name: 'Test Reaction',
      _listId: list1Id,
    });

    // Try to update the _listId field (should be ignored or fail)
    await client
      .patch(`/list-reactions/${reactionId}`)
      .send({
        _listId: list2Id, // This should not be allowed
      })
      .expect(422);
  });

  it('updates only provided fields, leaves others unchanged', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({});
    ({ client } = appWithClient);

    // Create test list first
    const listId = await createTestList(client, {
      _name: 'Test List',
      description: 'A test list',
    });

    // Create test list reaction
    const reactionId = await createTestListReaction(client, {
      _name: 'Original Reaction',
      _listId: listId,
      description: 'Original description',
      _visibility: 'private',
    });

    // Update only the name
    await client.patch(`/list-reactions/${reactionId}`).send({
      _name: 'Updated Name Only',
    });

    // Verify that only name was updated
    const response = await client
      .get(`/list-reactions/${reactionId}`)
      .expect(200);

    expect(response.body).to.have.property('_name', 'Updated Name Only');
    expect(response.body).to.have.property(
      'description',
      'Original description',
    ); // Unchanged
    expect(response.body).to.have.property('_visibility', 'private'); // Unchanged
    expect(response.body).to.have.property('_version', 2); // Version incremented
  });

  it('handles non-existent list reaction ID', async () => {
    // Set up the application
    appWithClient = await setupApplication({});
    ({ client } = appWithClient);

    const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';

    // Try to update non-existent list reaction
    const errorResponse = await client
      .patch(`/list-reactions/${nonExistentId}`)
      .send({
        _name: 'Updated Name',
      })
      .expect(404);

    expect(errorResponse.body.error).to.have.property('statusCode', 404);
  });

  it('validates updated data', async () => {
    // Set up the application
    appWithClient = await setupApplication({});
    ({ client } = appWithClient);

    // Create test list first
    const listId = await createTestList(client, {
      _name: 'Test List',
      description: 'A test list',
    });

    // Create test list reaction
    const reactionId = await createTestListReaction(client, {
      _name: 'Test Reaction',
      _listId: listId,
    });

    // Try to update with invalid data (empty name)
    const errorResponse = await client
      .patch(`/list-reactions/${reactionId}`)
      .send({
        _name: '', // Invalid empty name
      })
      .expect(422);

    expect(errorResponse.body.error).to.have.property('statusCode', 422);
  });

  it('updates custom fields', async () => {
    // Set up the application with custom field configuration
    appWithClient = await setupApplication({});
    ({ client } = appWithClient);

    // Create test list first
    const listId = await createTestList(client, {
      _name: 'Test List',
      description: 'A test list',
    });

    // Create test list reaction with custom fields
    const reactionId = await createTestListReaction(client, {
      _name: 'Test Reaction',
      _listId: listId,
      customField: 'original value',
      rating: 5,
    });

    // Update custom fields
    await client.patch(`/list-reactions/${reactionId}`).send({
      customField: 'updated value',
      rating: 8,
      newCustomField: 'new value',
    });

    // Verify custom fields were updated
    const response = await client
      .get(`/list-reactions/${reactionId}`)
      .expect(200);

    expect(response.body).to.have.property('customField', 'updated value');
    expect(response.body).to.have.property('rating', 8);
    expect(response.body).to.have.property('newCustomField', 'new value');
  });

  it('handles malformed request body', async () => {
    // Set up the application
    appWithClient = await setupApplication({});
    ({ client } = appWithClient);

    // Create test list first
    const listId = await createTestList(client, {
      _name: 'Test List',
      description: 'A test list',
    });

    // Create test list reaction
    const reactionId = await createTestListReaction(client, {
      _name: 'Test Reaction',
      _listId: listId,
    });

    // Send malformed JSON (this will be handled by the framework)
    const errorResponse = await client
      .patch(`/list-reactions/${reactionId}`)
      .send('malformed-json')
      .expect(400);

    expect(errorResponse.body.error).to.have.property('statusCode', 400);
  });

  it('updates timestamp fields correctly', async () => {
    // Set up the application
    appWithClient = await setupApplication({});
    ({ client } = appWithClient);

    // Create test list first
    const listId = await createTestList(client, {
      _name: 'Test List',
      description: 'A test list',
    });

    // Create test list reaction
    const reactionId = await createTestListReaction(client, {
      _name: 'Test Reaction',
      _listId: listId,
    });

    // Get original timestamps
    const originalResponse = await client
      .get(`/list-reactions/${reactionId}`)
      .expect(200);

    const originalCreatedDateTime = originalResponse.body._createdDateTime;
    const originalLastUpdatedDateTime =
      originalResponse.body._lastUpdatedDateTime;

    // Wait a bit to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Update the reaction
    await client.patch(`/list-reactions/${reactionId}`).send({
      _name: 'Updated Reaction',
    });

    // Get updated reaction
    const updatedResponse = await client
      .get(`/list-reactions/${reactionId}`)
      .expect(200);

    // Verify timestamps
    expect(updatedResponse.body._createdDateTime).to.equal(
      originalCreatedDateTime,
    ); // Should remain the same
    expect(updatedResponse.body._lastUpdatedDateTime).to.not.equal(
      originalLastUpdatedDateTime,
    ); // Should be updated
    expect(
      new Date(updatedResponse.body._lastUpdatedDateTime).getTime(),
    ).to.be.greaterThan(
      new Date(originalLastUpdatedDateTime).getTime(),
    );
  });
});
