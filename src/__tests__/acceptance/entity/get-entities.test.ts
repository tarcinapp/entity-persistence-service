import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { GenericEntity, List } from '../../../models';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestEntity,
  createTestList,
  cleanupCreatedEntities,
} from '../test-helper';

describe('GET /entities', () => {
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
      // Clean up created entities
      await cleanupCreatedEntities(client);

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

  // Basic CRUD Tests
  it('basic: returns all entities when no filter is applied', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,movie',
    });
    ({ client } = appWithClient);

    // Create test entities
    await createTestEntity(client, {
      _name: 'Book 1',
      _kind: 'book',
      description: 'First book',
    });

    await createTestEntity(client, {
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

  // Filter Tests
  it('filter: by kind', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,movie',
    });
    ({ client } = appWithClient);

    // Create test entities
    await createTestEntity(client, {
      _name: 'Book 1',
      _kind: 'book',
      description: 'First book',
    });

    await createTestEntity(client, {
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
  });

  it('filter: active entities with complex filter', async () => {
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
    await createTestEntity(client, {
      _name: 'Active Book',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create inactive entity (expired)
    await createTestEntity(client, {
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

  it('filter: by visibility', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create public entity
    await createTestEntity(client, {
      _name: 'Public Book',
      _kind: 'book',
      _visibility: 'public',
    });

    // Create private entity
    await createTestEntity(client, {
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

  it('filter: by validFromDateTime', async () => {
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

    // Create entity with past validFromDateTime
    await createTestEntity(client, {
      _name: 'Past Book',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
    });

    // Create entity with future validFromDateTime
    await createTestEntity(client, {
      _name: 'Future Book',
      _kind: 'book',
      _validFromDateTime: futureDate.toISOString(),
    });

    // Get entities with validFromDateTime in the past
    const filterStr = `filter[where][_validFromDateTime][lt]=${encodeURIComponent(now.toISOString())}`;
    const response = await client.get('/entities').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Past Book');
    expect(response.body[0]._validFromDateTime).to.equal(
      pastDate.toISOString(),
    );
  });

  it('filter: by arbitrary date field (publishedDate)', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    // Create entity published last month
    await createTestEntity(client, {
      _name: 'Old Published Book',
      _kind: 'book',
      publishedDate: lastMonth.toISOString(),
    });

    // Create entity published next month
    await createTestEntity(client, {
      _name: 'New Published Book',
      _kind: 'book',
      publishedDate: nextMonth.toISOString(),
    });

    // Create entity with no published date
    await createTestEntity(client, {
      _name: 'Unpublished Book',
      _kind: 'book',
    });

    // Get entities published before now
    const filterStr = `filter[where][and][0][publishedDate][lt]=${encodeURIComponent(now.toISOString())}&filter[where][and][1][publishedDate][neq]=null`;
    const response = await client.get('/entities').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Old Published Book');
    expect(response.body[0].publishedDate).to.equal(lastMonth.toISOString());
  });

  it('filter: by arbitrary number fields (pages and price)', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create books with different page counts and prices
    await createTestEntity(client, {
      _name: 'Short Cheap Book',
      _kind: 'book',
      pages: 100,
      price: 9.99,
    });

    await createTestEntity(client, {
      _name: 'Long Expensive Book',
      _kind: 'book',
      pages: 500,
      price: 29.99,
    });

    await createTestEntity(client, {
      _name: 'Medium Priced Book',
      _kind: 'book',
      pages: 300,
      price: 19.99,
    });

    // Get books with more than 200 pages and price less than 25.00
    const filterStr =
      `filter[where][pages][gt]=200&` +
      `filter[where][pages][type]=number&` +
      `filter[where][price][lt]=25.00&` +
      `filter[where][price][type]=number`;

    const response = await client.get('/entities').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Medium Priced Book');
    expect(response.body[0].pages).to.equal(300);
    expect(response.body[0].price).to.equal(19.99);

    // Test with between range for pages and exact price match
    const rangeFilterStr =
      `filter[where][pages][between][0]=250&` +
      `filter[where][pages][between][1]=350&` +
      `filter[where][pages][type]=number&` +
      `filter[where][price][eq]=19.99&` +
      `filter[where][price][type]=number`;

    const rangeResponse = await client
      .get('/entities')
      .query(rangeFilterStr)
      .expect(200);

    expect(rangeResponse.body).to.be.Array().and.have.length(1);
    expect(rangeResponse.body[0]._name).to.equal('Medium Priced Book');
    expect(rangeResponse.body[0].pages).to.equal(300);
    expect(rangeResponse.body[0].price).to.equal(19.99);
  });

  it('filter: by owner', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    const owner1 = 'user-123';
    const owner2 = 'user-456';

    // Create entity with owner1
    await createTestEntity(client, {
      _name: 'Owner1 Book',
      _kind: 'book',
      _ownerUsers: [owner1],
    });

    // Create entity with owner2
    await createTestEntity(client, {
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

  it('filter: by nested fields using dot notation', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setMonth(pastDate.getMonth() - 1);

    // Create test entities with nested fields
    await createTestEntity(client, {
      _name: 'Book One',
      _kind: 'book',
      metadata: {
        publication: {
          year: 2024,
          edition: '1st',
          price: 29.99,
          releaseDate: now.toISOString(),
          details: {
            format: 'hardcover',
            pages: 300,
            stock: {
              quantity: 150,
              location: 'WAREHOUSE-A',
            },
          },
        },
        reviews: {
          rating: 4.5,
          verified: true,
          lastUpdated: pastDate.toISOString(),
        },
      },
    });

    await createTestEntity(client, {
      _name: 'Book Two',
      _kind: 'book',
      metadata: {
        publication: {
          year: 2023,
          edition: '2nd',
          price: 19.99,
          releaseDate: pastDate.toISOString(),
          details: {
            format: 'paperback',
            pages: 250,
            stock: {
              quantity: 50,
              location: 'WAREHOUSE-B',
            },
          },
        },
        reviews: {
          rating: 3.8,
          verified: false,
          lastUpdated: pastDate.toISOString(),
        },
      },
    });

    // Test filter by nested number field with type hint
    const numberFilterStr =
      `filter[where][metadata.publication.year][gt]=2023&` +
      `filter[where][metadata.publication.year][type]=number`;

    const numberResponse = await client
      .get('/entities')
      .query(numberFilterStr)
      .expect(200);

    expect(numberResponse.body).to.be.Array().and.have.length(1);
    expect(numberResponse.body[0]._name).to.equal('Book One');
    expect(numberResponse.body[0].metadata.publication.year).to.equal(2024);

    // Test filter by nested double field with type hint
    const doubleFilterStr =
      `filter[where][metadata.reviews.rating][gt]=4.0&` +
      `filter[where][metadata.reviews.rating][type]=number`;

    const doubleResponse = await client
      .get('/entities')
      .query(doubleFilterStr)
      .expect(200);

    expect(doubleResponse.body).to.be.Array().and.have.length(1);
    expect(doubleResponse.body[0]._name).to.equal('Book One');
    expect(doubleResponse.body[0].metadata.reviews.rating).to.equal(4.5);

    // Test filter by nested string field
    const stringFilterStr = `filter[where][metadata.publication.details.format]=hardcover`;

    const stringResponse = await client
      .get('/entities')
      .query(stringFilterStr)
      .expect(200);

    expect(stringResponse.body).to.be.Array().and.have.length(1);
    expect(stringResponse.body[0]._name).to.equal('Book One');
    expect(stringResponse.body[0].metadata.publication.details.format).to.equal(
      'hardcover',
    );

    // Test filter by nested date field
    const dateFilterStr = `filter[where][metadata.publication.releaseDate][gt]=${encodeURIComponent(pastDate.toISOString())}`;

    const dateResponse = await client
      .get('/entities')
      .query(dateFilterStr)
      .expect(200);

    expect(dateResponse.body).to.be.Array().and.have.length(1);
    expect(dateResponse.body[0]._name).to.equal('Book One');

    // Test filter by multiple nested fields with AND condition
    const complexFilterStr =
      `filter[where][and][0][metadata.publication.details.stock.quantity][gt]=100&` +
      `filter[where][and][0][metadata.publication.details.stock.quantity][type]=number&` +
      `filter[where][and][1][metadata.reviews.verified][eq]=true&` +
      `filter[where][and][1][metadata.reviews.verified][type]=boolean&` +
      `filter[where][and][2][metadata.publication.price][lt]=30.00&` +
      `filter[where][and][2][metadata.publication.price][type]=number`;

    const complexResponse = await client
      .get('/entities')
      .query(complexFilterStr)
      .expect(200);

    expect(complexResponse.body).to.be.Array().and.have.length(1);
    expect(complexResponse.body[0]._name).to.equal('Book One');
    expect(
      complexResponse.body[0].metadata.publication.details.stock.quantity,
    ).to.equal(150);
    expect(complexResponse.body[0].metadata.reviews.verified).to.be.true();
    expect(complexResponse.body[0].metadata.publication.price).to.equal(29.99);
  });

  // Pagination and Sorting Tests
  it('pagination: applies response limit configuration', async () => {
    // Set up the application with response limit configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      response_limit_entity: '2', // Limit response to 2 items
    });
    ({ client } = appWithClient);

    // Create 3 entities
    await createTestEntity(client, {
      _name: 'Book 1',
      _kind: 'book',
    });

    await createTestEntity(client, {
      _name: 'Book 2',
      _kind: 'book',
    });

    await createTestEntity(client, {
      _name: 'Book 3',
      _kind: 'book',
    });

    // Get entities with limit
    //const filterStr = 'filter[limit]=2';
    const response = await client.get('/entities').expect(200);

    expect(response.body).to.be.Array().and.have.length(2);
  });

  it('pagination: supports pagination', async () => {
    // Set up the application
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create test entities
    await createTestEntity(client, {
      _name: 'Book 1',
      _kind: 'book',
    });

    await createTestEntity(client, {
      _name: 'Book 2',
      _kind: 'book',
    });

    await createTestEntity(client, {
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

  it('pagination: supports sorting', async () => {
    // Set up the application
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create test entities
    await createTestEntity(client, {
      _name: 'Book C',
      _kind: 'book',
    });

    await createTestEntity(client, {
      _name: 'Book A',
      _kind: 'book',
    });

    await createTestEntity(client, {
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

  // Set Filter Tests
  it('set-filter: supports set filters via query parameters', async () => {
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
    await createTestEntity(client, {
      _name: 'Active Book',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create inactive entity
    await createTestEntity(client, {
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

  it('set-filter: filters entities by audience', async () => {
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
    await createTestEntity(client, {
      _name: 'Owner Book',
      _kind: 'book',
      _ownerUsers: [owner],
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create entity with viewer
    await createTestEntity(client, {
      _name: 'Viewer Book',
      _kind: 'book',
      _viewerUsers: [viewer],
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create entity with neither owner nor viewer
    await createTestEntity(client, {
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

  it('set-filter: filters active entities', async () => {
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
    await createTestEntity(client, {
      _name: 'Active Book',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create inactive entity (expired)
    await createTestEntity(client, {
      _name: 'Inactive Book',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });

    // Create inactive entity (not started)
    await createTestEntity(client, {
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

  it('set-filter: filters public entities', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create public entity
    await createTestEntity(client, {
      _name: 'Public Book',
      _kind: 'book',
      _visibility: 'public',
    });

    // Create protected entity
    await createTestEntity(client, {
      _name: 'Protected Book',
      _kind: 'book',
      _visibility: 'protected',
    });

    // Create private entity
    await createTestEntity(client, {
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

  it('set-filter: combines multiple sets with AND operator', async () => {
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
    await createTestEntity(client, {
      _name: 'Active Public Book',
      _kind: 'book',
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create active but private entity
    await createTestEntity(client, {
      _name: 'Active Private Book',
      _kind: 'book',
      _visibility: 'private',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create inactive but public entity
    await createTestEntity(client, {
      _name: 'Inactive Public Book',
      _kind: 'book',
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });

    // Create inactive and private entity
    await createTestEntity(client, {
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

  it('set-filter: combines set filters with regular filters', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    const now = new Date();

    // Create a date for the first day of current month
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Create a date for the current day (today) rather than hardcoding the second day
    // This ensures the date is never in the future
    const currentDay = new Date(now);
    // Set the time to midnight to ensure it's earlier in the day
    currentDay.setHours(0, 0, 0, 0);

    // Create a date that's definitely in the past but still in this month
    // If it's the first day of the month, use earlier hours on the same day
    const definitelyPastDate = new Date(now);
    // Set time to 3 hours ago to ensure it's in the past
    definitelyPastDate.setHours(now.getHours() - 3);

    // Create a date in previous month
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);

    // Create a date 1 hour before now (definitely in the past)
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Create an old inactive science book (previous month)
    await createTestEntity(client, {
      _name: 'Old Inactive Science Book',
      _kind: 'book',
      description: 'science',
      _creationDateTime: previousMonth.toISOString(),
      _validFromDateTime: previousMonth.toISOString(),
      _validUntilDateTime: previousMonth.toISOString(),
    });

    // Create a recent inactive science book (this month, and expired)
    await createTestEntity(client, {
      _name: 'Recent Inactive Science Book',
      _kind: 'book',
      description: 'science',
      _creationDateTime: definitelyPastDate.toISOString(), // Several hours in the past
      _validFromDateTime: definitelyPastDate.toISOString(),
      _validUntilDateTime: oneHourAgo.toISOString(), // Definitely inactive
    });

    // Create a recent inactive history book (this month)
    await createTestEntity(client, {
      _name: 'Recent Inactive History Book',
      _kind: 'book',
      description: 'history',
      _creationDateTime: firstDayOfMonth.toISOString(),
      _validFromDateTime: firstDayOfMonth.toISOString(),
      _validUntilDateTime: oneHourAgo.toISOString(),
    });

    // Create a recent active science book (this month, but not expired)
    await createTestEntity(client, {
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

  it('set-filter: filters inactive entities', async () => {
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
    await createTestEntity(client, {
      _name: 'Recently Expired Book',
      _kind: 'book',
      _validFromDateTime: olderPastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(), // Expired yesterday
    });

    // Create another inactive entity (expired 2 days ago)
    await createTestEntity(client, {
      _name: 'Old Expired Book',
      _kind: 'book',
      _validFromDateTime: olderPastDate.toISOString(),
      _validUntilDateTime: olderPastDate.toISOString(), // Expired 2 days ago
    });

    // Create an active entity with future expiration
    await createTestEntity(client, {
      _name: 'Active Book',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(), // Expires in 7 days
    });

    // Create an active entity with no expiration
    await createTestEntity(client, {
      _name: 'Indefinite Book',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: null, // Never expires
    });

    // Create an entity with no start date (should not be counted as inactive)
    await createTestEntity(client, {
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

  // Field Selection Tests
  it('field-selection: returns only selected fields', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create test entity with multiple fields
    await createTestEntity(client, {
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

  it('field-selection: excludes specified fields from response', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    const now = new Date();

    // Create test entity with multiple fields
    await createTestEntity(client, {
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

  // Entity Lookup Tests
  it('lookup: resolves entity references through lookup', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,author',
    });
    ({ client } = appWithClient);

    // Create an author entity
    const authorId = await createTestEntity(client, {
      _name: 'John Doe',
      _kind: 'author',
      biography: 'Famous author',
    });

    // Create a book entity that references the author
    await createTestEntity(client, {
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

  it('lookup: resolves multiple lookups including nested property references', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,author,publisher',
    });
    ({ client } = appWithClient);

    // Create a publisher entity
    const publisherId = await createTestEntity(client, {
      _name: 'Big Publishing House',
      _kind: 'publisher',
      location: 'New York',
    });

    // Create an author entity that references the publisher
    const authorId = await createTestEntity(client, {
      _name: 'John Doe',
      _kind: 'author',
      biography: 'Famous author',
      publisher: `tapp://localhost/entities/${publisherId}`,
    });

    // Create a book entity that references the author
    await createTestEntity(client, {
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

  it('lookup: resolves lookups from nested property paths', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,author',
    });
    ({ client } = appWithClient);

    // Create an author entity
    const authorId = await createTestEntity(client, {
      _name: 'John Doe',
      _kind: 'author',
      biography: 'Famous author',
    });

    // Create a book entity with nested reference to the author
    await createTestEntity(client, {
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

  it('lookup: selects specific fields from looked-up entities using scope', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,author',
    });
    ({ client } = appWithClient);

    // Create an author entity with multiple fields
    const authorId = await createTestEntity(client, {
      _name: 'John Doe',
      _kind: 'author',
      biography: 'Famous author',
      email: 'john@example.com',
      phone: '123-456-7890',
      address: '123 Main St',
    });

    // Create a book entity that references the author
    await createTestEntity(client, {
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

  it('lookup: resolves lookups from array properties containing entity references', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,author',
    });
    ({ client } = appWithClient);

    // Create multiple author entities
    const author1Id = await createTestEntity(client, {
      _name: 'John Doe',
      _kind: 'author',
      biography: 'Famous author',
    });

    const author2Id = await createTestEntity(client, {
      _name: 'Jane Smith',
      _kind: 'author',
      biography: 'Award-winning author',
    });

    // Create a book entity with array of author references
    await createTestEntity(client, {
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

  it('lookup: applies skip and limit in scope when looking up array references', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,author',
    });
    ({ client } = appWithClient);

    // Create multiple author entities
    const author1Id = await createTestEntity(client, {
      _name: 'John Doe',
      _kind: 'author',
      biography: 'Famous author',
    });

    const author2Id = await createTestEntity(client, {
      _name: 'Jane Smith',
      _kind: 'author',
      biography: 'Award-winning author',
    });

    const author3Id = await createTestEntity(client, {
      _name: 'Bob Wilson',
      _kind: 'author',
      biography: 'Best-selling author',
    });

    const author4Id = await createTestEntity(client, {
      _name: 'Alice Brown',
      _kind: 'author',
      biography: 'Critically acclaimed author',
    });

    // Create a book entity with array of author references
    await createTestEntity(client, {
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

  it('lookup: handles invalid references and not-found entities with skip and limit', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,author',
    });
    ({ client } = appWithClient);

    // Create multiple author entities
    const author1Id = await createTestEntity(client, {
      _name: 'John Doe',
      _kind: 'author',
      biography: 'Famous author',
    });

    const author2Id = await createTestEntity(client, {
      _name: 'Jane Smith',
      _kind: 'author',
      biography: 'Award-winning author',
    });

    // Create a book entity with array of author references including invalid and not-found references
    await createTestEntity(client, {
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

  it('lookup: handles not-found entities with skip and limit', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,author',
    });
    ({ client } = appWithClient);

    // Create a book entity with array of author references including not-found entities
    await createTestEntity(client, {
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

    expect(response.body).to.be.Array().and.have.length(1);

    // Find the book in the response
    const book = response.body.find((e: GenericEntity) => e._kind === 'book');
    expect(book).to.not.be.undefined();
    expect(book._name).to.equal('The Great Book');

    // Verify the authors array is empty since all references were not found
    expect(book.authors).to.be.Array().and.have.length(0);
  });

  // List Lookup Tests
  it('list-lookup: resolves list references through lookup', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create a reading list
    const listId = await createTestList(client, {
      _name: 'My Reading List',
      _kind: 'reading-list',
      description: 'Books I want to read',
    });

    // Create a book entity that references the list
    await createTestEntity(client, {
      _name: 'The Great Book',
      _kind: 'book',
      readingList: `tapp://localhost/lists/${listId}`,
      description: 'A great book to read',
    });

    // Get the book with reading list lookup
    const filterStr = 'filter[lookup][0][prop]=readingList';
    const response = await client.get('/entities').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);

    // Find the book in the response
    const book = response.body.find((e: GenericEntity) => e._kind === 'book');
    expect(book).to.not.be.undefined();
    expect(book._name).to.equal('The Great Book');

    // Verify the list reference is resolved
    expect(book.readingList).to.be.an.Object();
    expect(book.readingList._id).to.equal(listId);
    expect(book.readingList._name).to.equal('My Reading List');
    expect(book.readingList._kind).to.equal('reading-list');
    expect(book.readingList.description).to.equal('Books I want to read');
  });

  it('list-lookup: resolves multiple lookups including nested list references', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list,collection',
    });
    ({ client } = appWithClient);

    // Create a collection list
    const collectionId = await createTestList(client, {
      _name: 'My Collection',
      _kind: 'collection',
      description: 'My book collection',
    });

    // Create a reading list that references the collection
    const readingListId = await createTestList(client, {
      _name: 'My Reading List',
      _kind: 'reading-list',
      description: 'Books I want to read',
      collection: `tapp://localhost/lists/${collectionId}`,
    });

    // Create a book entity that references the reading list
    await createTestEntity(client, {
      _name: 'The Great Book',
      _kind: 'book',
      readingList: `tapp://localhost/lists/${readingListId}`,
      description: 'A great book to read',
    });

    // Get the book with both reading list and collection lookups
    const filterStr =
      'filter[lookup][0][prop]=readingList&' +
      'filter[lookup][0][scope][lookup][0][prop]=collection';
    const response = await client.get('/entities').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);

    // Find the book in the response
    const book = response.body.find((e: GenericEntity) => e._kind === 'book');
    expect(book).to.not.be.undefined();
    expect(book._name).to.equal('The Great Book');

    // Verify the reading list reference is resolved
    expect(book.readingList).to.be.an.Object();
    expect(book.readingList._id).to.equal(readingListId);
    expect(book.readingList._name).to.equal('My Reading List');
    expect(book.readingList._kind).to.equal('reading-list');
    expect(book.readingList.description).to.equal('Books I want to read');

    // Verify the nested collection reference is resolved
    expect(book.readingList.collection).to.be.an.Object();
    expect(book.readingList.collection._id).to.equal(collectionId);
    expect(book.readingList.collection._name).to.equal('My Collection');
    expect(book.readingList.collection._kind).to.equal('collection');
    expect(book.readingList.collection.description).to.equal(
      'My book collection',
    );
  });

  it('list-lookup: resolves lookups from nested property paths', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create a reading list
    const listId = await createTestList(client, {
      _name: 'My Reading List',
      _kind: 'reading-list',
      description: 'Books I want to read',
    });

    // Create a book entity with nested reference to the list
    await createTestEntity(client, {
      _name: 'The Great Book',
      _kind: 'book',
      metadata: {
        references: {
          readingList: `tapp://localhost/lists/${listId}`,
        },
      },
      description: 'A great book to read',
    });

    // Get the book with nested list lookup
    const filterStr = 'filter[lookup][0][prop]=metadata.references.readingList';
    const response = await client.get('/entities').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);

    // Find the book in the response
    const book = response.body.find((e: GenericEntity) => e._kind === 'book');
    expect(book).to.not.be.undefined();
    expect(book._name).to.equal('The Great Book');

    // Verify the nested list reference is resolved
    expect(book.metadata.references.readingList).to.be.an.Object();
    expect(book.metadata.references.readingList._id).to.equal(listId);
    expect(book.metadata.references.readingList._name).to.equal(
      'My Reading List',
    );
    expect(book.metadata.references.readingList._kind).to.equal('reading-list');
    expect(book.metadata.references.readingList.description).to.equal(
      'Books I want to read',
    );
  });

  it('list-lookup: selects specific fields from looked-up lists using scope', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create a reading list with multiple fields
    const listId = await createTestList(client, {
      _name: 'My Reading List',
      _kind: 'reading-list',
      description: 'Books I want to read',
      category: 'Fiction',
      priority: 'High',
    });

    // Create a book entity that references the list
    await createTestEntity(client, {
      _name: 'The Great Book',
      _kind: 'book',
      readingList: `tapp://localhost/lists/${listId}`,
      description: 'A great book to read',
    });

    // Get the book with list lookup, selecting only name and description fields
    const filterStr =
      'filter[lookup][0][prop]=readingList&' +
      'filter[lookup][0][scope][fields][_name]=true&' +
      'filter[lookup][0][scope][fields][description]=true';
    const response = await client.get('/entities').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);

    // Find the book in the response
    const book = response.body.find((e: GenericEntity) => e._kind === 'book');
    expect(book).to.not.be.undefined();
    expect(book._name).to.equal('The Great Book');

    // Verify the list reference is resolved with only selected fields
    expect(book.readingList).to.be.an.Object();
    expect(book.readingList._name).to.equal('My Reading List');
    expect(book.readingList.description).to.equal('Books I want to read');

    // Verify other fields are not included
    expect(book.readingList).to.not.have.property('_id');
    expect(book.readingList).to.not.have.property('_kind');
    expect(book.readingList).to.not.have.property('category');
    expect(book.readingList).to.not.have.property('priority');
  });

  it('list-lookup: resolves lookups from array properties containing list references', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create multiple reading lists
    const list1Id = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
      description: 'First list',
    });

    const list2Id = await createTestList(client, {
      _name: 'List 2',
      _kind: 'reading-list',
      description: 'Second list',
    });

    // Create an entity with array of list references
    await createTestEntity(client, {
      _name: 'Book with Multiple Lists',
      _kind: 'book',
      readingLists: [
        `tapp://localhost/lists/${list1Id}`,
        `tapp://localhost/lists/${list2Id}`,
      ],
      description: 'A book with multiple reading lists',
    });

    // Get the entity with lists lookup, using skip and limit in scope
    const filterStr =
      'filter[lookup][0][prop]=readingLists&' +
      'filter[lookup][0][scope][skip]=1&' +
      'filter[lookup][0][scope][limit]=2&' +
      'filter[lookup][0][scope][order][0]=_name ASC';
    const response = await client.get('/entities').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);

    // Find the book in the response
    const book = response.body.find((e: GenericEntity) => e._kind === 'book');
    expect(book).to.not.be.undefined();
    expect(book._name).to.equal('Book with Multiple Lists');

    // Verify the lists array is resolved with skip and limit applied
    expect(book.readingLists).to.be.Array().and.have.length(1);

    // Verify first list (should be List 2, as List 1 was skipped)
    const list1 = book.readingLists[0];
    expect(list1).to.be.an.Object();
    expect(list1._id).to.equal(list2Id);
    expect(list1._name).to.equal('List 2');
    expect(list1._kind).to.equal('reading-list');
    expect(list1.description).to.equal('Second list');
  });

  it('list-lookup: applies skip and limit in scope when looking up array references', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create multiple reading lists
    const list1Id = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
      description: 'First list',
    });

    const list2Id = await createTestList(client, {
      _name: 'List 2',
      _kind: 'reading-list',
      description: 'Second list',
    });

    const list3Id = await createTestList(client, {
      _name: 'List 3',
      _kind: 'reading-list',
      description: 'Third list',
    });

    const list4Id = await createTestList(client, {
      _name: 'List 4',
      _kind: 'reading-list',
      description: 'Fourth list',
    });

    // Create an entity with array of list references
    await createTestEntity(client, {
      _name: 'Book with Multiple Lists',
      _kind: 'book',
      readingLists: [
        `tapp://localhost/lists/${list1Id}`,
        `tapp://localhost/lists/${list2Id}`,
        `tapp://localhost/lists/${list3Id}`,
        `tapp://localhost/lists/${list4Id}`,
      ],
      description: 'A book with multiple reading lists',
    });

    // Get the entity with lists lookup, using skip and limit in scope
    const filterStr =
      'filter[lookup][0][prop]=readingLists&' +
      'filter[lookup][0][scope][skip]=1&' +
      'filter[lookup][0][scope][limit]=2&' +
      'filter[lookup][0][scope][order][0]=_name ASC';
    const response = await client.get('/entities').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);

    // Find the book in the response
    const book = response.body.find((e: GenericEntity) => e._kind === 'book');
    expect(book).to.not.be.undefined();
    expect(book._name).to.equal('Book with Multiple Lists');

    // Verify the lists array is resolved with skip and limit applied
    expect(book.readingLists).to.be.Array().and.have.length(2);

    // Verify first list (should be List 2, as List 1 was skipped)
    const list1 = book.readingLists[0];
    expect(list1).to.be.an.Object();
    expect(list1._id).to.equal(list2Id);
    expect(list1._name).to.equal('List 2');
    expect(list1._kind).to.equal('reading-list');
    expect(list1.description).to.equal('Second list');
  });

  it('list-lookup: handles invalid references and not-found lists with skip and limit', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create multiple reading lists
    const list1Id = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
      description: 'First list',
    });

    const list2Id = await createTestList(client, {
      _name: 'List 2',
      _kind: 'reading-list',
      description: 'Second list',
    });

    // Create an entity with array of list references including invalid and not-found references
    await createTestEntity(client, {
      _name: 'Book with Mixed Lists',
      _kind: 'book',
      readingLists: [
        'invalid-reference', // Invalid reference format
        `tapp://localhost/lists/${list1Id}`,
        'tapp://localhost/lists/invalid-guid', // Invalid GUID
        `tapp://localhost/lists/${list2Id}`,
        'tapp://localhost/lists/00000000-0000-0000-0000-000000000000', // Not found list
      ],
      description: 'A book with mixed valid and invalid list references',
    });

    // Get the entity with lists lookup, using skip and limit in scope
    const filterStr =
      'filter[lookup][0][prop]=readingLists&' +
      'filter[lookup][0][scope][skip]=1&' +
      'filter[lookup][0][scope][limit]=2&' +
      'filter[lookup][0][scope][order][0]=_name ASC';
    const response = await client.get('/entities').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);

    // Find the book in the response
    const book = response.body.find((e: GenericEntity) => e._kind === 'book');
    expect(book).to.not.be.undefined();
    expect(book._name).to.equal('Book with Mixed Lists');

    // Verify the lists array is resolved with skip and limit applied
    expect(book.readingLists).to.be.Array().and.have.length(1);

    // Verify first list (should be List 2, as List 1 was skipped)
    const list1 = book.readingLists[0];
    expect(list1).to.be.an.Object();
    expect(list1._id).to.equal(list2Id);
    expect(list1._name).to.equal('List 2');
    expect(list1._kind).to.equal('reading-list');
    expect(list1.description).to.equal('Second list');

    // Verify invalid and not-found references are not included
    const listIds = book.readingLists.map((l: List) => l._id);
    expect(listIds.indexOf('invalid-guid')).to.equal(-1);
    expect(listIds.indexOf('00000000-0000-0000-0000-000000000000')).to.equal(
      -1,
    );
  });

  it('list-lookup: handles not-found lists with skip and limit', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create an entity with array of list references including not-found lists
    await createTestEntity(client, {
      _name: 'Book with Missing Lists',
      _kind: 'book',
      readingLists: [
        'tapp://localhost/lists/00000000-0000-0000-0000-000000000000', // Not found list 1
        'tapp://localhost/lists/11111111-1111-1111-1111-111111111111', // Not found list 2
        'tapp://localhost/lists/22222222-2222-2222-2222-222222222222', // Not found list 3
      ],
      description: 'A book with missing list references',
    });

    // Get the entity with lists lookup, using skip and limit in scope
    const filterStr =
      'filter[lookup][0][prop]=readingLists&' +
      'filter[lookup][0][scope][skip]=1&' +
      'filter[lookup][0][scope][limit]=1';
    const response = await client.get('/entities').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);

    // Find the book in the response
    const book = response.body.find((e: GenericEntity) => e._kind === 'book');
    expect(book).to.not.be.undefined();
    expect(book._name).to.equal('Book with Missing Lists');

    // Verify the lists array is empty since all references were not found
    expect(book.readingLists).to.be.Array().and.have.length(0);
  });

  it('include: includes reactions in entity response', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      entity_reaction_kinds: 'like,love,wow,haha',
    });
    ({ client } = appWithClient);

    // Create 3 test entities
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

    const entity3Id = await createTestEntity(client, {
      _name: 'Book 3',
      _kind: 'book',
      description: 'Third book',
    });

    // Create reactions for each entity
    // Entity 1 reactions
    await client.post('/entity-reactions').send({
      _entityId: entity1Id,
      _name: 'Like',
      _kind: 'like',
      _ownerUsers: ['user-1'],
    });

    await client.post('/entity-reactions').send({
      _entityId: entity1Id,
      _name: 'Love',
      _kind: 'love',
      _ownerUsers: ['user-2'],
    });

    // Entity 2 reactions
    await client.post('/entity-reactions').send({
      _entityId: entity2Id,
      _name: 'Like',
      _kind: 'like',
      _ownerUsers: ['user-1'],
    });

    await client.post('/entity-reactions').send({
      _entityId: entity2Id,
      _name: 'Love',
      _kind: 'love',
      _ownerUsers: ['user-2'],
    });

    await client.post('/entity-reactions').send({
      _entityId: entity2Id,
      _name: 'Wow',
      _kind: 'wow',
      _ownerUsers: ['user-3'],
    });

    // Entity 3 reactions
    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Like',
      _kind: 'like',
      _ownerUsers: ['user-1'],
    });

    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Love',
      _kind: 'love',
      _ownerUsers: ['user-2'],
    });

    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Wow',
      _kind: 'wow',
      _ownerUsers: ['user-3'],
    });

    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Haha',
      _kind: 'haha',
      _ownerUsers: ['user-4'],
    });

    // Get entities with included reactions
    const response = await client
      .get('/entities')
      .query('filter[include][0][relation]=_reactions')
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(3);

    // Verify each entity has its reactions included
    const entity1 = response.body.find((e: any) => e._id === entity1Id);
    expect(entity1).to.not.be.undefined();
    expect(entity1).to.not.have.property('_reactions');

    const entity2 = response.body.find((e: any) => e._id === entity2Id);
    expect(entity2).to.not.be.undefined();
    expect(entity2._reactions).to.be.Array().and.have.length(2);
    expect(entity2._reactions.map((r: any) => r.count)).to.containDeep([
      15, 20,
    ]);

    const entity3 = response.body.find((e: any) => e._id === entity3Id);
    expect(entity3).to.not.be.undefined();
    expect(entity3._reactions).to.be.Array().and.have.length(2);
    expect(entity3._reactions.map((r: any) => r.count)).to.containDeep([
      15, 20,
    ]);
  });

  it('include: includes reactions in entity response with scope filtering', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      entity_reaction_kinds: 'like,love,wow,haha',
    });
    ({ client } = appWithClient);

    // Create 3 test entities
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

    const entity3Id = await createTestEntity(client, {
      _name: 'Book 3',
      _kind: 'book',
      description: 'Third book',
    });

    // Create reactions for each entity
    // Entity 1 reactions
    await client.post('/entity-reactions').send({
      _entityId: entity1Id,
      _name: 'Like Reaction',
      _kind: 'like',
      _ownerUsers: ['user-1'],
    });

    await client.post('/entity-reactions').send({
      _entityId: entity1Id,
      _name: 'Love Reaction',
      _kind: 'love',
      _ownerUsers: ['user-2'],
    });

    // Entity 2 reactions
    await client.post('/entity-reactions').send({
      _entityId: entity2Id,
      _name: 'Like Reaction',
      _kind: 'like',
      _ownerUsers: ['user-1'],
    });

    await client.post('/entity-reactions').send({
      _entityId: entity2Id,
      _name: 'Love Reaction',
      _kind: 'love',
      _ownerUsers: ['user-2'],
    });

    await client.post('/entity-reactions').send({
      _entityId: entity2Id,
      _name: 'Wow Reaction',
      _kind: 'wow',
      _ownerUsers: ['user-3'],
    });

    // Entity 3 reactions
    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Like Reaction',
      _kind: 'like',
      _ownerUsers: ['user-1'],
    });

    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Love Reaction',
      _kind: 'love',
      _ownerUsers: ['user-2'],
    });

    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Wow Reaction',
      _kind: 'wow',
      _ownerUsers: ['user-3'],
    });

    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Haha Reaction',
      _kind: 'haha',
      _ownerUsers: ['user-4'],
    });

    // Get entities with included reactions filtered by name
    const response = await client
      .get('/entities')
      .query(
        'filter[include][0][relation]=_reactions&filter[include][0][scope][where][_name]=Like%20Reaction',
      )
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(3);

    // Verify each entity has its reactions included and filtered
    const entity1 = response.body.find((e: any) => e._id === entity1Id);
    expect(entity1).to.not.be.undefined();
    expect(entity1).to.not.have.property('_reactions');

    const entity2 = response.body.find((e: any) => e._id === entity2Id);
    expect(entity2).to.not.be.undefined();
    expect(entity2._reactions).to.be.Array().and.have.length(2);
    expect(entity2._reactions.map((r: any) => r.count)).to.containDeep([
      15, 20,
    ]);

    const entity3 = response.body.find((e: any) => e._id === entity3Id);
    expect(entity3).to.not.be.undefined();
    expect(entity3._reactions).to.be.Array().and.have.length(2);
    expect(entity3._reactions.map((r: any) => r.count)).to.containDeep([
      15, 20,
    ]);
  });

  it('include: includes reactions in entity response with scope filtering by numeric property', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      entity_reaction_kinds: 'like,love,wow,haha',
    });
    ({ client } = appWithClient);

    // Create 3 test entities
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

    const entity3Id = await createTestEntity(client, {
      _name: 'Book 3',
      _kind: 'book',
      description: 'Third book',
    });

    // Create reactions for each entity with count property
    // Entity 1 reactions
    await client.post('/entity-reactions').send({
      _entityId: entity1Id,
      _name: 'Like Reaction',
      _kind: 'like',
      _ownerUsers: ['user-1'],
      count: 5,
    });

    await client.post('/entity-reactions').send({
      _entityId: entity1Id,
      _name: 'Love Reaction',
      _kind: 'love',
      _ownerUsers: ['user-2'],
      count: 10,
    });

    // Entity 2 reactions
    await client.post('/entity-reactions').send({
      _entityId: entity2Id,
      _name: 'Like Reaction',
      _kind: 'like',
      _ownerUsers: ['user-1'],
      count: 5,
    });

    await client.post('/entity-reactions').send({
      _entityId: entity2Id,
      _name: 'Love Reaction',
      _kind: 'love',
      _ownerUsers: ['user-2'],
      count: 15,
    });

    await client.post('/entity-reactions').send({
      _entityId: entity2Id,
      _name: 'Wow Reaction',
      _kind: 'wow',
      _ownerUsers: ['user-3'],
      count: 20,
    });

    // Entity 3 reactions
    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Like Reaction',
      _kind: 'like',
      _ownerUsers: ['user-1'],
      count: 5,
    });

    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Love Reaction',
      _kind: 'love',
      _ownerUsers: ['user-2'],
      count: 10,
    });

    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Wow Reaction',
      _kind: 'wow',
      _ownerUsers: ['user-3'],
      count: 15,
    });

    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Haha Reaction',
      _kind: 'haha',
      _ownerUsers: ['user-4'],
      count: 20,
    });

    // Get entities with included reactions filtered by count > 10
    const response = await client
      .get('/entities')
      .query(
        'filter[include][0][relation]=_reactions&filter[include][0][scope][where][count][gt]=10&filter[include][0][scope][where][count][type]=number',
      )
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(3);

    // Verify each entity has its reactions included and filtered
    const entity1 = response.body.find((e: any) => e._id === entity1Id);
    expect(entity1).to.not.be.undefined();
    expect(entity1).to.not.have.property('_reactions');

    const entity2 = response.body.find((e: any) => e._id === entity2Id);
    expect(entity2).to.not.be.undefined();
    expect(entity2._reactions).to.be.Array().and.have.length(2);
    expect(entity2._reactions.map((r: any) => r.count)).to.containDeep([
      15, 20,
    ]);

    const entity3 = response.body.find((e: any) => e._id === entity3Id);
    expect(entity3).to.not.be.undefined();
    expect(entity3._reactions).to.be.Array().and.have.length(2);
    expect(entity3._reactions.map((r: any) => r.count)).to.containDeep([
      15, 20,
    ]);
  });

  it('include: includes reactions in entity response with scope filtering by date property', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      entity_reaction_kinds: 'like,love,wow,haha',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Create 3 test entities
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

    const entity3Id = await createTestEntity(client, {
      _name: 'Book 3',
      _kind: 'book',
      description: 'Third book',
    });

    // Create reactions for each entity with reactionDate property
    // Entity 1 reactions
    await client.post('/entity-reactions').send({
      _entityId: entity1Id,
      _name: 'Like Reaction',
      _kind: 'like',
      _ownerUsers: ['user-1'],
      reactionDate: yesterday.toISOString(),
    });

    await client.post('/entity-reactions').send({
      _entityId: entity1Id,
      _name: 'Love Reaction',
      _kind: 'love',
      _ownerUsers: ['user-2'],
      reactionDate: now.toISOString(),
    });

    // Entity 2 reactions
    await client.post('/entity-reactions').send({
      _entityId: entity2Id,
      _name: 'Like Reaction',
      _kind: 'like',
      _ownerUsers: ['user-1'],
      reactionDate: yesterday.toISOString(),
    });

    await client.post('/entity-reactions').send({
      _entityId: entity2Id,
      _name: 'Love Reaction',
      _kind: 'love',
      _ownerUsers: ['user-2'],
      reactionDate: now.toISOString(),
    });

    await client.post('/entity-reactions').send({
      _entityId: entity2Id,
      _name: 'Wow Reaction',
      _kind: 'wow',
      _ownerUsers: ['user-3'],
      reactionDate: tomorrow.toISOString(),
    });

    // Entity 3 reactions
    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Like Reaction',
      _kind: 'like',
      _ownerUsers: ['user-1'],
      reactionDate: yesterday.toISOString(),
    });

    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Love Reaction',
      _kind: 'love',
      _ownerUsers: ['user-2'],
      reactionDate: now.toISOString(),
    });

    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Wow Reaction',
      _kind: 'wow',
      _ownerUsers: ['user-3'],
      reactionDate: tomorrow.toISOString(),
    });

    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Haha Reaction',
      _kind: 'haha',
      _ownerUsers: ['user-4'],
      reactionDate: tomorrow.toISOString(),
    });

    // Get entities with included reactions filtered by reactionDate > now
    const response = await client
      .get('/entities')
      .query(
        `filter[include][0][relation]=_reactions&filter[include][0][scope][where][reactionDate][gt]=${encodeURIComponent(now.toISOString())}`,
      )
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(3);

    // Verify each entity has its reactions included and filtered
    const entity1 = response.body.find((e: any) => e._id === entity1Id);
    expect(entity1).to.not.be.undefined();
    expect(entity1).to.not.have.property('_reactions');

    const entity2 = response.body.find((e: any) => e._id === entity2Id);
    expect(entity2).to.not.be.undefined();
    expect(entity2._reactions).to.be.Array().and.have.length(1);
    expect(entity2._reactions[0]._name).to.equal('Wow Reaction');
    expect(entity2._reactions[0].reactionDate).to.equal(tomorrow.toISOString());

    const entity3 = response.body.find((e: any) => e._id === entity3Id);
    expect(entity3).to.not.be.undefined();
    expect(entity3._reactions).to.be.Array().and.have.length(2);
    expect(entity3._reactions.map((r: any) => r._name)).to.containDeep([
      'Wow Reaction',
      'Haha Reaction',
    ]);
    expect(entity3._reactions.map((r: any) => r.reactionDate)).to.containDeep([
      tomorrow.toISOString(),
      tomorrow.toISOString(),
    ]);
  });

  it('include: includes reactions in entity response with set[actives] filter', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      entity_reaction_kinds: 'like,love,wow,haha',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 10);
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 10);

    // Create 3 test entities
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

    const entity3Id = await createTestEntity(client, {
      _name: 'Book 3',
      _kind: 'book',
      description: 'Third book',
    });

    // Create reactions for each entity with different validity periods
    // Entity 1 reactions
    await client.post('/entity-reactions').send({
      _entityId: entity1Id,
      _name: 'Like Reaction',
      _kind: 'like',
      _ownerUsers: ['user-1'],
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: null, // Never expires
    });

    await client.post('/entity-reactions').send({
      _entityId: entity1Id,
      _name: 'Love Reaction',
      _kind: 'love',
      _ownerUsers: ['user-2'],
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(), // Expired
    });

    // Entity 2 reactions
    await client.post('/entity-reactions').send({
      _entityId: entity2Id,
      _name: 'Like Reaction',
      _kind: 'like',
      _ownerUsers: ['user-1'],
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(), // Active
    });

    await client.post('/entity-reactions').send({
      _entityId: entity2Id,
      _name: 'Love Reaction',
      _kind: 'love',
      _ownerUsers: ['user-2'],
      _validFromDateTime: futureDate.toISOString(), // Not started yet
      _validUntilDateTime: null,
    });

    await client.post('/entity-reactions').send({
      _entityId: entity2Id,
      _name: 'Wow Reaction',
      _kind: 'wow',
      _ownerUsers: ['user-3'],
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: null, // Never expires
    });

    // Entity 3 reactions
    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Like Reaction',
      _kind: 'like',
      _ownerUsers: ['user-1'],
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(), // Expired
    });

    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Love Reaction',
      _kind: 'love',
      _ownerUsers: ['user-2'],
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(), // Active
    });

    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Wow Reaction',
      _kind: 'wow',
      _ownerUsers: ['user-3'],
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: null, // Never expires
    });

    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Haha Reaction',
      _kind: 'haha',
      _ownerUsers: ['user-4'],
      _validFromDateTime: futureDate.toISOString(), // Not started yet
      _validUntilDateTime: null,
    });

    // Get entities with included reactions filtered by set[actives]
    const response = await client
      .get('/entities')
      .query(
        'filter[include][0][relation]=_reactions&filter[include][0][set][and][0][actives]=true&filter[include][0][set][and][1][publics]=true',
      )
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(3);

    // Verify each entity has its reactions included and filtered
    const entity1 = response.body.find((e: any) => e._id === entity1Id);
    expect(entity1).to.not.be.undefined();
    expect(entity1._reactions).to.be.Array().and.have.length(1);
    expect(entity1._reactions[0]._name).to.equal('Like Reaction');
    expect(entity1._reactions[0]._validFromDateTime).to.equal(
      pastDate.toISOString(),
    );
    expect(entity1._reactions[0]._validUntilDateTime).to.be.null();

    const entity2 = response.body.find((e: any) => e._id === entity2Id);
    expect(entity2).to.not.be.undefined();
    expect(entity2._reactions).to.be.Array().and.have.length(2);
    expect(entity2._reactions.map((r: any) => r._name)).to.containDeep([
      'Like Reaction',
      'Wow Reaction',
    ]);
    expect(
      entity2._reactions.map((r: any) => r._validFromDateTime),
    ).to.containDeep([pastDate.toISOString(), pastDate.toISOString()]);
    expect(
      entity2._reactions.map((r: any) => r._validUntilDateTime),
    ).to.containDeep([futureDate.toISOString(), null]);

    const entity3 = response.body.find((e: any) => e._id === entity3Id);
    expect(entity3).to.not.be.undefined();
    expect(entity3._reactions).to.be.Array().and.have.length(2);
    expect(entity3._reactions.map((r: any) => r._name)).to.containDeep([
      'Love Reaction',
      'Wow Reaction',
    ]);
    expect(
      entity3._reactions.map((r: any) => r._validFromDateTime),
    ).to.containDeep([pastDate.toISOString(), pastDate.toISOString()]);
    expect(
      entity3._reactions.map((r: any) => r._validUntilDateTime),
    ).to.containDeep([futureDate.toISOString(), null]);
  });

  it('include: includes reactions in entity response without filtering', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      entity_reaction_kinds: 'like,love,wow,haha',
    });
    ({ client } = appWithClient);

    // Create 3 test entities
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

    const entity3Id = await createTestEntity(client, {
      _name: 'Book 3',
      _kind: 'book',
      description: 'Third book',
    });

    // Create reactions for each entity
    // Entity 1 reactions
    await client.post('/entity-reactions').send({
      _entityId: entity1Id,
      _name: 'Like',
      _kind: 'like',
      _ownerUsers: ['user-1'],
    });

    await client.post('/entity-reactions').send({
      _entityId: entity1Id,
      _name: 'Love',
      _kind: 'love',
      _ownerUsers: ['user-2'],
    });

    // Entity 2 reactions
    await client.post('/entity-reactions').send({
      _entityId: entity2Id,
      _name: 'Like',
      _kind: 'like',
      _ownerUsers: ['user-1'],
    });

    await client.post('/entity-reactions').send({
      _entityId: entity2Id,
      _name: 'Love',
      _kind: 'love',
      _ownerUsers: ['user-2'],
    });

    await client.post('/entity-reactions').send({
      _entityId: entity2Id,
      _name: 'Wow',
      _kind: 'wow',
      _ownerUsers: ['user-3'],
    });

    // Entity 3 reactions
    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Like',
      _kind: 'like',
      _ownerUsers: ['user-1'],
    });

    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Love',
      _kind: 'love',
      _ownerUsers: ['user-2'],
    });

    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Wow',
      _kind: 'wow',
      _ownerUsers: ['user-3'],
    });

    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Haha',
      _kind: 'haha',
      _ownerUsers: ['user-4'],
    });

    // Get entities with included reactions without any filtering
    const response = await client
      .get('/entities')
      .query('filter[include][0][relation]=_reactions')
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(3);

    // Verify each entity has its reactions included
    const entity1 = response.body.find((e: any) => e._id === entity1Id);
    expect(entity1).to.not.be.undefined();
    expect(entity1._reactions).to.be.Array().and.have.length(2);
    expect(entity1._reactions.map((r: any) => r._name)).to.containDeep([
      'Like',
      'Love',
    ]);

    const entity2 = response.body.find((e: any) => e._id === entity2Id);
    expect(entity2).to.not.be.undefined();
    expect(entity2._reactions).to.be.Array().and.have.length(3);
    expect(entity2._reactions.map((r: any) => r._name)).to.containDeep([
      'Like',
      'Love',
      'Wow',
    ]);

    const entity3 = response.body.find((e: any) => e._id === entity3Id);
    expect(entity3).to.not.be.undefined();
    expect(entity3._reactions).to.be.Array().and.have.length(4);
    expect(entity3._reactions.map((r: any) => r._name)).to.containDeep([
      'Like',
      'Love',
      'Wow',
      'Haha',
    ]);
  });

  it('include: includes reactions in entity response with set filters for active and public reactions', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      entity_reaction_kinds: 'like,love,wow,haha',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);

    // Create 3 test entities
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

    const entity3Id = await createTestEntity(client, {
      _name: 'Book 3',
      _kind: 'book',
      description: 'Third book',
    });

    // Create reactions for each entity with different visibility and active status
    // Entity 1 reactions
    await client.post('/entity-reactions').send({
      _entityId: entity1Id,
      _name: 'Public Active Like',
      _kind: 'like',
      _ownerUsers: ['user-1'],
      _ownerGroups: ['group-1'],
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: null, // Never expires
    });

    await client.post('/entity-reactions').send({
      _entityId: entity1Id,
      _name: 'Private Active Love',
      _kind: 'love',
      _ownerUsers: ['user-1'],
      _ownerGroups: ['group-1'],
      _visibility: 'private',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: null, // Never expires
    });

    await client.post('/entity-reactions').send({
      _entityId: entity1Id,
      _name: 'Public Expired Wow',
      _kind: 'wow',
      _ownerUsers: ['user-1'],
      _ownerGroups: ['group-1'],
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(), // Expired
    });

    await client.post('/entity-reactions').send({
      _entityId: entity1Id,
      _name: 'User Only Active Like',
      _kind: 'like',
      _ownerUsers: ['user-1'],
      _ownerGroups: [],
      _visibility: 'private',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: null, // Never expires
    });

    await client.post('/entity-reactions').send({
      _entityId: entity1Id,
      _name: 'Group Only Active Love',
      _kind: 'love',
      _ownerUsers: [],
      _ownerGroups: ['group-1'],
      _visibility: 'protected',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: null, // Never expires
    });

    // Entity 2 reactions
    await client.post('/entity-reactions').send({
      _entityId: entity2Id,
      _name: 'Public Active Like',
      _kind: 'like',
      _ownerUsers: ['user-2'],
      _ownerGroups: ['group-2'],
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: null, // Never expires
    });

    await client.post('/entity-reactions').send({
      _entityId: entity2Id,
      _name: 'Protected Pending Love',
      _kind: 'love',
      _ownerUsers: ['user-2'],
      _ownerGroups: ['group-2'],
      _visibility: 'protected',
      _validFromDateTime: futureDate.toISOString(), // Not started yet
      _validUntilDateTime: null,
    });

    await client.post('/entity-reactions').send({
      _entityId: entity2Id,
      _name: 'Public Active Wow',
      _kind: 'wow',
      _ownerUsers: ['user-3'],
      _ownerGroups: ['group-3'],
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: null, // Never expires
    });

    await client.post('/entity-reactions').send({
      _entityId: entity2Id,
      _name: 'Public Expired Like',
      _kind: 'like',
      _ownerUsers: ['user-2'],
      _ownerGroups: ['group-2'],
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(), // Expired
    });

    await client.post('/entity-reactions').send({
      _entityId: entity2Id,
      _name: 'User Only Pending Wow',
      _kind: 'wow',
      _ownerUsers: ['user-2'],
      _ownerGroups: [],
      _visibility: 'private',
      _validFromDateTime: futureDate.toISOString(), // Not started yet
      _validUntilDateTime: null,
    });

    await client.post('/entity-reactions').send({
      _entityId: entity2Id,
      _name: 'Group Only Pending Like',
      _kind: 'like',
      _ownerUsers: [],
      _ownerGroups: ['group-2'],
      _visibility: 'protected',
      _validFromDateTime: futureDate.toISOString(), // Not started yet
      _validUntilDateTime: null,
    });

    // Entity 3 reactions
    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Private Active Like',
      _kind: 'like',
      _ownerUsers: ['user-3'],
      _ownerGroups: ['group-3'],
      _visibility: 'private',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: null, // Never expires
    });

    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Protected Active Love',
      _kind: 'love',
      _ownerUsers: ['user-3'],
      _ownerGroups: ['group-3'],
      _visibility: 'protected',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: null, // Never expires
    });

    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Public Active Wow',
      _kind: 'wow',
      _ownerUsers: ['user-3'],
      _ownerGroups: ['group-3'],
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: null, // Never expires
    });

    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Public Expired Like',
      _kind: 'like',
      _ownerUsers: ['user-3'],
      _ownerGroups: ['group-3'],
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(), // Expired
    });

    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'User Only Active Love',
      _kind: 'love',
      _ownerUsers: ['user-3'],
      _ownerGroups: [],
      _visibility: 'private',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: null, // Never expires
    });

    await client.post('/entity-reactions').send({
      _entityId: entity3Id,
      _name: 'Group Only Active Wow',
      _kind: 'wow',
      _ownerUsers: [],
      _ownerGroups: ['group-3'],
      _visibility: 'protected',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: null, // Never expires
    });

    // Get entities with included reactions filtered by set[audience]
    const response = await client
      .get('/entities')
      .query(
        'filter[include][0][relation]=_reactions&filter[include][0][set][audience][userIds]=user-1,user-2&filter[include][0][set][audience][groupIds]=group-1,group-2',
      )
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(3);

    // Verify each entity has its reactions included and filtered
    const entity1 = response.body.find((e: any) => e._id === entity1Id);
    expect(entity1).to.not.be.undefined();
    expect(entity1._reactions).to.be.Array().and.have.length(4);
    expect(entity1._reactions.map((r: any) => r._name)).to.containDeep([
      'Public Active Like',
      'Private Active Love',
      'User Only Active Like',
      'Group Only Active Love',
    ]);

    const entity2 = response.body.find((e: any) => e._id === entity2Id);
    expect(entity2).to.not.be.undefined();
    expect(entity2._reactions).to.be.Array().and.have.length(5);
    expect(entity2._reactions.map((r: any) => r._name)).to.containDeep([
      'Public Active Like',
      'Protected Pending Love',
      'Public Active Wow',
      'User Only Pending Wow',
      'Group Only Pending Like',
    ]);

    const entity3 = response.body.find((e: any) => e._id === entity3Id);
    expect(entity3).to.not.be.undefined();
    expect(entity3._reactions).to.be.Array().and.have.length(1);
    expect(entity3._reactions.map((r: any) => r._name)).to.containDeep([
      'Public Active Wow',
    ]);
  });
});
