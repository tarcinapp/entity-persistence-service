import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestList,
  createTestEntity,
} from '../test-helper';

describe('GET /relations/count', () => {
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

  it('returns correct count of list-entity relations', async () => {
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
      _name: 'Book 1',
      _kind: 'book',
      description: 'First book',
    });

    const entity2Id = await createTestEntity(client, {
      _name: 'Book 2',
      _kind: 'book',
      description: 'Second book',
    });

    // Create relations
    await client.post('/relations').send({
      _listId: listId,
      _entityId: entity1Id,
    });

    await client.post('/relations').send({
      _listId: listId,
      _entityId: entity2Id,
    });

    // Get count of relations
    const response = await client
      .get('/relations/count')
      .expect(200);

    expect(response.body).to.have.property('count', 2);
  });
});
