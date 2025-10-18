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
      _name: 'Great Books',
      _kind: 'reading-list',
      description: 'A list of great books',
    });

    // First reaction creation - should succeed
    const firstReaction: Partial<ListReaction> = {
      _listId: listId,
      _kind: 'like',
      _name: 'Like', // arbitrary, non-managed field
      description: 'A like reaction',
    };

    await client.post('/list-reactions').send(firstReaction).expect(200);

    // Second reaction with same kind and listId - should fail
    const secondReaction: Partial<ListReaction> = {
      _listId: listId,
      _kind: 'like',
      _name: 'Another Like',
      description: 'Another like reaction',
    };

    const errorResponse = await client
      .post('/list-reactions')
      .send(secondReaction)
      .expect(409);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 409,
      name: 'EntityExistsError',
      code: 'ENTITY-EXISTS',
      status: 409,
    });
  });

  it('allows multiple reactions when uniqueness is disabled', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like',
      LIST_REACTION_UNIQUENESS: '', // Disable uniqueness
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'Great Books',
      _kind: 'reading-list',
      description: 'A list of great books',
    });

    // First reaction
    const firstReaction: Partial<ListReaction> = {
      _listId: listId,
      _kind: 'like',
      _name: 'First Like',
      description: 'First like reaction',
    };

    const firstResponse = await client
      .post('/list-reactions')
      .send(firstReaction)
      .expect(200);

    // Second reaction with same kind and listId - should succeed
    const secondReaction: Partial<ListReaction> = {
      _listId: listId,
      _kind: 'like',
      _name: 'Second Like',
      description: 'Second like reaction',
    };

    const secondResponse = await client
      .post('/list-reactions')
      .send(secondReaction)
      .expect(200);

    expect(firstResponse.body._id).to.not.equal(secondResponse.body._id);
    expect(firstResponse.body._name).to.equal('First Like');
    expect(secondResponse.body._name).to.equal('Second Like');
  });

  it('enforces list reaction limit when configured', async () => {
    appWithClient = await setupApplication({
      list_reaction_kinds: 'like',
      LIST_REACTION_LIMIT_PER_LIST: '1',
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'Limited List',
      description: 'A list with reaction limit',
    });

    // First reaction - should succeed
    const firstReaction: Partial<ListReaction> = {
      _listId: listId,
      _kind: 'like',
      _name: 'First Like',
      description: 'First like reaction',
    };

    await client.post('/list-reactions').send(firstReaction).expect(200);

    // Second reaction - should fail due to limit
    const secondReaction: Partial<ListReaction> = {
      _listId: listId,
      _kind: 'like',
      _name: 'Second Like',
      description: 'Second like reaction',
    };

    const errorResponse = await client
      .post('/list-reactions')
      .send(secondReaction)
      .expect(429);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      code: 'LIMIT-EXCEEDED',
      status: 429,
    });
  });

  it('validates required fields', async () => {
    appWithClient = await setupApplication({});
    ({ client } = appWithClient);

    // Missing _listId
    const incompleteReaction: Partial<ListReaction> = {
      _name: 'Like',
      description: 'A like reaction',
    };

    const errorResponse = await client
      .post('/list-reactions')
      .send(incompleteReaction)
      .expect(422);

    expect(errorResponse.body.error).to.have.property('statusCode', 422);
  });

  it('generates slug from name', async () => {
    appWithClient = await setupApplication({});
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'Sample List',
      description: 'A sample list',
    });

    const newReaction: Partial<ListReaction> = {
      _listId: listId,
      _name: 'Love This List!',
      description: 'A reaction with special characters',
    };

    const response = await client
      .post('/list-reactions')
      .send(newReaction)
      .expect(200);

    expect(response.body._slug).to.be.equal('love-this-list');
  });

  it('validates list existence', async () => {
    appWithClient = await setupApplication({});
    ({ client } = appWithClient);

    const nonExistentListId = '123e4567-e89b-12d3-a456-426614174000';

    const newReaction: Partial<ListReaction> = {
      _listId: nonExistentListId,
      _name: 'Like',
      description: 'A like reaction for non-existent list',
    };

    const errorResponse = await client
      .post('/list-reactions')
      .send(newReaction)
      .expect(422);

    expect(errorResponse.body.error).to.have.property('statusCode', 422);
  });

  it('sets default visibility when not specified', async () => {
    appWithClient = await setupApplication({
      DEFAULT_VISIBILITY: 'public',
    });
    ({ client } = appWithClient);

    const listId = await createTestList(client, {
      _name: 'Sample List',
      description: 'A sample list',
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

    expect(response.body._visibility).to.equal('public');
  });
});
