import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { GenericList } from '../../../models';
import type { AppWithClient } from '../test-helper';
import { setupApplication, teardownApplication } from '../test-helper';

describe('POST /generic-lists', () => {
  let client: Client;
  let appWithClient: AppWithClient;

  beforeEach(async () => {
    if (appWithClient) {
      await teardownApplication(appWithClient);
    }
  });

  after(async () => {
    if (appWithClient) {
      await teardownApplication(appWithClient);
    }
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

  it('rejects duplicate list names', async () => {
    appWithClient = await setupApplication({
      list_kinds: 'featured',
      default_list_kind: 'featured',
      autoapprove_list: 'true',
      visibility_list: 'public',
      idempotency_list: 'false',
    });
    ({ client } = appWithClient);

    const newList: Partial<GenericList> = {
      _name: 'Duplicate List',
      description: 'Test Description',
    };

    // Create first list
    await client.post('/generic-lists').send(newList).expect(200);

    // Try to create duplicate
    await client.post('/generic-lists').send(newList).expect(409);
  });

  it('rejects invalid list data', async () => {
    appWithClient = await setupApplication({
      list_kinds: 'featured',
      default_list_kind: 'featured',
      autoapprove_list: 'true',
      visibility_list: 'public',
      idempotency_list: 'false',
    });
    ({ client } = appWithClient);

    const invalidList = {
      // Missing required name field
      description: 'Test Description',
    };

    await client.post('/generic-lists').send(invalidList).expect(422);
  });

  it('creates list with idempotency key when enabled', async () => {
    appWithClient = await setupApplication({
      list_kinds: 'featured',
      default_list_kind: 'featured',
      autoapprove_list: 'true',
      visibility_list: 'public',
      idempotency_list: 'true',
    });
    ({ client } = appWithClient);

    const newList: Partial<GenericList> = {
      _name: 'Idempotent List',
      description: 'Test idempotency',
    };

    const idempotencyKey = 'test-key-123';

    // First request
    const response1 = await client
      .post('/generic-lists')
      .set('Idempotency-Key', idempotencyKey)
      .send(newList)
      .expect(200);

    // Second request with same key
    const response2 = await client
      .post('/generic-lists')
      .set('Idempotency-Key', idempotencyKey)
      .send(newList)
      .expect(200);

    expect(response1.body._id).to.equal(response2.body._id);
  });

  it('ignores idempotency key when disabled', async () => {
    appWithClient = await setupApplication({
      list_kinds: 'featured',
      default_list_kind: 'featured',
      autoapprove_list: 'true',
      visibility_list: 'public',
      idempotency_list: 'false',
    });
    ({ client } = appWithClient);

    const newList: Partial<GenericList> = {
      _name: 'Non-Idempotent List',
      description: 'Test non-idempotency',
    };

    const idempotencyKey = 'test-key-456';

    // First request
    const response1 = await client
      .post('/generic-lists')
      .set('Idempotency-Key', idempotencyKey)
      .send(newList)
      .expect(200);

    // Second request with same key should create new list
    const response2 = await client
      .post('/generic-lists')
      .set('Idempotency-Key', idempotencyKey)
      .send(newList)
      .expect(409); // Should fail with duplicate name

    expect(response1.body._id).to.not.equal(response2.body?._id);
  });

  it('uses specified default kind when creating list', async () => {
    appWithClient = await setupApplication({
      list_kinds: 'editors-pick,featured,trending',
      default_list_kind: 'trending',
      autoapprove_list: 'true',
      visibility_list: 'public',
      idempotency_list: 'false',
    });
    ({ client } = appWithClient);

    const newList: Partial<GenericList> = {
      _name: 'Trending List',
      description: 'Should be trending by default',
    };

    const response = await client
      .post('/generic-lists')
      .send(newList)
      .expect(200);

    expect(response.body._kind).to.equal('trending');
  });
});
