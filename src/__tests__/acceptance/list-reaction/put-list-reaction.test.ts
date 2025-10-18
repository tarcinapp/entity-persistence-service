import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { ListReaction } from '../../../models';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestList,
  createTestListReaction,
} from '../test-helper';

describe('PUT /list-reactions/{id}', () => {
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

  it('replaces entire list reaction with PUT operation', async () => {
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
      _name: 'Original Reaction',
      _listId: listId,
      _kind: 'like',
      description: 'Original description',
      _visibility: 'private',
      customField: 'original value',
    });

    // Replace entire list reaction with PUT
    const replacementReaction: Partial<ListReaction> = {
      _name: 'Completely New Reaction',
      _listId: listId,
      _kind: 'comment',
      description: 'Completely new description',
      _visibility: 'public',
      newCustomField: 'new value',
      // Note: customField is omitted, so it should be removed
    };

    await client
      .put(`/list-reactions/${reactionId}`)
      .send(replacementReaction)
      .expect(204);

    // Verify the replacement by getting the updated list reaction
    const response = await client
      .get(`/list-reactions/${reactionId}`)
      .expect(200);

    // Verify that all fields are replaced
    expect(response.body).to.have.property('_id', reactionId);
    expect(response.body).to.have.property('_name', 'Completely New Reaction');
    expect(response.body).to.have.property('_kind', 'comment');
    expect(response.body).to.have.property('_listId', listId);
    expect(response.body).to.have.property(
      'description',
      'Completely new description',
    );
    expect(response.body).to.have.property('_visibility', 'public');
    expect(response.body).to.have.property('newCustomField', 'new value');
    expect(response.body).to.not.have.property('customField'); // Should be removed
    expect(response.body).to.have.property('_version', 2); // Version should be incremented
  });

  it('should not allow modifying _listId field with PUT operation', async () => {
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

    // Try to replace with different _listId
    const replacementReaction: Partial<ListReaction> = {
      _name: 'Updated Reaction',
      _listId: list2Id, // Different list ID - should not be allowed
      description: 'Updated description',
    };

    await client
      .put(`/list-reactions/${reactionId}`)
      .send(replacementReaction)
      .expect(422);
  });

  it('validates required fields in PUT operation', async () => {
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

    // Try to replace with missing required fields
    const incompleteReaction = {
      description: 'Only description provided',
      // Missing _name and _listId
    };

    const errorResponse = await client
      .put(`/list-reactions/${reactionId}`)
      .send(incompleteReaction)
      .expect(422);

    expect(errorResponse.body.error).to.have.property('statusCode', 422);
  });

  it('validates list reaction kind in PUT operation', async () => {
    // Set up the application with specific kinds
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like,dislike',
    });
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
      _kind: 'like',
    });

    // Try to replace with invalid kind
    const replacementReaction: Partial<ListReaction> = {
      _name: 'Updated Reaction',
      _listId: listId,
      _kind: 'love', // Invalid kind
      description: 'Updated description',
    };

    const errorResponse = await client
      .put(`/list-reactions/${reactionId}`)
      .send(replacementReaction)
      .expect(422);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 422,
      name: 'InvalidKindError',
      code: 'INVALID-LIST-REACTION-KIND',
      status: 422,
    });
  });

  it('handles non-existent list reaction ID in PUT operation', async () => {
    // Set up the application
    appWithClient = await setupApplication({});
    ({ client } = appWithClient);

    // Create test list for the replacement data
    const listId = await createTestList(client, {
      _name: 'Test List',
      description: 'A test list',
    });

    const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';

    const replacementReaction: Partial<ListReaction> = {
      _name: 'Replacement Reaction',
      _listId: listId,
      description: 'Replacement description',
    };

    // Try to replace non-existent list reaction
    const errorResponse = await client
      .put(`/list-reactions/${nonExistentId}`)
      .send(replacementReaction)
      .expect(404);

    expect(errorResponse.body.error).to.have.property('statusCode', 404);
  });

  it('preserves system-managed fields in PUT operation', async () => {
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
      _name: 'Original Reaction',
      _listId: listId,
      description: 'Original description',
    });

    // Get original system fields
    const originalResponse = await client
      .get(`/list-reactions/${reactionId}`)
      .expect(200);

    const originalCreatedDateTime = originalResponse.body._createdDateTime;
    const originalSlug = originalResponse.body._slug;

    // Try to replace system-managed fields (these should be ignored or preserved)
    const replacementReaction = {
      _name: 'Updated Reaction',
      _listId: listId,
      description: 'Updated description',
      _id: 'should-be-ignored',
      _createdDateTime: '2020-01-01T00:00:00.000Z', // Should be ignored
      _slug: 'should-be-ignored', // Should be generated from _name
      _version: 999, // Should be ignored
    };

    await client
      .put(`/list-reactions/${reactionId}`)
      .send(replacementReaction)
      .expect(204);

    // Verify system fields are preserved/managed correctly
    const updatedResponse = await client
      .get(`/list-reactions/${reactionId}`)
      .expect(200);

    expect(updatedResponse.body._id).to.equal(reactionId); // Should remain the same
    expect(updatedResponse.body._createdDateTime).to.equal(
      originalCreatedDateTime,
    ); // Should remain the same
    expect(updatedResponse.body._slug).to.equal('updated-reaction'); // Should be generated from new name
    expect(updatedResponse.body._version).to.equal(2); // Should be incremented, not set to 999
  });

  it('handles malformed request body in PUT operation', async () => {
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

    // Send malformed JSON
    const errorResponse = await client
      .put(`/list-reactions/${reactionId}`)
      .send('malformed-json')
      .expect(400);

    expect(errorResponse.body.error).to.have.property('statusCode', 400);
  });

  it('updates timestamp fields correctly in PUT operation', async () => {
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
      _name: 'Original Reaction',
      _listId: listId,
      description: 'Original description',
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

    // Replace the reaction with PUT
    const replacementReaction: Partial<ListReaction> = {
      _name: 'Completely New Reaction',
      _listId: listId,
      description: 'Completely new description',
    };

    await client
      .put(`/list-reactions/${reactionId}`)
      .send(replacementReaction)
      .expect(204);

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

  it('clears fields not included in PUT request', async () => {
    // Set up the application
    appWithClient = await setupApplication({});
    ({ client } = appWithClient);

    // Create test list first
    const listId = await createTestList(client, {
      _name: 'Test List',
      description: 'A test list',
    });

    // Create test list reaction with multiple fields
    const reactionId = await createTestListReaction(client, {
      _name: 'Original Reaction',
      _listId: listId,
      description: 'Original description',
      _visibility: 'private',
      customField1: 'value1',
      customField2: 'value2',
      rating: 5,
    });

    // Replace with minimal data (should clear other fields)
    const replacementReaction: Partial<ListReaction> = {
      _name: 'Minimal Reaction',
      _listId: listId,
      description: 'Minimal description',
      // Note: _visibility, customField1, customField2, rating are omitted
    };

    await client
      .put(`/list-reactions/${reactionId}`)
      .send(replacementReaction)
      .expect(204);

    // Verify fields are cleared
    const updatedResponse = await client
      .get(`/list-reactions/${reactionId}`)
      .expect(200);

    expect(updatedResponse.body._name).to.equal('Minimal Reaction');
    expect(updatedResponse.body.description).to.equal('Minimal description');
    expect(updatedResponse.body).to.not.have.property('customField1');
    expect(updatedResponse.body).to.not.have.property('customField2');
    expect(updatedResponse.body).to.not.have.property('rating');
    // _visibility should have default value, not the original 'private'
  });
});
