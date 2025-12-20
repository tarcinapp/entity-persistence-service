import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestList,
  createTestEntity,
} from '../test-helper';

describe('PATCH /lists/{id}/entities', () => {
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

  it('updates entities in a list', async () => {
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

    // Create test entity
    const entityId = await createTestEntity(client, {
      _name: 'Original Book',
      _kind: 'book',
      description: 'Original description',
      _visibility: 'private',
    });

    // Create relation
    await client
      .post('/relations')
      .send({
        _listId: listId,
        _entityId: entityId,
      })
      .expect(200);

    // Update entity properties
    const patchResponse = await client
      .patch(`/lists/${listId}/entities`)
      .send({
        _name: 'Updated Book',
        description: 'Updated description',
        _visibility: 'public',
      })
      .expect(200);

    // Verify update count
    expect(patchResponse.body).to.have.property('count', 1);

    // Verify changes by getting the updated entity
    const response = await client.get(`/lists/${listId}/entities`).expect(200);

    // Verify response
    expect(response.body).to.be.an.Array();
    expect(response.body).to.have.length(1);

    // Sort entities by name to ensure consistent ordering
    const sortedEntities = response.body.sort((a: any, b: any) =>
      a._name.localeCompare(b._name),
    );

    // Verify entity properties were updated
    expect(sortedEntities[0]).to.have.property('_name', 'Updated Book');
    expect(sortedEntities[0]).to.have.property('_id', entityId);
    expect(sortedEntities[0]).to.have.property('_kind', 'book');
    expect(sortedEntities[0]).to.have.property(
      'description',
      'Updated description',
    );
    expect(sortedEntities[0]).to.have.property('_visibility', 'public');
    expect(sortedEntities[0]).to.have.property('_validFromDateTime');
    expect(sortedEntities[0]).to.have.property('_createdDateTime');
    expect(sortedEntities[0]).to.have.property('_lastUpdatedDateTime');
  });

  it('should not allow modifying _kind field when updating entities in a list', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
      entity_kinds: 'book,article',
      autoapprove_list_entity_relations: 'true',
    });
    ({ client } = appWithClient);

    // Create test list
    const listId = await createTestList(client, {
      _name: 'Test List',
      _kind: 'reading',
      description: 'A test list',
    });

    // Create test entity
    const entityId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
      description: 'Test description',
      _visibility: 'private',
    });

    // Create relation
    await client
      .post('/relations')
      .send({
        _listId: listId,
        _entityId: entityId,
      })
      .expect(200);

    // Attempt to update _kind field
    const response = await client
      .patch(`/lists/${listId}/entities`)
      .send({
        _kind: 'article',
      })
      .expect(422);

    // Verify error response
    expect(response.body).to.have.property('error');
    expect(response.body.error).to.have.property('statusCode', 422);
    expect(response.body.error).to.have.property('name', 'ImmutableKindError');
    expect(response.body.error).to.have.property(
      'message',
      'Entity kind cannot be changed after creation.',
    );
    expect(response.body.error).to.have.property(
      'code',
      'IMMUTABLE-ENTITY-KIND',
    );

    // Verify _kind remains unchanged by getting the entities
    const getResponse = await client
      .get(`/lists/${listId}/entities`)
      .expect(200);
    expect(getResponse.body).to.be.an.Array();
    expect(getResponse.body).to.have.length(1);
    expect(getResponse.body[0]).to.have.property('_kind', 'book');
  });

  it('should allow updating other fields while preserving _kind when updating entities in a list', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
      entity_kinds: 'book,article',
      autoapprove_list_entity_relations: 'true',
    });
    ({ client } = appWithClient);

    // Create test list
    const listId = await createTestList(client, {
      _name: 'Test List',
      _kind: 'reading',
      description: 'A test list',
    });

    // Create test entity
    const entityId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
      description: 'Test description',
      _visibility: 'private',
    });

    // Create relation
    await client
      .post('/relations')
      .send({
        _listId: listId,
        _entityId: entityId,
      })
      .expect(200);

    // Update other fields
    const patchResponse = await client
      .patch(`/lists/${listId}/entities`)
      .send({
        _name: 'Updated Book',
        description: 'Updated description',
        _visibility: 'public',
      })
      .expect(200);

    // Verify update count
    expect(patchResponse.body).to.have.property('count', 1);

    // Verify _kind remains unchanged while other fields are updated
    const response = await client.get(`/lists/${listId}/entities`).expect(200);
    expect(response.body).to.be.an.Array();
    expect(response.body).to.have.length(1);
    expect(response.body[0]).to.have.property('_kind', 'book');
    expect(response.body[0]).to.have.property('_name', 'Updated Book');
    expect(response.body[0]).to.have.property(
      'description',
      'Updated description',
    );
    expect(response.body[0]).to.have.property('_visibility', 'public');
  });
});
