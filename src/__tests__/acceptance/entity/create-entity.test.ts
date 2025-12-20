import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { GenericEntity } from '../../../models';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  expectResponseToMatch,
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

  it('creates a new entity with default kind', async () => {
    appWithClient = await setupApplication({
      // use default values
    });
    ({ client } = appWithClient);

    const newEntity: Partial<GenericEntity> = {
      _name: 'Sample Book',
      description: 'A sample book entity',
    };

    const response = await client.post('/entities').send(newEntity).expect(200);

    // checks name and description
    expect(response.body).to.containDeep(newEntity);

    // checks managed fields
    expect(response.body._id).to.be.String();
    expect(response.body._kind).to.be.equal('entity'); // default entity kind
    expect(response.body._slug).to.be.equal('sample-book');
    expect(response.body._createdDateTime).to.be.String();
    expect(response.body._lastUpdatedDateTime).to.be.String();
    expect(response.body._visibility).to.be.equal('protected'); // default visibility
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

    // First entity creation - should succeed
    const firstEntity: Partial<GenericEntity> = {
      _name: 'The Great Gatsby',
      _kind: 'book',
      description: 'A classic novel by F. Scott Fitzgerald',
    };

    const response = await client
      .post('/entities')
      .send(firstEntity)
      .expect(200);

    expect(response.body._slug).to.be.equal('the-great-gatsby');
    expect(response.body._kind).to.be.equal('book');

    // Second entity with same resulting slug and kind - should fail
    const secondEntity: Partial<GenericEntity> = {
      _name: 'The Great Gatsby', // Will generate same slug
      _kind: 'book',
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

    // First entity creation - should succeed
    const firstEntity: Partial<GenericEntity> = {
      _name: 'The Great Gatsby',
      _kind: 'book',
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

    // Second entity with same resulting slug, kind and owner - should fail
    const secondEntity: Partial<GenericEntity> = {
      _name: 'The Great Gatsby', // Will generate same slug
      _kind: 'book',
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

    // First entity creation with multiple owners - should succeed
    const firstEntity: Partial<GenericEntity> = {
      _name: 'The Great Gatsby',
      _kind: 'book',
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

    // Second entity with same name and kind, and one overlapping owner - should fail
    const secondEntity: Partial<GenericEntity> = {
      _name: 'The Great Gatsby',
      _kind: 'book',
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

    // First entity creation with validity period - should succeed
    const firstEntity: Partial<GenericEntity> = {
      _name: 'The Great Gatsby',
      _kind: 'book',
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

    // Second entity with same name and kind, different owner, but also active - should fail
    const secondEntity: Partial<GenericEntity> = {
      _name: 'The Great Gatsby',
      _kind: 'book',
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

    // First entity creation with validity period in the past - should succeed
    const firstEntity: Partial<GenericEntity> = {
      _name: 'The Great Gatsby',
      _kind: 'book',
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

    // Second entity with same name and kind, different owner, and active - should succeed since first entity is inactive
    const secondEntity: Partial<GenericEntity> = {
      _name: 'The Great Gatsby',
      _kind: 'book',
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

  it('automatically sets validFromDateTime when autoapprove_entity is true', async () => {
    // Set up the environment variables with autoapprove_entity enabled
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      autoapprove_entity: 'true',
    });
    ({ client } = appWithClient);

    const newEntity: Partial<GenericEntity> = {
      _name: 'Auto Approved Entity',
      _kind: 'book',
      description: 'An entity that should be auto-approved',
    };

    const response = await client.post('/entities').send(newEntity).expect(200);

    // Verify the response
    expect(response.body._slug).to.be.equal('auto-approved-entity');
    expect(response.body._kind).to.be.equal('book');

    // Verify that _validFromDateTime was automatically set to current time
    const now = new Date();
    const validFrom = new Date(response.body._validFromDateTime);
    expect(validFrom).to.be.Date();
    expect(validFrom.getTime()).to.be.approximately(now.getTime(), 5000); // Allow 5 second difference

    // Verify other fields
    expect(response.body.description).to.be.equal(
      'An entity that should be auto-approved',
    );
  });

  it('automatically sets validFromDateTime when autoapprove_entity_for_kind matches', async () => {
    // Set up the environment variables with kind-specific auto-approve
    appWithClient = await setupApplication({
      entity_kinds: 'book,movie',
      autoapprove_entity_for_book: 'true',
    });
    ({ client } = appWithClient);

    const newEntity: Partial<GenericEntity> = {
      _name: 'Auto Approved Book',
      _kind: 'book',
      description: 'A book that should be auto-approved',
    };

    const response = await client.post('/entities').send(newEntity).expect(200);

    // Verify the response
    expect(response.body._slug).to.be.equal('auto-approved-book');
    expect(response.body._kind).to.be.equal('book');

    // Verify that _validFromDateTime was automatically set to current time
    const now = new Date();
    const validFrom = new Date(response.body._validFromDateTime);
    expect(validFrom).to.be.Date();
    expect(validFrom.getTime()).to.be.approximately(now.getTime(), 5000); // Allow 5 second difference

    // Verify other fields
    expect(response.body.description).to.be.equal(
      'A book that should be auto-approved',
    );
  });

  it('does not set validFromDateTime when autoapprove_entity_for_kind does not match', async () => {
    // Set up the environment variables with kind-specific auto-approve for a different kind
    appWithClient = await setupApplication({
      entity_kinds: 'book,movie',
      autoapprove_entity_for_movie: 'true',
    });
    ({ client } = appWithClient);

    const newEntity: Partial<GenericEntity> = {
      _name: 'Non Auto Approved Book',
      _kind: 'book',
      description: 'A book that should not be auto-approved',
    };

    const response = await client.post('/entities').send(newEntity).expect(200);

    // Verify the response
    expect(response.body._slug).to.be.equal('non-auto-approved-book');
    expect(response.body._kind).to.be.equal('book');

    // Verify that _validFromDateTime was not automatically set
    expect(response.body._validFromDateTime).to.be.null();

    // Verify other fields
    expect(response.body.description).to.be.equal(
      'A book that should not be auto-approved',
    );
  });

  it('sets visibility to private when visibility_entity is configured as private', async () => {
    // Set up the environment variables with visibility configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      visibility_entity: 'private',
    });
    ({ client } = appWithClient);

    const newEntity: Partial<GenericEntity> = {
      _name: 'Private Entity',
      _kind: 'book',
      description: 'An entity that should be private by default',
    };

    const response = await client.post('/entities').send(newEntity).expect(200);

    // Verify the response
    expect(response.body._slug).to.be.equal('private-entity');
    expect(response.body._kind).to.be.equal('book');
    expect(response.body._visibility).to.be.equal('private');
  });

  it('sets visibility to public when visibility_entity_for_kind is configured as public', async () => {
    // Set up the environment variables with kind-specific visibility
    appWithClient = await setupApplication({
      entity_kinds: 'book,movie',
      visibility_entity_for_book: 'public',
    });
    ({ client } = appWithClient);

    const newEntity: Partial<GenericEntity> = {
      _name: 'Public Book Entity',
      _kind: 'book',
      description: 'A book entity that should be public by default',
    };

    const response = await client.post('/entities').send(newEntity).expect(200);

    // Verify the response
    expect(response.body._slug).to.be.equal('public-book-entity');
    expect(response.body._kind).to.be.equal('book');
    expect(response.body._visibility).to.be.equal('public');
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

  it('enforces idempotency based on configured fields', async () => {
    // Set up the environment variables with idempotency configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      idempotency_entity: '_kind,_slug,description', // Configure idempotency fields
    });
    ({ client } = appWithClient);

    // First entity creation - should succeed
    const firstEntity = {
      _name: 'Science Book',
      _kind: 'book',
      description: 'A book about science', // This will be part of idempotency check
      _ownerUsers: ['user-123'], // This field is not part of idempotency
      _visibility: 'private', // This field is not part of idempotency
    };

    const firstResponse = await client
      .post('/entities')
      .send(firstEntity)
      .expect(200);

    // Verify the first response
    expect(firstResponse.body._slug).to.be.equal('science-book');
    expect(firstResponse.body._kind).to.be.equal('book');
    expect(firstResponse.body.description).to.be.equal('A book about science');
    expect(firstResponse.body._ownerUsers).to.containDeep(['user-123']);
    expect(firstResponse.body._visibility).to.be.equal('private');

    // Second entity with same idempotency fields but different other fields
    const secondEntity = {
      _name: 'Science Book', // Same name will generate same slug
      _kind: 'book', // Same kind
      description: 'A book about science', // Same description
      _ownerUsers: ['user-456'], // Different owner
      _visibility: 'public', // Different visibility
    };

    const secondResponse = await client
      .post('/entities')
      .send(secondEntity)
      .expect(200);

    // Verify all fields in the second response match the first response
    expectResponseToMatch(secondResponse.body, firstResponse.body);

    // Verify only one record exists by getting all entities
    const getAllResponse = await client.get('/entities').expect(200);
    expect(getAllResponse.body).to.be.Array().lengthOf(1); // Only one record should exist
  });

  it('enforces kind-specific idempotency configuration', async () => {
    // Set up the environment variables with kind-specific idempotency
    appWithClient = await setupApplication({
      entity_kinds: 'book,movie',
      idempotency_entity_for_book: '_kind,_slug,_ownerUsers', // Different fields for book
      idempotency_entity_for_movie: '_kind,description', // Different fields for movie
    });
    ({ client } = appWithClient);

    // First book entity - should succeed
    const firstBookEntity = {
      _name: 'Science Book',
      _kind: 'book',
      description: 'First description', // Not part of idempotency for book
      _ownerUsers: ['user-123'], // Part of idempotency for book
    };

    const firstBookResponse = await client
      .post('/entities')
      .send(firstBookEntity)
      .expect(200);

    // Second book entity with same idempotency fields - should return same record
    const secondBookEntity = {
      _name: 'Science Book', // Will generate same slug
      _kind: 'book',
      description: 'Different description', // Can be different as not part of idempotency
      _ownerUsers: ['user-123'], // Same owner
    };

    const secondBookResponse = await client
      .post('/entities')
      .send(secondBookEntity)
      .expect(200);

    // Verify responses match
    expectResponseToMatch(secondBookResponse.body, firstBookResponse.body);

    // First movie entity - should succeed
    const firstMovieEntity = {
      _name: 'Featured Movie',
      _kind: 'movie',
      description: 'Movie description', // Part of idempotency for movie
      _ownerUsers: ['user-456'], // Not part of idempotency for movie
    };

    const firstMovieResponse = await client
      .post('/entities')
      .send(firstMovieEntity)
      .expect(200);

    // Second movie entity with same idempotency fields - should return same record
    const secondMovieEntity = {
      _name: 'Different Name', // Can be different as not part of idempotency
      _kind: 'movie',
      description: 'Movie description', // Same description
      _ownerUsers: ['user-789'], // Can be different as not part of idempotency
    };

    const secondMovieResponse = await client
      .post('/entities')
      .send(secondMovieEntity)
      .expect(200);

    // Verify responses match
    expectResponseToMatch(secondMovieResponse.body, firstMovieResponse.body);

    // Verify only two records exist (one for each kind)
    const getAllResponse = await client.get('/entities').expect(200);
    expect(getAllResponse.body).to.be.Array().lengthOf(2);
  });

  it('enforces idempotency with array fields', async () => {
    // Set up the environment variables with array fields in idempotency
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      idempotency_entity: '_kind,_ownerUsers,_viewerUsers', // Using array fields for idempotency
    });
    ({ client } = appWithClient);

    // First entity - should succeed
    const firstEntity = {
      _name: 'First Entity',
      _kind: 'book',
      _ownerUsers: ['user-123', 'user-456'],
      _viewerUsers: ['viewer-1', 'viewer-2'],
      description: 'First description',
    };

    const firstResponse = await client
      .post('/entities')
      .send(firstEntity)
      .expect(200);

    // Second entity with same array values but different order - should return same record
    const secondEntity = {
      _name: 'Different Name',
      _kind: 'book',
      _ownerUsers: ['user-456', 'user-123'], // Same values, different order
      _viewerUsers: ['viewer-2', 'viewer-1'], // Same values, different order
      description: 'Different description',
    };

    const secondResponse = await client
      .post('/entities')
      .send(secondEntity)
      .expect(200);

    // Verify responses match
    expectResponseToMatch(secondResponse.body, firstResponse.body);

    // Verify only one record exists
    const getAllResponse = await client.get('/entities').expect(200);
    expect(getAllResponse.body).to.be.Array().lengthOf(1);
  });

  it('enforces idempotency with date fields', async () => {
    // Set up the environment variables with date fields in idempotency
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      idempotency_entity: '_kind,_validFromDateTime,_validUntilDateTime', // Using date fields for idempotency
    });
    ({ client } = appWithClient);

    const validFrom = new Date();
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 7);

    // First entity - should succeed
    const firstEntity = {
      _name: 'First Entity',
      _kind: 'book',
      _validFromDateTime: validFrom.toISOString(),
      _validUntilDateTime: validUntil.toISOString(),
      description: 'First description',
    };

    const firstResponse = await client
      .post('/entities')
      .send(firstEntity)
      .expect(200);

    // Second entity with same dates but different other fields - should return same record
    const secondEntity = {
      _name: 'Different Name',
      _kind: 'book',
      _validFromDateTime: validFrom.toISOString(),
      _validUntilDateTime: validUntil.toISOString(),
      description: 'Different description',
    };

    const secondResponse = await client
      .post('/entities')
      .send(secondEntity)
      .expect(200);

    // Verify responses match
    expectResponseToMatch(secondResponse.body, firstResponse.body);

    // Verify only one record exists
    const getAllResponse = await client.get('/entities').expect(200);
    expect(getAllResponse.body).to.be.Array().lengthOf(1);
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
