import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestEntity,
} from '../test-helper';

describe('GET /entities/{id}', () => {
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

  it('returns entity by id', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create test entity
    const entityId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
      description: 'A test book',
      author: 'Test Author',
    });

    // Get entity by id
    const response = await client.get(`/entities/${entityId}`).expect(200);

    // Verify response
    expect(response.body).to.have.property('_id', entityId);
    expect(response.body).to.have.property('_name', 'Test Book');
    expect(response.body).to.have.property('_kind', 'book');
    expect(response.body).to.have.property('description', 'A test book');
    expect(response.body).to.have.property('author', 'Test Author');
    expect(response.body).to.have.property('_version', 1);
    expect(response.body).to.have.property('_validFromDateTime');
    expect(response.body).to.have.property('_createdDateTime');
    expect(response.body).to.have.property('_lastUpdatedDateTime');
  });
});
