import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { EntityPersistenceApplication } from '../../..';
import type { AppWithClient } from '../test-helper';
import { setupApplication, teardownApplication } from '../test-helper';

describe('GET /generic-lists', () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let app: EntityPersistenceApplication;
  let client: Client;
  let appWithClient: AppWithClient;

  before('setupApplication', async () => {
    appWithClient = await setupApplication();
    ({ app, client } = appWithClient);
  });

  after(async () => {
    await teardownApplication(appWithClient);
  });

  beforeEach(async () => {
    // Create test data
    const lists = [
      { name: 'List 1', description: 'Description 1' },
      { name: 'List 2', description: 'Description 2' },
      { name: 'Different List', description: 'Description 3' },
    ];

    for (const list of lists) {
      await client.post('/generic-lists').send(list);
    }
  });

  it('returns all generic lists', async () => {
    const response = await client.get('/generic-lists').expect(200);

    expect(response.body).to.be.Array();
    expect(response.body).to.have.length(3);
    expect(response.body[0]).to.have.properties([
      'id',
      'name',
      'description',
      'createdAt',
      'updatedAt',
    ]);
  });

  it('filters generic lists by name', async () => {
    const response = await client
      .get('/generic-lists')
      .query({ filter: { where: { name: 'List 1' } } })
      .expect(200);

    expect(response.body).to.be.Array();
    expect(response.body).to.have.length(1);
    expect(response.body[0].name).to.equal('List 1');
  });

  it('supports pagination', async () => {
    const response = await client
      .get('/generic-lists')
      .query({ filter: { limit: 2, skip: 1 } })
      .expect(200);

    expect(response.body).to.be.Array();
    expect(response.body).to.have.length(2);
  });

  it('supports sorting', async () => {
    const response = await client
      .get('/generic-lists')
      .query({ filter: { order: ['name DESC'] } })
      .expect(200);

    expect(response.body).to.be.Array();
    expect(response.body[0].name).to.equal('List 2');
  });
});
