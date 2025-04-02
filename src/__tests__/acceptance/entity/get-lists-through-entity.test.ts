import { expect } from '@loopback/testlab';
import type { EntityPersistenceApplication } from '../../../application';
import {
  setupApplication,
  teardownApplication,
  createTestEntity,
  createTestList,
  AppWithClient,
} from '../test-helper';

describe('GET /entities/{id}/lists', () => {
  let app: EntityPersistenceApplication;
  let client: any;
  let mongod: any;
  let originalEnv: any;

  before('setupApplication', async () => {
    const appWithClient = await setupApplication();
    app = appWithClient.app;
    client = appWithClient.client;
    mongod = appWithClient.mongod;
    originalEnv = appWithClient.originalEnv;
  });

  after(async () => {
    await teardownApplication({ app, client, mongod, originalEnv });
  });

  it('returns lists associated with an entity', async () => {
    // Create an entity first
    const entityId = await createTestEntity(client, {
      _name: 'Test Entity',
      _kind: 'test',
    });

    // Create a list and associate it with the entity
    const listId = await createTestList(client, {
      _name: 'Test List',
      _kind: 'test',
    });

    // Create the relation
    await client
      .post(`/list-entity-relations`)
      .send({
        _listId: listId,
        _entityId: entityId,
      })
      .expect(200);

    // Make the request
    const response = await client
      .get(`/entities/${entityId}/lists`)
      .expect(200);

    // Verify the response
    expect(response.body).to.be.Array();
    expect(response.body).to.have.length(1);
    expect(response.body[0]).to.containDeep({
      _id: listId,
      _name: 'Test List',
      _kind: 'test',
    });
    expect(response.body[0]).to.have.property('_relationMetadata');
  });
});
