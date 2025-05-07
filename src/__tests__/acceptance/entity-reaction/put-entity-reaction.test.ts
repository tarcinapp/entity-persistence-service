import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestEntity,
  createTestEntityReaction,
} from '../test-helper';

describe('PUT /entity-reactions/{id}', () => {
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

  it('replaces entity reaction with new data', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like',
    });
    ({ client } = appWithClient);

    // Create test entity first
    const entityId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    // Create test entity reaction
    const reactionId = await createTestEntityReaction(client, {
      _name: 'Original Reaction',
      _entityId: entityId,
      _kind: 'like',
      description: 'Original description',
      _visibility: 'private',
    });

    // Replace entity reaction with new data
    await client
      .put(`/entity-reactions/${reactionId}`)
      .send({
        _name: 'Replaced Reaction',
        _entityId: entityId,
        _kind: 'like',
        description: 'Replaced description',
        _visibility: 'public',
      })
      .expect(204);

    // Verify changes by getting the updated entity reaction
    const response = await client
      .get(`/entity-reactions/${reactionId}`)
      .expect(200);

    // Verify response
    expect(response.body).to.have.property('_id', reactionId);
    expect(response.body).to.have.property('_name', 'Replaced Reaction');
    expect(response.body).to.have.property('_kind', 'like');
    expect(response.body).to.have.property('_entityId', entityId);
    expect(response.body).to.have.property(
      'description',
      'Replaced description',
    );
    expect(response.body).to.have.property('_visibility', 'public');
    expect(response.body).to.have.property('_version', 2); // Version should be incremented
    expect(response.body).to.have.property('_validFromDateTime');
    expect(response.body).to.have.property('_lastUpdatedDateTime');
  });

  it('should not allow changing _kind field with PUT operation', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like,comment',
    });
    ({ client } = appWithClient);

    // Create test entity first
    const entityId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    // Create test entity reaction
    const reactionId = await createTestEntityReaction(client, {
      _name: 'Test Reaction',
      _entityId: entityId,
      _kind: 'like',
      description: 'Test description',
      _visibility: 'private',
    });

    // Attempt to replace entity reaction with different _kind
    const response = await client
      .put(`/entity-reactions/${reactionId}`)
      .send({
        _name: 'Test Comment',
        _entityId: entityId,
        _kind: 'comment', // Attempting to change _kind
        description: 'Test description',
        _visibility: 'private',
      })
      .expect(422);

    // Verify error response
    expect(response.body).to.have.property('error');
    expect(response.body.error).to.have.property('statusCode', 422);
    expect(response.body.error).to.have.property('name', 'ImmutableKindError');
    expect(response.body.error).to.have.property(
      'message',
      "Entity reaction kind cannot be changed after creation. Current kind is 'like'.",
    );
    expect(response.body.error).to.have.property(
      'code',
      'IMMUTABLE-ENTITY-REACTION-KIND',
    );
    expect(response.body.error).to.have.property('status', 422);

    // Verify _kind remains unchanged by getting the entity reaction
    const getResponse = await client
      .get(`/entity-reactions/${reactionId}`)
      .expect(200);
    expect(getResponse.body).to.have.property('_kind', 'like');
  });

  it('should not allow changing _entityId field with PUT operation', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like',
    });
    ({ client } = appWithClient);

    // Create test entities
    const entity1Id = await createTestEntity(client, {
      _name: 'First Book',
      _kind: 'book',
    });

    const entity2Id = await createTestEntity(client, {
      _name: 'Second Book',
      _kind: 'book',
    });

    // Create test entity reaction
    const reactionId = await createTestEntityReaction(client, {
      _name: 'Test Reaction',
      _entityId: entity1Id,
      _kind: 'like',
      description: 'Test description',
      _visibility: 'private',
    });

    // Attempt to replace entity reaction with different _entityId
    const response = await client
      .put(`/entity-reactions/${reactionId}`)
      .send({
        _name: 'Test Reaction',
        _entityId: entity2Id, // Attempting to change _entityId
        _kind: 'like',
        description: 'Test description',
        _visibility: 'private',
      })
      .expect(422);

    // Verify error response
    expect(response.body).to.have.property('error');
    expect(response.body.error).to.have.property('statusCode', 422);
    expect(response.body.error).to.have.property(
      'name',
      'ImmutableEntityIdError',
    );
    expect(response.body.error).to.have.property(
      'message',
      `Entity reaction entity ID cannot be changed after creation. Current entity ID is '${entity1Id}'.`,
    );
    expect(response.body.error).to.have.property('code', 'IMMUTABLE-ENTITY-ID');
    expect(response.body.error).to.have.property('status', 422);

    // Verify _entityId remains unchanged by getting the entity reaction
    const getResponse = await client
      .get(`/entity-reactions/${reactionId}`)
      .expect(200);
    expect(getResponse.body).to.have.property('_entityId', entity1Id);
  });
});
