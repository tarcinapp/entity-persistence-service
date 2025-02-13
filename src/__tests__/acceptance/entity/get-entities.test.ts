import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { GenericEntity } from '../../../models';
import type { AppWithClient } from '../test-helper';
import { setupApplication, teardownApplication } from '../test-helper';

describe('GET /entities', () => {
  let client: Client;
  let appWithClient: AppWithClient | undefined;

  // Store created entity IDs for cleanup
  let createdEntityIds: string[] = [];

  beforeEach(async () => {
    if (appWithClient) {
      await teardownApplication(appWithClient);
    }

    appWithClient = undefined;

    // Clear all environment variables
    Object.keys(process.env).forEach((key) => {
      delete process.env[key];
    });

    // Reset created entity IDs
    createdEntityIds = [];
  });

  afterEach(async () => {
    if (appWithClient) {
      // Clean up created entities
      for (const id of createdEntityIds) {
        try {
          await client.delete(`/entities/${id}`);
        } catch (error) {
          console.error(`Failed to delete entity ${id}:`, error);
        }
      }

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

  async function createTestEntity(
    entityData: Partial<GenericEntity>,
  ): Promise<string> {
    const response = await client
      .post('/entities')
      .send(entityData)
      .expect(200);
    const entityId = response.body._id;
    createdEntityIds.push(entityId);

    return entityId;
  }

  it('returns all entities when no filter is applied', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,movie',
    });
    ({ client } = appWithClient);

    // Create test entities
    await createTestEntity({
      _name: 'Book 1',
      _kind: 'book',
      description: 'First book',
    });

    await createTestEntity({
      _name: 'Movie 1',
      _kind: 'movie',
      description: 'First movie',
    });

    // Get all entities
    const response = await client.get('/entities').expect(200);

    expect(response.body).to.be.Array().and.have.length(2);
    expect(response.body.map((e: GenericEntity) => e._name)).to.containDeep([
      'Book 1',
      'Movie 1',
    ]);
  });

  it('filters entities by kind', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,movie',
    });
    ({ client } = appWithClient);

    // Create test entities
    await createTestEntity({
      _name: 'Book 1',
      _kind: 'book',
      description: 'First book',
    });

    await createTestEntity({
      _name: 'Movie 1',
      _kind: 'movie',
      description: 'First movie',
    });

    // Get only book entities
    const response = await client
      .get('/entities')
      .query({ filter: { where: { _kind: 'book' } } })
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Book 1');
    expect(response.body[0]._kind).to.equal('book');
  });

  it('filters active entities', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);

    // Create active entity
    await createTestEntity({
      _name: 'Active Book',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create inactive entity (expired)
    await createTestEntity({
      _name: 'Inactive Book',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });

    // Get only active entities using complex filter
    const filterStr =
      `filter[where][and][0][or][0][_validUntilDateTime][eq]=null&` +
      `filter[where][and][0][or][1][_validUntilDateTime][gt]=${encodeURIComponent(now.toISOString())}&` +
      `filter[where][and][1][_validFromDateTime][neq]=null&` +
      `filter[where][and][2][_validFromDateTime][lt]=${encodeURIComponent(now.toISOString())}`;

    const response = await client.get('/entities').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Active Book');
  });

  it('filters entities by visibility', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create public entity
    await createTestEntity({
      _name: 'Public Book',
      _kind: 'book',
      _visibility: 'public',
    });

    // Create private entity
    await createTestEntity({
      _name: 'Private Book',
      _kind: 'book',
      _visibility: 'private',
    });

    // Get only public entities
    const response = await client
      .get('/entities')
      .query({ filter: { where: { _visibility: 'public' } } })
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Public Book');
    expect(response.body[0]._visibility).to.equal('public');
  });

  it('filters entities by owner', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    const owner1 = 'user-123';
    const owner2 = 'user-456';

    // Create entity with owner1
    await createTestEntity({
      _name: 'Owner1 Book',
      _kind: 'book',
      _ownerUsers: [owner1],
    });

    // Create entity with owner2
    await createTestEntity({
      _name: 'Owner2 Book',
      _kind: 'book',
      _ownerUsers: [owner2],
    });

    // Get entities for owner1
    const filterStr = `filter[where][_ownerUsers][inq][]=${owner1}`;

    const response = await client.get('/entities').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Owner1 Book');
    expect(response.body[0]._ownerUsers).to.containDeep([owner1]);
  });

  it('applies response limit configuration', async () => {
    // Set up the application with response limit configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      response_limit_entity_count: '2', // Limit response to 2 items
    });
    ({ client } = appWithClient);

    // Create 3 entities
    await createTestEntity({
      _name: 'Book 1',
      _kind: 'book',
    });

    await createTestEntity({
      _name: 'Book 2',
      _kind: 'book',
    });

    await createTestEntity({
      _name: 'Book 3',
      _kind: 'book',
    });

    // Get entities with limit
    const filterStr = 'filter[limit]=2';
    const response = await client.get('/entities').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(2);
  });

  it('supports pagination', async () => {
    // Set up the application
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create test entities
    await createTestEntity({
      _name: 'Book 1',
      _kind: 'book',
    });

    await createTestEntity({
      _name: 'Book 2',
      _kind: 'book',
    });

    await createTestEntity({
      _name: 'Book 3',
      _kind: 'book',
    });

    // Get first page
    const firstPage = await client
      .get('/entities')
      .query({ filter: { limit: 2, skip: 0 } })
      .expect(200);

    expect(firstPage.body).to.be.Array().and.have.length(2);

    // Get second page
    const secondPage = await client
      .get('/entities')
      .query({ filter: { limit: 2, skip: 2 } })
      .expect(200);

    expect(secondPage.body).to.be.Array().and.have.length(1);
  });

  it('supports sorting', async () => {
    // Set up the application
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create test entities
    await createTestEntity({
      _name: 'Book C',
      _kind: 'book',
    });

    await createTestEntity({
      _name: 'Book A',
      _kind: 'book',
    });

    await createTestEntity({
      _name: 'Book B',
      _kind: 'book',
    });

    // Get entities sorted by name
    const response = await client
      .get('/entities')
      .query({ filter: { order: ['_name ASC'] } })
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(3);
    expect(response.body.map((e: GenericEntity) => e._name)).to.eql([
      'Book A',
      'Book B',
      'Book C',
    ]);
  });

  it('supports set filters via query parameters', async () => {
    // Set up the application
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);

    // Create active entity
    await createTestEntity({
      _name: 'Active Book',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create inactive entity
    await createTestEntity({
      _name: 'Inactive Book',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });

    // Get active entities using set filter directly
    const response = await client
      .get('/entities')
      .query({ set: { actives: true } })
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Active Book');

    // Get active and public entities using multiple set filters
    const multiSetResponse = await client
      .get('/entities')
      .query({
        set: {
          actives: true,
          publics: true,
        },
      })
      .expect(200);

    expect(multiSetResponse.body).to.be.Array();
  });

  it('filters entities by audience using set filter', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    const owner = 'user-123';
    const viewer = 'user-456';
    const otherUser = 'user-789';

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 7);

    // Create entity with owner
    await createTestEntity({
      _name: 'Owner Book',
      _kind: 'book',
      _ownerUsers: [owner],
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create entity with viewer
    await createTestEntity({
      _name: 'Viewer Book',
      _kind: 'book',
      _viewerUsers: [viewer],
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create entity with neither owner nor viewer
    await createTestEntity({
      _name: 'Other Book',
      _kind: 'book',
    });

    // Get entities for owner using set[audience]
    const ownerFilterStr = `set[audience][userIds]=${owner}`;
    const ownerResponse = await client
      .get('/entities')
      .query(ownerFilterStr)
      .expect(200);

    expect(ownerResponse.body).to.be.Array().and.have.length(1);
    expect(ownerResponse.body[0]._name).to.equal('Owner Book');
    expect(ownerResponse.body[0]._ownerUsers).to.containDeep([owner]);

    // Get entities for viewer using set[audience]
    const viewerFilterStr = `set[audience][userIds]=${viewer}`;
    const viewerResponse = await client
      .get('/entities')
      .query(viewerFilterStr)
      .expect(200);

    expect(viewerResponse.body).to.be.Array().and.have.length(1);
    expect(viewerResponse.body[0]._name).to.equal('Viewer Book');
    expect(viewerResponse.body[0]._viewerUsers).to.containDeep([viewer]);

    // Get entities for user with no access
    const otherFilterStr = `set[audience][userIds]=${otherUser}`;
    const otherResponse = await client
      .get('/entities')
      .query(otherFilterStr)
      .expect(200);

    expect(otherResponse.body).to.be.Array().and.have.length(0);
  });
});
