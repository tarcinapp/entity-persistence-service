import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { ListReaction } from '../../../models';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestList,
} from '../test-helper';

describe('POST /list-reactions', () => {
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

  it('creates a new list reaction with default kind', async () => {
    appWithClient = await setupApplication({});
    ({ client } = appWithClient);

    // First, create a list to react to
    const listId = await createTestList(client, {
      _name: 'Sample Book List',
      description: 'A sample book list',
    });

    const newReaction: Partial<ListReaction> = {
      _listId: listId,
      _name: 'Like',
      description: 'A like reaction',
    };

    const response = await client
      .post('/list-reactions')
      .send(newReaction)
      .expect(200);

    expect(response.body).to.containDeep(newReaction);
    expect(response.body._id).to.be.String();
    expect(response.body._listId).to.equal(listId);
    expect(response.body._kind).to.be.equal('list-reaction'); // default kind
    expect(response.body._slug).to.be.equal('like');
    expect(response.body._createdDateTime).to.be.String();
    expect(response.body._lastUpdatedDateTime).to.be.String();
    expect(response.body._visibility).to.be.String();
    expect(response.body._version).to.be.equal(1);
  });

  it('creates a list reaction with specified kind', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like,dislike',
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'Sample Book List',
      description: 'A sample book list',
    });

    const newReaction: Partial<ListReaction> = {
      _listId: listId,
      _kind: 'like',
      _name: 'Like',
      description: 'A like reaction',
    };

    const response = await client
      .post('/list-reactions')
      .send(newReaction)
      .expect(200);

    expect(response.body).to.containDeep(newReaction);
    expect(response.body._kind).to.be.equal('like');
  });

  it('rejects invalid list reaction kind', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like,dislike',
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'Sample Book List',
      description: 'A sample book list',
    });

    const newReaction: Partial<ListReaction> = {
      _listId: listId,
      _kind: 'love', // Invalid kind
      _name: 'Love',
      description: 'A love reaction',
    };

    const errorResponse = await client
      .post('/list-reactions')
      .send(newReaction)
      .expect(422);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 422,
      name: 'InvalidKindError',
      code: 'INVALID-LIST-REACTION-KIND',
      status: 422,
    });
  });

  it('rejects duplicate list reaction based on uniqueness configuration', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like',
      LIST_REACTION_UNIQUENESS:
        'where[_kind]=${_kind}&where[_listId]=${_listId}',
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'The Great Gatsby List',
      _kind: 'reading-list',
      description: 'A classic list',
    });

    // First reaction creation - should succeed
    const firstReaction: Partial<ListReaction> = {
      _listId: listId,
      _kind: 'like',
      _name: 'Like', // arbitrary, non-managed field
      description: 'A like reaction',
    };
    await client
      .post('/list-reactions')
      .send(firstReaction)
      .expect(200);

    // Second reaction with same kind and listId - should fail
    const secondReaction: Partial<ListReaction> = {
      _listId: listId,
      _kind: 'like',
      _name: 'Like',
      description: 'Another like',
    };
    const errorResponse = await client
      .post('/list-reactions')
      .send(secondReaction)
      .expect(409);
    expect(errorResponse.body.error).to.containDeep({
      statusCode: 409,
      name: 'UniquenessViolationError',
      code: 'LISTREACTION-UNIQUENESS-VIOLATION',
      status: 409,
    });
  });

  it('rejects duplicate list reaction based on uniqueness configuration including owner users', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like',
      LIST_REACTION_UNIQUENESS:
        'where[_slug]=${_slug}&where[_kind]=${_kind}&set[owners][userIds]=${_ownerUsers}',
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'The Great Gatsby List',
      _kind: 'reading-list',
      description: 'A classic list',
    });

    // First reaction creation - should succeed
    const firstReaction: Partial<ListReaction> = {
      _listId: listId,
      _kind: 'like',
      _name: 'Like',
      _ownerUsers: ['user-123'],
      description: 'A like reaction',
    };
    const response = await client
      .post('/list-reactions')
      .send(firstReaction)
      .expect(200);
    expect(response.body._slug).to.be.equal('like');
    expect(response.body._kind).to.be.equal('like');
    expect(response.body._ownerUsers).to.containDeep(['user-123']);

    // Second reaction with same slug, kind, and owner - should fail
    const secondReaction: Partial<ListReaction> = {
      _listId: listId,
      _kind: 'like',
      _name: 'Like',
      _ownerUsers: ['user-123'],
      description: 'Another like',
    };
    const errorResponse2 = await client
      .post('/list-reactions')
      .send(secondReaction)
      .expect(409);
    expect(errorResponse2.body.error).to.containDeep({
      statusCode: 409,
      name: 'UniquenessViolationError',
      code: 'LISTREACTION-UNIQUENESS-VIOLATION',
      status: 409,
    });
  });

  it('allows duplicate list reaction with different owner users when uniqueness includes owner users', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like',
      LIST_REACTION_UNIQUENESS:
        'where[_slug]=${_slug}&where[_kind]=${_kind}&set[owners][userIds]=${_ownerUsers}',
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'The Great Gatsby List',
      _kind: 'reading-list',
      description: 'A classic list',
    });

    // First reaction creation - should succeed
    const firstReaction: Partial<ListReaction> = {
      _listId: listId,
      _kind: 'like',
      _name: 'Like',
      _ownerUsers: ['user-123', 'user-456'],
      description: 'A like reaction',
    };
    const firstResponse = await client
      .post('/list-reactions')
      .send(firstReaction)
      .expect(200);
    expect(firstResponse.body._ownerUsers).to.containDeep([
      'user-123',
      'user-456',
    ]);

    // Second reaction with different owner - should succeed
    const secondReaction: Partial<ListReaction> = {
      _listId: listId,
      _kind: 'like',
      _name: 'Like',
      _ownerUsers: ['user-789'],
      description: 'Another like',
    };
    const secondResponse = await client
      .post('/list-reactions')
      .send(secondReaction)
      .expect(200);
    expect(secondResponse.body._ownerUsers).to.containDeep(['user-789']);
  });

  it('rejects duplicate list reaction when uniqueness set includes owners and same user exists', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like',
      LIST_REACTION_UNIQUENESS:
        'where[_slug]=${_slug}&where[_kind]=${_kind}&set[owners][userIds]=${_ownerUsers}',
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'The Great Gatsby List',
      _kind: 'reading-list',
      description: 'A classic list',
    });

    // First reaction creation with multiple owners - should succeed
    const firstReaction: Partial<ListReaction> = {
      _listId: listId,
      _kind: 'like',
      _name: 'Like',
      _ownerUsers: ['user-123', 'user-456', 'user-789'],
      description: 'A like reaction',
    };
    const firstResponse = await client
      .post('/list-reactions')
      .send(firstReaction)
      .expect(200);
    expect(firstResponse.body._ownerUsers).to.containDeep([
      'user-123',
      'user-456',
      'user-789',
    ]);

    // Second reaction with overlapping owner - should fail
    const secondReaction: Partial<ListReaction> = {
      _listId: listId,
      _kind: 'like',
      _name: 'Like',
      _ownerUsers: ['user-123', 'user-999'],
      description: 'Another like',
    };
    const errorResponse3 = await client
      .post('/list-reactions')
      .send(secondReaction)
      .expect(409);
    expect(errorResponse3.body.error).to.containDeep({
      statusCode: 409,
      name: 'UniquenessViolationError',
      code: 'LISTREACTION-UNIQUENESS-VIOLATION',
      status: 409,
    });
  });

  it('rejects duplicate list reaction when uniqueness set includes actives and both reactions are active', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like',
      LIST_REACTION_UNIQUENESS:
        'where[_slug]=${_slug}&where[_kind]=${_kind}&set[actives]',
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'The Great Gatsby List',
      _kind: 'reading-list',
      description: 'A classic list',
    });

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    // First reaction creation with validity period - should succeed
    const firstReaction: Partial<ListReaction> = {
      _listId: listId,
      _kind: 'like',
      _name: 'Like',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      description: 'A like reaction',
    };
    const firstResponse2 = await client
      .post('/list-reactions')
      .send(firstReaction)
      .expect(200);
    expect(firstResponse2.body._validFromDateTime).to.be.equal(
      pastDate.toISOString(),
    );
    expect(firstResponse2.body._validUntilDateTime).to.be.equal(
      futureDate.toISOString(),
    );

    // Second reaction with same name, kind, and also active - should fail
    const secondReaction: Partial<ListReaction> = {
      _listId: listId,
      _kind: 'like',
      _name: 'Like',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: null, // Indefinitely active
      description: 'Another like',
    };
    const errorResponse4 = await client
      .post('/list-reactions')
      .send(secondReaction)
      .expect(409);
    expect(errorResponse4.body.error).to.containDeep({
      statusCode: 409,
      name: 'UniquenessViolationError',
      code: 'LISTREACTION-UNIQUENESS-VIOLATION',
      status: 409,
    });
  });

  it('allows duplicate list reaction when uniqueness set includes actives and existing reaction is inactive', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like',
      LIST_REACTION_UNIQUENESS:
        'where[_kind]=${_kind}&where[_listId]=${_listId}&set[actives]',
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'The Great Gatsby List',
      _kind: 'reading-list',
      description: 'A classic list',
    });

    const pastStartDate = new Date();
    pastStartDate.setDate(pastStartDate.getDate() - 7);
    const pastEndDate = new Date();
    pastEndDate.setDate(pastEndDate.getDate() - 1);
    const futureDate2 = new Date();
    futureDate2.setDate(futureDate2.getDate() + 7);

    // First reaction creation with validity period in the past - should succeed
    const firstReaction3: Partial<ListReaction> = {
      _listId: listId,
      _kind: 'like',
      _validFromDateTime: pastStartDate.toISOString(),
      _validUntilDateTime: pastEndDate.toISOString(), // Inactive
      description: 'A like reaction',
    };
    const firstResponse3 = await client
      .post('/list-reactions')
      .send(firstReaction3)
      .expect(200);
    expect(firstResponse3.body._validFromDateTime).to.be.equal(
      pastStartDate.toISOString(),
    );
    expect(firstResponse3.body._validUntilDateTime).to.be.equal(
      pastEndDate.toISOString(),
    );

    // Second reaction with same kind and listId, and active - should succeed
    const secondReaction3: Partial<ListReaction> = {
      _listId: listId,
      _kind: 'like',
      _validFromDateTime: new Date().toISOString(),
      _validUntilDateTime: futureDate2.toISOString(),
      description: 'Another like',
    };
    const secondResponse3 = await client
      .post('/list-reactions')
      .send(secondReaction3)
      .expect(200);
    expect(secondResponse3.body._validFromDateTime).to.not.be.null();
    expect(secondResponse3.body._validUntilDateTime).to.be.equal(
      futureDate2.toISOString(),
    );
  });

  it('automatically sets validFromDateTime when autoapprove_list_reaction is true', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like',
      autoapprove_list_reaction: 'true',
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'Auto Approved List',
      _kind: 'reading-list',
    });

    const newReaction: Partial<ListReaction> = {
      _listId: listId,
      _kind: 'like',
      description: 'A reaction that should be auto-approved',
    };

    const response = await client
      .post('/list-reactions')
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

  it('automatically sets validFromDateTime when autoapprove_list_reaction_for_kind matches', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like,dislike',
      autoapprove_list_reaction_for_like: 'true',
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'Auto Approved List',
      _kind: 'reading-list',
    });

    const newReaction: Partial<ListReaction> = {
      _listId: listId,
      _kind: 'like',
      description: 'A like reaction that should be auto-approved',
    };

    const response = await client
      .post('/list-reactions')
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

  it('does not set validFromDateTime when autoapprove_list_reaction_for_kind does not match', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like,dislike',
      autoapprove_list_reaction_for_dislike: 'true',
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'Non Auto Approved List',
      _kind: 'reading-list',
    });

    const newReaction: Partial<ListReaction> = {
      _listId: listId,
      _kind: 'like',
      description: 'A like reaction that should not be auto-approved',
    };

    const response = await client
      .post('/list-reactions')
      .send(newReaction)
      .expect(200);

    expect(response.body._validFromDateTime).to.be.null();
    expect(response.body.description).to.be.equal(
      'A like reaction that should not be auto-approved',
    );
  });

  it('sets visibility to private when visibility_list_reaction is configured as private', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like',
      visibility_list_reaction: 'private',
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'Private List',
      _kind: 'reading-list',
    });

    const newReaction: Partial<ListReaction> = {
      _listId: listId,
      _kind: 'like',
      description: 'A reaction that should be private by default',
    };

    const response = await client
      .post('/list-reactions')
      .send(newReaction)
      .expect(200);

    expect(response.body._visibility).to.be.equal('private');
  });

  it('sets visibility to public when visibility_list_reaction_for_kind is configured as public', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like,dislike',
      visibility_list_reaction_for_like: 'public',
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'Public List',
      _kind: 'reading-list',
    });

    const newReaction: Partial<ListReaction> = {
      _listId: listId,
      _kind: 'like',
      description: 'A like reaction that should be public by default',
    };

    const response = await client
      .post('/list-reactions')
      .send(newReaction)
      .expect(200);

    expect(response.body._visibility).to.be.equal('public');
  });

  it('rejects list reaction creation with invalid visibility value', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like',
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'Invalid Visibility List',
      _kind: 'reading-list',
    });

    const newReaction: Partial<ListReaction> = {
      _listId: listId,
      _kind: 'like',
      _visibility: 'invalid-value', // Invalid visibility value
      description: 'A reaction with invalid visibility',
    };

    const errorResponse = await client
      .post('/list-reactions')
      .send(newReaction)
      .expect(422);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 422,
      name: 'UnprocessableEntityError',
      code: 'VALIDATION_FAILED',
    });
  });

  it('enforces global record count limit for list reactions', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like',
      LIST_REACTION_RECORD_LIMITS: '[{"scope":"","limit":2}]',
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'First List',
      _kind: 'reading-list',
    });

    // First reaction - should succeed
    await client
      .post('/list-reactions')
      .send({ _listId: listId, _kind: 'like', description: 'First' })
      .expect(200);
    // Second reaction - should succeed
    await client
      .post('/list-reactions')
      .send({ _listId: listId, _kind: 'like', description: 'Second' })
      .expect(200);
    // Third reaction - should fail
    const errorResponse = await client
      .post('/list-reactions')
      .send({ _listId: listId, _kind: 'like', description: 'Third' })
      .expect(429);
    expect(errorResponse.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      code: 'LISTREACTION-LIMIT-EXCEEDED',
      status: 429,
    });
  });

  it('enforces kind-specific record count limit for list reactions', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like,dislike',
      LIST_REACTION_RECORD_LIMITS:
        '[{"scope":"where[_kind]=like","limit":1}]',
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'List',
      _kind: 'reading-list',
    });

    // First like reaction - should succeed
    await client
      .post('/list-reactions')
      .send({ _listId: listId, _kind: 'like', description: 'Like' })
      .expect(200);
    // Dislike reaction - should succeed
    await client
      .post('/list-reactions')
      .send({ _listId: listId, _kind: 'dislike', description: 'Dislike' })
      .expect(200);
    // Second like reaction - should fail
    const errorResponse2 = await client
      .post('/list-reactions')
      .send({ _listId: listId, _kind: 'like', description: 'Another Like' })
      .expect(429);
    expect(errorResponse2.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      code: 'LISTREACTION-LIMIT-EXCEEDED',
      status: 429,
    });
  });

  it('enforces record set limit for active list reactions', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like',
      LIST_REACTION_RECORD_LIMITS: '[{"scope":"set[actives]","limit":2}]',
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'List',
      _kind: 'reading-list',
    });

    const pastDate2 = new Date();
    pastDate2.setDate(pastDate2.getDate() - 1);
    const futureDate3 = new Date();
    futureDate3.setDate(futureDate3.getDate() + 7);

    // First active reaction - should succeed
    await client
      .post('/list-reactions')
      .send({
        _listId: listId,
        _kind: 'like',
        _validFromDateTime: pastDate2.toISOString(),
        _validUntilDateTime: futureDate3.toISOString(),
        description: 'First active',
      })
      .expect(200);
    // Second active reaction - should succeed
    await client
      .post('/list-reactions')
      .send({
        _listId: listId,
        _kind: 'like',
        _validFromDateTime: pastDate2.toISOString(),
        _validUntilDateTime: futureDate3.toISOString(),
        description: 'Second active',
      })
      .expect(200);
    // Inactive reaction - should succeed
    await client
      .post('/list-reactions')
      .send({
        _listId: listId,
        _kind: 'like',
        _validFromDateTime: pastDate2.toISOString(),
        _validUntilDateTime: pastDate2.toISOString(),
        description: 'Inactive',
      })
      .expect(200);
    // Third active reaction - should fail
    const errorResponse4 = await client
      .post('/list-reactions')
      .send({
        _listId: listId,
        _kind: 'like',
        _validFromDateTime: pastDate2.toISOString(),
        _validUntilDateTime: futureDate3.toISOString(),
        description: 'Third active',
      })
      .expect(429);
    expect(errorResponse4.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      code: 'LISTREACTION-LIMIT-EXCEEDED',
      status: 429,
    });
  });

  it('enforces kind-specific record set limit for active list reactions', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like,dislike',
      LIST_REACTION_RECORD_LIMITS:
        '[{"scope":"set[actives]&where[_kind]=like","limit":1}]',
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'List',
      _kind: 'reading-list',
    });

    const pastDate3 = new Date();
    pastDate3.setDate(pastDate3.getDate() - 1);
    const futureDate4 = new Date();
    futureDate4.setDate(futureDate4.getDate() + 7);

    // First active like reaction - should succeed
    await client
      .post('/list-reactions')
      .send({
        _listId: listId,
        _kind: 'like',
        _validFromDateTime: pastDate3.toISOString(),
        _validUntilDateTime: futureDate4.toISOString(),
        description: 'Active like',
      })
      .expect(200);
    // Active dislike reaction - should succeed
    await client
      .post('/list-reactions')
      .send({
        _listId: listId,
        _kind: 'dislike',
        _validFromDateTime: pastDate3.toISOString(),
        _validUntilDateTime: futureDate4.toISOString(),
        description: 'Active dislike',
      })
      .expect(200);
    // Second active like reaction - should fail
    const errorResponse5 = await client
      .post('/list-reactions')
      .send({
        _listId: listId,
        _kind: 'like',
        _validFromDateTime: pastDate3.toISOString(),
        _validUntilDateTime: futureDate4.toISOString(),
        description: 'Another active like',
      })
      .expect(429);
    expect(errorResponse5.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      code: 'LISTREACTION-LIMIT-EXCEEDED',
      status: 429,
    });
  });

  it('enforces record set limit for active and public list reactions', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like',
      LIST_REACTION_RECORD_LIMITS:
        '[{"scope":"set[actives]&set[publics]","limit":2}]',
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'List',
      _kind: 'reading-list',
    });

    const pastDate4 = new Date();
    pastDate4.setDate(pastDate4.getDate() - 1);
    const futureDate5 = new Date();
    futureDate5.setDate(futureDate5.getDate() + 7);

    // First active and public reaction - should succeed
    await client
      .post('/list-reactions')
      .send({
        _listId: listId,
        _kind: 'like',
        _validFromDateTime: pastDate4.toISOString(),
        _validUntilDateTime: futureDate5.toISOString(),
        _visibility: 'public',
        description: 'First active public',
      })
      .expect(200);
    // Second active and public reaction - should succeed
    await client
      .post('/list-reactions')
      .send({
        _listId: listId,
        _kind: 'like',
        _validFromDateTime: pastDate4.toISOString(),
        _validUntilDateTime: futureDate5.toISOString(),
        _visibility: 'public',
        description: 'Second active public',
      })
      .expect(200);
    // Active but private reaction - should succeed
    await client
      .post('/list-reactions')
      .send({
        _listId: listId,
        _kind: 'like',
        _validFromDateTime: pastDate4.toISOString(),
        _validUntilDateTime: futureDate5.toISOString(),
        _visibility: 'private',
        description: 'Private active',
      })
      .expect(200);
    // Public but inactive reaction - should succeed
    await client
      .post('/list-reactions')
      .send({
        _listId: listId,
        _kind: 'like',
        _validFromDateTime: pastDate4.toISOString(),
        _validUntilDateTime: pastDate4.toISOString(),
        _visibility: 'public',
        description: 'Inactive public',
      })
      .expect(200);
    // Third active and public reaction - should fail
    const errorResponse6 = await client
      .post('/list-reactions')
      .send({
        _listId: listId,
        _kind: 'like',
        _validFromDateTime: pastDate4.toISOString(),
        _validUntilDateTime: futureDate5.toISOString(),
        _visibility: 'public',
        description: 'Third active public',
      })
      .expect(429);
    expect(errorResponse6.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      code: 'LISTREACTION-LIMIT-EXCEEDED',
      status: 429,
    });
  });

  it('enforces record limit per user using owners set for list reactions', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like',
      LIST_REACTION_RECORD_LIMITS:
        '[{"scope":"set[owners][userIds]=${_ownerUsers}","limit":2}]',
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'List',
      _kind: 'reading-list',
    });
    const userId = 'user-123';

    // First reaction for user - should succeed
    await client
      .post('/list-reactions')
      .send({
        _listId: listId,
        _kind: 'like',
        _ownerUsers: [userId],
        description: 'First for user',
      })
      .expect(200);
    // Second reaction for user - should succeed
    await client
      .post('/list-reactions')
      .send({
        _listId: listId,
        _kind: 'like',
        _ownerUsers: [userId],
        description: 'Second for user',
      })
      .expect(200);
    // Reaction for different user - should succeed
    await client
      .post('/list-reactions')
      .send({
        _listId: listId,
        _kind: 'like',
        _ownerUsers: ['user-456'],
        description: 'Different user',
      })
      .expect(200);
    // Reaction with multiple owners including our user - should fail
    const errorResponse7 = await client
      .post('/list-reactions')
      .send({
        _listId: listId,
        _kind: 'like',
        _ownerUsers: [userId, 'user-789'],
        description: 'Multi owner',
      })
      .expect(429);
    expect(errorResponse7.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      code: 'LISTREACTION-LIMIT-EXCEEDED',
      status: 429,
    });
  });

  it('enforces idempotency based on configured fields for list reactions', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like',
      idempotency_list_reaction: '_kind,_listId,description',
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'List',
      _kind: 'reading-list',
    });

    // First reaction - should succeed
    const firstReaction = {
      _listId: listId,
      _kind: 'like',
      description: 'A reaction',
    };
    const firstResponse4 = await client
      .post('/list-reactions')
      .send(firstReaction)
      .expect(200);
    // Second reaction with same idempotency fields but different other fields
    const secondReaction4 = {
      _listId: listId,
      _kind: 'like',
      description: 'A reaction',
      _ownerUsers: ['user-456'],
    };
    const secondResponse4 = await client
      .post('/list-reactions')
      .send(secondReaction4)
      .expect(200);
    expect(secondResponse4.body._id).to.equal(firstResponse4.body._id);
  });

  it('enforces kind-specific idempotency configuration for list reactions', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like,dislike',
      idempotency_list_reaction_for_like: '_kind,_listId,_ownerUsers',
      idempotency_list_reaction_for_dislike: '_kind,description',
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'List',
      _kind: 'reading-list',
    });

    // First like reaction - should succeed
    const firstLike = {
      _listId: listId,
      _kind: 'like',
      _ownerUsers: ['user-123'],
    };
    const firstLikeResponse = await client
      .post('/list-reactions')
      .send(firstLike)
      .expect(200);
    // Second like reaction with same idempotency fields - should return same record
    const secondLike = {
      _listId: listId,
      _kind: 'like',
      _ownerUsers: ['user-123'],
    };
    const secondLikeResponse = await client
      .post('/list-reactions')
      .send(secondLike)
      .expect(200);
    expect(secondLikeResponse.body._id).to.equal(firstLikeResponse.body._id);

    // First dislike reaction - should succeed
    const firstDislike = {
      _listId: listId,
      _kind: 'dislike',
      description: 'desc',
    };
    const firstDislikeResponse = await client
      .post('/list-reactions')
      .send(firstDislike)
      .expect(200);
    // Second dislike reaction with same idempotency fields - should return same record
    const secondDislike = {
      _listId: listId,
      _kind: 'dislike',
      description: 'desc',
    };
    const secondDislikeResponse = await client
      .post('/list-reactions')
      .send(secondDislike)
      .expect(200);
    expect(secondDislikeResponse.body._id).to.equal(
      firstDislikeResponse.body._id,
    );
  });

  it('enforces idempotency with array fields for list reactions', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like',
      idempotency_list_reaction: '_kind,_ownerUsers',
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'List',
      _kind: 'reading-list',
    });

    // First reaction - should succeed
    const firstReaction2 = {
      _listId: listId,
      _kind: 'like',
      _ownerUsers: ['user-123', 'user-456'],
    };
    const firstResponse5 = await client
      .post('/list-reactions')
      .send(firstReaction2)
      .expect(200);
    // Second reaction with same array values but different order - should return same record
    const secondReaction5 = {
      _listId: listId,
      _kind: 'like',
      _ownerUsers: ['user-456', 'user-123'],
    };
    const secondResponse5 = await client
      .post('/list-reactions')
      .send(secondReaction5)
      .expect(200);
    expect(secondResponse5.body._id).to.equal(firstResponse5.body._id);
  });

  it('enforces idempotency with date fields for list reactions', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like',
      idempotency_list_reaction:
        '_kind,_validFromDateTime,_validUntilDateTime',
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'List',
      _kind: 'reading-list',
    });

    const validFrom = new Date();
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 7);

    // First reaction - should succeed
    const firstReaction4 = {
      _listId: listId,
      _kind: 'like',
      _validFromDateTime: validFrom.toISOString(),
      _validUntilDateTime: validUntil.toISOString(),
    };
    const firstResponse6 = await client
      .post('/list-reactions')
      .send(firstReaction4)
      .expect(200);
    // Second reaction with same dates but different other fields - should return same record
    const secondReaction6 = {
      _listId: listId,
      _kind: 'like',
      _validFromDateTime: validFrom.toISOString(),
      _validUntilDateTime: validUntil.toISOString(),
      description: 'Different',
    };
    const secondResponse6 = await client
      .post('/list-reactions')
      .send(secondReaction6)
      .expect(200);
    expect(secondResponse6.body._id).to.equal(firstResponse6.body._id);
  });

  it('should return 404 if list specified by _listId does not exist', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like',
    });
    ({ client } = appWithClient);

    const nonExistentListId = 'non-existent-list-id';
    const newReaction: Partial<ListReaction> = {
      _listId: nonExistentListId,
      _kind: 'like',
      description: 'Reaction to non-existent list',
    };
    const errorResponse7 = await client
      .post('/list-reactions')
      .send(newReaction)
      .expect(404);
    expect(errorResponse7.body.error).to.containDeep({
      statusCode: 404,
      name: 'NotFoundError',
      code: 'LIST-NOT-FOUND',
      status: 404,
    });
  });

  describe('lookup constraint validation', () => {
    it('should reject list reaction with invalid list reference when record=list is configured', async () => {
      appWithClient = await setupApplication({
        list_reaction_kinds: 'like,dislike',
        LIST_REACTION_LOOKUP_CONSTRAINT: JSON.stringify([
          {
            propertyPath: 'references',
            record: 'list',
          },
        ]),
      });
      ({ client } = appWithClient);

      const listId = await createTestList(client, {
        _name: 'List',
        _kind: 'reading-list',
      });

      // Try to create a reaction referencing an entity (invalid)
      const invalidReference = 'tapp://localhost/entities/1';
      const newReaction = {
        _listId: listId,
        _kind: 'like',
        references: [invalidReference],
      };
      const errorResponse8 = await client
        .post('/list-reactions')
        .send(newReaction)
        .expect(422);
      expect(errorResponse8.body.error).to.containDeep({
        statusCode: 422,
        name: 'InvalidLookupReferenceError',
        code: 'LIST-REACTION-INVALID-LOOKUP-REFERENCE',
        status: 422,
      });
    });

    it('should reject list reaction with invalid entity reference when record=entity is configured', async () => {
      appWithClient = await setupApplication({
        list_reaction_kinds: 'like,dislike',
        LIST_REACTION_LOOKUP_CONSTRAINT: JSON.stringify([
          {
            propertyPath: 'references',
            record: 'entity',
          },
        ]),
      });
      ({ client } = appWithClient);

      const listId = await createTestList(client, {
        _name: 'List',
        _kind: 'reading-list',
      });

      // Try to create a reaction referencing a list when entity is configured
      const invalidReference = `tapp://localhost/lists/${listId}`;
      const newReaction = {
        _listId: listId,
        _kind: 'like',
        references: [invalidReference],
      };
      const errorResponse9 = await client
        .post('/list-reactions')
        .send(newReaction)
        .expect(422);
      expect(errorResponse9.body.error).to.containDeep({
        statusCode: 422,
        name: 'InvalidLookupReferenceError',
        code: 'LIST-REACTION-INVALID-LOOKUP-REFERENCE',
        status: 422,
      });
    });

    it('should reject list reaction with invalid target kind when targetKind is configured', async () => {
      appWithClient = await setupApplication({
        list_reaction_kinds: 'like,dislike',
        LIST_REACTION_LOOKUP_CONSTRAINT: JSON.stringify([
          {
            propertyPath: 'references',
            record: 'list',
            targetKind: 'author',
          },
        ]),
      });
      ({ client } = appWithClient);

      // First create a book list to reference
      const bookListId = await createTestList(client, {
        _name: 'Referenced Book List',
        _kind: 'reading-list',
      });
      const listId = await createTestList(client, {
        _name: 'List',
        _kind: 'reading-list',
      });

      // Try to create a reaction referencing a book list when author is required
      const invalidReference = `tapp://localhost/lists/${bookListId}`;
      const newReaction = {
        _listId: listId,
        _kind: 'like',
        references: [invalidReference],
      };
      const errorResponse10 = await client
        .post('/list-reactions')
        .send(newReaction)
        .expect(422);
      expect(errorResponse10.body.error).to.containDeep({
        statusCode: 422,
        name: 'InvalidLookupConstraintError',
        code: 'LIST-REACTION-INVALID-LOOKUP-KIND',
        status: 422,
      });
    });

    it('should accept list reaction with valid references when all constraints are satisfied', async () => {
      appWithClient = await setupApplication({
        list_reaction_kinds: 'like,dislike',
        LIST_REACTION_LOOKUP_CONSTRAINT: JSON.stringify([
          {
            propertyPath: 'references',
            record: 'list',
            sourceKind: 'reading-list',
            targetKind: 'author',
          },
        ]),
      });
      ({ client } = appWithClient);

      // First create an author list to reference
      const authorListId = await createTestList(client, {
        _name: 'Referenced Author List',
        _kind: 'author',
      });
      const listId = await createTestList(client, {
        _name: 'List',
        _kind: 'reading-list',
      });

      const validReference = `tapp://localhost/lists/${authorListId}`;
      const newReaction = {
        _listId: listId,
        _kind: 'like',
        references: [validReference],
      };
      const response = await client
        .post('/list-reactions')
        .send(newReaction)
        .expect(200);
      expect(response.body).to.containDeep({
        _listId: listId,
        _kind: 'like',
        references: [validReference],
      });
    });

    it('should accept list reaction with multiple valid references when all constraints are satisfied', async () => {
      appWithClient = await setupApplication({
        list_reaction_kinds: 'like,dislike',
        LIST_REACTION_LOOKUP_CONSTRAINT: JSON.stringify([
          {
            propertyPath: 'references',
            record: 'list',
            sourceKind: 'reading-list',
            targetKind: 'author',
          },
        ]),
      });
      ({ client } = appWithClient);

      // Create multiple author lists to reference
      const author1Id = await createTestList(client, {
        _name: 'First Author List',
        _kind: 'author',
      });
      const author2Id = await createTestList(client, {
        _name: 'Second Author List',
        _kind: 'author',
      });
      const listId = await createTestList(client, {
        _name: 'List',
        _kind: 'reading-list',
      });

      const validReferences = [
        `tapp://localhost/lists/${author1Id}`,
        `tapp://localhost/lists/${author2Id}`,
      ];
      const newReaction = {
        _listId: listId,
        _kind: 'like',
        references: validReferences,
      };
      const response2 = await client
        .post('/list-reactions')
        .send(newReaction)
        .expect(200);
      expect(response2.body).to.containDeep({
        _listId: listId,
        _kind: 'like',
        references: validReferences,
      });
    });

    it('should reject list reaction with invalid list-reaction reference when record=list-reaction is configured', async () => {
      appWithClient = await setupApplication({
        list_reaction_kinds: 'like,dislike',
        LIST_REACTION_LOOKUP_CONSTRAINT: JSON.stringify([
          {
            propertyPath: 'references',
            record: 'list-reaction',
          },
        ]),
      });
      ({ client } = appWithClient);

      const listId = await createTestList(client, {
        _name: 'List',
        _kind: 'reading-list',
      });
      // Try to create a reaction referencing a list (invalid for list-reaction constraint)
      const invalidReference = `tapp://localhost/lists/${listId}`;
      const newReaction = {
        _listId: listId,
        _kind: 'like',
        references: [invalidReference],
      };
      const errorResponse9b = await client
        .post('/list-reactions')
        .send(newReaction)
        .expect(422);
      expect(errorResponse9b.body.error).to.containDeep({
        statusCode: 422,
        name: 'InvalidLookupReferenceError',
        code: 'LIST-REACTION-INVALID-LOOKUP-REFERENCE',
        status: 422,
      });
    });

    it('should reject list reaction with invalid target kind for list-reaction reference when targetKind is configured', async () => {
      appWithClient = await setupApplication({
        list_reaction_kinds: 'like,dislike,comment',
        LIST_REACTION_LOOKUP_CONSTRAINT: JSON.stringify([
          {
            propertyPath: 'references',
            record: 'list-reaction',
            targetKind: 'comment',
          },
        ]),
      });
      ({ client } = appWithClient);

      const listId = await createTestList(client, {
        _name: 'List',
        _kind: 'reading-list',
      });
      // Create a like reaction to reference (invalid kind)
      const likeReactionId = await client
        .post('/list-reactions')
        .send({ _listId: listId, _kind: 'like' })
        .then((res) => res.body._id);
      const invalidReference2 = `tapp://localhost/list-reactions/${likeReactionId}`;
      const newReaction = {
        _listId: listId,
        _kind: 'dislike',
        references: [invalidReference2],
      };
      const errorResponse10b = await client
        .post('/list-reactions')
        .send(newReaction)
        .expect(422);
      expect(errorResponse10b.body.error).to.containDeep({
        statusCode: 422,
        name: 'InvalidLookupConstraintError',
        code: 'LIST-REACTION-INVALID-LOOKUP-KIND',
        status: 422,
      });
    });

    it('should accept list reaction with valid list-reaction reference when all constraints are satisfied', async () => {
      appWithClient = await setupApplication({
        list_reaction_kinds: 'like,comment',
        LIST_REACTION_LOOKUP_CONSTRAINT: JSON.stringify([
          {
            propertyPath: 'references',
            record: 'list-reaction',
            targetKind: 'comment',
          },
        ]),
      });
      ({ client } = appWithClient);

      const listId = await createTestList(client, {
        _name: 'List',
        _kind: 'reading-list',
      });
      // Create a comment reaction to reference (valid kind)
      const commentReactionId = await client
        .post('/list-reactions')
        .send({ _listId: listId, _kind: 'comment' })
        .then((res) => res.body._id);
      const validReference2 = `tapp://localhost/list-reactions/${commentReactionId}`;
      const newReaction = {
        _listId: listId,
        _kind: 'like',
        references: [validReference2],
      };
      const response3 = await client
        .post('/list-reactions')
        .send(newReaction)
        .expect(200);
      expect(response3.body).to.containDeep({
        _listId: listId,
        _kind: 'like',
        references: [validReference2],
      });
    });

    it('should accept list reaction with multiple valid list-reaction references when all constraints are satisfied', async () => {
      appWithClient = await setupApplication({
        list_reaction_kinds: 'like,comment',
        LIST_REACTION_LOOKUP_CONSTRAINT: JSON.stringify([
          {
            propertyPath: 'references',
            record: 'list-reaction',
            targetKind: 'comment',
          },
        ]),
      });
      ({ client } = appWithClient);

      const listId = await createTestList(client, {
        _name: 'List',
        _kind: 'reading-list',
      });
      // Create multiple comment reactions to reference
      const comment1Id = await client
        .post('/list-reactions')
        .send({ _listId: listId, _kind: 'comment' })
        .then((res) => res.body._id);
      const comment2Id = await client
        .post('/list-reactions')
        .send({ _listId: listId, _kind: 'comment' })
        .then((res) => res.body._id);
      const validReferences2 = [
        `tapp://localhost/list-reactions/${comment1Id}`,
        `tapp://localhost/list-reactions/${comment2Id}`,
      ];
      const newReaction = {
        _listId: listId,
        _kind: 'like',
        references: validReferences2,
      };
      const response4 = await client
        .post('/list-reactions')
        .send(newReaction)
        .expect(200);
      expect(response4.body).to.containDeep({
        _listId: listId,
        _kind: 'like',
        references: validReferences2,
      });
    });
  });
});



