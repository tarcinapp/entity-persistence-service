import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { GenericEntity } from '../../../models';
import type { AppWithClient } from '../test-helper';
import { setupApplication, teardownApplication } from '../test-helper';

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
      status: 422,
    });
  });

  it('rejects duplicate entity based on uniqueness configuration', async () => {
    // Set up the environment variables
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      uniqueness_entity_fields: '_slug,_kind',
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
      name: 'DataUniquenessViolationError',
      message: 'Entity already exists.',
      code: 'ENTITY-ALREADY-EXISTS',
    });
  });

  it('rejects duplicate entity based on uniqueness configuration including owner users', async () => {
    // Set up the environment variables
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      uniqueness_entity_fields: '_slug,_kind,_ownerUsers',
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
      name: 'DataUniquenessViolationError',
      message: 'Entity already exists.',
      code: 'ENTITY-ALREADY-EXISTS',
    });
  });

  it('allows duplicate entity with different owner users when uniqueness includes owner users', async () => {
    // Set up the environment variables
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      uniqueness_entity_fields: '_slug,_kind,_ownerUsers', // _ownerUsers is not contributing to uniqueness check
    });
    ({ client } = appWithClient);

    // First entity creation - should succeed
    const firstEntity: Partial<GenericEntity> = {
      _name: 'The Great Gatsby',
      _kind: 'book',
      _ownerUsers: ['user-123', 'user-456'],
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
    ]);

    // Second entity with same name and kind and with same owner - should succeed because uniqueness is not enforced for array fields
    const secondEntity: Partial<GenericEntity> = {
      _name: 'The Great Gatsby',
      _kind: 'book',
      _ownerUsers: ['user-123'], // Different owner
      description: 'Another copy of the same book',
    };

    const secondResponse = await client
      .post('/entities')
      .send(secondEntity)
      .expect(200);

    expect(secondResponse.body._slug).to.be.equal('the-great-gatsby');
    expect(secondResponse.body._kind).to.be.equal('book');
    expect(secondResponse.body._ownerUsers).to.containDeep(['user-123']);

    // Verify both records exist by getting all entities
    const getAllResponse = await client.get('/entities').expect(200);
    expect(getAllResponse.body).to.be.Array().lengthOf(2);
  });

  it('rejects duplicate entity when uniqueness set includes owners and same user exists', async () => {
    // Set up the environment variables with set[owners] uniqueness
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      uniqueness_entity_fields: '_slug,_kind',
      uniqueness_entity_scope: 'set[owners]',
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
      name: 'DataUniquenessViolationError',
      message: 'Entity already exists.',
      code: 'ENTITY-ALREADY-EXISTS',
    });
  });

  it('rejects duplicate entity when uniqueness set includes actives and both entities are active', async () => {
    // Set up the environment variables with set[actives] uniqueness
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      uniqueness_entity_fields: '_slug,_kind',
      uniqueness_entity_scope: 'set[actives]',
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
      name: 'DataUniquenessViolationError',
      message: 'Entity already exists.',
      code: 'ENTITY-ALREADY-EXISTS',
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
      code: 'VALIDATION_FAILED',
    });
  });

  it('enforces global record count limit', async () => {
    // Set up the environment variables with record limit
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      record_limit_entity_count: '2', // Only allow 2 records total
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
      message: 'Entity limit is exceeded.',
      code: 'ENTITY-LIMIT-EXCEEDED',
      status: 429,
      details: [
        {
          code: 'ENTITY-LIMIT-EXCEEDED',
          info: {
            limit: 2,
          },
        },
      ],
    });
  });

  it('enforces kind-specific record count limit', async () => {
    // Set up the environment variables with kind-specific record limit
    appWithClient = await setupApplication({
      entity_kinds: 'book,movie',
      record_limit_entity_count_for_book: '1', // Only allow 1 book entity
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
      message: 'Entity limit is exceeded.',
      code: 'ENTITY-LIMIT-EXCEEDED',
      status: 429,
      details: [
        {
          code: 'ENTITY-LIMIT-EXCEEDED',
          info: {
            limit: 1,
          },
        },
      ],
    });
  });

  it('enforces record set limit for active records', async () => {
    // Set up the environment variables with record set limit for active records
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      record_limit_entity_count: '2', // Allow 2 records total and active at a time
      record_limit_entity_scope: 'set[actives]', // Limit applies to active records
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
      message: 'Entity limit is exceeded.',
      code: 'ENTITY-LIMIT-EXCEEDED',
      status: 429,
      details: [
        {
          code: 'ENTITY-LIMIT-EXCEEDED',
          info: {
            limit: 2,
          },
        },
      ],
    });
  });
});
