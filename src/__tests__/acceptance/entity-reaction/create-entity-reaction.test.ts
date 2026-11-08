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

  it('creates a new entity reaction with explicitly provided managed fields', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'entity-reaction',
    });
    ({ client } = appWithClient);

    // First, create an entity to react to
    const entityId = await createTestEntity(client, {
      _name: 'Sample Book',
      _kind: 'entity',
      description: 'A sample book entity',
    });

    // EPBO pre-resolves all managed fields before the request reaches EPS.
    // Tests must supply them explicitly, matching what EPBO would inject.
    const newReaction = {
      _entityId: entityId,
      _kind: 'entity-reaction',
      _name: 'Like',
      _slug: 'like',
      _visibility: 'protected',
      _validFromDateTime: null,
      _validUntilDateTime: null,
      description: 'A like reaction',
    };

    const response = await client
      .post('/entity-reactions')
      .send(newReaction)
      .expect(200);

    expect(response.body).to.containDeep({
      _entityId: entityId,
      _name: 'Like',
      description: 'A like reaction',
    });
    expect(response.body._id).to.be.String();
    expect(response.body._entityId).to.equal(entityId);
    expect(response.body._kind).to.be.equal('entity-reaction');
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
    });
    expect(errorResponse.body.error.requestId ?? '').to.match(/.+/);
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

    // EPBO pre-resolves _slug; tests must supply it explicitly.
    const firstReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'like',
      _name: 'Like',
      _slug: 'like',
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
      _slug: 'like',
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

    // EPBO pre-resolves _slug; tests must supply it explicitly.
    const firstReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'like',
      _name: 'Like',
      _slug: 'like',
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

    // Second reaction with same slug, kind, overlapping owner - should fail
    const secondReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'like',
      _name: 'Like',
      _slug: 'like',
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

    // EPBO pre-resolves _slug; tests must supply it explicitly.
    const firstReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'like',
      _name: 'Like',
      _slug: 'like',
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

    // Second reaction with same slug, kind, and also active - should fail
    const secondReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'like',
      _name: 'Like',
      _slug: 'like',
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
    });
  });

  it('allows duplicate entity reaction when uniqueness set includes actives and existing reaction is inactive', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like',
      ENTITY_REACTION_UNIQUENESS:
        'where[_kind]=${_kind}&where[_entityId]=${_entityId}&set[actives]',
    });
    ({ client } = appWithClient);

    const entityId = await createTestEntity(client, {
      _name: 'The Great Gatsby',
      _kind: 'book',
      description: 'A classic novel',
    });

    const pastStartDate = new Date();
    pastStartDate.setDate(pastStartDate.getDate() - 7);
    const pastEndDate = new Date();
    pastEndDate.setDate(pastEndDate.getDate() - 1);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    // First reaction creation with validity period in the past - should succeed
    const firstReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'like',
      _validFromDateTime: pastStartDate.toISOString(),
      _validUntilDateTime: pastEndDate.toISOString(), // Inactive
      description: 'A like reaction',
    };
    const firstResponse = await client
      .post('/entity-reactions')
      .send(firstReaction)
      .expect(200);
    expect(firstResponse.body._validFromDateTime).to.be.equal(
      pastStartDate.toISOString(),
    );
    expect(firstResponse.body._validUntilDateTime).to.be.equal(
      pastEndDate.toISOString(),
    );

    // Second reaction with same kind and entityId, and active - should succeed
    const secondReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'like',
      _validFromDateTime: new Date().toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      description: 'Another like',
    };
    const secondResponse = await client
      .post('/entity-reactions')
      .send(secondReaction)
      .expect(200);
    expect(secondResponse.body._validFromDateTime).to.not.be.null();
    expect(secondResponse.body._validUntilDateTime).to.be.equal(
      futureDate.toISOString(),
    );
  });

  // Autoapprove and visibility tests are removed: EPS no longer reads AUTOAPPROVE_* or VISIBILITY_*
  // env vars. Those responsibilities moved to EPBO. Tests for those behaviors belong in EPBO's
  // own test suite.

  it('rejects entity reaction creation with invalid visibility value', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like',
    });
    ({ client } = appWithClient);

    const entityId = await createTestEntity(client, {
      _name: 'Invalid Visibility Entity',
      _kind: 'book',
    });

    const newReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'like',
      _visibility: 'invalid-value', // Invalid visibility value
      description: 'A reaction with invalid visibility',
    };

    const errorResponse = await client
      .post('/entity-reactions')
      .send(newReaction)
      .expect(422);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 422,
      name: 'UnprocessableEntityError',
      code: 'VALIDATION-FAILED',
    });
  });

  it('enforces global record count limit for entity reactions', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like',
      ENTITY_REACTION_RECORD_LIMITS: '[{"scope":"","limit":2}]',
    });
    ({ client } = appWithClient);

    const entityId = await createTestEntity(client, {
      _name: 'First Entity',
      _kind: 'book',
    });

    // First reaction - should succeed
    await client
      .post('/entity-reactions')
      .send({ _entityId: entityId, _kind: 'like', description: 'First' })
      .expect(200);
    // Second reaction - should succeed
    await client
      .post('/entity-reactions')
      .send({ _entityId: entityId, _kind: 'like', description: 'Second' })
      .expect(200);
    // Third reaction - should fail
    const errorResponse = await client
      .post('/entity-reactions')
      .send({ _entityId: entityId, _kind: 'like', description: 'Third' })
      .expect(429);
    expect(errorResponse.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      code: 'ENTITYREACTION-LIMIT-EXCEEDED',
    });
  });

  it('enforces kind-specific record count limit for entity reactions', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like,dislike',
      ENTITY_REACTION_RECORD_LIMITS:
        '[{"scope":"where[_kind]=like","limit":1}]',
    });
    ({ client } = appWithClient);

    const entityId = await createTestEntity(client, {
      _name: 'Entity',
      _kind: 'book',
    });

    // First like reaction - should succeed
    await client
      .post('/entity-reactions')
      .send({ _entityId: entityId, _kind: 'like', description: 'Like' })
      .expect(200);
    // Dislike reaction - should succeed
    await client
      .post('/entity-reactions')
      .send({ _entityId: entityId, _kind: 'dislike', description: 'Dislike' })
      .expect(200);
    // Second like reaction - should fail
    const errorResponse = await client
      .post('/entity-reactions')
      .send({ _entityId: entityId, _kind: 'like', description: 'Another Like' })
      .expect(429);
    expect(errorResponse.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      code: 'ENTITYREACTION-LIMIT-EXCEEDED',
    });
  });

  it('enforces record set limit for active entity reactions', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like',
      ENTITY_REACTION_RECORD_LIMITS: '[{"scope":"set[actives]","limit":2}]',
    });
    ({ client } = appWithClient);

    const entityId = await createTestEntity(client, {
      _name: 'Entity',
      _kind: 'book',
    });

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    // First active reaction - should succeed
    await client
      .post('/entity-reactions')
      .send({
        _entityId: entityId,
        _kind: 'like',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: futureDate.toISOString(),
        description: 'First active',
      })
      .expect(200);
    // Second active reaction - should succeed
    await client
      .post('/entity-reactions')
      .send({
        _entityId: entityId,
        _kind: 'like',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: futureDate.toISOString(),
        description: 'Second active',
      })
      .expect(200);
    // Inactive reaction - should succeed
    await client
      .post('/entity-reactions')
      .send({
        _entityId: entityId,
        _kind: 'like',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: pastDate.toISOString(),
        description: 'Inactive',
      })
      .expect(200);
    // Third active reaction - should fail
    const errorResponse = await client
      .post('/entity-reactions')
      .send({
        _entityId: entityId,
        _kind: 'like',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: futureDate.toISOString(),
        description: 'Third active',
      })
      .expect(429);
    expect(errorResponse.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      code: 'ENTITYREACTION-LIMIT-EXCEEDED',
    });
  });

  it('enforces kind-specific record set limit for active entity reactions', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like,dislike',
      ENTITY_REACTION_RECORD_LIMITS:
        '[{"scope":"set[actives]&where[_kind]=like","limit":1}]',
    });
    ({ client } = appWithClient);

    const entityId = await createTestEntity(client, {
      _name: 'Entity',
      _kind: 'book',
    });

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    // First active like reaction - should succeed
    await client
      .post('/entity-reactions')
      .send({
        _entityId: entityId,
        _kind: 'like',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: futureDate.toISOString(),
        description: 'Active like',
      })
      .expect(200);
    // Active dislike reaction - should succeed
    await client
      .post('/entity-reactions')
      .send({
        _entityId: entityId,
        _kind: 'dislike',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: futureDate.toISOString(),
        description: 'Active dislike',
      })
      .expect(200);
    // Second active like reaction - should fail
    const errorResponse = await client
      .post('/entity-reactions')
      .send({
        _entityId: entityId,
        _kind: 'like',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: futureDate.toISOString(),
        description: 'Another active like',
      })
      .expect(429);
    expect(errorResponse.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      code: 'ENTITYREACTION-LIMIT-EXCEEDED',
    });
  });

  it('enforces record set limit for active and public entity reactions', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like',
      ENTITY_REACTION_RECORD_LIMITS:
        '[{"scope":"set[actives]&set[publics]","limit":2}]',
    });
    ({ client } = appWithClient);

    const entityId = await createTestEntity(client, {
      _name: 'Entity',
      _kind: 'book',
    });

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    // First active and public reaction - should succeed
    await client
      .post('/entity-reactions')
      .send({
        _entityId: entityId,
        _kind: 'like',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: futureDate.toISOString(),
        _visibility: 'public',
        description: 'First active public',
      })
      .expect(200);
    // Second active and public reaction - should succeed
    await client
      .post('/entity-reactions')
      .send({
        _entityId: entityId,
        _kind: 'like',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: futureDate.toISOString(),
        _visibility: 'public',
        description: 'Second active public',
      })
      .expect(200);
    // Active but private reaction - should succeed
    await client
      .post('/entity-reactions')
      .send({
        _entityId: entityId,
        _kind: 'like',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: futureDate.toISOString(),
        _visibility: 'private',
        description: 'Private active',
      })
      .expect(200);
    // Public but inactive reaction - should succeed
    await client
      .post('/entity-reactions')
      .send({
        _entityId: entityId,
        _kind: 'like',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: pastDate.toISOString(),
        _visibility: 'public',
        description: 'Inactive public',
      })
      .expect(200);
    // Third active and public reaction - should fail
    const errorResponse = await client
      .post('/entity-reactions')
      .send({
        _entityId: entityId,
        _kind: 'like',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: futureDate.toISOString(),
        _visibility: 'public',
        description: 'Third active public',
      })
      .expect(429);
    expect(errorResponse.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      code: 'ENTITYREACTION-LIMIT-EXCEEDED',
    });
  });

  it('enforces record limit per user using owners set for entity reactions', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like',
      ENTITY_REACTION_RECORD_LIMITS:
        '[{"scope":"set[owners][userIds]=${_ownerUsers}","limit":2}]',
    });
    ({ client } = appWithClient);

    const entityId = await createTestEntity(client, {
      _name: 'Entity',
      _kind: 'book',
    });
    const userId = 'user-123';

    // First reaction for user - should succeed
    await client
      .post('/entity-reactions')
      .send({
        _entityId: entityId,
        _kind: 'like',
        _ownerUsers: [userId],
        description: 'First for user',
      })
      .expect(200);
    // Second reaction for user - should succeed
    await client
      .post('/entity-reactions')
      .send({
        _entityId: entityId,
        _kind: 'like',
        _ownerUsers: [userId],
        description: 'Second for user',
      })
      .expect(200);
    // Reaction for different user - should succeed
    await client
      .post('/entity-reactions')
      .send({
        _entityId: entityId,
        _kind: 'like',
        _ownerUsers: ['user-456'],
        description: 'Different user',
      })
      .expect(200);
    // Reaction with multiple owners including our user - should fail
    const errorResponse = await client
      .post('/entity-reactions')
      .send({
        _entityId: entityId,
        _kind: 'like',
        _ownerUsers: [userId, 'user-789'],
        description: 'Multi owner',
      })
      .expect(429);
    expect(errorResponse.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      code: 'ENTITYREACTION-LIMIT-EXCEEDED',
    });
  });

  // Idempotency tests are removed: EPS no longer computes or checks _idempotencyKey.
  // Idempotency is now a client responsibility — clients send explicit idempotency keys.
  // Tests for idempotency behavior do not belong in EPS's test suite.

  it('should return 404 if entity specified by _entityId does not exist', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like',
    });
    ({ client } = appWithClient);

    const nonExistentEntityId = 'non-existent-entity-id';
    const newReaction: Partial<EntityReaction> = {
      _entityId: nonExistentEntityId,
      _kind: 'like',
      description: 'Reaction to non-existent entity',
    };
    const errorResponse = await client
      .post('/entity-reactions')
      .send(newReaction)
      .expect(404);
    expect(errorResponse.body.error).to.containDeep({
      statusCode: 404,
      name: 'NotFoundError',
      code: 'ENTITY-NOT-FOUND',
    });
  });

  describe('lookup constraint validation', () => {
    it('should reject entity reaction with invalid entity reference when record=entity is configured', async () => {
      appWithClient = await setupApplication({
        entity_reaction_kinds: 'like,dislike',
        ENTITY_REACTION_LOOKUP_CONSTRAINT: JSON.stringify([
          {
            propertyPath: 'references',
            record: 'entity',
          },
        ]),
      });
      ({ client } = appWithClient);

      const entityId = await createTestEntity(client, {
        _name: 'Book',
        _kind: 'book',
      });

      // Try to create a reaction referencing a list (invalid)
      const invalidReference = 'tapp://localhost/lists/1';
      const newReaction = {
        _entityId: entityId,
        _kind: 'like',
        references: [invalidReference],
      };
      const errorResponse = await client
        .post('/entity-reactions')
        .send(newReaction)
        .expect(422);
      expect(errorResponse.body.error).to.containDeep({
        statusCode: 422,
        name: 'InvalidLookupReferenceError',
        code: 'ENTITY-REACTION-INVALID-LOOKUP-REFERENCE',
      });
    });

    it('should reject entity reaction with invalid list reference when record=list is configured', async () => {
      appWithClient = await setupApplication({
        entity_reaction_kinds: 'like,dislike',
        ENTITY_REACTION_LOOKUP_CONSTRAINT: JSON.stringify([
          {
            propertyPath: 'references',
            record: 'list',
          },
        ]),
      });
      ({ client } = appWithClient);

      const entityId = await createTestEntity(client, {
        _name: 'Book',
        _kind: 'book',
      });

      // Try to create a reaction referencing an entity (invalid)
      const invalidReference = `tapp://localhost/entities/${entityId}`;
      const newReaction = {
        _entityId: entityId,
        _kind: 'like',
        references: [invalidReference],
      };
      const errorResponse = await client
        .post('/entity-reactions')
        .send(newReaction)
        .expect(422);
      expect(errorResponse.body.error).to.containDeep({
        statusCode: 422,
        name: 'InvalidLookupReferenceError',
        code: 'ENTITY-REACTION-INVALID-LOOKUP-REFERENCE',
      });
    });

    it('should reject entity reaction with invalid target kind when targetKind is configured', async () => {
      appWithClient = await setupApplication({
        entity_reaction_kinds: 'like,dislike',
        ENTITY_REACTION_LOOKUP_CONSTRAINT: JSON.stringify([
          {
            propertyPath: 'references',
            record: 'entity',
            targetKind: 'author',
          },
        ]),
      });
      ({ client } = appWithClient);

      // First create a book entity to reference
      const bookEntityId = await createTestEntity(client, {
        _name: 'Referenced Book',
        _kind: 'book',
      });
      const entityId = await createTestEntity(client, {
        _name: 'Book',
        _kind: 'book',
      });

      // Try to create a reaction referencing a book when author is required
      const invalidReference = `tapp://localhost/entities/${bookEntityId}`;
      const newReaction = {
        _entityId: entityId,
        _kind: 'like',
        references: [invalidReference],
      };
      const errorResponse = await client
        .post('/entity-reactions')
        .send(newReaction)
        .expect(422);
      expect(errorResponse.body.error).to.containDeep({
        statusCode: 422,
        name: 'InvalidLookupConstraintError',
        code: 'ENTITY-REACTION-INVALID-LOOKUP-KIND',
      });
    });

    it('should accept entity reaction with valid references when all constraints are satisfied', async () => {
      appWithClient = await setupApplication({
        entity_reaction_kinds: 'like,dislike',
        ENTITY_REACTION_LOOKUP_CONSTRAINT: JSON.stringify([
          {
            propertyPath: 'references',
            record: 'entity',
            sourceKind: 'book',
            targetKind: 'author',
          },
        ]),
      });
      ({ client } = appWithClient);

      // First create an author entity to reference
      const authorEntityId = await createTestEntity(client, {
        _name: 'Referenced Author',
        _kind: 'author',
      });
      const entityId = await createTestEntity(client, {
        _name: 'Book',
        _kind: 'book',
      });

      const validReference = `tapp://localhost/entities/${authorEntityId}`;
      const newReaction = {
        _entityId: entityId,
        _kind: 'like',
        references: [validReference],
      };
      const response = await client
        .post('/entity-reactions')
        .send(newReaction)
        .expect(200);
      expect(response.body).to.containDeep({
        _entityId: entityId,
        _kind: 'like',
        references: [validReference],
      });
    });

    it('should accept entity reaction with multiple valid references when all constraints are satisfied', async () => {
      appWithClient = await setupApplication({
        entity_reaction_kinds: 'like,dislike',
        ENTITY_REACTION_LOOKUP_CONSTRAINT: JSON.stringify([
          {
            propertyPath: 'references',
            record: 'entity',
            sourceKind: 'book',
            targetKind: 'author',
          },
        ]),
      });
      ({ client } = appWithClient);

      // Create multiple author entities to reference
      const author1Id = await createTestEntity(client, {
        _name: 'First Author',
        _kind: 'author',
      });
      const author2Id = await createTestEntity(client, {
        _name: 'Second Author',
        _kind: 'author',
      });
      const entityId = await createTestEntity(client, {
        _name: 'Book',
        _kind: 'book',
      });

      const validReferences = [
        `tapp://localhost/entities/${author1Id}`,
        `tapp://localhost/entities/${author2Id}`,
      ];
      const newReaction = {
        _entityId: entityId,
        _kind: 'like',
        references: validReferences,
      };
      const response = await client
        .post('/entity-reactions')
        .send(newReaction)
        .expect(200);
      expect(response.body).to.containDeep({
        _entityId: entityId,
        _kind: 'like',
        references: validReferences,
      });
    });

    it('should reject entity reaction with invalid entity-reaction reference when record=entity-reaction is configured', async () => {
      appWithClient = await setupApplication({
        entity_reaction_kinds: 'like,dislike',
        ENTITY_REACTION_LOOKUP_CONSTRAINT: JSON.stringify([
          {
            propertyPath: 'references',
            record: 'entity-reaction',
          },
        ]),
      });
      ({ client } = appWithClient);

      const entityId = await createTestEntity(client, {
        _name: 'Book',
        _kind: 'book',
      });
      // Try to create a reaction referencing an entity (invalid for entity-reaction constraint)
      const invalidReference = `tapp://localhost/entities/${entityId}`;
      const newReaction = {
        _entityId: entityId,
        _kind: 'like',
        references: [invalidReference],
      };
      const errorResponse = await client
        .post('/entity-reactions')
        .send(newReaction)
        .expect(422);
      expect(errorResponse.body.error).to.containDeep({
        statusCode: 422,
        name: 'InvalidLookupReferenceError',
        code: 'ENTITY-REACTION-INVALID-LOOKUP-REFERENCE',
      });
    });

    it('should reject entity reaction with invalid target kind for entity-reaction reference when targetKind is configured', async () => {
      appWithClient = await setupApplication({
        entity_reaction_kinds: 'like,dislike,comment',
        ENTITY_REACTION_LOOKUP_CONSTRAINT: JSON.stringify([
          {
            propertyPath: 'references',
            record: 'entity-reaction',
            targetKind: 'comment',
          },
        ]),
      });
      ({ client } = appWithClient);

      const entityId = await createTestEntity(client, {
        _name: 'Book',
        _kind: 'book',
      });
      // Create a like reaction to reference (invalid kind)
      const likeReactionId = await client
        .post('/entity-reactions')
        .send({ _entityId: entityId, _kind: 'like' })
        .then((res) => res.body._id);
      const invalidReference = `tapp://localhost/entity-reactions/${likeReactionId}`;
      const newReaction = {
        _entityId: entityId,
        _kind: 'dislike',
        references: [invalidReference],
      };
      const errorResponse = await client
        .post('/entity-reactions')
        .send(newReaction)
        .expect(422);
      expect(errorResponse.body.error).to.containDeep({
        statusCode: 422,
        name: 'InvalidLookupConstraintError',
        code: 'ENTITY-REACTION-INVALID-LOOKUP-KIND',
      });
    });

    it('should accept entity reaction with valid entity-reaction reference when all constraints are satisfied', async () => {
      appWithClient = await setupApplication({
        entity_reaction_kinds: 'like,comment',
        ENTITY_REACTION_LOOKUP_CONSTRAINT: JSON.stringify([
          {
            propertyPath: 'references',
            record: 'entity-reaction',
            targetKind: 'comment',
          },
        ]),
      });
      ({ client } = appWithClient);

      const entityId = await createTestEntity(client, {
        _name: 'Book',
        _kind: 'book',
      });
      // Create a comment reaction to reference (valid kind)
      const commentReactionId = await client
        .post('/entity-reactions')
        .send({ _entityId: entityId, _kind: 'comment' })
        .then((res) => res.body._id);
      const validReference = `tapp://localhost/entity-reactions/${commentReactionId}`;
      const newReaction = {
        _entityId: entityId,
        _kind: 'like',
        references: [validReference],
      };
      const response = await client
        .post('/entity-reactions')
        .send(newReaction)
        .expect(200);
      expect(response.body).to.containDeep({
        _entityId: entityId,
        _kind: 'like',
        references: [validReference],
      });
    });

    it('should accept entity reaction with multiple valid entity-reaction references when all constraints are satisfied', async () => {
      appWithClient = await setupApplication({
        entity_reaction_kinds: 'like,comment',
        ENTITY_REACTION_LOOKUP_CONSTRAINT: JSON.stringify([
          {
            propertyPath: 'references',
            record: 'entity-reaction',
            targetKind: 'comment',
          },
        ]),
      });
      ({ client } = appWithClient);

      const entityId = await createTestEntity(client, {
        _name: 'Book',
        _kind: 'book',
      });
      // Create multiple comment reactions to reference
      const comment1Id = await client
        .post('/entity-reactions')
        .send({ _entityId: entityId, _kind: 'comment' })
        .then((res) => res.body._id);
      const comment2Id = await client
        .post('/entity-reactions')
        .send({ _entityId: entityId, _kind: 'comment' })
        .then((res) => res.body._id);
      const validReferences = [
        `tapp://localhost/entity-reactions/${comment1Id}`,
        `tapp://localhost/entity-reactions/${comment2Id}`,
      ];
      const newReaction = {
        _entityId: entityId,
        _kind: 'like',
        references: validReferences,
      };
      const response = await client
        .post('/entity-reactions')
        .send(newReaction)
        .expect(200);
      expect(response.body).to.containDeep({
        _entityId: entityId,
        _kind: 'like',
        references: validReferences,
      });
    });
  });
});
