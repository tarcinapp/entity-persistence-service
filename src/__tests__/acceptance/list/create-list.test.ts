import type { DataObject } from '@loopback/repository';
import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { List } from '../../../models';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
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

  it('creates a new generic list with explicitly provided managed fields', async () => {
    appWithClient = await setupApplication({
      list_kinds: 'list',
    });
    ({ client } = appWithClient);

    // EPBO pre-resolves all managed fields before the request reaches EPS.
    // Tests must supply them explicitly, matching what EPBO would inject.
    const newList = {
      _name: "Editor's Pick",
      _kind: 'list',
      _slug: 'editors-pick',
      _visibility: 'protected',
      _validFromDateTime: null,
      _validUntilDateTime: null,
      description: 'List of items that the editor has picked',
    };

    const response = await client.post('/lists').send(newList).expect(200);

    // checks name and description
    expect(response.body).to.containDeep({
      _name: "Editor's Pick",
      description: 'List of items that the editor has picked',
    });

    // checks managed fields stored by EPS
    expect(response.body._id).to.be.String();
    expect(response.body._kind).to.be.equal('list');
    expect(response.body._slug).to.be.equal('editors-pick');
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
      LIST_UNIQUENESS: 'where[_slug]=${_slug}&where[_kind]=${_kind}',
    });
    ({ client } = appWithClient);

    // EPBO pre-resolves _slug; tests must supply it explicitly.
    const firstList: Partial<List> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _slug: 'science-fiction-books',
      description: 'A list of science fiction books',
    };

    const response = await client.post('/lists').send(firstList).expect(200);

    expect(response.body._slug).to.be.equal('science-fiction-books');
    expect(response.body._kind).to.be.equal('book-list');

    // Second list with same slug and kind - should fail
    const secondList: Partial<List> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _slug: 'science-fiction-books',
      description: 'Another list of science fiction books',
    };

    const errorResponse = await client
      .post('/lists')
      .send(secondList)
      .expect(409);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 409,
      name: 'UniquenessViolationError',
      message: 'List already exists',
      code: 'LIST-UNIQUENESS-VIOLATION',
      details: [
        {
          code: 'LIST-UNIQUENESS-VIOLATION',
          message: 'List already exists',
          info: {
            scope: 'where[_slug]=science-fiction-books&where[_kind]=book-list',
          },
        },
      ],
    });
    expect(errorResponse.body.error.requestId ?? '').to.match(/.+/);
  });

  it('rejects duplicate list based on uniqueness configuration including owner users', async () => {
    // Set up the environment variables
    appWithClient = await setupApplication({
      list_kinds: 'book-list',
      LIST_UNIQUENESS:
        'where[_slug]=${_slug}&where[_kind]=${_kind}&set[owners][userIds]=${_ownerUsers}',
    });
    ({ client } = appWithClient);

    // EPBO pre-resolves _slug; tests must supply it explicitly.
    const firstList: Partial<List> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _slug: 'science-fiction-books',
      _ownerUsers: ['user-123'],
      description: 'A list of science fiction books',
    };

    const response = await client.post('/lists').send(firstList).expect(200);

    expect(response.body._slug).to.be.equal('science-fiction-books');
    expect(response.body._kind).to.be.equal('book-list');
    expect(response.body._ownerUsers).to.containDeep(['user-123']);

    // Second list with same slug, kind and owner - should fail
    const secondList: Partial<List> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _slug: 'science-fiction-books',
      _ownerUsers: ['user-123'],
      description: 'Another list of science fiction books',
    };

    const errorResponse = await client
      .post('/lists')
      .send(secondList)
      .expect(409);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 409,
      name: 'UniquenessViolationError',
      message: 'List already exists',
      code: 'LIST-UNIQUENESS-VIOLATION',
      details: [
        {
          code: 'LIST-UNIQUENESS-VIOLATION',
          message: 'List already exists',
          info: {
            scope:
              'where[_slug]=science-fiction-books&where[_kind]=book-list&set[owners][userIds]=user-123',
          },
        },
      ],
    });
  });

  it('rejects duplicate list when uniqueness set includes owners and same user exists', async () => {
    // Set up the environment variables with set[owners] uniqueness
    appWithClient = await setupApplication({
      list_kinds: 'book-list',
      LIST_UNIQUENESS:
        'where[_slug]=${_slug}&where[_kind]=${_kind}&set[owners][userIds]=${_ownerUsers}',
    });
    ({ client } = appWithClient);

    // EPBO pre-resolves _slug; tests must supply it explicitly.
    const firstList: Partial<List> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _slug: 'science-fiction-books',
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

    // Second list with same slug, kind, and one overlapping owner - should fail
    const secondList: Partial<List> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _slug: 'science-fiction-books',
      _ownerUsers: ['user-123', 'user-999'], // user-123 exists in first list
      description: 'Another list of science fiction books',
    };

    const errorResponse = await client
      .post('/lists')
      .send(secondList)
      .expect(409);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 409,
      name: 'UniquenessViolationError',
      message: 'List already exists',
      code: 'LIST-UNIQUENESS-VIOLATION',
      details: [
        {
          code: 'LIST-UNIQUENESS-VIOLATION',
          message: 'List already exists',
          info: {
            scope:
              'where[_slug]=science-fiction-books&where[_kind]=book-list&set[owners][userIds]=user-123,user-999',
          },
        },
      ],
    });
  });

  it('rejects duplicate list when uniqueness set includes actives and both lists are active', async () => {
    // Set up the environment variables with set[actives] uniqueness
    appWithClient = await setupApplication({
      list_kinds: 'book-list',
      LIST_UNIQUENESS:
        'where[_slug]=${_slug}&where[_kind]=${_kind}&set[actives]',
    });
    ({ client } = appWithClient);

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1); // Yesterday

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // 7 days from now

    // EPBO pre-resolves _slug; tests must supply it explicitly.
    const firstList: DataObject<List> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _slug: 'science-fiction-books',
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

    // Second list with same slug and kind, different owner, but also active - should fail
    const secondList: Partial<List> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _slug: 'science-fiction-books',
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
      name: 'UniquenessViolationError',
      message: 'List already exists',
      code: 'LIST-UNIQUENESS-VIOLATION',
      details: [
        {
          code: 'LIST-UNIQUENESS-VIOLATION',
          message: 'List already exists',
          info: {
            scope:
              'where[_slug]=science-fiction-books&where[_kind]=book-list&set[actives]',
          },
        },
      ],
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

    // EPBO pre-resolves _slug; tests must supply it explicitly.
    const firstList: DataObject<List> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _slug: 'science-fiction-books',
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

    // Second list with same slug and kind, different owner, and active - should succeed since first list is inactive
    const secondList: Partial<List> = {
      _name: 'Science Fiction Books',
      _kind: 'book-list',
      _slug: 'science-fiction-books',
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
      code: 'VALIDATION-FAILED',
    });
  });

  it('enforces global record count limit', async () => {
    // Set up the environment variables with record limit
    appWithClient = await setupApplication({
      list_kinds: 'book-list',
      LIST_RECORD_LIMITS: '[{"scope":"","limit":2}]',
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
      message: 'Record limit exceeded for list',
      code: 'LIST-LIMIT-EXCEEDED',
      details: [
        {
          code: 'LIST-LIMIT-EXCEEDED',
          message: 'Record limit exceeded for list',
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
      list_kinds: 'book-list,featured-list',
      LIST_RECORD_LIMITS: '[{"scope":"where[_kind]=book-list","limit":1}]', // Only allow 1 book-list
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
      message: 'Record limit exceeded for list',
      code: 'LIST-LIMIT-EXCEEDED',
      details: [
        {
          code: 'LIST-LIMIT-EXCEEDED',
          message: 'Record limit exceeded for list',
          info: {
            limit: 1,
            scope: 'where[_kind]=book-list',
          },
        },
      ],
    });
  });

  it('enforces record set limit for active records', async () => {
    // Set up the environment variables with record set limit for active records
    appWithClient = await setupApplication({
      list_kinds: 'book-list',
      LIST_RECORD_LIMITS: '[{"scope":"set[actives]","limit":2}]', // Allow 2 active records at a time
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
      message: 'Record limit exceeded for list',
      code: 'LIST-LIMIT-EXCEEDED',
      details: [
        {
          code: 'LIST-LIMIT-EXCEEDED',
          message: 'Record limit exceeded for list',
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
      list_kinds: 'book-list,featured-list',
      LIST_RECORD_LIMITS:
        '[{"scope":"set[actives]&where[_kind]=book-list","limit":1}]', // Only 1 active book-list
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
      message: 'Record limit exceeded for list',
      code: 'LIST-LIMIT-EXCEEDED',
      details: [
        {
          code: 'LIST-LIMIT-EXCEEDED',
          message: 'Record limit exceeded for list',
          info: {
            limit: 1,
            scope: 'set[actives]&where[_kind]=book-list',
          },
        },
      ],
    });
  });

  it('enforces record set limit for active and public records', async () => {
    // Set up the environment variables with record set limit for both active and public records
    appWithClient = await setupApplication({
      list_kinds: 'book-list',
      LIST_RECORD_LIMITS: '[{"scope":"set[actives]&set[publics]","limit":2}]', // Allow 2 records that are both active and public
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
      message: 'Record limit exceeded for list',
      code: 'LIST-LIMIT-EXCEEDED',
      details: [
        {
          code: 'LIST-LIMIT-EXCEEDED',
          message: 'Record limit exceeded for list',
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
      list_kinds: 'book-list',
      LIST_RECORD_LIMITS:
        '[{"scope":"set[owners][userIds]=${_ownerUsers}","limit":2}]', // Allow 2 records per user
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
      message: 'Record limit exceeded for list',
      code: 'LIST-LIMIT-EXCEEDED',
      details: [
        {
          code: 'LIST-LIMIT-EXCEEDED',
          message: 'Record limit exceeded for list',
          info: {
            limit: 2,
            scope: 'set[owners][userIds]=user-123,user-789',
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
      message: 'Record limit exceeded for list',
      code: 'LIST-LIMIT-EXCEEDED',
      details: [
        {
          code: 'LIST-LIMIT-EXCEEDED',
          message: 'Record limit exceeded for list',
          info: {
            limit: 2,
            scope: 'set[owners][userIds]=user-123',
          },
        },
      ],
    });
  });

});
