import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { EntityReaction } from '../../../models';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestEntity,
  createTestEntityReaction,
  cleanupCreatedEntities,
  cleanupCreatedEntityReactions,
} from '../test-helper';

describe('GET /entity-reactions', () => {
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
      // Clean up created entity reactions and entities
      await cleanupCreatedEntityReactions(client);
      await cleanupCreatedEntities(client);

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

  // Basic CRUD Tests
  it('basic: returns all entity reactions when no filter is applied', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create test entities first
    const entity1Id = await createTestEntity(client, {
      _name: 'Book 1',
      _kind: 'book',
      description: 'First book',
    });

    const entity2Id = await createTestEntity(client, {
      _name: 'Book 2',
      _kind: 'book',
      description: 'Second book',
    });

    // Create test entity reactions
    await createTestEntityReaction(client, {
      _name: 'Reaction 1',
      _entityId: entity1Id,
      _kind: 'like',
    });

    await createTestEntityReaction(client, {
      _name: 'Reaction 2',
      _entityId: entity2Id,
      _kind: 'comment',
    });

    // Get all entity reactions
    const response = await client.get('/entity-reactions').expect(200);

    expect(response.body).to.be.Array().and.have.length(2);
    expect(response.body.map((e: EntityReaction) => e._name)).to.containDeep([
      'Reaction 1',
      'Reaction 2',
    ]);
  });

  // Filter Tests
  it('filter: by kind', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create test entities first
    const entity1Id = await createTestEntity(client, {
      _name: 'Book 1',
      _kind: 'book',
      description: 'First book',
    });

    const entity2Id = await createTestEntity(client, {
      _name: 'Book 2',
      _kind: 'book',
      description: 'Second book',
    });

    // Create test entity reactions
    await createTestEntityReaction(client, {
      _name: 'Like Reaction',
      _entityId: entity1Id,
      _kind: 'like',
    });

    await createTestEntityReaction(client, {
      _name: 'Comment Reaction',
      _entityId: entity2Id,
      _kind: 'comment',
    });

    // Get only like reactions
    const response = await client
      .get('/entity-reactions')
      .query({ filter: { where: { _kind: 'like' } } })
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Like Reaction');
    expect(response.body[0]._kind).to.equal('like');
    expect(response.body[0]._entityId).to.equal(entity1Id);
  });

  it('filter: by entityId', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create test entities first
    const entity1Id = await createTestEntity(client, {
      _name: 'Book 1',
      _kind: 'book',
      description: 'First book',
    });

    const entity2Id = await createTestEntity(client, {
      _name: 'Book 2',
      _kind: 'book',
      description: 'Second book',
    });

    // Create test entity reactions
    await createTestEntityReaction(client, {
      _name: 'Reaction for Book 1',
      _entityId: entity1Id,
      _kind: 'like',
    });

    await createTestEntityReaction(client, {
      _name: 'Reaction for Book 2',
      _entityId: entity2Id,
      _kind: 'like',
    });

    // Get reactions for specific entity
    const response = await client
      .get('/entity-reactions')
      .query({ filter: { where: { _entityId: entity1Id } } })
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Reaction for Book 1');
    expect(response.body[0]._entityId).to.equal(entity1Id);
  });
});
