import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestList,
  createTestEntity,
} from '../test-helper';

describe('POST /lists/{id}/entities', () => {
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

  it('adds entities to a list', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
      entity_kinds: 'book',
      autoapprove_list_entity_relations: 'true',
    });
    ({ client } = appWithClient);

    // Create test list
    const listId = await createTestList(client, {
      _name: 'Test List',
      _kind: 'reading',
      description: 'A test list',
    });

    // Create test entities
    const entity1Id = await createTestEntity(client, {
      _name: 'First Book',
      _kind: 'book',
      description: 'First book description',
    });

    const entity2Id = await createTestEntity(client, {
      _name: 'Second Book',
      _kind: 'book',
      description: 'Second book description',
    });

    // Add first entity to the list
    await client
      .post('/list-entity-relations')
      .send({
        _listId: listId,
        _entityId: entity1Id,
        _visibility: 'private',
      })
      .expect(200);

    // Add second entity to the list
    await client
      .post('/list-entity-relations')
      .send({
        _listId: listId,
        _entityId: entity2Id,
        _visibility: 'private',
      })
      .expect(200);

    // Verify relations were created
    const relationsResponse = await client
      .get(`/list-entity-relations?filter[where][_listId]=${listId}`)
      .expect(200);

    expect(relationsResponse.body).to.be.an.Array();
    expect(relationsResponse.body).to.have.length(2);

    // Verify entities are associated with the list
    const entitiesResponse = await client
      .get(`/lists/${listId}/entities`)
      .expect(200);

    expect(entitiesResponse.body).to.be.an.Array();
    expect(entitiesResponse.body).to.have.length(2);
    expect(entitiesResponse.body.map((e: any) => e._id)).to.containDeep([
      entity1Id,
      entity2Id,
    ]);
  });
});
