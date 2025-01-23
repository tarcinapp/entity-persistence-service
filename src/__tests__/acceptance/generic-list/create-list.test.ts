import type { DataObject } from '@loopback/repository';
import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { UniquenessConfigurationReader } from '../../../extensions';
import type { GenericList } from '../../../models';
import type { AppWithClient } from '../test-helper';
import { setupApplication, teardownApplication } from '../test-helper';

describe('POST /generic-lists', () => {
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

  it('creates a new generic list with default kind', async () => {
    appWithClient = await setupApplication({
      // use default values
    });
    ({ client } = appWithClient);

    const newList: Partial<GenericList> = {
      _name: "Editor's Pick",
      description: 'List of items that the editor has picked',
    };

    const response = await client
      .post('/generic-lists')
      .send(newList)
      .expect(200);

    // checks name and description
    expect(response.body).to.containDeep(newList);

    // checks managed fields
    expect(response.body._id).to.be.String();
    expect(response.body._kind).to.be.equal('list'); // default list kind
    expect(response.body._slug).to.be.equal('editors-pick');
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

  it('creates a list with specified kind', async () => {
    appWithClient = await setupApplication({
      list_kinds: 'editors-pick,featured',
    });
    ({ client } = appWithClient);

    const newList: Partial<GenericList> = {
      _name: 'Featured List',
      _kind: 'featured',
      description: 'A featured list',
    };

    const response = await client
      .post('/generic-lists')
      .send(newList)
      .expect(200);

    expect(response.body._kind).to.be.equal('featured');
  });

  it('rejects invalid list kind', async () => {
    appWithClient = await setupApplication({
      list_kinds: 'only-featured,trending',
    });
    ({ client } = appWithClient);

    const newList: Partial<GenericList> = {
      _name: 'Invalid Kind List',
      _kind: 'editors-pick', // This is now invalid
      description: 'A list with invalid kind',
    };

    await client.post('/generic-lists').send(newList).expect(422);
  });

  it('rejects duplicate list based on uniqueness configuration', async () => {
    // Set up the environment variables
    appWithClient = await setupApplication({
      list_kinds: 'book-list',
      uniqueness_list_fields: '_slug,_kind',
    });
    ({ client } = appWithClient);

    // Debug log
    console.log('Environment variables:', {
      list_kinds: process.env.list_kinds,
      uniqueness_list_fields: process.env.uniqueness_list_fields,
    });

    // Get the uniqueness configuration reader
    const uniquenessReader =
      await appWithClient.app.get<UniquenessConfigurationReader>(
        'extensions.uniqueness.configurationreader',
      );
    console.log('Uniqueness configuration:', {
      isConfigured:
        uniquenessReader.isUniquenessConfiguredForLists('book-list'),
      fields: uniquenessReader.getFieldsForLists('book-list'),
    });

    // First list creation - should succeed
    const firstList: Partial<GenericList> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      description: 'A list of science fiction books',
    };

    const response = await client
      .post('/generic-lists')
      .send(firstList)
      .expect(200);

    expect(response.body._slug).to.be.equal('science-fiction-books');
    expect(response.body._kind).to.be.equal('book-list');

    // Second list with same resulting slug and kind - should fail
    const secondList: Partial<GenericList> = {
      _name: 'Science Fiction Books', // Will generate same slug
      _kind: 'book-list',
      description: 'Another list of science fiction books',
    };

    const errorResponse = await client
      .post('/generic-lists')
      .send(secondList)
      .expect(409);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 409,
      name: 'DataUniquenessViolationError',
      message: 'List already exists.',
      code: 'LIST-ALREADY-EXISTS',
    });
  });

  it('rejects duplicate list based on uniqueness configuration including owner users', async () => {
    // Set up the environment variables
    appWithClient = await setupApplication({
      list_kinds: 'book-list',
      uniqueness_list_fields: '_slug,_kind,_ownerUsers',
    });
    ({ client } = appWithClient);

    // Debug log
    console.log('Environment variables:', {
      list_kinds: process.env.list_kinds,
      uniqueness_list_fields: process.env.uniqueness_list_fields,
    });

    // First list creation - should succeed
    const firstList: Partial<GenericList> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _ownerUsers: ['user-123'],
      description: 'A list of science fiction books',
    };

    const response = await client
      .post('/generic-lists')
      .send(firstList)
      .expect(200);

    expect(response.body._slug).to.be.equal('science-fiction-books');
    expect(response.body._kind).to.be.equal('book-list');
    expect(response.body._ownerUsers).to.containDeep(['user-123']);

    // Second list with same resulting slug, kind and owner - should fail
    const secondList: Partial<GenericList> = {
      _name: 'Science Fiction Books', // Will generate same slug
      _kind: 'book-list',
      _ownerUsers: ['user-123'],
      description: 'Another list of science fiction books',
    };

    const errorResponse = await client
      .post('/generic-lists')
      .send(secondList)
      .expect(409);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 409,
      name: 'DataUniquenessViolationError',
      message: 'List already exists.',
      code: 'LIST-ALREADY-EXISTS',
    });
  });

  it('allows duplicate list with different owner users when uniqueness includes owner users', async () => {
    // Set up the environment variables
    appWithClient = await setupApplication({
      list_kinds: 'book-list',
      uniqueness_list_fields: '_slug,_kind,_ownerUsers', // _ownerUsers is not contributing to uniqueness check
    });
    ({ client } = appWithClient);

    // First list creation - should succeed
    const firstList: Partial<GenericList> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _ownerUsers: ['user-123', 'user-456'],
      description: 'A list of science fiction books',
    };

    const firstResponse = await client
      .post('/generic-lists')
      .send(firstList)
      .expect(200);

    expect(firstResponse.body._slug).to.be.equal('science-fiction-books');
    expect(firstResponse.body._kind).to.be.equal('book-list');
    expect(firstResponse.body._ownerUsers).to.containDeep([
      'user-123',
      'user-456',
    ]);

    // Second list with same name and kind and with same owner - should succeed because uniqueness is not enforced for array fields
    const secondList: Partial<GenericList> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _ownerUsers: ['user-123'], // Different owner
      description: 'Another list of science fiction books',
    };

    const secondResponse = await client
      .post('/generic-lists')
      .send(secondList)
      .expect(200);

    expect(secondResponse.body._slug).to.be.equal('science-fiction-books');
    expect(secondResponse.body._kind).to.be.equal('book-list');
    expect(secondResponse.body._ownerUsers).to.containDeep(['user-123']);
  });

  it('rejects duplicate list when uniqueness set includes owners and same user exists', async () => {
    // Set up the environment variables with set[owners] uniqueness
    appWithClient = await setupApplication({
      list_kinds: 'book-list',
      uniqueness_list_fields: '_slug,_kind',
      uniqueness_list_set: 'set[owners]',
    });
    ({ client } = appWithClient);

    // First list creation with multiple owners - should succeed
    const firstList: Partial<GenericList> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _ownerUsers: ['user-123', 'user-456', 'user-789'],
      description: 'A list of science fiction books',
    };

    const firstResponse = await client
      .post('/generic-lists')
      .send(firstList)
      .expect(200);

    expect(firstResponse.body._slug).to.be.equal('science-fiction-books');
    expect(firstResponse.body._kind).to.be.equal('book-list');
    expect(firstResponse.body._ownerUsers).to.containDeep([
      'user-123',
      'user-456',
      'user-789',
    ]);

    // Second list with same name and kind, and one overlapping owner - should fail
    const secondList: Partial<GenericList> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _ownerUsers: ['user-123', 'user-999'], // user-123 exists in first list
      description: 'Another list of science fiction books',
    };

    const errorResponse = await client
      .post('/generic-lists')
      .send(secondList)
      .expect(409);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 409,
      name: 'DataUniquenessViolationError',
      message: 'List already exists.',
      code: 'LIST-ALREADY-EXISTS',
    });
  });

  it('rejects duplicate list when uniqueness set includes actives and both lists are active', async () => {
    // Set up the environment variables with set[actives] uniqueness
    appWithClient = await setupApplication({
      list_kinds: 'book-list',
      uniqueness_list_fields: '_slug,_kind',
      uniqueness_list_set: 'set[actives]',
    });
    ({ client } = appWithClient);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1); // Yesterday

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // 7 days from now

    // First list creation with validity period - should succeed
    const firstList: DataObject<GenericList> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _ownerUsers: ['user-123'],
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      description: 'A list of science fiction books',
    };

    const firstResponse = await client
      .post('/generic-lists')
      .send(firstList)
      .expect(200);

    expect(firstResponse.body._slug).to.be.equal('science-fiction-books');
    expect(firstResponse.body._kind).to.be.equal('book-list');
    expect(firstResponse.body._validFromDateTime).to.be.equal(
      pastDate.toISOString(),
    );
    expect(firstResponse.body._validUntilDateTime).to.be.equal(
      futureDate.toISOString(),
    );

    // Second list with same name and kind, different owner, but also active - should fail
    const secondList: Partial<GenericList> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _ownerUsers: ['user-999'], // Different owner
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: null, // No end date, meaning indefinitely active
      description: 'Another list of science fiction books',
    };

    const errorResponse = await client
      .post('/generic-lists')
      .send(secondList)
      .expect(409);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 409,
      name: 'DataUniquenessViolationError',
      message: 'List already exists.',
      code: 'LIST-ALREADY-EXISTS',
    });
  });

  it('allows duplicate list when uniqueness set includes actives and existing list is inactive', async () => {
    // Set up the environment variables with set[actives] uniqueness
    appWithClient = await setupApplication({
      list_kinds: 'book-list',
      uniqueness_list_fields: '_slug,_kind',
      uniqueness_list_set: 'set[actives]',
    });
    ({ client } = appWithClient);

    const pastStartDate = new Date();
    pastStartDate.setDate(pastStartDate.getDate() - 7); // 7 days ago

    const pastEndDate = new Date();
    pastEndDate.setDate(pastEndDate.getDate() - 1); // Yesterday

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // 7 days from now

    // First list creation with validity period in the past - should succeed
    const firstList: DataObject<GenericList> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _ownerUsers: ['user-123'],
      _validFromDateTime: pastStartDate.toISOString(),
      _validUntilDateTime: pastEndDate.toISOString(), // List is now inactive
      description: 'A list of science fiction books',
    };

    const firstResponse = await client
      .post('/generic-lists')
      .send(firstList)
      .expect(200);

    expect(firstResponse.body._slug).to.be.equal('science-fiction-books');
    expect(firstResponse.body._kind).to.be.equal('book-list');
    expect(firstResponse.body._validFromDateTime).to.be.equal(
      pastStartDate.toISOString(),
    );
    expect(firstResponse.body._validUntilDateTime).to.be.equal(
      pastEndDate.toISOString(),
    );

    // Second list with same name and kind, different owner, and active - should succeed since first list is inactive
    const secondList: Partial<GenericList> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _ownerUsers: ['user-999'], // Different owner
      _validFromDateTime: new Date().toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      description: 'Another list of science fiction books',
    };

    const secondResponse = await client
      .post('/generic-lists')
      .send(secondList)
      .expect(200);

    expect(secondResponse.body._slug).to.be.equal('science-fiction-books');
    expect(secondResponse.body._kind).to.be.equal('book-list');
    expect(secondResponse.body._validFromDateTime).to.not.be.null();
    expect(secondResponse.body._validUntilDateTime).to.be.equal(
      futureDate.toISOString(),
    );
  });

  it('automatically sets validFromDateTime when autoapprove_list is true', async () => {
    // Set up the environment variables with autoapprove_list enabled
    appWithClient = await setupApplication({
      list_kinds: 'book-list',
      autoapprove_list: 'true',
    });
    ({ client } = appWithClient);

    const newList: Partial<GenericList> = {
      _name: 'Auto Approved List',
      _kind: 'book-list',
      description: 'A list that should be auto-approved',
    };

    const response = await client
      .post('/generic-lists')
      .send(newList)
      .expect(200);

    // Verify the response
    expect(response.body._slug).to.be.equal('auto-approved-list');
    expect(response.body._kind).to.be.equal('book-list');

    // Verify that _validFromDateTime was automatically set to current time
    const now = new Date();
    const validFrom = new Date(response.body._validFromDateTime);
    expect(validFrom).to.be.Date();
    expect(validFrom.getTime()).to.be.approximately(now.getTime(), 5000); // Allow 5 second difference

    // Verify other fields
    expect(response.body.description).to.be.equal(
      'A list that should be auto-approved',
    );
  });

  it('automatically sets validFromDateTime when autoapprove_list_for_kind matches', async () => {
    // Set up the environment variables with kind-specific auto-approve
    appWithClient = await setupApplication({
      list_kinds: 'book-list,featured-list',
      'autoapprove_list_for_book-list': 'true',
    });
    ({ client } = appWithClient);

    const newList: Partial<GenericList> = {
      _name: 'Auto Approved Book List',
      _kind: 'book-list',
      description: 'A book list that should be auto-approved',
    };

    const response = await client
      .post('/generic-lists')
      .send(newList)
      .expect(200);

    // Verify the response
    expect(response.body._slug).to.be.equal('auto-approved-book-list');
    expect(response.body._kind).to.be.equal('book-list');

    // Verify that _validFromDateTime was automatically set to current time
    const now = new Date();
    const validFrom = new Date(response.body._validFromDateTime);
    expect(validFrom).to.be.Date();
    expect(validFrom.getTime()).to.be.approximately(now.getTime(), 5000); // Allow 5 second difference

    // Verify other fields
    expect(response.body.description).to.be.equal(
      'A book list that should be auto-approved',
    );
  });

  it('does not set validFromDateTime when autoapprove_list_for_kind does not match', async () => {
    // Set up the environment variables with kind-specific auto-approve for a different kind
    appWithClient = await setupApplication({
      list_kinds: 'book-list,featured-list',
      'autoapprove-list-for-featured-list': 'true',
    });
    ({ client } = appWithClient);

    const newList: Partial<GenericList> = {
      _name: 'Non Auto Approved Book List',
      _kind: 'book-list',
      description: 'A book list that should not be auto-approved',
    };

    const response = await client
      .post('/generic-lists')
      .send(newList)
      .expect(200);

    // Verify the response
    expect(response.body._slug).to.be.equal('non-auto-approved-book-list');
    expect(response.body._kind).to.be.equal('book-list');

    // Verify that _validFromDateTime was not automatically set
    expect(response.body._validFromDateTime).to.be.null();

    // Verify other fields
    expect(response.body.description).to.be.equal(
      'A book list that should not be auto-approved',
    );
  });

  it('sets visibility to private when visibility_list is configured as private', async () => {
    // Set up the environment variables with visibility configuration
    appWithClient = await setupApplication({
      list_kinds: 'book-list',
      visibility_list: 'private',
    });
    ({ client } = appWithClient);

    const newList: Partial<GenericList> = {
      _name: 'Private List',
      _kind: 'book-list',
      description: 'A list that should be private by default',
    };

    const response = await client
      .post('/generic-lists')
      .send(newList)
      .expect(200);

    // Verify the response
    expect(response.body._slug).to.be.equal('private-list');
    expect(response.body._kind).to.be.equal('book-list');
    expect(response.body._visibility).to.be.equal('private');
  });

  it('sets visibility to public when visibility_list_for_kind is configured as public', async () => {
    // Set up the environment variables with kind-specific visibility
    appWithClient = await setupApplication({
      list_kinds: 'book-list,featured-list',
      'visibility_list_for_book-list': 'public',
    });
    ({ client } = appWithClient);

    const newList: Partial<GenericList> = {
      _name: 'Public Book List',
      _kind: 'book-list',
      description: 'A book list that should be public by default',
    };

    const response = await client
      .post('/generic-lists')
      .send(newList)
      .expect(200);

    // Verify the response
    expect(response.body._slug).to.be.equal('public-book-list');
    expect(response.body._kind).to.be.equal('book-list');
    expect(response.body._visibility).to.be.equal('public');
  });

  it('rejects list creation with invalid visibility value', async () => {
    appWithClient = await setupApplication({
      list_kinds: 'book-list',
    });
    ({ client } = appWithClient);

    const newList: Partial<GenericList> = {
      _name: 'Invalid Visibility List',
      _kind: 'book-list',
      _visibility: 'invalid-value', // Invalid visibility value
      description: 'A list with invalid visibility',
    };

    const errorResponse = await client
      .post('/generic-lists')
      .send(newList)
      .expect(422);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 422,
      name: 'UnprocessableEntityError',
      message:
        'The request body is invalid. See error object `details` property for more info.',
      code: 'VALIDATION_FAILED',
    });
  });
});
