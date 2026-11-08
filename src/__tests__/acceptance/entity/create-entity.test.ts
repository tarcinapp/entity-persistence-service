import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { GenericEntity } from '../../../models';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
} from '../test-helper';

describe('POST /entities', () => {
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

  it('creates a new entity with explicitly provided managed fields', async () => {
    appWithClient = await setupApplication({
      entity_kinds: 'entity',
    });
    ({ client } = appWithClient);

    // EPBO pre-resolves all managed fields before the request reaches EPS.
    // Tests must supply them explicitly, matching what EPBO would inject.
    const newEntity = {
      _name: 'Sample Book',
      _kind: 'entity',
      _slug: 'sample-book',
      _visibility: 'protected',
      _validFromDateTime: null,
      _validUntilDateTime: null,
      description: 'A sample book entity',
    };

    const response = await client.post('/entities').send(newEntity).expect(200);

    // checks name and description
    expect(response.body).to.containDeep({
      _name: 'Sample Book',
      description: 'A sample book entity',
    });

    // checks managed fields stored by EPS
    expect(response.body._id).to.be.String();
    expect(response.body._kind).to.be.equal('entity');
    expect(response.body._slug).to.be.equal('sample-book');
    expect(response.body._createdDateTime).to.be.String();
    expect(response.body._lastUpdatedDateTime).to.be.String();
    expect(response.body._visibility).to.be.equal('protected');
    expect(response.body._validFromDateTime).to.be.equal(null);
    expect(response.body._validUntilDateTime).to.be.equal(null);
    expect(response.body._version).to.be.equal(1);
    expect(response.body._ownerUsers).to.be.Array().lengthOf(0);
    expect(response.body._ownerGroups).to.be.Array().lengthOf(0);
    expect(response.body._viewerUsers).to.be.Array().lengthOf(0);
    expect(response.body._viewerGroups).to.be.Array().lengthOf(0);
  });

  it('creates an entity with specified kind', async () => {
    appWithClient = await setupApplication({
      entity_kinds: 'book,author',
    });
    ({ client } = appWithClient);

    const newEntity: Partial<GenericEntity> = {
      _name: 'Featured Author',
      _kind: 'author',
      description: 'A featured author entity',
    };

    const response = await client.post('/entities').send(newEntity).expect(200);

    // checks name, kind and description
    expect(response.body).to.containDeep(newEntity);
    expect(response.body._kind).to.be.equal('author');
  });

  it('rejects invalid entity kind', async () => {
    appWithClient = await setupApplication({
      entity_kinds: 'book,movie',
    });
    ({ client } = appWithClient);

    const newEntity: Partial<GenericEntity> = {
      _name: 'Invalid Kind Entity',
      _kind: 'author', // This is now invalid
      description: 'An entity with invalid kind',
    };

    const errorResponse = await client
      .post('/entities')
      .send(newEntity)
      .expect(422);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 422,
      name: 'InvalidKindError',
      code: 'INVALID-ENTITY-KIND',
    });
  });

  it('rejects duplicate entity based on uniqueness configuration', async () => {
    // Set up the environment variables
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      ENTITY_UNIQUENESS: 'where[_slug]=${_slug}&where[_kind]=${_kind}',
    });
    ({ client } = appWithClient);

    // EPBO pre-resolves _slug; tests must supply it explicitly.
    const firstEntity: Partial<GenericEntity> = {
      _name: 'The Great Gatsby',
      _kind: 'book',
      _slug: 'the-great-gatsby',
      description: 'A classic novel by F. Scott Fitzgerald',
    };

    const response = await client
      .post('/entities')
      .send(firstEntity)
      .expect(200);

    expect(response.body._slug).to.be.equal('the-great-gatsby');
    expect(response.body._kind).to.be.equal('book');

    // Second entity with same slug and kind - should fail
    const secondEntity: Partial<GenericEntity> = {
      _name: 'The Great Gatsby',
      _kind: 'book',
      _slug: 'the-great-gatsby',
      description: 'Another copy of the same book',
    };

    const errorResponse = await client
      .post('/entities')
      .send(secondEntity)
      .expect(409);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 409,
      name: 'UniquenessViolationError',
      message: 'Entity already exists',
      code: 'ENTITY-UNIQUENESS-VIOLATION',
      details: [
        {
          code: 'ENTITY-UNIQUENESS-VIOLATION',
          message: 'Entity already exists',
          info: {
            scope: 'where[_slug]=the-great-gatsby&where[_kind]=book',
          },
        },
      ],
    });
  });

  it('rejects duplicate entity based on uniqueness configuration including owner users', async () => {
    // Set up the environment variables
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      ENTITY_UNIQUENESS:
        'where[_slug]=${_slug}&where[_kind]=${_kind}&set[owners][userIds]=${_ownerUsers}',
    });
    ({ client } = appWithClient);

    // EPBO pre-resolves _slug; tests must supply it explicitly.
    const firstEntity: Partial<GenericEntity> = {
      _name: 'The Great Gatsby',
      _kind: 'book',
      _slug: 'the-great-gatsby',
      _ownerUsers: ['user-123'],
      description: 'A classic novel by F. Scott Fitzgerald',
    };

    const response = await client
      .post('/entities')
      .send(firstEntity)
      .expect(200);

    expect(response.body._slug).to.be.equal('the-great-gatsby');
    expect(response.body._kind).to.be.equal('book');
    expect(response.body._ownerUsers).to.containDeep(['user-123']);

    // Second entity with same slug, kind and owner - should fail
    const secondEntity: Partial<GenericEntity> = {
      _name: 'The Great Gatsby',
      _kind: 'book',
      _slug: 'the-great-gatsby',
      _ownerUsers: ['user-123'],
      description: 'Another copy of the same book',
    };

    const errorResponse = await client
      .post('/entities')
      .send(secondEntity)
      .expect(409);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 409,
      name: 'UniquenessViolationError',
      message: 'Entity already exists',
      code: 'ENTITY-UNIQUENESS-VIOLATION',
      details: [
        {
          code: 'ENTITY-UNIQUENESS-VIOLATION',
          message: 'Entity already exists',
          info: {
            scope:
              'where[_slug]=the-great-gatsby&where[_kind]=book&set[owners][userIds]=user-123',
          },
        },
      ],
    });
  });

  it('rejects duplicate entity when uniqueness set includes owners and same user exists', async () => {
    // Set up the environment variables with set[owners] uniqueness
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      ENTITY_UNIQUENESS:
        'where[_slug]=${_slug}&where[_kind]=${_kind}&set[owners][userIds]=${_ownerUsers}',
    });
    ({ client } = appWithClient);

    // EPBO pre-resolves _slug; tests must supply it explicitly.
    const firstEntity: Partial<GenericEntity> = {
      _name: 'The Great Gatsby',
      _kind: 'book',
      _slug: 'the-great-gatsby',
      _ownerUsers: ['user-123', 'user-456', 'user-789'],
      description: 'A classic novel by F. Scott Fitzgerald',
    };

    const firstResponse = await client
      .post('/entities')
      .send(firstEntity)
      .expect(200);

    expect(firstResponse.body._slug).to.be.equal('the-great-gatsby');
    expect(firstResponse.body._kind).to.be.equal('book');
    expect(firstResponse.body._ownerUsers).to.containDeep([
      'user-123',
      'user-456',
      'user-789',
    ]);

    // Second entity with same slug, kind, and one overlapping owner - should fail
    const secondEntity: Partial<GenericEntity> = {
      _name: 'The Great Gatsby',
      _kind: 'book',
      _slug: 'the-great-gatsby',
      _ownerUsers: ['user-123', 'user-999'], // user-123 exists in first entity
      description: 'Another copy of the same book',
    };

    const errorResponse = await client
      .post('/entities')
      .send(secondEntity)
      .expect(409);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 409,
      name: 'UniquenessViolationError',
      message: 'Entity already exists',
      code: 'ENTITY-UNIQUENESS-VIOLATION',
      details: [
        {
          code: 'ENTITY-UNIQUENESS-VIOLATION',
          message: 'Entity already exists',
          info: {
            scope:
              'where[_slug]=the-great-gatsby&where[_kind]=book&set[owners][userIds]=user-123,user-999',
          },
        },
      ],
    });
    expect(errorResponse.body.error.requestId ?? '').to.match(/.+/);
  });

  it('rejects duplicate entity when uniqueness set includes actives and both entities are active', async () => {
    // Set up the environment variables with set[actives] uniqueness
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      ENTITY_UNIQUENESS:
        'where[_slug]=${_slug}&where[_kind]=${_kind}&set[actives]',
    });
    ({ client } = appWithClient);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1); // Yesterday

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // 7 days from now

    // EPBO pre-resolves _slug; tests must supply it explicitly.
    const firstEntity: Partial<GenericEntity> = {
      _name: 'The Great Gatsby',
      _kind: 'book',
      _slug: 'the-great-gatsby',
      _ownerUsers: ['user-123'],
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      description: 'A classic novel by F. Scott Fitzgerald',
    };

    const firstResponse = await client
      .post('/entities')
      .send(firstEntity)
      .expect(200);

    expect(firstResponse.body._slug).to.be.equal('the-great-gatsby');
    expect(firstResponse.body._kind).to.be.equal('book');
    expect(firstResponse.body._validFromDateTime).to.be.equal(
      pastDate.toISOString(),
    );
    expect(firstResponse.body._validUntilDateTime).to.be.equal(
      futureDate.toISOString(),
    );

    // Second entity with same slug and kind, different owner, but also active - should fail
    const secondEntity: Partial<GenericEntity> = {
      _name: 'The Great Gatsby',
      _kind: 'book',
      _slug: 'the-great-gatsby',
      _ownerUsers: ['user-999'], // Different owner
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: null, // No end date, meaning indefinitely active
      description: 'Another copy of the same book',
    };

    const errorResponse = await client
      .post('/entities')
      .send(secondEntity)
      .expect(409);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 409,
      name: 'UniquenessViolationError',
      message: 'Entity already exists',
      code: 'ENTITY-UNIQUENESS-VIOLATION',
      details: [
        {
          code: 'ENTITY-UNIQUENESS-VIOLATION',
          message: 'Entity already exists',
          info: {
            scope:
              'where[_slug]=the-great-gatsby&where[_kind]=book&set[actives]',
          },
        },
      ],
    });
  });

  it('allows duplicate entity when uniqueness set includes actives and existing entity is inactive', async () => {
    // Set up the environment variables with set[actives] uniqueness
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      uniqueness_entity_fields: '_slug,_kind',
      uniqueness_entity_scope: 'set[actives]',
    });
    ({ client } = appWithClient);

    const pastStartDate = new Date();
    pastStartDate.setDate(pastStartDate.getDate() - 7); // 7 days ago

    const pastEndDate = new Date();
    pastEndDate.setDate(pastEndDate.getDate() - 1); // Yesterday

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // 7 days from now

    // EPBO pre-resolves _slug; tests must supply it explicitly.
    const firstEntity: Partial<GenericEntity> = {
      _name: 'The Great Gatsby',
      _kind: 'book',
      _slug: 'the-great-gatsby',
      _ownerUsers: ['user-123'],
      _validFromDateTime: pastStartDate.toISOString(),
      _validUntilDateTime: pastEndDate.toISOString(), // Entity is now inactive
      description: 'A classic novel by F. Scott Fitzgerald',
    };

    const firstResponse = await client
      .post('/entities')
      .send(firstEntity)
      .expect(200);

    expect(firstResponse.body._slug).to.be.equal('the-great-gatsby');
    expect(firstResponse.body._kind).to.be.equal('book');
    expect(firstResponse.body._validFromDateTime).to.be.equal(
      pastStartDate.toISOString(),
    );
    expect(firstResponse.body._validUntilDateTime).to.be.equal(
      pastEndDate.toISOString(),
    );

    // Second entity with same slug and kind, different owner, and active - should succeed since first entity is inactive
    const secondEntity: Partial<GenericEntity> = {
      _name: 'The Great Gatsby',
      _kind: 'book',
      _slug: 'the-great-gatsby',
      _ownerUsers: ['user-999'], // Different owner
      _validFromDateTime: new Date().toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      description: 'Another copy of the same book',
    };

    const secondResponse = await client
      .post('/entities')
      .send(secondEntity)
      .expect(200);

    expect(secondResponse.body._slug).to.be.equal('the-great-gatsby');
    expect(secondResponse.body._kind).to.be.equal('book');
    expect(secondResponse.body._validFromDateTime).to.not.be.null();
    expect(secondResponse.body._validUntilDateTime).to.be.equal(
      futureDate.toISOString(),
    );

    // Verify both records exist
    const getAllResponse = await client.get('/entities').expect(200);
    expect(getAllResponse.body).to.be.Array().lengthOf(2); // Two records should exist
  });


  it('rejects entity creation with invalid visibility value', async () => {
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    const newEntity: Partial<GenericEntity> = {
      _name: 'Invalid Visibility Entity',
      _kind: 'book',
      _visibility: 'invalid-value', // Invalid visibility value
      description: 'An entity with invalid visibility',
    };

    const errorResponse = await client
      .post('/entities')
      .send(newEntity)
      .expect(422);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 422,
      name: 'UnprocessableEntityError',
      message:
        'The request body is invalid. See error object `details` property for more info.',
      code: 'VALIDATION-FAILED',
    });
  });

  it('enforces global record count limit', async () => {
    // Set up the environment variables with record limit
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      ENTITY_RECORD_LIMITS: '[{"scope":"","limit":2}]',
    });
    ({ client } = appWithClient);

    // First entity - should succeed
    const firstEntity = {
      _name: 'First Entity',
      _kind: 'book',
      description: 'First entity within limit',
    };
    await client.post('/entities').send(firstEntity).expect(200);

    // Second entity - should succeed
    const secondEntity = {
      _name: 'Second Entity',
      _kind: 'book',
      description: 'Second entity within limit',
    };
    await client.post('/entities').send(secondEntity).expect(200);

    // Third entity - should fail due to limit
    const thirdEntity = {
      _name: 'Third Entity',
      _kind: 'book',
      description: 'Third entity exceeding limit',
    };
    const errorResponse = await client
      .post('/entities')
      .send(thirdEntity)
      .expect(429);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      message: 'Record limit exceeded for entity',
      code: 'ENTITY-LIMIT-EXCEEDED',
      details: [
        {
          code: 'ENTITY-LIMIT-EXCEEDED',
          message: 'Record limit exceeded for entity',
          info: {
            limit: 2,
            scope: '',
          },
        },
      ],
    });
  });

  it('enforces kind-specific record count limit', async () => {
    // Set up the environment variables with kind-specific record limit
    appWithClient = await setupApplication({
      entity_kinds: 'book,movie',
      ENTITY_RECORD_LIMITS: '[{"scope":"where[_kind]=book","limit":1}]', // Only allow 1 book entity
    });
    ({ client } = appWithClient);

    // First book entity - should succeed
    const firstBookEntity = {
      _name: 'First Book Entity',
      _kind: 'book',
      description: 'First book entity within limit',
    };
    await client.post('/entities').send(firstBookEntity).expect(200);

    // Movie entity - should succeed (different kind)
    const movieEntity = {
      _name: 'Movie Entity',
      _kind: 'movie',
      description: 'Movie entity not affected by book limit',
    };
    await client.post('/entities').send(movieEntity).expect(200);

    // Second book entity - should fail due to kind-specific limit
    const secondBookEntity = {
      _name: 'Second Book Entity',
      _kind: 'book',
      description: 'Second book entity exceeding limit',
    };
    const errorResponse = await client
      .post('/entities')
      .send(secondBookEntity)
      .expect(429);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      message: 'Record limit exceeded for entity',
      code: 'ENTITY-LIMIT-EXCEEDED',
      details: [
        {
          code: 'ENTITY-LIMIT-EXCEEDED',
          message: 'Record limit exceeded for entity',
          info: {
            limit: 1,
            scope: 'where[_kind]=book',
          },
        },
      ],
    });
  });

  it('enforces record set limit for active records', async () => {
    // Set up the environment variables with record set limit for active records
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      ENTITY_RECORD_LIMITS: '[{"scope":"set[actives]","limit":2}]', // Allow 2 active records at a time
    });
    ({ client } = appWithClient);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    // First active entity - should succeed
    const firstEntity = {
      _name: 'First Active Entity',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      description: 'First active entity within limit',
    };
    await client.post('/entities').send(firstEntity).expect(200);

    // Second active entity - should succeed
    const secondEntity = {
      _name: 'Second Active Entity',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      description: 'Second active entity within limit',
    };
    await client.post('/entities').send(secondEntity).expect(200);

    // Inactive entity - should succeed despite active records limit
    const inactiveEntity = {
      _name: 'Inactive Entity',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(), // Already expired
      description: 'Inactive entity not counted in active limit',
    };
    await client.post('/entities').send(inactiveEntity).expect(200);

    // Third active entity - should fail due to active records limit
    const thirdActiveEntity = {
      _name: 'Third Active Entity',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      description: 'Third active entity exceeding limit',
    };
    const errorResponse = await client
      .post('/entities')
      .send(thirdActiveEntity)
      .expect(429);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      message: 'Record limit exceeded for entity',
      code: 'ENTITY-LIMIT-EXCEEDED',
      details: [
        {
          code: 'ENTITY-LIMIT-EXCEEDED',
          message: 'Record limit exceeded for entity',
          info: {
            limit: 2,
            scope: 'set[actives]',
          },
        },
      ],
    });
  });

  it('enforces kind-specific record set limit for active records', async () => {
    // Set up the environment variables with kind-specific record set limit
    appWithClient = await setupApplication({
      entity_kinds: 'book,movie',
      ENTITY_RECORD_LIMITS:
        '[{"scope":"set[actives]&where[_kind]=book","limit":1}]', // Only 1 active book entity
    });
    ({ client } = appWithClient);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    // First active book entity - should succeed
    const firstBookEntity = {
      _name: 'First Active Book Entity',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      description: 'First active book entity within limit',
    };
    await client.post('/entities').send(firstBookEntity).expect(200);

    // Active movie entity - should succeed (different kind)
    const movieEntity = {
      _name: 'Active Movie Entity',
      _kind: 'movie',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      description: 'Movie entity not affected by book limit',
    };
    await client.post('/entities').send(movieEntity).expect(200);

    // Second active book entity - should fail due to kind-specific active limit
    const secondBookEntity = {
      _name: 'Second Active Book Entity',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      description: 'Second active book entity exceeding limit',
    };
    const errorResponse = await client
      .post('/entities')
      .send(secondBookEntity)
      .expect(429);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      message: 'Record limit exceeded for entity',
      code: 'ENTITY-LIMIT-EXCEEDED',
      details: [
        {
          code: 'ENTITY-LIMIT-EXCEEDED',
          message: 'Record limit exceeded for entity',
          info: {
            limit: 1,
            scope: 'set[actives]&where[_kind]=book',
          },
        },
      ],
    });
  });

  it('enforces record set limit for active and public records', async () => {
    // Set up the environment variables with record set limit for both active and public records
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      ENTITY_RECORD_LIMITS: '[{"scope":"set[actives]&set[publics]","limit":2}]', // Allow 2 records that are both active and public
    });
    ({ client } = appWithClient);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    // First active and public entity - should succeed
    const firstEntity = {
      _name: 'First Active Public Entity',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      _visibility: 'public',
      description: 'First active and public entity within limit',
    };
    await client.post('/entities').send(firstEntity).expect(200);

    // Second active and public entity - should succeed
    const secondEntity = {
      _name: 'Second Active Public Entity',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      _visibility: 'public',
      description: 'Second active and public entity within limit',
    };
    await client.post('/entities').send(secondEntity).expect(200);

    // Active but private entity - should succeed despite limit (not public)
    const privateEntity = {
      _name: 'Private Active Entity',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      _visibility: 'private',
      description: 'Private active entity not counted in limit',
    };
    await client.post('/entities').send(privateEntity).expect(200);

    // Public but inactive entity - should succeed despite limit (not active)
    const inactiveEntity = {
      _name: 'Inactive Public Entity',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(), // Already expired
      _visibility: 'public',
      description: 'Inactive public entity not counted in limit',
    };
    await client.post('/entities').send(inactiveEntity).expect(200);

    // Third active and public entity - should fail due to combined active+public limit
    const thirdActivePublicEntity = {
      _name: 'Third Active Public Entity',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      _visibility: 'public',
      description: 'Third active and public entity exceeding limit',
    };
    const errorResponse = await client
      .post('/entities')
      .send(thirdActivePublicEntity)
      .expect(429);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      message: 'Record limit exceeded for entity',
      code: 'ENTITY-LIMIT-EXCEEDED',
      details: [
        {
          code: 'ENTITY-LIMIT-EXCEEDED',
          message: 'Record limit exceeded for entity',
          info: {
            limit: 2,
            scope: 'set[actives]&set[publics]',
          },
        },
      ],
    });
  });

  it('enforces record limit per user using owners set', async () => {
    // Set up the environment variables with record set limit for owners
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      ENTITY_RECORD_LIMITS:
        '[{"scope":"set[owners][userIds]=${_ownerUsers}","limit":2}]', // Allow 2 records per user
    });
    ({ client } = appWithClient);

    const userId = 'user-123';

    // First entity for user - should succeed
    const firstEntity = {
      _name: 'First User Entity',
      _kind: 'book',
      _ownerUsers: [userId],
      description: 'First entity for the user within limit',
    };
    await client.post('/entities').send(firstEntity).expect(200);

    // Second entity for user - should succeed
    const secondEntity = {
      _name: 'Second User Entity',
      _kind: 'book',
      _ownerUsers: [userId],
      description: 'Second entity for the user within limit',
    };
    await client.post('/entities').send(secondEntity).expect(200);

    // Entity for different user - should succeed despite limit
    const differentUserEntity = {
      _name: 'Different User Entity',
      _kind: 'book',
      _ownerUsers: ['user-456'],
      description: 'Entity for different user not counted in limit',
    };
    await client.post('/entities').send(differentUserEntity).expect(200);

    // Entity with multiple owners including our user - should fail due to user's limit
    const multiOwnerEntity = {
      _name: 'Multi Owner Entity',
      _kind: 'book',
      _ownerUsers: [userId, 'user-789'], // Includes the limited user
      description: 'Entity with multiple owners including limited user',
    };
    const errorResponse = await client
      .post('/entities')
      .send(multiOwnerEntity)
      .expect(429);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      message: 'Record limit exceeded for entity',
      code: 'ENTITY-LIMIT-EXCEEDED',
      details: [
        {
          code: 'ENTITY-LIMIT-EXCEEDED',
          message: 'Record limit exceeded for entity',
          info: {
            limit: 2,
            scope: 'set[owners][userIds]=user-123,user-789',
          },
        },
      ],
    });
  });


  describe('lookup constraint validation', () => {
    it('should reject entity with invalid entity reference when record=entity is configured', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book,author',
        ENTITY_LOOKUP_CONSTRAINT: JSON.stringify([
          {
            propertyPath: 'references',
            record: 'entity',
          },
        ]),
      });
      ({ client } = appWithClient);

      const newEntity = {
        _name: 'Book with Invalid Reference',
        _kind: 'book',
        references: ['tapp://localhost/lists/1'], // List reference when entity is required
      };

      const errorResponse = await client
        .post('/entities')
        .send(newEntity)
        .expect(422);

      expect(errorResponse.body.error).to.containDeep({
        statusCode: 422,
        name: 'InvalidLookupReferenceError',
        code: 'ENTITY-INVALID-LOOKUP-REFERENCE',
      });
    });

    it('should reject entity with invalid list reference when record=list is configured', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book,author',
        ENTITY_LOOKUP_CONSTRAINT: JSON.stringify([
          {
            propertyPath: 'references',
            record: 'list',
          },
        ]),
      });
      ({ client } = appWithClient);

      const newEntity = {
        _name: 'Book with Invalid Reference',
        _kind: 'book',
        references: ['tapp://localhost/entities/1'], // Entity reference when list is required
      };

      const errorResponse = await client
        .post('/entities')
        .send(newEntity)
        .expect(422);

      expect(errorResponse.body.error).to.containDeep({
        statusCode: 422,
        name: 'InvalidLookupReferenceError',
        code: 'ENTITY-INVALID-LOOKUP-REFERENCE',
      });
    });

    it('should reject entity with invalid target kind when targetKind is configured', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book,author',
        ENTITY_LOOKUP_CONSTRAINT: JSON.stringify([
          {
            propertyPath: 'references',
            record: 'entity',
            targetKind: 'author',
          },
        ]),
      });
      ({ client } = appWithClient);

      // First create a book entity to reference
      const bookEntity = {
        _name: 'Referenced Book',
        _kind: 'book',
      };
      const bookResponse = await client
        .post('/entities')
        .send(bookEntity)
        .expect(200);
      const bookId = bookResponse.body._id;

      const newEntity = {
        _name: 'Book with Wrong Reference',
        _kind: 'book',
        references: [`tapp://localhost/entities/${bookId}`], // References a book when author is required
      };

      const errorResponse = await client
        .post('/entities')
        .send(newEntity)
        .expect(422);

      expect(errorResponse.body.error).to.containDeep({
        statusCode: 422,
        name: 'InvalidLookupConstraintError',
        code: 'ENTITY-INVALID-LOOKUP-KIND',
      });
    });

    it('should accept entity with valid references when all constraints are satisfied', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book,author',
        ENTITY_LOOKUP_CONSTRAINT: JSON.stringify([
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
      const authorEntity = {
        _name: 'Referenced Author',
        _kind: 'author',
      };
      const authorResponse = await client
        .post('/entities')
        .send(authorEntity)
        .expect(200);
      const authorId = authorResponse.body._id;

      const newEntity = {
        _name: 'Book with Valid References',
        _kind: 'book', // Correct source kind
        references: [`tapp://localhost/entities/${authorId}`], // References an author (correct target kind)
      };

      const response = await client
        .post('/entities')
        .send(newEntity)
        .expect(200);

      expect(response.body).to.containDeep({
        _name: 'Book with Valid References',
        _kind: 'book',
        references: [`tapp://localhost/entities/${authorId}`],
      });
    });

    it('should accept entity with multiple valid references when all constraints are satisfied', async () => {
      appWithClient = await setupApplication({
        entity_kinds: 'book,author',
        ENTITY_LOOKUP_CONSTRAINT: JSON.stringify([
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
      const author1 = {
        _name: 'First Author',
        _kind: 'author',
      };
      const author2 = {
        _name: 'Second Author',
        _kind: 'author',
      };
      const author1Response = await client
        .post('/entities')
        .send(author1)
        .expect(200);
      const author2Response = await client
        .post('/entities')
        .send(author2)
        .expect(200);
      const author1Id = author1Response.body._id;
      const author2Id = author2Response.body._id;

      const newEntity = {
        _name: 'Book with Multiple References',
        _kind: 'book',
        references: [
          `tapp://localhost/entities/${author1Id}`,
          `tapp://localhost/entities/${author2Id}`,
        ],
      };

      const response = await client
        .post('/entities')
        .send(newEntity)
        .expect(200);

      expect(response.body).to.containDeep({
        _name: 'Book with Multiple References',
        _kind: 'book',
        references: [
          `tapp://localhost/entities/${author1Id}`,
          `tapp://localhost/entities/${author2Id}`,
        ],
      });
    });
  });
});
