import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestEntity,
} from '../test-helper';

describe('PATCH /entities/{id}', () => {
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

  it('updates entity properties', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create test entity
    const entityId = await createTestEntity(client, {
      _name: 'Original Book',
      _kind: 'book',
      description: 'Original description',
      _visibility: 'private',
    });

    // Update entity properties
    await client
      .patch(`/entities/${entityId}`)
      .send({
        _name: 'Updated Book',
        description: 'Updated description',
        _visibility: 'public',
      })
      .expect(204);

    // Verify changes by getting the updated entity
    const response = await client.get(`/entities/${entityId}`).expect(200);

    // Verify response
    expect(response.body).to.have.property('_id', entityId);
    expect(response.body).to.have.property('_name', 'Updated Book');
    expect(response.body).to.have.property('_kind', 'book');
    expect(response.body).to.have.property(
      'description',
      'Updated description',
    );
    expect(response.body).to.have.property('_visibility', 'public');
    expect(response.body).to.have.property('_version', 2); // Version should be incremented
    expect(response.body).to.have.property('_validFromDateTime');
    expect(response.body).to.have.property('_createdDateTime');
    expect(response.body).to.have.property('_lastUpdatedDateTime');
  });
});
