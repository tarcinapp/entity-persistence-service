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
});
