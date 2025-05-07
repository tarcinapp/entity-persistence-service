import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestList,
  createTestEntity,
} from '../test-helper';

describe('GET /lists/{id}/entities', () => {
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

  it('returns entities associated with a list', async () => {
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

    // Create relations
    await client
      .post('/list-entity-relations')
      .send({
        _listId: listId,
        _entityId: entity1Id,
      })
      .expect(200);

    await client
      .post('/list-entity-relations')
      .send({
        _listId: listId,
        _entityId: entity2Id,
      })
      .expect(200);

    // Get entities for the list
    const response = await client.get(`/lists/${listId}/entities`).expect(200);

    // Verify response
    expect(response.body).to.be.an.Array();
    expect(response.body).to.have.length(2);

    // Sort entities by name to ensure consistent ordering
    const sortedEntities = response.body.sort((a: any, b: any) =>
      a._name.localeCompare(b._name),
    );

    // Verify first entity (First Book)
    expect(sortedEntities[0]).to.have.property('_name', 'First Book');
    expect(sortedEntities[0]).to.have.property('_id', entity1Id);
    expect(sortedEntities[0]).to.have.property('_kind', 'book');
    expect(sortedEntities[0]).to.have.property(
      'description',
      'First book description',
    );

    // Verify second entity (Second Book)
    expect(sortedEntities[1]).to.have.property('_name', 'Second Book');
    expect(sortedEntities[1]).to.have.property('_id', entity2Id);
    expect(sortedEntities[1]).to.have.property('_kind', 'book');
    expect(sortedEntities[1]).to.have.property(
      'description',
      'Second book description',
    );
  });

  it('returns 404 when list is not found', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
      entity_kinds: 'book',
      autoapprove_list_entity_relations: 'true',
    });
    ({ client } = appWithClient);

    // Try to get entities for a non-existent list
    const nonExistentId = 'non-existent-id';
    const response = await client
      .get(`/lists/${nonExistentId}/entities`)
      .expect(404);

    // Verify error response
    expect(response.body.error).to.have.property('statusCode', 404);
    expect(response.body.error).to.have.property('name', 'NotFoundError');
    expect(response.body.error).to.have.property(
      'message',
      `List with id '${nonExistentId}' could not be found.`,
    );
    expect(response.body.error).to.have.property('code', 'LIST-NOT-FOUND');
    expect(response.body.error).to.have.property('status', 404);
  });
});
