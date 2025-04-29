import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { EntityReaction } from '../../../models';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestEntity,
} from '../test-helper';

describe('POST /entity-reactions', () => {
  let client: Client;
  let appWithClient: AppWithClient | undefined;

  beforeEach(async () => {
    if (appWithClient) {
      await teardownApplication(appWithClient);
    }

    appWithClient = undefined;
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

  it('creates a new entity reaction with default kind', async () => {
    appWithClient = await setupApplication({});
    ({ client } = appWithClient);

    // First, create an entity to react to
    const entityId = await createTestEntity(client, {
      _name: 'Sample Book',
      description: 'A sample book entity',
    });

    const newReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _name: 'Like',
      description: 'A like reaction',
    };

    const response = await client
      .post('/entity-reactions')
      .send(newReaction)
      .expect(200);

    expect(response.body).to.containDeep(newReaction);
    expect(response.body._id).to.be.String();
    expect(response.body._entityId).to.equal(entityId);
    expect(response.body._kind).to.be.equal('entity-reaction'); // default kind
    expect(response.body._slug).to.be.equal('like');
    expect(response.body._createdDateTime).to.be.String();
    expect(response.body._lastUpdatedDateTime).to.be.String();
    expect(response.body._visibility).to.be.String();
    expect(response.body._version).to.be.equal(1);
  });

  it('creates an entity reaction with specified kind', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like,dislike',
    });
    ({ client } = appWithClient);

    const entityId = await createTestEntity(client, {
      _name: 'Sample Book',
      description: 'A sample book entity',
    });

    const newReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'like',
      _name: 'Like',
      description: 'A like reaction',
    };

    const response = await client
      .post('/entity-reactions')
      .send(newReaction)
      .expect(200);

    expect(response.body).to.containDeep(newReaction);
    expect(response.body._kind).to.be.equal('like');
  });

  it('rejects invalid entity reaction kind', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like,dislike',
    });
    ({ client } = appWithClient);

    const entityId = await createTestEntity(client, {
      _name: 'Sample Book',
      description: 'A sample book entity',
    });

    const newReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'love', // Invalid kind
      _name: 'Love',
      description: 'A love reaction',
    };

    const errorResponse = await client
      .post('/entity-reactions')
      .send(newReaction)
      .expect(422);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 422,
      name: 'InvalidKindError',
      code: 'INVALID-ENTITY-REACTION-KIND',
      status: 422,
    });
  });

  it('rejects duplicate entity reaction based on uniqueness configuration', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like',
      ENTITY_REACTION_UNIQUENESS:
        'where[_kind]=${_kind}&where[_entityId]=${_entityId}',
    });
    ({ client } = appWithClient);

    const entityId = await createTestEntity(client, {
      _name: 'The Great Gatsby',
      _kind: 'book',
      description: 'A classic novel',
    });

    // First reaction creation - should succeed
    const firstReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'like',
      _name: 'Like', // arbitrary, non-managed field
      description: 'A like reaction',
    };
    const response = await client
      .post('/entity-reactions')
      .send(firstReaction)
      .expect(200);
    expect(response.body._kind).to.be.equal('like');
    expect(response.body._entityId).to.be.equal(entityId);
    expect(response.body._name).to.be.equal('Like');

    // Second reaction with same kind and entityId - should fail
    const secondReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'like',
      _name: 'Like', // can be the same or different, doesn't affect uniqueness
      description: 'Another like',
    };
    const errorResponse = await client
      .post('/entity-reactions')
      .send(secondReaction)
      .expect(409);
    expect(errorResponse.body.error).to.containDeep({
      statusCode: 409,
      name: 'UniquenessViolationError',
      code: 'ENTITYREACTION-UNIQUENESS-VIOLATION',
      status: 409,
    });
  });

  it('rejects duplicate entity reaction based on uniqueness configuration including owner users', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like',
      ENTITY_REACTION_UNIQUENESS:
        'where[_slug]=${_slug}&where[_kind]=${_kind}&set[owners][userIds]=${_ownerUsers}',
    });
    ({ client } = appWithClient);

    const entityId = await createTestEntity(client, {
      _name: 'The Great Gatsby',
      _kind: 'book',
      description: 'A classic novel',
    });

    // First reaction creation - should succeed
    const firstReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'like',
      _name: 'Like',
      _ownerUsers: ['user-123'],
      description: 'A like reaction',
    };
    const response = await client
      .post('/entity-reactions')
      .send(firstReaction)
      .expect(200);
    expect(response.body._slug).to.be.equal('like');
    expect(response.body._kind).to.be.equal('like');
    expect(response.body._ownerUsers).to.containDeep(['user-123']);

    // Second reaction with same slug, kind, and owner - should fail
    const secondReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'like',
      _name: 'Like',
      _ownerUsers: ['user-123'],
      description: 'Another like',
    };
    const errorResponse = await client
      .post('/entity-reactions')
      .send(secondReaction)
      .expect(409);
    expect(errorResponse.body.error).to.containDeep({
      statusCode: 409,
      name: 'UniquenessViolationError',
      code: 'ENTITYREACTION-UNIQUENESS-VIOLATION',
      status: 409,
    });
  });

  it('allows duplicate entity reaction with different owner users when uniqueness includes owner users', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like',
      ENTITY_REACTION_UNIQUENESS:
        'where[_slug]=${_slug}&where[_kind]=${_kind}&set[owners][userIds]=${_ownerUsers}',
    });
    ({ client } = appWithClient);

    const entityId = await createTestEntity(client, {
      _name: 'The Great Gatsby',
      _kind: 'book',
      description: 'A classic novel',
    });

    // First reaction creation - should succeed
    const firstReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'like',
      _name: 'Like',
      _ownerUsers: ['user-123', 'user-456'],
      description: 'A like reaction',
    };
    const firstResponse = await client
      .post('/entity-reactions')
      .send(firstReaction)
      .expect(200);
    expect(firstResponse.body._ownerUsers).to.containDeep([
      'user-123',
      'user-456',
    ]);

    // Second reaction with different owner - should succeed
    const secondReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'like',
      _name: 'Like',
      _ownerUsers: ['user-789'],
      description: 'Another like',
    };
    const secondResponse = await client
      .post('/entity-reactions')
      .send(secondReaction)
      .expect(200);
    expect(secondResponse.body._ownerUsers).to.containDeep(['user-789']);
  });

  it('rejects duplicate entity reaction when uniqueness set includes owners and same user exists', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like',
      ENTITY_REACTION_UNIQUENESS:
        'where[_slug]=${_slug}&where[_kind]=${_kind}&set[owners][userIds]=${_ownerUsers}',
    });
    ({ client } = appWithClient);

    const entityId = await createTestEntity(client, {
      _name: 'The Great Gatsby',
      _kind: 'book',
      description: 'A classic novel',
    });

    // First reaction creation with multiple owners - should succeed
    const firstReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'like',
      _name: 'Like',
      _ownerUsers: ['user-123', 'user-456', 'user-789'],
      description: 'A like reaction',
    };
    const firstResponse = await client
      .post('/entity-reactions')
      .send(firstReaction)
      .expect(200);
    expect(firstResponse.body._ownerUsers).to.containDeep([
      'user-123',
      'user-456',
      'user-789',
    ]);

    // Second reaction with overlapping owner - should fail
    const secondReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'like',
      _name: 'Like',
      _ownerUsers: ['user-123', 'user-999'],
      description: 'Another like',
    };
    const errorResponse = await client
      .post('/entity-reactions')
      .send(secondReaction)
      .expect(409);
    expect(errorResponse.body.error).to.containDeep({
      statusCode: 409,
      name: 'UniquenessViolationError',
      code: 'ENTITYREACTION-UNIQUENESS-VIOLATION',
      status: 409,
    });
  });

  it('rejects duplicate entity reaction when uniqueness set includes actives and both reactions are active', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like',
      ENTITY_REACTION_UNIQUENESS:
        'where[_slug]=${_slug}&where[_kind]=${_kind}&set[actives]',
    });
    ({ client } = appWithClient);

    const entityId = await createTestEntity(client, {
      _name: 'The Great Gatsby',
      _kind: 'book',
      description: 'A classic novel',
    });

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    // First reaction creation with validity period - should succeed
    const firstReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'like',
      _name: 'Like',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      description: 'A like reaction',
    };
    const firstResponse = await client
      .post('/entity-reactions')
      .send(firstReaction)
      .expect(200);
    expect(firstResponse.body._validFromDateTime).to.be.equal(
      pastDate.toISOString(),
    );
    expect(firstResponse.body._validUntilDateTime).to.be.equal(
      futureDate.toISOString(),
    );

    // Second reaction with same name, kind, and also active - should fail
    const secondReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'like',
      _name: 'Like',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: null, // Indefinitely active
      description: 'Another like',
    };
    const errorResponse = await client
      .post('/entity-reactions')
      .send(secondReaction)
      .expect(409);
    expect(errorResponse.body.error).to.containDeep({
      statusCode: 409,
      name: 'UniquenessViolationError',
      code: 'ENTITYREACTION-UNIQUENESS-VIOLATION',
      status: 409,
    });
  });
});
