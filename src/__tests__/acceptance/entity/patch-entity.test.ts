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

  it('should not allow modifying _kind field with PATCH operation', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,article',
    });
    ({ client } = appWithClient);

    // Create test entity
    const entityId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
      description: 'Test description',
      _visibility: 'private',
    });

    // Attempt to update _kind field
    const response = await client
      .patch(`/entities/${entityId}`)
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
      "Entity kind cannot be changed after creation. Current kind is 'book'.",
    );
    expect(response.body.error).to.have.property(
      'code',
      'IMMUTABLE-ENTITY-KIND',
    );

    // Verify _kind remains unchanged by getting the entity
    const getResponse = await client.get(`/entities/${entityId}`).expect(200);
    expect(getResponse.body).to.have.property('_kind', 'book');
  });

  it('should allow updating other fields while preserving _kind', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,article',
    });
    ({ client } = appWithClient);

    // Create test entity
    const entityId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
      description: 'Test description',
      _visibility: 'private',
    });

    // Update other fields
    await client
      .patch(`/entities/${entityId}`)
      .send({
        _name: 'Updated Book',
        description: 'Updated description',
        _visibility: 'public',
      })
      .expect(204);

    // Verify _kind remains unchanged while other fields are updated
    const response = await client.get(`/entities/${entityId}`).expect(200);
    expect(response.body).to.have.property('_kind', 'book');
    expect(response.body).to.have.property('_name', 'Updated Book');
    expect(response.body).to.have.property(
      'description',
      'Updated description',
    );
    expect(response.body).to.have.property('_visibility', 'public');
  });
});
