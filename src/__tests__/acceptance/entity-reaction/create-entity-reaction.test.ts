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

  it('automatically sets validFromDateTime when autoapprove_entity_reaction is true', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like',
      autoapprove_entity_reaction: 'true',
    });
    ({ client } = appWithClient);

    const entityId = await createTestEntity(client, {
      _name: 'Auto Approved Entity',
      _kind: 'book',
    });

    const newReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'like',
      description: 'A reaction that should be auto-approved',
    };

    const response = await client
      .post('/entity-reactions')
      .send(newReaction)
      .expect(200);

    const now = new Date();
    const validFrom = new Date(response.body._validFromDateTime);
    expect(validFrom).to.be.Date();
    expect(validFrom.getTime()).to.be.approximately(now.getTime(), 5000); // Allow 5 second difference
    expect(response.body.description).to.be.equal(
      'A reaction that should be auto-approved',
    );
  });

  it('automatically sets validFromDateTime when autoapprove_entity_reaction_for_kind matches', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like,dislike',
      autoapprove_entity_reaction_for_like: 'true',
    });
    ({ client } = appWithClient);

    const entityId = await createTestEntity(client, {
      _name: 'Auto Approved Entity',
      _kind: 'book',
    });

    const newReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'like',
      description: 'A like reaction that should be auto-approved',
    };

    const response = await client
      .post('/entity-reactions')
      .send(newReaction)
      .expect(200);

    const now = new Date();
    const validFrom = new Date(response.body._validFromDateTime);
    expect(validFrom).to.be.Date();
    expect(validFrom.getTime()).to.be.approximately(now.getTime(), 5000); // Allow 5 second difference
    expect(response.body.description).to.be.equal(
      'A like reaction that should be auto-approved',
    );
  });

  it('does not set validFromDateTime when autoapprove_entity_reaction_for_kind does not match', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like,dislike',
      autoapprove_entity_reaction_for_dislike: 'true',
    });
    ({ client } = appWithClient);

    const entityId = await createTestEntity(client, {
      _name: 'Non Auto Approved Entity',
      _kind: 'book',
    });

    const newReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'like',
      description: 'A like reaction that should not be auto-approved',
    };

    const response = await client
      .post('/entity-reactions')
      .send(newReaction)
      .expect(200);

    expect(response.body._validFromDateTime).to.be.null();
    expect(response.body.description).to.be.equal(
      'A like reaction that should not be auto-approved',
    );
  });

  it('sets visibility to private when visibility_entity_reaction is configured as private', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like',
      visibility_entity_reaction: 'private',
    });
    ({ client } = appWithClient);

    const entityId = await createTestEntity(client, {
      _name: 'Private Entity',
      _kind: 'book',
    });

    const newReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'like',
      description: 'A reaction that should be private by default',
    };

    const response = await client
      .post('/entity-reactions')
      .send(newReaction)
      .expect(200);

    expect(response.body._visibility).to.be.equal('private');
  });

  it('sets visibility to public when visibility_entity_reaction_for_kind is configured as public', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like,dislike',
      visibility_entity_reaction_for_like: 'public',
    });
    ({ client } = appWithClient);

    const entityId = await createTestEntity(client, {
      _name: 'Public Entity',
      _kind: 'book',
    });

    const newReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'like',
      description: 'A like reaction that should be public by default',
    };

    const response = await client
      .post('/entity-reactions')
      .send(newReaction)
      .expect(200);

    expect(response.body._visibility).to.be.equal('public');
  });

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
      code: 'VALIDATION_FAILED',
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
      status: 429,
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
      status: 429,
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
      status: 429,
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
      status: 429,
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
      status: 429,
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
      status: 429,
    });
  });

  it('enforces idempotency based on configured fields for entity reactions', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like',
      idempotency_entity_reaction: '_kind,_entityId,description',
    });
    ({ client } = appWithClient);

    const entityId = await createTestEntity(client, {
      _name: 'Entity',
      _kind: 'book',
    });

    // First reaction - should succeed
    const firstReaction = {
      _entityId: entityId,
      _kind: 'like',
      description: 'A reaction',
    };
    const firstResponse = await client
      .post('/entity-reactions')
      .send(firstReaction)
      .expect(200);
    // Second reaction with same idempotency fields but different other fields
    const secondReaction = {
      _entityId: entityId,
      _kind: 'like',
      description: 'A reaction',
      _ownerUsers: ['user-456'],
    };
    const secondResponse = await client
      .post('/entity-reactions')
      .send(secondReaction)
      .expect(200);
    expect(secondResponse.body._id).to.equal(firstResponse.body._id);
  });

  it('enforces kind-specific idempotency configuration for entity reactions', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like,dislike',
      idempotency_entity_reaction_for_like: '_kind,_entityId,_ownerUsers',
      idempotency_entity_reaction_for_dislike: '_kind,description',
    });
    ({ client } = appWithClient);

    const entityId = await createTestEntity(client, {
      _name: 'Entity',
      _kind: 'book',
    });

    // First like reaction - should succeed
    const firstLike = {
      _entityId: entityId,
      _kind: 'like',
      _ownerUsers: ['user-123'],
    };
    const firstLikeResponse = await client
      .post('/entity-reactions')
      .send(firstLike)
      .expect(200);
    // Second like reaction with same idempotency fields - should return same record
    const secondLike = {
      _entityId: entityId,
      _kind: 'like',
      _ownerUsers: ['user-123'],
    };
    const secondLikeResponse = await client
      .post('/entity-reactions')
      .send(secondLike)
      .expect(200);
    expect(secondLikeResponse.body._id).to.equal(firstLikeResponse.body._id);

    // First dislike reaction - should succeed
    const firstDislike = {
      _entityId: entityId,
      _kind: 'dislike',
      description: 'desc',
    };
    const firstDislikeResponse = await client
      .post('/entity-reactions')
      .send(firstDislike)
      .expect(200);
    // Second dislike reaction with same idempotency fields - should return same record
    const secondDislike = {
      _entityId: entityId,
      _kind: 'dislike',
      description: 'desc',
    };
    const secondDislikeResponse = await client
      .post('/entity-reactions')
      .send(secondDislike)
      .expect(200);
    expect(secondDislikeResponse.body._id).to.equal(
      firstDislikeResponse.body._id,
    );
  });

  it('enforces idempotency with array fields for entity reactions', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like',
      idempotency_entity_reaction: '_kind,_ownerUsers',
    });
    ({ client } = appWithClient);

    const entityId = await createTestEntity(client, {
      _name: 'Entity',
      _kind: 'book',
    });

    // First reaction - should succeed
    const firstReaction = {
      _entityId: entityId,
      _kind: 'like',
      _ownerUsers: ['user-123', 'user-456'],
    };
    const firstResponse = await client
      .post('/entity-reactions')
      .send(firstReaction)
      .expect(200);
    // Second reaction with same array values but different order - should return same record
    const secondReaction = {
      _entityId: entityId,
      _kind: 'like',
      _ownerUsers: ['user-456', 'user-123'],
    };
    const secondResponse = await client
      .post('/entity-reactions')
      .send(secondReaction)
      .expect(200);
    expect(secondResponse.body._id).to.equal(firstResponse.body._id);
  });

  it('enforces idempotency with date fields for entity reactions', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like',
      idempotency_entity_reaction:
        '_kind,_validFromDateTime,_validUntilDateTime',
    });
    ({ client } = appWithClient);

    const entityId = await createTestEntity(client, {
      _name: 'Entity',
      _kind: 'book',
    });

    const validFrom = new Date();
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 7);

    // First reaction - should succeed
    const firstReaction = {
      _entityId: entityId,
      _kind: 'like',
      _validFromDateTime: validFrom.toISOString(),
      _validUntilDateTime: validUntil.toISOString(),
    };
    const firstResponse = await client
      .post('/entity-reactions')
      .send(firstReaction)
      .expect(200);
    // Second reaction with same dates but different other fields - should return same record
    const secondReaction = {
      _entityId: entityId,
      _kind: 'like',
      _validFromDateTime: validFrom.toISOString(),
      _validUntilDateTime: validUntil.toISOString(),
      description: 'Different',
    };
    const secondResponse = await client
      .post('/entity-reactions')
      .send(secondReaction)
      .expect(200);
    expect(secondResponse.body._id).to.equal(firstResponse.body._id);
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
        code: 'ENTITYREACTION-INVALID-LOOKUP-REFERENCE',
        status: 422,
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
        code: 'ENTITYREACTION-INVALID-LOOKUP-REFERENCE',
        status: 422,
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
        code: 'ENTITYREACTION-INVALID-LOOKUP-KIND',
        status: 422,
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
  });
});
