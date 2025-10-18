import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestList,
  createTestEntity,
} from '../test-helper';

describe('PUT /relations/{id}', () => {
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

  it('replaces relation with new data', async () => {
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
      _name: 'Test Book',
      _kind: 'book',
      description: 'A test book',
    });

    // Create relation
    const relationResponse = await client
      .post('/relations')
      .send({
        _listId: listId,
        _entityId: entityId,
        _visibility: 'private',
      })
      .expect(200);

    const relationId = relationResponse.body._id;

    // Replace relation with new data
    await client
      .put(`/relations/${relationId}`)
      .send({
        _listId: listId,
        _entityId: entityId,
        _kind: 'relation',
        _visibility: 'public',
      })
      .expect(204);

    // Verify changes by getting the updated relation
    const response = await client
      .get(`/relations/${relationId}`)
      .expect(200);

    // Verify response
    expect(response.body).to.have.property('_id', relationId);
    expect(response.body).to.have.property('_listId', listId);
    expect(response.body).to.have.property('_entityId', entityId);
    expect(response.body).to.have.property('_kind', 'relation');
    expect(response.body).to.have.property('_visibility', 'public');
    expect(response.body).to.have.property('_version', 2); // Version should be incremented
    expect(response.body).to.have.property('_validFromDateTime');
    expect(response.body).to.have.property('_lastUpdatedDateTime');
  });

  it('should not allow changing _kind field with PUT operation', async () => {
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
      _name: 'Test Book',
      _kind: 'book',
      description: 'A test book',
    });

    // Create relation
    const relationResponse = await client
      .post('/relations')
      .send({
        _listId: listId,
        _entityId: entityId,
        _visibility: 'private',
      })
      .expect(200);

    const relationId = relationResponse.body._id;

    // Attempt to replace relation with different _kind
    const response = await client
      .put(`/relations/${relationId}`)
      .send({
        _listId: listId,
        _entityId: entityId,
        _kind: 'custom-relation', // Attempting to change _kind
        _visibility: 'public',
      })
      .expect(422);

    // Verify error response
    expect(response.body).to.have.property('error');
    expect(response.body.error).to.have.property('statusCode', 422);
    expect(response.body.error).to.have.property('name', 'ImmutableKindError');
    expect(response.body.error).to.have.property(
      'message',
      'Relation kind cannot be changed after creation.',
    );
    expect(response.body.error).to.have.property(
      'code',
      'IMMUTABLE-RELATION-KIND',
    );
    expect(response.body.error).to.have.property('status', 422);

    // Verify _kind remains unchanged by getting the relation
    const getResponse = await client
      .get(`/relations/${relationId}`)
      .expect(200);
    expect(getResponse.body).to.have.property('_kind', 'relation');
  });
});
