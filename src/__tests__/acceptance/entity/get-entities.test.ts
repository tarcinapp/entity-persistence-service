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
      response_limit_entity: '2', // Limit response to 2 items
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
    //const filterStr = 'filter[limit]=2';
    const response = await client.get('/entities').expect(200);

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

  it('resolves entity references through lookup', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,author',
    });
    ({ client } = appWithClient);

    // Create an author entity
    const authorId = await createTestEntity({
      _name: 'John Doe',
      _kind: 'author',
      biography: 'Famous author',
    });

    // Create a book entity that references the author
    await createTestEntity({
      _name: 'The Great Book',
      _kind: 'book',
      author: `tapp://localhost/entities/${authorId}`,
      description: 'A great book by John Doe',
    });

    // Get the book with author lookup
    const filterStr = 'filter[lookup][0][prop]=author';
    const response = await client.get('/entities').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(2);

    // Find the book in the response
    const book = response.body.find((e: GenericEntity) => e._kind === 'book');
    expect(book).to.not.be.undefined();
    expect(book._name).to.equal('The Great Book');

    // Verify the author reference is resolved
    expect(book.author).to.be.an.Object();
    expect(book.author._id).to.equal(authorId);
    expect(book.author._name).to.equal('John Doe');
    expect(book.author._kind).to.equal('author');
    expect(book.author.biography).to.equal('Famous author');
  });

  it('resolves multiple lookups including nested property references', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,author,publisher',
    });
    ({ client } = appWithClient);

    // Create a publisher entity
    const publisherId = await createTestEntity({
      _name: 'Big Publishing House',
      _kind: 'publisher',
      location: 'New York',
    });

    // Create an author entity that references the publisher
    const authorId = await createTestEntity({
      _name: 'John Doe',
      _kind: 'author',
      biography: 'Famous author',
      publisher: `tapp://localhost/entities/${publisherId}`,
    });

    // Create a book entity that references the author
    await createTestEntity({
      _name: 'The Great Book',
      _kind: 'book',
      author: `tapp://localhost/entities/${authorId}`,
      description: 'A great book by John Doe',
    });

    // Get the book with both author and author's publisher lookups
    const filterStr =
      'filter[lookup][0][prop]=author&' +
      'filter[lookup][0][scope][lookup][0][prop]=publisher';
    const response = await client.get('/entities').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(3);

    // Find the book in the response
    const book = response.body.find((e: GenericEntity) => e._kind === 'book');
    expect(book).to.not.be.undefined();
    expect(book._name).to.equal('The Great Book');

    // Verify the author reference is resolved
    expect(book.author).to.be.an.Object();
    expect(book.author._id).to.equal(authorId);
    expect(book.author._name).to.equal('John Doe');
    expect(book.author._kind).to.equal('author');
    expect(book.author.biography).to.equal('Famous author');

    // Verify the nested publisher reference is resolved
    expect(book.author.publisher).to.be.an.Object();
    expect(book.author.publisher._id).to.equal(publisherId);
    expect(book.author.publisher._name).to.equal('Big Publishing House');
    expect(book.author.publisher._kind).to.equal('publisher');
    expect(book.author.publisher.location).to.equal('New York');
  });

  it('resolves lookups from nested property paths', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,author',
    });
    ({ client } = appWithClient);

    // Create an author entity
    const authorId = await createTestEntity({
      _name: 'John Doe',
      _kind: 'author',
      biography: 'Famous author',
    });

    // Create a book entity with nested reference to the author
    await createTestEntity({
      _name: 'The Great Book',
      _kind: 'book',
      metadata: {
        references: {
          author: `tapp://localhost/entities/${authorId}`,
        },
      },
      description: 'A great book by John Doe',
    });

    // Get the book with nested author lookup
    const filterStr = 'filter[lookup][0][prop]=metadata.references.author';
    const response = await client.get('/entities').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(2);

    // Find the book in the response
    const book = response.body.find((e: GenericEntity) => e._kind === 'book');
    expect(book).to.not.be.undefined();
    expect(book._name).to.equal('The Great Book');

    // Verify the nested author reference is resolved
    expect(book.metadata.references.author).to.be.an.Object();
    expect(book.metadata.references.author._id).to.equal(authorId);
    expect(book.metadata.references.author._name).to.equal('John Doe');
    expect(book.metadata.references.author._kind).to.equal('author');
    expect(book.metadata.references.author.biography).to.equal('Famous author');
  });

  it('selects specific fields from looked-up entities using scope', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,author',
    });
    ({ client } = appWithClient);

    // Create an author entity with multiple fields
    const authorId = await createTestEntity({
      _name: 'John Doe',
      _kind: 'author',
      biography: 'Famous author',
      email: 'john@example.com',
      phone: '123-456-7890',
      address: '123 Main St',
    });

    // Create a book entity that references the author
    await createTestEntity({
      _name: 'The Great Book',
      _kind: 'book',
      author: `tapp://localhost/entities/${authorId}`,
      description: 'A great book by John Doe',
    });

    // Get the book with author lookup, selecting only name and biography fields
    const filterStr =
      'filter[lookup][0][prop]=author&' +
      'filter[lookup][0][scope][fields][_name]=true&' +
      'filter[lookup][0][scope][fields][biography]=true';
    const response = await client.get('/entities').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(2);

    // Find the book in the response
    const book = response.body.find((e: GenericEntity) => e._kind === 'book');
    expect(book).to.not.be.undefined();
    expect(book._name).to.equal('The Great Book');

    // Verify the author reference is resolved with only selected fields
    expect(book.author).to.be.an.Object();
    expect(book.author._name).to.equal('John Doe');
    expect(book.author.biography).to.equal('Famous author');

    // Verify other fields are not included
    expect(book.author).to.not.have.property('_id');
    expect(book.author).to.not.have.property('_kind');
    expect(book.author).to.not.have.property('email');
    expect(book.author).to.not.have.property('phone');
    expect(book.author).to.not.have.property('address');
  });

  it('resolves lookups from array properties containing entity references', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,author',
    });
    ({ client } = appWithClient);

    // Create multiple author entities
    const author1Id = await createTestEntity({
      _name: 'John Doe',
      _kind: 'author',
      biography: 'Famous author',
    });

    const author2Id = await createTestEntity({
      _name: 'Jane Smith',
      _kind: 'author',
      biography: 'Award-winning author',
    });

    // Create a book entity with array of author references
    await createTestEntity({
      _name: 'The Great Book',
      _kind: 'book',
      authors: [
        `tapp://localhost/entities/${author1Id}`,
        `tapp://localhost/entities/${author2Id}`,
      ],
      description: 'A great book by multiple authors',
    });

    // Get the book with authors lookup, using skip and limit in scope
    const filterStr =
      'filter[lookup][0][prop]=authors&' +
      'filter[lookup][0][scope][skip]=1&' +
      'filter[lookup][0][scope][limit]=2&' +
      'filter[lookup][0][scope][order][0]=_name ASC';
    const response = await client.get('/entities').query(filterStr).expect(200);

    // Response should contain all entities (book + all authors)
    expect(response.body).to.be.Array().and.have.length(3);

    // Find the book in the response
    const book = response.body.find((e: GenericEntity) => e._kind === 'book');
    expect(book).to.not.be.undefined();
    expect(book._name).to.equal('The Great Book');

    // Verify the authors array is resolved with skip and limit applied
    // After ordering by name ASC: Jane Smith, John Doe
    // After skip=1: Only John Doe should remain
    expect(book.authors).to.be.an.Array().and.have.length(1);

    // Verify first author (should be John Doe, as Jane Smith was skipped)
    const author1 = book.authors[0];
    expect(author1).to.be.an.Object();
    expect(author1._id).to.equal(author1Id);
    expect(author1._name).to.equal('John Doe');
    expect(author1._kind).to.equal('author');
    expect(author1.biography).to.equal('Famous author');

    // Verify invalid and not-found references are not included
    const authorIds = book.authors.map((a: any) => a._id);
    expect(authorIds.indexOf('invalid-guid')).to.equal(-1);
    expect(authorIds.indexOf('00000000-0000-0000-0000-000000000000')).to.equal(
      -1,
    );
  });

  it('applies skip and limit in scope when looking up array references', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,author',
    });
    ({ client } = appWithClient);

    // Create multiple author entities
    const author1Id = await createTestEntity({
      _name: 'John Doe',
      _kind: 'author',
      biography: 'Famous author',
    });

    const author2Id = await createTestEntity({
      _name: 'Jane Smith',
      _kind: 'author',
      biography: 'Award-winning author',
    });

    const author3Id = await createTestEntity({
      _name: 'Bob Wilson',
      _kind: 'author',
      biography: 'Best-selling author',
    });

    const author4Id = await createTestEntity({
      _name: 'Alice Brown',
      _kind: 'author',
      biography: 'Critically acclaimed author',
    });

    // Create a book entity with array of author references
    await createTestEntity({
      _name: 'The Great Book',
      _kind: 'book',
      authors: [
        `tapp://localhost/entities/${author1Id}`,
        `tapp://localhost/entities/${author2Id}`,
        `tapp://localhost/entities/${author3Id}`,
        `tapp://localhost/entities/${author4Id}`,
      ],
      description: 'A great book by multiple authors',
    });

    // Get the book with authors lookup, using skip and limit in scope
    const filterStr =
      'filter[lookup][0][prop]=authors&' +
      'filter[lookup][0][scope][skip]=1&' +
      'filter[lookup][0][scope][limit]=2&' +
      'filter[lookup][0][scope][order][0]=_name ASC';
    const response = await client.get('/entities').query(filterStr).expect(200);

    // Response should contain all entities (book + all authors)
    expect(response.body).to.be.Array().and.have.length(5);

    // Find the book in the response
    const book = response.body.find((e: GenericEntity) => e._kind === 'book');
    expect(book).to.not.be.undefined();
    expect(book._name).to.equal('The Great Book');

    // Verify the authors array is resolved with skip and limit applied
    expect(book.authors).to.be.an.Array().and.have.length(2);

    // Verify first author (should be Bob Wilson, as Alice Brown was skipped)
    const author1 = book.authors[0];
    expect(author1).to.be.an.Object();
    expect(author1._id).to.equal(author3Id);
    expect(author1._name).to.equal('Bob Wilson');
    expect(author1._kind).to.equal('author');
    expect(author1.biography).to.equal('Best-selling author');

    // Verify second author (should be Jane Smith)
    const author2 = book.authors[1];
    expect(author2).to.be.an.Object();
    expect(author2._id).to.equal(author2Id);
    expect(author2._name).to.equal('Jane Smith');
    expect(author2._kind).to.equal('author');
    expect(author2.biography).to.equal('Award-winning author');

    // Verify invalid and not-found references are not included
    expect(book.authors).to.have.length(2);
    const authorIds = book.authors.map((a: any) => a._id);
    expect(authorIds.indexOf('invalid-guid')).to.equal(-1);
    expect(authorIds.indexOf('00000000-0000-0000-0000-000000000000')).to.equal(
      -1,
    );
  });

  it('handles invalid references and not-found entities with skip and limit', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,author',
    });
    ({ client } = appWithClient);

    // Create multiple author entities
    const author1Id = await createTestEntity({
      _name: 'John Doe',
      _kind: 'author',
      biography: 'Famous author',
    });

    const author2Id = await createTestEntity({
      _name: 'Jane Smith',
      _kind: 'author',
      biography: 'Award-winning author',
    });

    // Create a book entity with array of author references including invalid and not-found references
    await createTestEntity({
      _name: 'The Great Book',
      _kind: 'book',
      authors: [
        'invalid-reference', // Invalid reference format
        `tapp://localhost/entities/${author1Id}`,
        'tapp://localhost/entities/invalid-guid', // Invalid GUID
        `tapp://localhost/entities/${author2Id}`,
        'tapp://localhost/entities/00000000-0000-0000-0000-000000000000', // Not found entity
      ],
      description: 'A great book by multiple authors',
    });

    // Get the book with authors lookup, using skip and limit in scope
    const filterStr =
      'filter[lookup][0][prop]=authors&' +
      'filter[lookup][0][scope][skip]=1&' +
      'filter[lookup][0][scope][limit]=2&' +
      'filter[lookup][0][scope][order][0]=_name ASC';
    const response = await client.get('/entities').query(filterStr).expect(200);

    // Response should contain all entities (book + all authors)
    expect(response.body).to.be.Array().and.have.length(3);

    // Find the book in the response
    const book = response.body.find((e: GenericEntity) => e._kind === 'book');
    expect(book).to.not.be.undefined();
    expect(book._name).to.equal('The Great Book');

    // Verify the authors array is resolved with skip and limit applied
    // After ordering by name ASC: Jane Smith, John Doe
    // After skip=1: Only John Doe should remain
    expect(book.authors).to.be.an.Array().and.have.length(1);

    // Verify first author (should be John Doe, as Jane Smith was skipped)
    const author1 = book.authors[0];
    expect(author1).to.be.an.Object();
    expect(author1._id).to.equal(author1Id);
    expect(author1._name).to.equal('John Doe');
    expect(author1._kind).to.equal('author');
    expect(author1.biography).to.equal('Famous author');

    // Verify invalid and not-found references are not included
    const authorIds = book.authors.map((a: any) => a._id);
    expect(authorIds.indexOf('invalid-guid')).to.equal(-1);
    expect(authorIds.indexOf('00000000-0000-0000-0000-000000000000')).to.equal(
      -1,
    );
  });

  it('handles not-found entities with skip and limit', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,author',
    });
    ({ client } = appWithClient);

    // Create a book entity with array of author references including not-found entities
    await createTestEntity({
      _name: 'The Great Book',
      _kind: 'book',
      authors: [
        'tapp://localhost/entities/00000000-0000-0000-0000-000000000000', // Not found entity 1
        'tapp://localhost/entities/11111111-1111-1111-1111-111111111111', // Not found entity 2
        'tapp://localhost/entities/22222222-2222-2222-2222-222222222222', // Not found entity 3
      ],
      description: 'A great book with missing authors',
    });

    // Get the book with authors lookup, using skip and limit in scope
    const filterStr =
      'filter[lookup][0][prop]=authors&' +
      'filter[lookup][0][scope][skip]=1&' +
      'filter[lookup][0][scope][limit]=1';
    const response = await client.get('/entities').query(filterStr).expect(200);

    // Response should contain only the book (no authors found)
    expect(response.body).to.be.Array().and.have.length(1);

    // Find the book in the response
    const book = response.body.find((e: GenericEntity) => e._kind === 'book');
    expect(book).to.not.be.undefined();
    expect(book._name).to.equal('The Great Book');

    // Verify the authors array is empty since all references are not-found entities
    expect(book.authors).to.be.an.Array().and.have.length(0);
  });
});
