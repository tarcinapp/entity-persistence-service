import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestList,
  createTestEntity,
} from '../test-helper';

describe('DELETE /list-entity-relations/{id}', () => {
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

  it('deletes relation', async () => {
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
      .post('/list-entity-relations')
      .send({
        _listId: listId,
        _entityId: entityId,
        _visibility: 'private',
      })
      .expect(200);

    const relationId = relationResponse.body._id;

    // Delete relation
    await client.delete(`/list-entity-relations/${relationId}`).expect(204);

    // Verify relation is deleted by attempting to get it
    await client.get(`/list-entity-relations/${relationId}`).expect(404);
  });
});
