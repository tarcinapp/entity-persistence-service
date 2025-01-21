import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { EntityPersistenceApplication } from '../../..';
import type { AppWithClient } from '../test-helper';
import { setupApplication, teardownApplication } from '../test-helper';

describe('GET /generic-lists/{id}', () => {
  let app: EntityPersistenceApplication;
  let client: Client;
  let appWithClient: AppWithClient;
  let listId: string;

  before('setupApplication', async () => {
    appWithClient = await setupApplication();
    ({ app, client } = appWithClient);
  });

  after(async () => {
    await teardownApplication(appWithClient);
  });

  beforeEach(async () => {
    const newList = {
      name: 'Test List',
      description: 'Test Description',
    };

    const response = await client.post('/generic-lists').send(newList);
    listId = response.body.id;
  });

  it('returns a generic list by id', async () => {
    const response = await client.get(`/generic-lists/${listId}`).expect(200);

    expect(response.body).to.have.properties([
      'id',
      'name',
      'description',
      'createdAt',
      'updatedAt',
    ]);
    expect(response.body.id).to.equal(listId);
    expect(response.body.name).to.equal('Test List');
  });

  it('returns 404 when list not found', async () => {
    await client.get('/generic-lists/nonexistent-id').expect(404);
  });

  it('returns list with included relations', async () => {
    const response = await client
      .get(`/generic-lists/${listId}`)
      .query({ filter: { include: ['tags'] } })
      .expect(200);

    expect(response.body).to.have.property('tags');
    expect(response.body.tags).to.be.Array();
  });

  it('returns 400 for invalid id format', async () => {
    await client.get('/generic-lists/invalid-id-format').expect(400);
  });
});
