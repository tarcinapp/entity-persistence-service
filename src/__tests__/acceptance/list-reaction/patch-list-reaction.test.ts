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
      description: 'Test description',
      _visibility: 'private',
    });

    // Attempt to update _kind field
    const response = await client
      .patch(`/list-reactions/${reactionId}`)
      .send({
        _kind: 'comment',
      })
      .expect(422);

    // Verify error response
    expect(response.body).to.have.property('error');
    expect(response.body.error).to.have.property('statusCode', 422);
    expect(response.body.error).to.have.property('name', 'ImmutableKindError');
    expect(response.body.error).to.have.property(
      'message',
      "List reaction kind cannot be changed after creation. Current kind is 'like'.",
    );
    expect(response.body.error).to.have.property(
      'code',
      'IMMUTABLE-LIST-REACTION-KIND',
    );

    // Verify _kind remains unchanged by getting the list reaction
    const getResponse = await client
      .get(`/list-reactions/${reactionId}`)
      .expect(200);
    expect(getResponse.body).to.have.property('_kind', 'like');
  });

  it('should not allow modifying _listId field with PATCH operation', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like',
    });
    ({ client } = appWithClient);

    // Create test lists
    const list1Id = await createTestList(client, {
      _name: 'First List',
      _kind: 'reading-list',
    });

    const list2Id = await createTestList(client, {
      _name: 'Second List',
      _kind: 'reading-list',
    });

    // Create test list reaction
    const reactionId = await createTestListReaction(client, {
      _name: 'Test Reaction',
      _listId: list1Id,
      _kind: 'like',
      description: 'Test description',
    });

    // Attempt to update _listId field
    const response = await client
      .patch(`/list-reactions/${reactionId}`)
      .send({
        _listId: list2Id,
      })
      .expect(422);

    // Verify error response
    expect(response.body).to.have.property('error');
    expect(response.body.error).to.have.property('statusCode', 422);
    expect(response.body.error).to.have.property(
      'name',
      'ImmutableListIdError',
    );
    expect(response.body.error).to.have.property(
      'message',
      `List reaction list ID cannot be changed after creation. Current list ID is '${list1Id}'.`,
    );
    expect(response.body.error).to.have.property('code', 'IMMUTABLE-LIST-ID');

    // Verify _listId remains unchanged by getting the list reaction
    const getResponse = await client
      .get(`/list-reactions/${reactionId}`)
      .expect(200);
    expect(getResponse.body).to.have.property('_listId', list1Id);
  });

  it('should allow updating other fields while preserving _kind and _listId', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like,comment',
    });
    ({ client } = appWithClient);

    // Create test list
    const listId = await createTestList(client, {
      _name: 'Test List',
      _kind: 'reading-list',
    });

    // Create test list reaction
    const reactionId = await createTestListReaction(client, {
      _name: 'Test Reaction',
      _listId: listId,
      _kind: 'like',
      description: 'Test description',
      _visibility: 'private',
    });

    // Update other fields
    await client
      .patch(`/list-reactions/${reactionId}`)
      .send({
        _name: 'Updated Reaction',
        description: 'Updated description',
        _visibility: 'public',
      })
      .expect(204);

    // Verify _kind and _listId remain unchanged while other fields are updated
    const response = await client
      .get(`/list-reactions/${reactionId}`)
      .expect(200);
    expect(response.body).to.have.property('_kind', 'like');
    expect(response.body).to.have.property('_listId', listId);
    expect(response.body).to.have.property('_name', 'Updated Reaction');
    expect(response.body).to.have.property(
      'description',
      'Updated description',
    );
    expect(response.body).to.have.property('_visibility', 'public');
  });
});
