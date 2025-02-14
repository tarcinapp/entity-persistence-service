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

  it('filters active entities with complex filter', async () => {
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

  it('filters active entities using set[actives]', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 7);

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

    // Create inactive entity (not started)
    await createTestEntity({
      _name: 'Future Book',
      _kind: 'book',
      _validFromDateTime: futureDate.toISOString(),
      _validUntilDateTime: null,
    });

    // Get active entities using set[actives]
    const filterStr = 'set[actives]=true';
    const response = await client.get('/entities').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Active Book');
  });

  it('filters public entities using set[publics]', async () => {
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

    // Create protected entity
    await createTestEntity({
      _name: 'Protected Book',
      _kind: 'book',
      _visibility: 'protected',
    });

    // Create private entity
    await createTestEntity({
      _name: 'Private Book',
      _kind: 'book',
      _visibility: 'private',
    });

    // Get public entities using set[publics]
    const filterStr = 'set[publics]=true';
    const response = await client.get('/entities').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Public Book');
    expect(response.body[0]._visibility).to.equal('public');
  });

  it('combines multiple sets with AND operator', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 7);

    // Create active and public entity
    await createTestEntity({
      _name: 'Active Public Book',
      _kind: 'book',
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create active but private entity
    await createTestEntity({
      _name: 'Active Private Book',
      _kind: 'book',
      _visibility: 'private',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create inactive but public entity
    await createTestEntity({
      _name: 'Inactive Public Book',
      _kind: 'book',
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });

    // Create inactive and private entity
    await createTestEntity({
      _name: 'Inactive Private Book',
      _kind: 'book',
      _visibility: 'private',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });

    // Get entities that are both active AND public using set[and]
    const filterStr = 'set[and][0][actives]=true&set[and][1][publics]=true';
    const response = await client.get('/entities').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Active Public Book');
    expect(response.body[0]._visibility).to.equal('public');
    expect(response.body[0]._validUntilDateTime).to.equal(
      futureDate.toISOString(),
    );
  });

  it('combines set filters with regular filters', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    const now = new Date();

    // Create a date for the first day of current month
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Create a date for the second day of current month
    const secondDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 2);

    // Create a date in previous month
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);

    // Create a date 1 hour before now (definitely in the past)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Create an old inactive science book (previous month)
    await createTestEntity({
      _name: 'Old Inactive Science Book',
      _kind: 'book',
      description: 'science',
      _creationDateTime: previousMonth.toISOString(),
      _validFromDateTime: previousMonth.toISOString(),
      _validUntilDateTime: previousMonth.toISOString(),
    });

    // Create a recent inactive science book (this month, and expired)
    await createTestEntity({
      _name: 'Recent Inactive Science Book',
      _kind: 'book',
      description: 'science',
      _creationDateTime: secondDayOfMonth.toISOString(), // Definitely within current month
      _validFromDateTime: secondDayOfMonth.toISOString(),
      _validUntilDateTime: oneHourAgo.toISOString(), // Definitely inactive
    });

    // Create a recent inactive history book (this month)
    await createTestEntity({
      _name: 'Recent Inactive History Book',
      _kind: 'book',
      description: 'history',
      _creationDateTime: firstDayOfMonth.toISOString(),
      _validFromDateTime: firstDayOfMonth.toISOString(),
      _validUntilDateTime: oneHourAgo.toISOString(),
    });

    // Create a recent active science book (this month, but not expired)
    await createTestEntity({
      _name: 'Recent Active Science Book',
      _kind: 'book',
      description: 'science',
      _creationDateTime: firstDayOfMonth.toISOString(),
      _validFromDateTime: firstDayOfMonth.toISOString(),
      _validUntilDateTime: new Date(now.getTime() + 86400000).toISOString(), // tomorrow
    });

    // Get inactive entities created within the current month that have 'science' in their description
    const filterStr =
      'set[and][0][inactives]=true&set[and][1][month]=true&filter[where][description]=science';
    const response = await client.get('/entities').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Recent Inactive Science Book');
    expect(response.body[0].description).to.equal('science');

    // Verify it was created this month
    const createdDate = new Date(response.body[0]._creationDateTime);
    expect(createdDate.getMonth()).to.equal(now.getMonth());
    expect(createdDate.getFullYear()).to.equal(now.getFullYear());

    // Verify it is inactive (validUntilDateTime is in the past)
    expect(
      new Date(response.body[0]._validUntilDateTime).getTime(),
    ).to.be.lessThan(now.getTime());
  });

  it('filters inactive entities using set[inactives]', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const olderPastDate = new Date(now);
    olderPastDate.setDate(olderPastDate.getDate() - 2);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 7);

    // Create an inactive entity (expired yesterday)
    await createTestEntity({
      _name: 'Recently Expired Book',
      _kind: 'book',
      _validFromDateTime: olderPastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(), // Expired yesterday
    });

    // Create another inactive entity (expired 2 days ago)
    await createTestEntity({
      _name: 'Old Expired Book',
      _kind: 'book',
      _validFromDateTime: olderPastDate.toISOString(),
      _validUntilDateTime: olderPastDate.toISOString(), // Expired 2 days ago
    });

    // Create an active entity with future expiration
    await createTestEntity({
      _name: 'Active Book',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(), // Expires in 7 days
    });

    // Create an active entity with no expiration
    await createTestEntity({
      _name: 'Indefinite Book',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: null, // Never expires
    });

    // Create an entity with no start date (should not be counted as inactive)
    await createTestEntity({
      _name: 'No Start Date Book',
      _kind: 'book',
      _validFromDateTime: undefined,
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Get inactive entities using set[inactives]
    const filterStr = 'set[inactives]=true';
    const response = await client.get('/entities').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(2);

    // Sort the results by name for consistent testing
    const sortedResults = response.body.sort((a: any, b: any) =>
      a._name.localeCompare(b._name),
    );

    // Check first entity (Old Expired Book)
    expect(sortedResults[0]._name).to.equal('Old Expired Book');
    expect(
      new Date(sortedResults[0]._validUntilDateTime).getTime(),
    ).to.be.lessThanOrEqual(now.getTime());

    // Check second entity (Recently Expired Book)
    expect(sortedResults[1]._name).to.equal('Recently Expired Book');
    expect(
      new Date(sortedResults[1]._validUntilDateTime).getTime(),
    ).to.be.lessThanOrEqual(now.getTime());
  });

  it('returns only selected fields', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create test entity with multiple fields
    await createTestEntity({
      _name: 'Complete Book',
      _kind: 'book',
      description: 'A book with many fields',
      _visibility: 'public',
      _ownerUsers: ['user-123'],
      _viewerUsers: ['viewer-456'],
      _validFromDateTime: new Date().toISOString(),
    });

    // Request only specific fields
    const filterStr =
      'filter[fields][_name]=true&filter[fields][description]=true&filter[fields][_visibility]=true';
    const response = await client.get('/entities').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    const entity = response.body[0];

    // Should have the requested fields
    expect(entity).to.have.property('_name', 'Complete Book');
    expect(entity).to.have.property('description', 'A book with many fields');
    expect(entity).to.have.property('_visibility', 'public');

    // Should not have other fields
    expect(entity).to.not.have.property('_id');
    expect(entity).to.not.have.property('_kind');
    expect(entity).to.not.have.property('_ownerUsers');
    expect(entity).to.not.have.property('_viewerUsers');
    expect(entity).to.not.have.property('_validFromDateTime');
    expect(entity).to.not.have.property('_creationDateTime');
    expect(entity).to.not.have.property('_lastUpdatedDateTime');
  });

  it('excludes specified fields from response', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    const now = new Date();

    // Create test entity with multiple fields
    await createTestEntity({
      _name: 'Complete Book',
      _kind: 'book',
      description: 'A book with many fields',
      _visibility: 'public',
      _ownerUsers: ['user-123'],
      _viewerUsers: ['viewer-456'],
      _validFromDateTime: now.toISOString(),
      _validUntilDateTime: new Date(now.getTime() + 86400000).toISOString(), // tomorrow
    });

    // Request to exclude specific fields
    const filterStr =
      'filter[fields][_ownerUsers]=false&filter[fields][_viewerUsers]=false&filter[fields][_validFromDateTime]=false&filter[fields][_validUntilDateTime]=false';
    const response = await client.get('/entities').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    const entity = response.body[0];

    // Should have non-excluded fields
    expect(entity).to.have.property('_id');
    expect(entity).to.have.property('_name', 'Complete Book');
    expect(entity).to.have.property('_kind', 'book');

    // Loopback is not returning fields that are not explitly defined in the model, if at least one field is excluded in the filter query.
    //expect(entity).to.have.property('description', 'A book with many fields');
    expect(entity).to.have.property('_visibility', 'public');
    expect(entity).to.have.property('_createdDateTime');
    expect(entity).to.have.property('_lastUpdatedDateTime');

    // Should not have excluded fields
    expect(entity).to.not.have.property('_ownerUsers');
    expect(entity).to.not.have.property('_viewerUsers');
    expect(entity).to.not.have.property('_validFromDateTime');
    expect(entity).to.not.have.property('_validUntilDateTime');
  });
});
