import type { DataObject } from '@loopback/repository';
import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { List } from '../../../models';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  expectResponseToMatch,
} from '../test-helper';

describe('POST /lists', () => {
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

    const newList: Partial<List> = {
      _name: "Editor's Pick",
      description: 'List of items that the editor has picked',
    };

    const response = await client.post('/lists').send(newList).expect(200);

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

    const newList: Partial<List> = {
      _name: 'Featured List',
      _kind: 'featured',
      description: 'A featured list',
    };

    const response = await client.post('/lists').send(newList).expect(200);

    expect(response.body._kind).to.be.equal('featured');
  });

  it('rejects invalid list kind', async () => {
    appWithClient = await setupApplication({
      list_kinds: 'only-featured,trending',
    });
    ({ client } = appWithClient);

    const newList: Partial<List> = {
      _name: 'Invalid Kind List',
      _kind: 'editors-pick', // This is now invalid
      description: 'A list with invalid kind',
    };

    await client.post('/lists').send(newList).expect(422);
  });

  it('rejects duplicate list based on uniqueness configuration', async () => {
    // Set up the environment variables
    appWithClient = await setupApplication({
      list_kinds: 'book-list',
      uniqueness_list_fields: '_slug,_kind',
    });
    ({ client } = appWithClient);

    // First list creation - should succeed
    const firstList: Partial<List> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      description: 'A list of science fiction books',
    };

    const response = await client.post('/lists').send(firstList).expect(200);

    expect(response.body._slug).to.be.equal('science-fiction-books');
    expect(response.body._kind).to.be.equal('book-list');

    // Second list with same resulting slug and kind - should fail
    const secondList: Partial<List> = {
      _name: 'Science Fiction Books', // Will generate same slug
      _kind: 'book-list',
      description: 'Another list of science fiction books',
    };

    const errorResponse = await client
      .post('/lists')
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

    // First list creation - should succeed
    const firstList: Partial<List> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _ownerUsers: ['user-123'],
      description: 'A list of science fiction books',
    };

    const response = await client.post('/lists').send(firstList).expect(200);

    expect(response.body._slug).to.be.equal('science-fiction-books');
    expect(response.body._kind).to.be.equal('book-list');
    expect(response.body._ownerUsers).to.containDeep(['user-123']);

    // Second list with same resulting slug, kind and owner - should fail
    const secondList: Partial<List> = {
      _name: 'Science Fiction Books', // Will generate same slug
      _kind: 'book-list',
      _ownerUsers: ['user-123'],
      description: 'Another list of science fiction books',
    };

    const errorResponse = await client
      .post('/lists')
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
    const firstList: Partial<List> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _ownerUsers: ['user-123', 'user-456'],
      description: 'A list of science fiction books',
    };

    const firstResponse = await client
      .post('/lists')
      .send(firstList)
      .expect(200);

    expect(firstResponse.body._slug).to.be.equal('science-fiction-books');
    expect(firstResponse.body._kind).to.be.equal('book-list');
    expect(firstResponse.body._ownerUsers).to.containDeep([
      'user-123',
      'user-456',
    ]);

    // Second list with same name and kind and with same owner - should succeed because uniqueness is not enforced for array fields
    const secondList: Partial<List> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _ownerUsers: ['user-123'], // Different owner
      description: 'Another list of science fiction books',
    };

    const secondResponse = await client
      .post('/lists')
      .send(secondList)
      .expect(200);

    expect(secondResponse.body._slug).to.be.equal('science-fiction-books');
    expect(secondResponse.body._kind).to.be.equal('book-list');
    expect(secondResponse.body._ownerUsers).to.containDeep(['user-123']);

    // Verify both records exist by getting all lists
    const getAllResponse = await client.get('/lists').expect(200);
    expect(getAllResponse.body).to.be.Array().lengthOf(2);
  });

  it('rejects duplicate list when uniqueness set includes owners and same user exists', async () => {
    // Set up the environment variables with set[owners] uniqueness
    appWithClient = await setupApplication({
      list_kinds: 'book-list',
      uniqueness_list_fields: '_slug,_kind',
      uniqueness_list_scope: 'set[owners]',
    });
    ({ client } = appWithClient);

    // First list creation with multiple owners - should succeed
    const firstList: Partial<List> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _ownerUsers: ['user-123', 'user-456', 'user-789'],
      description: 'A list of science fiction books',
    };

    const firstResponse = await client
      .post('/lists')
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
    const secondList: Partial<List> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _ownerUsers: ['user-123', 'user-999'], // user-123 exists in first list
      description: 'Another list of science fiction books',
    };

    const errorResponse = await client
      .post('/lists')
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
      uniqueness_list_scope: 'set[actives]',
    });
    ({ client } = appWithClient);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1); // Yesterday

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // 7 days from now

    // First list creation with validity period - should succeed
    const firstList: DataObject<List> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _ownerUsers: ['user-123'],
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      description: 'A list of science fiction books',
    };

    const firstResponse = await client
      .post('/lists')
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
    const secondList: Partial<List> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _ownerUsers: ['user-999'], // Different owner
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: null, // No end date, meaning indefinitely active
      description: 'Another list of science fiction books',
    };

    const errorResponse = await client
      .post('/lists')
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
      uniqueness_list_scope: 'set[actives]',
    });
    ({ client } = appWithClient);

    const pastStartDate = new Date();
    pastStartDate.setDate(pastStartDate.getDate() - 7); // 7 days ago

    const pastEndDate = new Date();
    pastEndDate.setDate(pastEndDate.getDate() - 1); // Yesterday

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // 7 days from now

    // First list creation with validity period in the past - should succeed
    const firstList: DataObject<List> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _ownerUsers: ['user-123'],
      _validFromDateTime: pastStartDate.toISOString(),
      _validUntilDateTime: pastEndDate.toISOString(), // List is now inactive
      description: 'A list of science fiction books',
    };

    const firstResponse = await client
      .post('/lists')
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
    const secondList: Partial<List> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _ownerUsers: ['user-999'], // Different owner
      _validFromDateTime: new Date().toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      description: 'Another list of science fiction books',
    };

    const secondResponse = await client
      .post('/lists')
      .send(secondList)
      .expect(200);

    expect(secondResponse.body._slug).to.be.equal('science-fiction-books');
    expect(secondResponse.body._kind).to.be.equal('book-list');
    expect(secondResponse.body._validFromDateTime).to.not.be.null();
    expect(secondResponse.body._validUntilDateTime).to.be.equal(
      futureDate.toISOString(),
    );

    // Verify only one record exists by getting all lists
    const getAllResponse = await client.get('/lists').expect(200);
    expect(getAllResponse.body).to.be.Array().lengthOf(2); // Two records should exist
  });

  it('automatically sets validFromDateTime when autoapprove_list is true', async () => {
    // Set up the environment variables with autoapprove_list enabled
    appWithClient = await setupApplication({
      list_kinds: 'book-list',
      autoapprove_list: 'true',
    });
    ({ client } = appWithClient);

    const newList: Partial<List> = {
      _name: 'Auto Approved List',
      _kind: 'book-list',
      description: 'A list that should be auto-approved',
    };

    const response = await client.post('/lists').send(newList).expect(200);

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

    const newList: Partial<List> = {
      _name: 'Auto Approved Book List',
      _kind: 'book-list',
      description: 'A book list that should be auto-approved',
    };

    const response = await client.post('/lists').send(newList).expect(200);

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

    const newList: Partial<List> = {
      _name: 'Non Auto Approved Book List',
      _kind: 'book-list',
      description: 'A book list that should not be auto-approved',
    };

    const response = await client.post('/lists').send(newList).expect(200);

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

    const newList: Partial<List> = {
      _name: 'Private List',
      _kind: 'book-list',
      description: 'A list that should be private by default',
    };

    const response = await client.post('/lists').send(newList).expect(200);

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

    const newList: Partial<List> = {
      _name: 'Public Book List',
      _kind: 'book-list',
      description: 'A book list that should be public by default',
    };

    const response = await client.post('/lists').send(newList).expect(200);

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

    const newList: Partial<List> = {
      _name: 'Invalid Visibility List',
      _kind: 'book-list',
      _visibility: 'invalid-value', // Invalid visibility value
      description: 'A list with invalid visibility',
    };

    const errorResponse = await client.post('/lists').send(newList).expect(422);

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
      list_kinds: 'book-list',
      record_limit_list_count: '2', // Only allow 2 records total
    });
    ({ client } = appWithClient);

    // First list - should succeed
    const firstList = {
      _name: 'First List',
      _kind: 'book-list',
      description: 'First list within limit',
    };
    await client.post('/lists').send(firstList).expect(200);

    // Second list - should succeed
    const secondList = {
      _name: 'Second List',
      _kind: 'book-list',
      description: 'Second list within limit',
    };
    await client.post('/lists').send(secondList).expect(200);

    // Third list - should fail due to limit
    const thirdList = {
      _name: 'Third List',
      _kind: 'book-list',
      description: 'Third list exceeding limit',
    };
    const errorResponse = await client
      .post('/lists')
      .send(thirdList)
      .expect(429);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      message: 'List limit is exceeded.',
      code: 'LIST-LIMIT-EXCEEDED',
      status: 429,
      details: [
        {
          code: 'LIST-LIMIT-EXCEEDED',
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
      list_kinds: 'book-list,featured-list',
      'record_limit_list_count_for_book-list': '1', // Only allow 1 book-list
    });
    ({ client } = appWithClient);

    // First book list - should succeed
    const firstBookList = {
      _name: 'First Book List',
      _kind: 'book-list',
      description: 'First book list within limit',
    };
    await client.post('/lists').send(firstBookList).expect(200);

    // Featured list - should succeed (different kind)
    const featuredList = {
      _name: 'Featured List',
      _kind: 'featured-list',
      description: 'Featured list not affected by book-list limit',
    };
    await client.post('/lists').send(featuredList).expect(200);

    // Second book list - should fail due to kind-specific limit
    const secondBookList = {
      _name: 'Second Book List',
      _kind: 'book-list',
      description: 'Second book list exceeding limit',
    };
    const errorResponse = await client
      .post('/lists')
      .send(secondBookList)
      .expect(429);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      message: 'List limit is exceeded.',
      code: 'LIST-LIMIT-EXCEEDED',
      status: 429,
      details: [
        {
          code: 'LIST-LIMIT-EXCEEDED',
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
      list_kinds: 'book-list',
      record_limit_list_count: '2', // Allow 2 records total and active at a time
      record_limit_list_scope: 'set[actives]', // Limit applies to active records
    });
    ({ client } = appWithClient);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    // First active list - should succeed
    const firstList = {
      _name: 'First Active List',
      _kind: 'book-list',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      description: 'First active list within limit',
    };
    await client.post('/lists').send(firstList).expect(200);

    // Second active list - should succeed
    const secondList = {
      _name: 'Second Active List',
      _kind: 'book-list',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      description: 'Second active list within limit',
    };
    await client.post('/lists').send(secondList).expect(200);

    // Inactive list - should succeed despite active records limit
    const inactiveList = {
      _name: 'Inactive List',
      _kind: 'book-list',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(), // Already expired
      description: 'Inactive list not counted in active limit',
    };
    await client.post('/lists').send(inactiveList).expect(200);

    // Third active list - should fail due to active records limit
    const thirdActiveList = {
      _name: 'Third Active List',
      _kind: 'book-list',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      description: 'Third active list exceeding limit',
    };
    const errorResponse = await client
      .post('/lists')
      .send(thirdActiveList)
      .expect(429);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      message: 'List limit is exceeded.',
      code: 'LIST-LIMIT-EXCEEDED',
      status: 429,
      details: [
        {
          code: 'LIST-LIMIT-EXCEEDED',
          info: {
            limit: 2,
          },
        },
      ],
    });
  });

  it('enforces kind-specific record set limit for active records', async () => {
    // Set up the environment variables with kind-specific record set limit
    appWithClient = await setupApplication({
      list_kinds: 'book-list,featured-list',
      'record_limit_list_scope_for_book-list': 'set[actives]',
      'record_limit_list_count_for_book-list': '1', // Only 1 active book-list
    });
    ({ client } = appWithClient);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    // First active book list - should succeed
    const firstBookList = {
      _name: 'First Active Book List',
      _kind: 'book-list',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      description: 'First active book list within limit',
    };
    await client.post('/lists').send(firstBookList).expect(200);

    // Active featured list - should succeed (different kind)
    const featuredList = {
      _name: 'Active Featured List',
      _kind: 'featured-list',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      description: 'Featured list not affected by book-list limit',
    };
    await client.post('/lists').send(featuredList).expect(200);

    // Second active book list - should fail due to kind-specific active limit
    const secondBookList = {
      _name: 'Second Active Book List',
      _kind: 'book-list',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      description: 'Second active book list exceeding limit',
    };
    const errorResponse = await client
      .post('/lists')
      .send(secondBookList)
      .expect(429);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      message: 'List limit is exceeded.',
      code: 'LIST-LIMIT-EXCEEDED',
      status: 429,
      details: [
        {
          code: 'LIST-LIMIT-EXCEEDED',
          info: {
            limit: 1,
          },
        },
      ],
    });
  });

  it('enforces record set limit for active and public records', async () => {
    // Set up the environment variables with record set limit for both active and public records
    appWithClient = await setupApplication({
      list_kinds: 'book-list',
      record_limit_list_count: '2', // Allow 2 records total that are both active and public
      record_limit_list_scope: 'set[actives]&set[publics]', // Limit applies to records that are both active and public
    });
    ({ client } = appWithClient);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    // First active and public list - should succeed
    const firstList = {
      _name: 'First Active Public List',
      _kind: 'book-list',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      _visibility: 'public',
      description: 'First active and public list within limit',
    };
    await client.post('/lists').send(firstList).expect(200);

    // Second active and public list - should succeed
    const secondList = {
      _name: 'Second Active Public List',
      _kind: 'book-list',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      _visibility: 'public',
      description: 'Second active and public list within limit',
    };
    await client.post('/lists').send(secondList).expect(200);

    // Active but private list - should succeed despite limit (not public)
    const privateList = {
      _name: 'Private Active List',
      _kind: 'book-list',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      _visibility: 'private',
      description: 'Private active list not counted in limit',
    };
    await client.post('/lists').send(privateList).expect(200);

    // Public but inactive list - should succeed despite limit (not active)
    const inactiveList = {
      _name: 'Inactive Public List',
      _kind: 'book-list',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(), // Already expired
      _visibility: 'public',
      description: 'Inactive public list not counted in limit',
    };
    await client.post('/lists').send(inactiveList).expect(200);

    // Third active and public list - should fail due to combined active+public limit
    const thirdActivePublicList = {
      _name: 'Third Active Public List',
      _kind: 'book-list',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      _visibility: 'public',
      description: 'Third active and public list exceeding limit',
    };
    const errorResponse = await client
      .post('/lists')
      .send(thirdActivePublicList)
      .expect(429);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      message: 'List limit is exceeded.',
      code: 'LIST-LIMIT-EXCEEDED',
      status: 429,
      details: [
        {
          code: 'LIST-LIMIT-EXCEEDED',
          info: {
            limit: 2,
          },
        },
      ],
    });
  });

  it('enforces record limit per user using owners set', async () => {
    // Set up the environment variables with record set limit for owners
    appWithClient = await setupApplication({
      list_kinds: 'book-list',
      record_limit_list_count: '2', // Allow 2 records per user
      record_limit_list_scope: 'set[owners]', // Limit applies per owner
    });
    ({ client } = appWithClient);

    const userId = 'user-123';

    // First list for user - should succeed
    const firstList = {
      _name: 'First User List',
      _kind: 'book-list',
      _ownerUsers: [userId],
      description: 'First list for the user within limit',
    };
    await client.post('/lists').send(firstList).expect(200);

    // Second list for user - should succeed
    const secondList = {
      _name: 'Second User List',
      _kind: 'book-list',
      _ownerUsers: [userId],
      description: 'Second list for the user within limit',
    };
    await client.post('/lists').send(secondList).expect(200);

    // List for different user - should succeed despite limit
    const differentUserList = {
      _name: 'Different User List',
      _kind: 'book-list',
      _ownerUsers: ['user-456'],
      description: 'List for different user not counted in limit',
    };
    await client.post('/lists').send(differentUserList).expect(200);

    // List with multiple owners including our user - should fail due to user's limit
    const multiOwnerList = {
      _name: 'Multi Owner List',
      _kind: 'book-list',
      _ownerUsers: [userId, 'user-789'], // Includes the limited user
      description: 'List with multiple owners including limited user',
    };
    const errorResponse = await client
      .post('/lists')
      .send(multiOwnerList)
      .expect(429);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      message: 'List limit is exceeded.',
      code: 'LIST-LIMIT-EXCEEDED',
      status: 429,
      details: [
        {
          code: 'LIST-LIMIT-EXCEEDED',
          info: {
            limit: 2,
          },
        },
      ],
    });

    // Third list for user - should fail due to user's limit
    const thirdList = {
      _name: 'Third User List',
      _kind: 'book-list',
      _ownerUsers: [userId],
      description: 'Third list for the user exceeding limit',
    };
    const secondErrorResponse = await client
      .post('/lists')
      .send(thirdList)
      .expect(429);

    expect(secondErrorResponse.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      message: 'List limit is exceeded.',
      code: 'LIST-LIMIT-EXCEEDED',
      status: 429,
      details: [
        {
          code: 'LIST-LIMIT-EXCEEDED',
          info: {
            limit: 2,
          },
        },
      ],
    });
  });

  it('enforces idempotency based on configured fields', async () => {
    // Set up the environment variables with idempotency configuration
    appWithClient = await setupApplication({
      list_kinds: 'book-list',
      idempotency_list: '_kind,_slug,description', // Configure idempotency fields
    });
    ({ client } = appWithClient);

    // First list creation - should succeed
    const firstList = {
      _name: 'Science Books',
      _kind: 'book-list',
      description: 'A list of science books', // This will be part of idempotency check
      _ownerUsers: ['user-123'], // This field is not part of idempotency
      _visibility: 'private', // This field is not part of idempotency
    };

    const firstResponse = await client
      .post('/lists')
      .send(firstList)
      .expect(200);

    // Verify the first response
    expect(firstResponse.body._slug).to.be.equal('science-books');
    expect(firstResponse.body._kind).to.be.equal('book-list');
    expect(firstResponse.body.description).to.be.equal(
      'A list of science books',
    );
    expect(firstResponse.body._ownerUsers).to.containDeep(['user-123']);
    expect(firstResponse.body._visibility).to.be.equal('private');

    // Second list with same idempotency fields but different other fields
    const secondList = {
      _name: 'Science Books', // Same name will generate same slug
      _kind: 'book-list', // Same kind
      description: 'A list of science books', // Same description
      _ownerUsers: ['user-456'], // Different owner
      _visibility: 'public', // Different visibility
    };

    const secondResponse = await client
      .post('/lists')
      .send(secondList)
      .expect(200);

    // Verify all fields in the second response match the first response
    expectResponseToMatch(secondResponse.body, firstResponse.body);

    // Verify only one record exists by getting all lists
    const getAllResponse = await client.get('/lists').expect(200);
    expect(getAllResponse.body).to.be.Array().lengthOf(1); // Only one record should exist
  });

  it('enforces kind-specific idempotency configuration', async () => {
    // Set up the environment variables with kind-specific idempotency
    appWithClient = await setupApplication({
      list_kinds: 'book-list,featured-list',
      'idempotency_list_for_book-list': '_kind,_slug,_ownerUsers', // Different fields for book-list
      'idempotency_list_for_featured-list': '_kind,description', // Different fields for featured-list
    });
    ({ client } = appWithClient);

    // First book list - should succeed
    const firstBookList = {
      _name: 'Science Books',
      _kind: 'book-list',
      description: 'First description', // Not part of idempotency for book-list
      _ownerUsers: ['user-123'], // Part of idempotency for book-list
    };

    const firstBookResponse = await client
      .post('/lists')
      .send(firstBookList)
      .expect(200);

    // Second book list with same idempotency fields - should return same record
    const secondBookList = {
      _name: 'Science Books', // Will generate same slug
      _kind: 'book-list',
      description: 'Different description', // Can be different as not part of idempotency
      _ownerUsers: ['user-123'], // Same owner
    };

    const secondBookResponse = await client
      .post('/lists')
      .send(secondBookList)
      .expect(200);

    // Verify responses match
    expectResponseToMatch(secondBookResponse.body, firstBookResponse.body);

    // First featured list - should succeed
    const firstFeaturedList = {
      _name: 'Featured Books',
      _kind: 'featured-list',
      description: 'Featured description', // Part of idempotency for featured-list
      _ownerUsers: ['user-456'], // Not part of idempotency for featured-list
    };

    const firstFeaturedResponse = await client
      .post('/lists')
      .send(firstFeaturedList)
      .expect(200);

    // Second featured list with same idempotency fields - should return same record
    const secondFeaturedList = {
      _name: 'Different Name', // Can be different as not part of idempotency
      _kind: 'featured-list',
      description: 'Featured description', // Same description
      _ownerUsers: ['user-789'], // Can be different as not part of idempotency
    };

    const secondFeaturedResponse = await client
      .post('/lists')
      .send(secondFeaturedList)
      .expect(200);

    // Verify responses match
    expectResponseToMatch(
      secondFeaturedResponse.body,
      firstFeaturedResponse.body,
    );

    // Verify only two records exist (one for each kind)
    const getAllResponse = await client.get('/lists').expect(200);
    expect(getAllResponse.body).to.be.Array().lengthOf(2);
  });

  it('enforces idempotency with array fields', async () => {
    // Set up the environment variables with array fields in idempotency
    appWithClient = await setupApplication({
      list_kinds: 'book-list',
      idempotency_list: '_kind,_ownerUsers,_viewerUsers', // Using array fields for idempotency
    });
    ({ client } = appWithClient);

    // First list - should succeed
    const firstList = {
      _name: 'First List',
      _kind: 'book-list',
      _ownerUsers: ['user-123', 'user-456'],
      _viewerUsers: ['viewer-1', 'viewer-2'],
      description: 'First description',
    };

    const firstResponse = await client
      .post('/lists')
      .send(firstList)
      .expect(200);

    // Second list with same array values but different order - should return same record
    const secondList = {
      _name: 'Different Name',
      _kind: 'book-list',
      _ownerUsers: ['user-456', 'user-123'], // Same values, different order
      _viewerUsers: ['viewer-2', 'viewer-1'], // Same values, different order
      description: 'Different description',
    };

    const secondResponse = await client
      .post('/lists')
      .send(secondList)
      .expect(200);

    // Verify responses match
    expectResponseToMatch(secondResponse.body, firstResponse.body);

    // Verify only one record exists
    const getAllResponse = await client.get('/lists').expect(200);
    expect(getAllResponse.body).to.be.Array().lengthOf(1);
  });

  it('enforces idempotency with date fields', async () => {
    // Set up the environment variables with date fields in idempotency
    appWithClient = await setupApplication({
      list_kinds: 'book-list',
      idempotency_list: '_kind,_validFromDateTime,_validUntilDateTime', // Using date fields for idempotency
    });
    ({ client } = appWithClient);

    const validFrom = new Date();
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 7);

    // First list - should succeed
    const firstList = {
      _name: 'First List',
      _kind: 'book-list',
      _validFromDateTime: validFrom.toISOString(),
      _validUntilDateTime: validUntil.toISOString(),
      description: 'First description',
    };

    const firstResponse = await client
      .post('/lists')
      .send(firstList)
      .expect(200);

    // Second list with same dates but different other fields - should return same record
    const secondList = {
      _name: 'Different Name',
      _kind: 'book-list',
      _validFromDateTime: validFrom.toISOString(),
      _validUntilDateTime: validUntil.toISOString(),
      description: 'Different description',
    };

    const secondResponse = await client
      .post('/lists')
      .send(secondList)
      .expect(200);

    // Verify responses match
    expectResponseToMatch(secondResponse.body, firstResponse.body);

    // Verify only one record exists
    const getAllResponse = await client.get('/lists').expect(200);
    expect(getAllResponse.body).to.be.Array().lengthOf(1);
  });
});
