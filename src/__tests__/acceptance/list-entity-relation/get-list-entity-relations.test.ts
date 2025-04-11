import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { ListToEntityRelation } from '../../../models';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestEntity,
  createTestList,
  cleanupCreatedEntities,
} from '../test-helper';

describe('GET /list-entity-relations', () => {
  let client: Client;
  let appWithClient: AppWithClient | undefined;

  // Store created relation IDs for cleanup
  let createdRelationIds: string[] = [];

  beforeEach(async () => {
    if (appWithClient) {
      await teardownApplication(appWithClient);
    }

    appWithClient = undefined;

    // Clear all environment variables
    Object.keys(process.env).forEach((key) => {
      delete process.env[key];
    });

    // Reset created relation IDs
    createdRelationIds = [];
  });

  afterEach(async () => {
    if (appWithClient) {
      // Clean up created relations
      for (const id of createdRelationIds) {
        try {
          await client.delete(`/list-entity-relations/${id}`);
        } catch (error) {
          console.error(`Failed to delete relation ${id}:`, error);
        }
      }

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

  async function createTestRelation(
    relationData: Partial<ListToEntityRelation>,
  ): Promise<string> {
    const response = await client
      .post('/list-entity-relations')
      .send(relationData)
      .expect(200);
    const relationId = response.body._id;
    createdRelationIds.push(relationId);

    return relationId;
  }

  it('basic: returns relation with metadata when no filter is applied', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create a test entity
    const entityId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
      description: 'A test book',
      _visibility: 'public',
      _ownerUsers: ['user-123'],
      _viewerUsers: ['viewer-456'],
    });

    // Create a test list
    const listId = await createTestList(client, {
      _name: 'Test Reading List',
      _kind: 'reading-list',
      description: 'A test reading list',
      _visibility: 'private',
      _ownerUsers: ['user-789'],
      _viewerUsers: ['viewer-012'],
    });

    // Create a test relation
    await createTestRelation({
      _listId: listId,
      _entityId: entityId,
      _kind: 'reading-list-book',
    });

    // Get all relations
    const response = await client.get('/list-entity-relations').expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    const relation = response.body[0];

    // Verify basic relation fields
    expect(relation).to.have.property('_id');
    expect(relation).to.have.property('_kind', 'reading-list-book');
    expect(relation).to.have.property('_listId', listId);
    expect(relation).to.have.property('_entityId', entityId);

    // Verify _fromMetadata (list metadata)
    expect(relation).to.have.property('_fromMetadata');
    expect(relation._fromMetadata).to.have.properties({
      _kind: 'reading-list',
      _name: 'Test Reading List',
      _visibility: 'private',
    });
    expect(relation._fromMetadata._ownerUsers).to.containDeep(['user-789']);
    expect(relation._fromMetadata._viewerUsers).to.containDeep(['viewer-012']);

    // Verify _toMetadata (entity metadata)
    expect(relation).to.have.property('_toMetadata');
    expect(relation._toMetadata).to.have.properties({
      _kind: 'book',
      _name: 'Test Book',
      _visibility: 'public',
    });
    expect(relation._toMetadata._ownerUsers).to.containDeep(['user-123']);
    expect(relation._toMetadata._viewerUsers).to.containDeep(['viewer-456']);
  });

  it('filter: by kind', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list,watch-list',
    });
    ({ client } = appWithClient);

    // Create test entities
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    // Create test lists
    const readingListId = await createTestList(client, {
      _name: 'Reading List',
      _kind: 'reading-list',
    });

    const watchListId = await createTestList(client, {
      _name: 'Watch List',
      _kind: 'watch-list',
    });

    // Create test relations with different kinds
    await createTestRelation({
      _listId: readingListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    await createTestRelation({
      _listId: watchListId,
      _entityId: bookId,
      _kind: 'watch-list-book',
    });

    // Get only reading-list-book relations
    const response = await client
      .get('/list-entity-relations')
      .query({ filter: { where: { _kind: 'reading-list-book' } } })
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._kind).to.equal('reading-list-book');
    expect(response.body[0]._fromMetadata._kind).to.equal('reading-list');
  });

  it('filter: active relations with complex filter', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);

    // Create test entity and list
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    const listId = await createTestList(client, {
      _name: 'Reading List',
      _kind: 'reading-list',
    });

    // Create active relation
    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create inactive relation (expired)
    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });

    // Get only active relations using complex filter
    const filterStr =
      `filter[where][and][0][or][0][_validUntilDateTime][eq]=null&` +
      `filter[where][and][0][or][1][_validUntilDateTime][gt]=${encodeURIComponent(now.toISOString())}&` +
      `filter[where][and][1][_validFromDateTime][neq]=null&` +
      `filter[where][and][2][_validFromDateTime][lt]=${encodeURIComponent(now.toISOString())}`;

    const response = await client
      .get('/list-entity-relations')
      .query(filterStr)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    const relation = response.body[0];
    expect(relation._validUntilDateTime).to.equal(futureDate.toISOString());
  });

  it('filter: by visibility', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create test entity and list
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    const listId = await createTestList(client, {
      _name: 'Reading List',
      _kind: 'reading-list',
    });

    // Create relations with different visibility
    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      _visibility: 'public',
    });

    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      _visibility: 'private',
    });

    // Get only public relations
    const response = await client
      .get('/list-entity-relations')
      .query({ filter: { where: { _visibility: 'public' } } })
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._visibility).to.equal('public');
  });

  it('filter: by validFromDateTime', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);

    // Create test entity and list
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    const listId = await createTestList(client, {
      _name: 'Reading List',
      _kind: 'reading-list',
    });

    // Create relation with past validFromDateTime
    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      _validFromDateTime: pastDate.toISOString(),
    });

    // Create relation with future validFromDateTime
    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      _validFromDateTime: futureDate.toISOString(),
    });

    // Get relations with validFromDateTime in the past
    const filterStr = `filter[where][_validFromDateTime][lt]=${encodeURIComponent(now.toISOString())}`;
    const response = await client
      .get('/list-entity-relations')
      .query(filterStr)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._validFromDateTime).to.equal(
      pastDate.toISOString(),
    );
  });

  it('filter: by arbitrary date field (publishedDate)', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    // Create test entity and list
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    const listId = await createTestList(client, {
      _name: 'Reading List',
      _kind: 'reading-list',
    });

    // Create relations with different published dates
    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      publishedDate: lastMonth.toISOString(),
    });

    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      publishedDate: nextMonth.toISOString(),
    });

    // Create relation with no published date
    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    // Get relations published before now
    const filterStr = `filter[where][and][0][publishedDate][lt]=${encodeURIComponent(now.toISOString())}&filter[where][and][1][publishedDate][neq]=null`;
    const response = await client
      .get('/list-entity-relations')
      .query(filterStr)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0].publishedDate).to.equal(lastMonth.toISOString());
  });

  it('filter: by arbitrary number fields (priority and weight)', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create test entity and list
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    const listId = await createTestList(client, {
      _name: 'Reading List',
      _kind: 'reading-list',
    });

    // Create relations with different number fields
    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      priority: 1,
      weight: 10.5,
    });

    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      priority: 2,
      weight: 20.5,
    });

    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      priority: 3,
      weight: 30.5,
    });

    // Get relations with priority > 1 and weight < 25
    const filterStr =
      `filter[where][priority][gt]=1&` +
      `filter[where][priority][type]=number&` +
      `filter[where][weight][lt]=25&` +
      `filter[where][weight][type]=number`;

    const response = await client
      .get('/list-entity-relations')
      .query(filterStr)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0].priority).to.equal(2);
    expect(response.body[0].weight).to.equal(20.5);

    // Test with between range for priority
    const rangeFilterStr =
      `filter[where][priority][between][0]=2&` +
      `filter[where][priority][between][1]=3&` +
      `filter[where][priority][type]=number&` +
      `filter[where][weight][eq]=20.5&` +
      `filter[where][weight][type]=number`;

    const rangeResponse = await client
      .get('/list-entity-relations')
      .query(rangeFilterStr)
      .expect(200);

    expect(rangeResponse.body).to.be.Array().and.have.length(1);
    expect(rangeResponse.body[0].priority).to.equal(2);
    expect(rangeResponse.body[0].weight).to.equal(20.5);
  });

  it('filter: by nested fields using dot notation', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create test entity and list
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    const listId = await createTestList(client, {
      _name: 'Reading List',
      _kind: 'reading-list',
    });

    // Create relations with nested fields
    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      metadata: {
        status: {
          current: 'reading',
          progress: 50,
          lastUpdated: new Date().toISOString(),
        },
      },
    });

    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      metadata: {
        status: {
          current: 'completed',
          progress: 100,
          lastUpdated: new Date().toISOString(),
        },
      },
    });

    // Get relations with specific nested status
    const filterStr = `filter[where][metadata.status.current]=reading`;
    const response = await client
      .get('/list-entity-relations')
      .query(filterStr)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0].metadata.status.current).to.equal('reading');
    expect(response.body[0].metadata.status.progress).to.equal(50);

    // Get relations with progress using nested numeric filter
    const progressFilterStr =
      `filter[where][metadata.status.progress][gt]=75&` +
      `filter[where][metadata.status.progress][type]=number`;

    const progressResponse = await client
      .get('/list-entity-relations')
      .query(progressFilterStr)
      .expect(200);

    expect(progressResponse.body).to.be.Array().and.have.length(1);
    expect(progressResponse.body[0].metadata.status.current).to.equal(
      'completed',
    );
    expect(progressResponse.body[0].metadata.status.progress).to.equal(100);
  });

  it('pagination: applies response limit configuration', async () => {
    // Set up the application with response limit configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
      response_limit_list_entity_rel: '2', // Limit response to 2 items
    });
    ({ client } = appWithClient);

    // Create test entity and list
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    const listId = await createTestList(client, {
      _name: 'Reading List',
      _kind: 'reading-list',
    });

    // Create 3 relations
    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      order: 1,
    });

    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      order: 2,
    });

    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      order: 3,
    });

    // Get relations with limit
    const response = await client.get('/list-entity-relations').expect(200);

    expect(response.body).to.be.Array().and.have.length(2);
  });

  it('pagination: supports pagination', async () => {
    // Set up the application
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create test entity and list
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    const listId = await createTestList(client, {
      _name: 'Reading List',
      _kind: 'reading-list',
      _visibility: 'public',
    });

    // Create test relations
    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      order: 1,
    });

    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      order: 2,
    });

    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      order: 3,
    });

    // Get first page of reading list relations
    const firstPage = await client
      .get('/list-entity-relations')
      .query(
        'filter[limit]=2&' +
          'filter[skip]=0&' +
          'filter[order][0]=order ASC&' +
          'listFilter[where][_kind]=reading-list&' +
          'listFilter[where][_visibility]=public',
      )
      .expect(200);

    // Verify first page results
    expect(firstPage.body).to.be.Array().and.have.length(2);
    expect(firstPage.body[0].order).to.equal(1);
    expect(firstPage.body[1].order).to.equal(2);
    expect(firstPage.body[0]._fromMetadata._kind).to.equal('reading-list');
    expect(firstPage.body[1]._fromMetadata._kind).to.equal('reading-list');

    // Get second page of reading list relations
    const secondPage = await client
      .get('/list-entity-relations')
      .query(
        'filter[limit]=2&' +
          'filter[skip]=2&' +
          'filter[order][0]=order ASC&' +
          'listFilter[where][_kind]=reading-list&' +
          'listFilter[where][_visibility]=public',
      )
      .expect(200);

    // Verify second page results
    expect(secondPage.body).to.be.Array().and.have.length(1);
    expect(secondPage.body[0].order).to.equal(3);
    expect(secondPage.body[0]._fromMetadata._kind).to.equal('reading-list');

    // Test with different list filter to verify filtering is working
    const watchListPage = await client
      .get('/list-entity-relations')
      .query(
        'filter[limit]=2&' +
          'filter[skip]=0&' +
          'filter[order][0]=order ASC&' +
          'listFilter[where][_kind]=watch-list&' +
          'listFilter[where][_visibility]=public',
      )
      .expect(200);

    // Verify watch list results
    expect(watchListPage.body).to.be.Array().and.have.length(0);

    // Test combining list filter with relation filter
    const combinedFilterPage = await client
      .get('/list-entity-relations')
      .query(
        'filter[where][order][lt]=3&' +
          'filter[where][order][type]=number&' +
          'filter[limit]=2&' +
          'filter[skip]=0&' +
          'filter[order][0]=order ASC&' +
          'listFilter[where][_kind]=reading-list&' +
          'listFilter[where][_visibility]=public',
      )
      .expect(200);

    // Verify combined filter results
    expect(combinedFilterPage.body).to.be.Array().and.have.length(2);
    expect(combinedFilterPage.body[0].order).to.equal(1);
    expect(combinedFilterPage.body[1].order).to.equal(2);
    expect(combinedFilterPage.body[0]._fromMetadata._kind).to.equal(
      'reading-list',
    );
    expect(combinedFilterPage.body[1]._fromMetadata._kind).to.equal(
      'reading-list',
    );
  });

  it('pagination: supports sorting', async () => {
    // Set up the application
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create test entity and list
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    const listId = await createTestList(client, {
      _name: 'Reading List',
      _kind: 'reading-list',
    });

    // Create test relations with different orders
    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      order: 3,
    });

    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      order: 1,
    });

    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      order: 2,
    });

    // Get relations sorted by order ascending
    const ascResponse = await client
      .get('/list-entity-relations')
      .query({ filter: { order: ['order ASC'] } })
      .expect(200);

    expect(ascResponse.body).to.be.Array().and.have.length(3);
    expect(ascResponse.body.map((r: ListToEntityRelation) => r.order)).to.eql([
      1, 2, 3,
    ]);

    // Get relations sorted by order descending
    const descResponse = await client
      .get('/list-entity-relations')
      .query({ filter: { order: ['order DESC'] } })
      .expect(200);

    expect(descResponse.body).to.be.Array().and.have.length(3);
    expect(descResponse.body.map((r: ListToEntityRelation) => r.order)).to.eql([
      3, 2, 1,
    ]);

    // Test sorting by multiple fields
    const multiSortResponse = await client
      .get('/list-entity-relations')
      .query({
        filter: {
          order: ['_kind ASC', 'order DESC'],
        },
      })
      .expect(200);

    expect(multiSortResponse.body).to.be.Array().and.have.length(3);
    expect(
      multiSortResponse.body.map((r: ListToEntityRelation) => r.order),
    ).to.eql([3, 2, 1]);
  });

  it('set-filter: supports set filters via query parameters', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);

    console.log('Test dates:', {
      now: now.toISOString(),
      nowTimestamp: now.getTime(),
      pastDate: pastDate.toISOString(),
      pastTimestamp: pastDate.getTime(),
      futureDate: futureDate.toISOString(),
      futureTimestamp: futureDate.getTime(),
    });

    // Create test entity and list
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    const listId = await createTestList(client, {
      _name: 'Reading List',
      _kind: 'reading-list',
    });

    // Create active relation
    const activeRelation = await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create inactive relation
    const inactiveRelation = await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });

    console.log('Created relations:', {
      activeRelation,
      inactiveRelation,
    });

    // Get only active relations using set filter
    const response = await client
      .get('/list-entity-relations')
      .query({ set: { actives: true } })
      .expect(200);

    console.log('Response:', response.body);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._validUntilDateTime).to.equal(
      futureDate.toISOString(),
    );
  });

  it('set-filter: filters active relations', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);

    // Create test entity and list
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    const listId = await createTestList(client, {
      _name: 'Reading List',
      _kind: 'reading-list',
    });

    // Create active relation
    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create inactive relation (expired)
    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });

    // Create inactive relation (not started)
    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      _validFromDateTime: futureDate.toISOString(),
      _validUntilDateTime: null,
    });

    // Get active relations using set[actives]
    const response = await client
      .get('/list-entity-relations')
      .query({ set: { actives: true } })
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._validUntilDateTime).to.equal(
      futureDate.toISOString(),
    );
  });

  it('set-filter: filters public relations', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create test entity and list
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    const listId = await createTestList(client, {
      _name: 'Reading List',
      _kind: 'reading-list',
    });

    // Create public relation
    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      _visibility: 'public',
    });

    // Create private relation
    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      _visibility: 'private',
    });

    // Get public relations using set[publics]
    const response = await client
      .get('/list-entity-relations')
      .query({ set: { publics: true } })
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._visibility).to.equal('public');
  });

  it('set-filter: combines multiple sets with AND operator', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);

    // Create test entity and list
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    const listId = await createTestList(client, {
      _name: 'Reading List',
      _kind: 'reading-list',
    });

    // Create active and public relation
    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create active but private relation
    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      _visibility: 'private',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create inactive but public relation
    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });

    // Get relations that are both active AND public using set[and]
    const filterStr = 'set[and][0][actives]=true&set[and][1][publics]=true';
    const response = await client
      .get('/list-entity-relations')
      .query(filterStr)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._visibility).to.equal('public');
    expect(response.body[0]._validUntilDateTime).to.equal(
      futureDate.toISOString(),
    );
  });

  it('set-filter: combines set filters with regular filters', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);

    // Create test entity and list
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    const listId = await createTestList(client, {
      _name: 'Reading List',
      _kind: 'reading-list',
    });

    // Create active relation with priority 1
    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      priority: 1,
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create active relation with priority 2
    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      priority: 2,
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create inactive relation with priority 1
    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      priority: 1,
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });

    // Get active relations with priority 1 using both set and regular filter
    const filterStr =
      'set[actives]=true&filter[where][priority][eq]=1&filter[where][priority][type]=number';
    const response = await client
      .get('/list-entity-relations')
      .query(filterStr)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0].priority).to.equal(1);
    expect(response.body[0]._validUntilDateTime).to.equal(
      futureDate.toISOString(),
    );
  });

  it('filter: by list properties', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list,watch-list',
    });
    ({ client } = appWithClient);

    // Create test entities
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    // Create test lists with different properties
    const readingListId = await createTestList(client, {
      _name: 'Reading List',
      _kind: 'reading-list',
      _visibility: 'public',
    });

    const watchListId = await createTestList(client, {
      _name: 'Watch List',
      _kind: 'watch-list',
      _visibility: 'private',
    });

    // Create relations for both lists
    await createTestRelation({
      _listId: readingListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    await createTestRelation({
      _listId: watchListId,
      _entityId: bookId,
      _kind: 'watch-list-book',
    });

    // Test filtering by list visibility
    const response = await client
      .get('/list-entity-relations')
      .query({
        filter: {
          where: {
            _kind: { inq: ['reading-list-book', 'watch-list-book'] },
          },
        },
        listFilter: {
          where: {
            _visibility: 'public',
          },
        },
      })
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._fromMetadata._visibility).to.equal('public');
    expect(response.body[0]._fromMetadata._name).to.equal('Reading List');

    // Test filtering by list kind
    const kindResponse = await client
      .get('/list-entity-relations')
      .query({
        listFilter: {
          where: {
            _kind: 'watch-list',
          },
        },
      })
      .expect(200);

    expect(kindResponse.body).to.be.Array().and.have.length(1);
    expect(kindResponse.body[0]._fromMetadata._kind).to.equal('watch-list');
    expect(kindResponse.body[0]._fromMetadata._name).to.equal('Watch List');

    // Test combining relation and list filters
    const combinedResponse = await client
      .get('/list-entity-relations')
      .query({
        filter: {
          where: {
            _kind: 'reading-list-book',
          },
        },
        listFilter: {
          where: {
            _visibility: 'public',
            _kind: 'reading-list',
          },
        },
      })
      .expect(200);

    expect(combinedResponse.body).to.be.Array().and.have.length(1);
    expect(combinedResponse.body[0]._kind).to.equal('reading-list-book');
    expect(combinedResponse.body[0]._fromMetadata._visibility).to.equal(
      'public',
    );
    expect(combinedResponse.body[0]._fromMetadata._kind).to.equal(
      'reading-list',
    );
  });

  it('pagination: with list property filtering', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list,watch-list',
    });
    ({ client } = appWithClient);

    // Create test entities
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    // Create test lists with different properties
    const readingListId = await createTestList(client, {
      _name: 'Reading List',
      _kind: 'reading-list',
      _visibility: 'public',
    });

    const watchListId = await createTestList(client, {
      _name: 'Watch List',
      _kind: 'watch-list',
      _visibility: 'public',
    });

    // Create multiple relations with different orders
    await createTestRelation({
      _listId: readingListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      order: 1,
    });

    await createTestRelation({
      _listId: readingListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      order: 2,
    });

    await createTestRelation({
      _listId: readingListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      order: 3,
    });

    // Create relations for watch list (should be filtered out)
    await createTestRelation({
      _listId: watchListId,
      _entityId: bookId,
      _kind: 'watch-list-book',
      order: 1,
    });

    await createTestRelation({
      _listId: watchListId,
      _entityId: bookId,
      _kind: 'watch-list-book',
      order: 2,
    });

    // Get first page of reading list relations
    const firstPage = await client
      .get('/list-entity-relations')
      .query(
        'filter[limit]=2&' +
          'filter[skip]=0&' +
          'filter[order][0]=order ASC&' +
          'listFilter[where][_kind]=reading-list&' +
          'listFilter[where][_visibility]=public',
      )
      .expect(200);

    // Verify first page results
    expect(firstPage.body).to.be.Array().and.have.length(2);
    expect(firstPage.body[0].order).to.equal(1);
    expect(firstPage.body[1].order).to.equal(2);
    expect(firstPage.body[0]._fromMetadata._kind).to.equal('reading-list');
    expect(firstPage.body[1]._fromMetadata._kind).to.equal('reading-list');

    // Get second page of reading list relations
    const secondPage = await client
      .get('/list-entity-relations')
      .query(
        'filter[limit]=2&' +
          'filter[skip]=2&' +
          'filter[order][0]=order ASC&' +
          'listFilter[where][_kind]=reading-list&' +
          'listFilter[where][_visibility]=public',
      )
      .expect(200);

    // Verify second page results
    expect(secondPage.body).to.be.Array().and.have.length(1);
    expect(secondPage.body[0].order).to.equal(3);
    expect(secondPage.body[0]._fromMetadata._kind).to.equal('reading-list');

    // Test with different list filter to verify filtering is working
    const watchListPage = await client
      .get('/list-entity-relations')
      .query(
        'filter[limit]=2&' +
          'filter[skip]=0&' +
          'filter[order][0]=order ASC&' +
          'listFilter[where][_kind]=watch-list&' +
          'listFilter[where][_visibility]=public',
      )
      .expect(200);

    // Verify watch list results
    expect(watchListPage.body).to.be.Array().and.have.length(2);
    expect(watchListPage.body[0].order).to.equal(1);
    expect(watchListPage.body[1].order).to.equal(2);
    expect(watchListPage.body[0]._fromMetadata._kind).to.equal('watch-list');
    expect(watchListPage.body[1]._fromMetadata._kind).to.equal('watch-list');

    // Test combining list filter with relation filter
    const combinedFilterPage = await client
      .get('/list-entity-relations')
      .query(
        'filter[where][order][lt]=3&' +
          'filter[where][order][type]=number&' +
          'filter[limit]=2&' +
          'filter[skip]=0&' +
          'filter[order][0]=order ASC&' +
          'listFilter[where][_kind]=reading-list&' +
          'listFilter[where][_visibility]=public',
      )
      .expect(200);

    // Verify combined filter results
    expect(combinedFilterPage.body).to.be.Array().and.have.length(2);
    expect(combinedFilterPage.body[0].order).to.equal(1);
    expect(combinedFilterPage.body[1].order).to.equal(2);
    expect(combinedFilterPage.body[0]._fromMetadata._kind).to.equal(
      'reading-list',
    );
    expect(combinedFilterPage.body[1]._fromMetadata._kind).to.equal(
      'reading-list',
    );
  });

  it('field-selection: returns only selected fields', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create test entity and list
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    const listId = await createTestList(client, {
      _name: 'Reading List',
      _kind: 'reading-list',
    });

    // Create test relation with multiple fields
    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      _visibility: 'public',
      _ownerUsers: ['user-123'],
      _viewerUsers: ['viewer-456'],
      _validFromDateTime: new Date().toISOString(),
      order: 1,
      priority: 'high',
      notes: 'Important book to read',
    });

    // Request only specific fields
    const filterStr =
      'filter[fields][_kind]=true&' +
      'filter[fields][_visibility]=true&' +
      'filter[fields][order]=true&' +
      'filter[fields][notes]=true';

    const response = await client
      .get('/list-entity-relations')
      .query(filterStr)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    const relation = response.body[0];

    // Should have the requested fields
    expect(relation).to.have.property('_kind', 'reading-list-book');
    expect(relation).to.have.property('_visibility', 'public');
    expect(relation).to.have.property('order', 1);
    expect(relation).to.have.property('notes', 'Important book to read');

    // Should not have other fields
    expect(relation).to.not.have.property('_id');
    expect(relation).to.not.have.property('_listId');
    expect(relation).to.not.have.property('_entityId');
    expect(relation).to.not.have.property('_ownerUsers');
    expect(relation).to.not.have.property('_viewerUsers');
    expect(relation).to.not.have.property('_validFromDateTime');
    expect(relation).to.not.have.property('priority');
  });

  it('field-selection: excludes specified fields from response', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    const now = new Date();

    // Create test entity and list
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    const listId = await createTestList(client, {
      _name: 'Reading List',
      _kind: 'reading-list',
    });

    // Create test relation with multiple fields
    await createTestRelation({
      _listId: listId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      _visibility: 'public',
      _ownerUsers: ['user-123'],
      _viewerUsers: ['viewer-456'],
      _validFromDateTime: now.toISOString(),
      _validUntilDateTime: new Date(now.getTime() + 86400000).toISOString(), // tomorrow
      order: 1,
      priority: 'high',
      notes: 'Important book to read',
    });

    // Request to exclude specific fields
    const filterStr =
      'filter[fields][_ownerUsers]=false&' +
      'filter[fields][_viewerUsers]=false&' +
      'filter[fields][_validFromDateTime]=false&' +
      'filter[fields][_validUntilDateTime]=false';

    const response = await client
      .get('/list-entity-relations')
      .query(filterStr)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    const relation = response.body[0];

    // Should have non-excluded fields
    expect(relation).to.have.property('_id');
    expect(relation).to.have.property('_kind', 'reading-list-book');
    expect(relation).to.have.property('_listId', listId);
    expect(relation).to.have.property('_entityId', bookId);
    expect(relation).to.have.property('_visibility', 'public');
    expect(relation).to.have.property('order', 1);
    expect(relation).to.have.property('priority', 'high');
    expect(relation).to.have.property('notes', 'Important book to read');
    expect(relation).to.have.property('_createdDateTime');
    expect(relation).to.have.property('_lastUpdatedDateTime');

    // Should not have excluded fields
    expect(relation).to.not.have.property('_ownerUsers');
    expect(relation).to.not.have.property('_viewerUsers');
    expect(relation).to.not.have.property('_validFromDateTime');
    expect(relation).to.not.have.property('_validUntilDateTime');
  });

  it('filter: by list date access rules - combining AND and OR conditions', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
      autoapprove_list_entity_relations: 'true',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);

    // Create test entity
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    // Create lists with different date combinations
    const list1Id = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
      _validFromDateTime: pastDate.toISOString(), // Past date
      _visibility: 'public',
    });

    const list2Id = await createTestList(client, {
      _name: 'List 2',
      _kind: 'reading-list',
      _validFromDateTime: futureDate.toISOString(), // Future date
      _visibility: 'private',
    });

    const list3Id = await createTestList(client, {
      _name: 'List 3',
      _kind: 'reading-list',
      _validFromDateTime: pastDate.toISOString(), // Past date
      _validUntilDateTime: pastDate.toISOString(), // Past date
      _visibility: 'private',
    });

    const list4Id = await createTestList(client, {
      _name: 'List 4',
      _kind: 'reading-list',
      _validFromDateTime: pastDate.toISOString(), // Past date
      _validUntilDateTime: futureDate.toISOString(), // Future date
      _visibility: 'private',
    });

    // Create relations for all lists
    await createTestRelation({
      _listId: list1Id,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    await createTestRelation({
      _listId: list2Id,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    await createTestRelation({
      _listId: list3Id,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    await createTestRelation({
      _listId: list4Id,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    // Test filtering with AND and OR conditions
    // Find lists that are either:
    // 1. Currently active (past validFrom and future validUntil) OR
    // 2. Have public visibility
    const filterStr =
      'listFilter[where][or][0][and][0][_validFromDateTime][lt]=' +
      encodeURIComponent(now.toISOString()) +
      '&listFilter[where][or][0][and][1][_validUntilDateTime][gt]=' +
      encodeURIComponent(now.toISOString()) +
      '&listFilter[where][or][1][_visibility][eq]=public';

    const response = await client
      .get('/list-entity-relations')
      .query(filterStr)
      .expect(200);

    // Should return relations from List 1 (public) and List 4 (currently active)
    expect(response.body).to.be.Array().and.have.length(2);
    const listNames = response.body
      .map((r: any) => r._fromMetadata._name)
      .sort();
    expect(listNames).to.eql(['List 1', 'List 4']);
  });

  it('filter: by list date access rules - combining AND and OR conditions with different date fields', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
      autoapprove_list_entity_relations: 'true',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);

    // Create test entity
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    // Create lists with different date combinations
    const list1Id = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
      _validFromDateTime: pastDate.toISOString(), // Past date
      _createdDateTime: pastDate.toISOString(),
    });

    const list2Id = await createTestList(client, {
      _name: 'List 2',
      _kind: 'reading-list',
      _validFromDateTime: futureDate.toISOString(), // Future date
      _createdDateTime: futureDate.toISOString(),
    });

    const list3Id = await createTestList(client, {
      _name: 'List 3',
      _kind: 'reading-list',
      _validFromDateTime: pastDate.toISOString(), // Past date
      _validUntilDateTime: pastDate.toISOString(), // Past date
      _createdDateTime: futureDate.toISOString(),
    });

    const list4Id = await createTestList(client, {
      _name: 'List 4',
      _kind: 'reading-list',
      _validFromDateTime: pastDate.toISOString(), // Past date
      _validUntilDateTime: futureDate.toISOString(), // Past date
      _createdDateTime: futureDate.toISOString(),
    });

    // Create relations for all lists
    await createTestRelation({
      _listId: list1Id,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    await createTestRelation({
      _listId: list2Id,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    await createTestRelation({
      _listId: list3Id,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    await createTestRelation({
      _listId: list4Id,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    // Test filtering with AND and OR conditions
    // Find lists that are either:
    // 1. Currently active (past validFrom and future validUntil) OR
    // 2. Created in the past
    const filterStr =
      'listFilter[where][or][0][and][0][_validFromDateTime][lt]=' +
      encodeURIComponent(now.toISOString()) +
      '&listFilter[where][or][0][and][0][_validFromDateTime][type]=date&' +
      '&listFilter[where][or][0][and][1][_validUntilDateTime][gt]=' +
      encodeURIComponent(now.toISOString()) +
      '&listFilter[where][or][0][and][1][_validUntilDateTime][type]=date&' +
      '&listFilter[where][or][1][_createdDateTime][lt]=' +
      encodeURIComponent(now.toISOString()) +
      '&listFilter[where][or][1][_createdDateTime][type]=date';

    const response = await client
      .get('/list-entity-relations')
      .query(filterStr)
      .expect(200);

    console.log(response.body);

    // Retrieve and log all lists from /lists endpoint
    console.log('\n=== All Lists from /lists endpoint ===');
    const allListsResponse = await client
      .get('/lists')
      .query({
        filter: {
          order: '_name ASC',
        },
      })
      .expect(200);
    console.log('\nLists in database:');
    allListsResponse.body.forEach((list: any, index: number) => {
      console.log(`\nList ${index + 1}:`);
      console.log('Name:', list._name);
      console.log('validFrom:', list._validFromDateTime);
      console.log('validUntil:', list._validUntilDateTime);
      console.log('createdDateTime:', list._createdDateTime);
    });
    console.log('now:', now.toISOString());

    // Should return relations from List 1 (public) and List 3 (validFrom in past, validUntil in future)
    expect(response.body).to.be.Array().and.have.length(2);
    const listNames = response.body
      .map((r: any) => r._fromMetadata._name)
      .sort();
    expect(listNames).to.eql(['List 1', 'List 4']);
  });

  it('filter: by list active status (validFromDateTime and validUntilDateTime)', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
      autoapprove_list_entity_relations: 'true',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);

    // Create test entity
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    // Create lists with different date combinations
    const activeListId = await createTestList(client, {
      _name: 'Active List',
      _kind: 'reading-list',
      _validFromDateTime: pastDate.toISOString(), // Past date
      _validUntilDateTime: futureDate.toISOString(), // Future date
    });

    const activeListNullEndId = await createTestList(client, {
      _name: 'Active List Null End',
      _kind: 'reading-list',
      _validFromDateTime: pastDate.toISOString(), // Past date
      _validUntilDateTime: null, // No end date
    });

    const futureListId = await createTestList(client, {
      _name: 'Future List',
      _kind: 'reading-list',
      _validFromDateTime: futureDate.toISOString(), // Future date
      _validUntilDateTime: null,
    });

    const expiredListId = await createTestList(client, {
      _name: 'Expired List',
      _kind: 'reading-list',
      _validFromDateTime: pastDate.toISOString(), // Past date
      _validUntilDateTime: pastDate.toISOString(), // Past date (expired)
    });

    // Create relations for all lists
    await createTestRelation({
      _listId: activeListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    await createTestRelation({
      _listId: activeListNullEndId,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    await createTestRelation({
      _listId: futureListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    await createTestRelation({
      _listId: expiredListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    // Filter for active lists:
    // - validFromDateTime must be in the past
    // - AND validUntilDateTime must be either null OR in the future
    const filterStr =
      'listFilter[where][and][0][_validFromDateTime][lt]=' +
      encodeURIComponent(now.toISOString()) +
      '&listFilter[where][and][0][_validFromDateTime][type]=date&' +
      'listFilter[where][and][1][or][0][_validUntilDateTime][eq]=null&' +
      'listFilter[where][and][1][or][1][_validUntilDateTime][gt]=' +
      encodeURIComponent(now.toISOString()) +
      '&listFilter[where][and][1][or][1][_validUntilDateTime][type]=date';

    const response = await client
      .get('/list-entity-relations')
      .query(filterStr)
      .expect(200);

    // Should return relations from active lists only
    expect(response.body).to.be.Array().and.have.length(2);
    const listNames = response.body
      .map((r: any) => r._fromMetadata._name)
      .sort();
    expect(listNames).to.eql(['Active List', 'Active List Null End']);
  });

  it('filter: by list active status using listSet[actives]', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
      autoapprove_list_entity_relations: 'true',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);

    // Create test entity
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    // Create lists with different date combinations
    const activeListId = await createTestList(client, {
      _name: 'Active List',
      _kind: 'reading-list',
      _validFromDateTime: pastDate.toISOString(), // Past date
      _validUntilDateTime: futureDate.toISOString(), // Future date
    });

    const activeListNullEndId = await createTestList(client, {
      _name: 'Active List Null End',
      _kind: 'reading-list',
      _validFromDateTime: pastDate.toISOString(), // Past date
      _validUntilDateTime: null, // No end date
    });

    const futureListId = await createTestList(client, {
      _name: 'Future List',
      _kind: 'reading-list',
      _validFromDateTime: futureDate.toISOString(), // Future date
      _validUntilDateTime: null,
    });

    const expiredListId = await createTestList(client, {
      _name: 'Expired List',
      _kind: 'reading-list',
      _validFromDateTime: pastDate.toISOString(), // Past date
      _validUntilDateTime: pastDate.toISOString(), // Past date (expired)
    });

    // Create relations for all lists
    await createTestRelation({
      _listId: activeListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    await createTestRelation({
      _listId: activeListNullEndId,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    await createTestRelation({
      _listId: futureListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    await createTestRelation({
      _listId: expiredListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    // Filter for active lists using listSet[actives]
    const response = await client
      .get('/list-entity-relations')
      .query({ listSet: { actives: true } })
      .expect(200);

    // Should return relations from active lists only
    expect(response.body).to.be.Array().and.have.length(2);
    const listNames = response.body
      .map((r: any) => r._fromMetadata._name)
      .sort();
    expect(listNames).to.eql(['Active List', 'Active List Null End']);
  });

  it('filter: by list active and public status using listSet[and]', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
      autoapprove_list_entity_relations: 'true',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);

    // Create test entity
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    // Create lists with different combinations of active status and visibility
    const activePublicListId = await createTestList(client, {
      _name: 'Active Public List',
      _kind: 'reading-list',
      _validFromDateTime: pastDate.toISOString(), // Past date
      _validUntilDateTime: futureDate.toISOString(), // Future date
      _visibility: 'public',
    });

    const activePrivateListId = await createTestList(client, {
      _name: 'Active Private List',
      _kind: 'reading-list',
      _validFromDateTime: pastDate.toISOString(), // Past date
      _validUntilDateTime: futureDate.toISOString(), // Future date
      _visibility: 'private',
    });

    const inactivePublicListId = await createTestList(client, {
      _name: 'Inactive Public List',
      _kind: 'reading-list',
      _validFromDateTime: pastDate.toISOString(), // Past date
      _validUntilDateTime: pastDate.toISOString(), // Past date (expired)
      _visibility: 'public',
    });

    const inactivePrivateListId = await createTestList(client, {
      _name: 'Inactive Private List',
      _kind: 'reading-list',
      _validFromDateTime: pastDate.toISOString(), // Past date
      _validUntilDateTime: pastDate.toISOString(), // Past date (expired)
      _visibility: 'private',
    });

    // Create relations for all lists
    await createTestRelation({
      _listId: activePublicListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    await createTestRelation({
      _listId: activePrivateListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    await createTestRelation({
      _listId: inactivePublicListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    await createTestRelation({
      _listId: inactivePrivateListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    // Filter for lists that are both active AND public
    const filterStr =
      'listSet[and][0][actives]=true&listSet[and][1][publics]=true';
    const response = await client
      .get('/list-entity-relations')
      .query(filterStr)
      .expect(200);

    // Should return relations from lists that are both active and public
    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._fromMetadata._name).to.equal('Active Public List');
    expect(response.body[0]._fromMetadata._visibility).to.equal('public');
    expect(response.body[0]._fromMetadata._validFromDateTime).to.equal(
      pastDate.toISOString(),
    );
    expect(response.body[0]._fromMetadata._validUntilDateTime).to.equal(
      futureDate.toISOString(),
    );
  });

  it('filter: combine listSet[actives], listSet[publics], and set[actives]', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
      autoapprove_list_entity_relations: 'true',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);

    // Create test entity
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    // Create lists with different combinations of active status and visibility
    const activePublicListId = await createTestList(client, {
      _name: 'Active Public List',
      _kind: 'reading-list',
      _validFromDateTime: pastDate.toISOString(), // Past date
      _validUntilDateTime: futureDate.toISOString(), // Future date
      _visibility: 'public',
    });

    const activePrivateListId = await createTestList(client, {
      _name: 'Active Private List',
      _kind: 'reading-list',
      _validFromDateTime: pastDate.toISOString(), // Past date
      _validUntilDateTime: futureDate.toISOString(), // Future date
      _visibility: 'private',
    });

    const inactivePublicListId = await createTestList(client, {
      _name: 'Inactive Public List',
      _kind: 'reading-list',
      _validFromDateTime: pastDate.toISOString(), // Past date
      _validUntilDateTime: pastDate.toISOString(), // Past date (expired)
      _visibility: 'public',
    });

    // Create active and inactive relations for each list
    // Active relation for active public list
    await createTestRelation({
      _listId: activePublicListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Inactive relation for active public list
    await createTestRelation({
      _listId: activePublicListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(), // Expired
    });

    // Active relation for active private list
    await createTestRelation({
      _listId: activePrivateListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Active relation for inactive public list
    await createTestRelation({
      _listId: inactivePublicListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Filter for:
    // 1. Active lists (listSet[actives])
    // 2. Public lists (listSet[publics])
    // 3. Active relations (set[actives])
    const filterStr =
      'listSet[actives]=true&listSet[publics]=true&set[actives]=true';
    const response = await client
      .get('/list-entity-relations')
      .query(filterStr)
      .expect(200);

    // Should return only the active relation from the active public list
    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._fromMetadata._name).to.equal('Active Public List');
    expect(response.body[0]._fromMetadata._visibility).to.equal('public');
    expect(response.body[0]._validFromDateTime).to.equal(
      pastDate.toISOString(),
    );
    expect(response.body[0]._validUntilDateTime).to.equal(
      futureDate.toISOString(),
    );
  });

  it('filter: using listSet[audience] for user and group access control', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
      autoapprove_list_entity_relations: 'true',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);

    // Create test entity
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    // Create lists with different combinations of ownership, visibility and status

    // 1. Public active list (should be accessible to all)
    const publicActiveListId = await createTestList(client, {
      _name: 'Public Active List',
      _kind: 'reading-list',
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // 2. Public inactive list (should not be accessible)
    const publicInactiveListId = await createTestList(client, {
      _name: 'Public Inactive List',
      _kind: 'reading-list',
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(), // Expired
    });

    // 3. Private list owned by user-123 (should be accessible to user-123)
    const userOwnedListId = await createTestList(client, {
      _name: 'User Owned List',
      _kind: 'reading-list',
      _visibility: 'private',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      _ownerUsers: ['user-123'],
    });

    // 4. Protected list owned by group-456 (should be accessible to members of group-456)
    const groupOwnedListId = await createTestList(client, {
      _name: 'Group Owned List',
      _kind: 'reading-list',
      _visibility: 'protected',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      _ownerGroups: ['group-456'],
    });

    // 5. Private list with user-123 as viewer (should be accessible to user-123)
    const userViewableListId = await createTestList(client, {
      _name: 'User Viewable List',
      _kind: 'reading-list',
      _visibility: 'private',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      _viewerUsers: ['user-123'],
    });

    // 6. Private list with group-456 as viewer (should be accessible to members of group-456)
    const groupViewableListId = await createTestList(client, {
      _name: 'Group Viewable List',
      _kind: 'reading-list',
      _visibility: 'protected',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      _viewerGroups: ['group-456'],
    });

    // 7. Private list with no access for the test user (should not be accessible)
    const noAccessListId = await createTestList(client, {
      _name: 'No Access List',
      _kind: 'reading-list',
      _visibility: 'private',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      _ownerUsers: ['other-user'],
    });

    // Create relations for all lists
    await createTestRelation({
      _listId: publicActiveListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    await createTestRelation({
      _listId: publicInactiveListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    await createTestRelation({
      _listId: userOwnedListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    await createTestRelation({
      _listId: groupOwnedListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    await createTestRelation({
      _listId: userViewableListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    await createTestRelation({
      _listId: groupViewableListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    await createTestRelation({
      _listId: noAccessListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    // Test 1: Filter for lists accessible to user-123
    const userFilterStr = 'listSet[audience][userIds]=user-123';
    const userResponse = await client
      .get('/list-entity-relations')
      .query(userFilterStr)
      .expect(200);

    // Should return relations from:
    // - Public active list (public + active)
    // - User owned list (owner + active)
    // - User viewable list (viewer + active)
    expect(userResponse.body).to.be.Array().and.have.length(3);
    const userAccessibleLists = userResponse.body
      .map((r: any) => r._fromMetadata._name)
      .sort();
    expect(userAccessibleLists).to.eql([
      'Public Active List',
      'User Owned List',
      'User Viewable List',
    ]);

    // Test 2: Filter for lists accessible to a member of group-456
    const groupFilterStr = 'listSet[audience][groupIds]=group-456';
    const groupResponse = await client
      .get('/list-entity-relations')
      .query(groupFilterStr)
      .expect(200);

    // Should return relations from:
    // - Public active list (public + active)
    // - Group owned list (owner + active)
    // - Group viewable list (viewer + active)
    expect(groupResponse.body).to.be.Array().and.have.length(3);
    const groupAccessibleLists = groupResponse.body
      .map((r: any) => r._fromMetadata._name)
      .sort();
    expect(groupAccessibleLists).to.eql([
      'Group Owned List',
      'Group Viewable List',
      'Public Active List',
    ]);

    // Test 3: Filter for lists accessible to both user-123 and a member of group-456
    const combinedFilterStr =
      'listSet[audience][userIds]=user-123&listSet[audience][groupIds]=group-456';
    const combinedResponse = await client
      .get('/list-entity-relations')
      .query(combinedFilterStr)
      .expect(200);

    // Should return relations from all accessible lists
    expect(combinedResponse.body).to.be.Array().and.have.length(5);
    const combinedAccessibleLists = combinedResponse.body
      .map((r: any) => r._fromMetadata._name)
      .sort();
    expect(combinedAccessibleLists).to.eql([
      'Group Owned List',
      'Group Viewable List',
      'Public Active List',
      'User Owned List',
      'User Viewable List',
    ]);
  });

  it('filter: combine listSet[audience], set[actives], and entitySet[audience]', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list',
      autoapprove_list_entity_relations: 'true',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);

    // Create test entities with different access controls
    const publicBookId = await createTestEntity(client, {
      _name: 'Public Book',
      _kind: 'book',
      _visibility: 'public',
    });

    const privateBookId = await createTestEntity(client, {
      _name: 'Private Book',
      _kind: 'book',
      _visibility: 'private',
      _ownerUsers: ['user-123'],
    });

    const protectedBookId = await createTestEntity(client, {
      _name: 'Protected Book',
      _kind: 'book',
      _visibility: 'protected',
      _ownerGroups: ['group-456'],
    });

    // Create lists with different access controls
    const publicListId = await createTestList(client, {
      _name: 'Public List',
      _kind: 'reading-list',
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    const privateListId = await createTestList(client, {
      _name: 'Private List',
      _kind: 'reading-list',
      _visibility: 'private',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      _ownerUsers: ['user-123'],
    });

    const protectedListId = await createTestList(client, {
      _name: 'Protected List',
      _kind: 'reading-list',
      _visibility: 'protected',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      _ownerGroups: ['group-456'],
    });

    // Create active and inactive relations with different combinations
    // Active relations
    await createTestRelation({
      _listId: publicListId,
      _entityId: publicBookId,
      _kind: 'reading-list-book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    await createTestRelation({
      _listId: privateListId,
      _entityId: privateBookId,
      _kind: 'reading-list-book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    await createTestRelation({
      _listId: protectedListId,
      _entityId: protectedBookId,
      _kind: 'reading-list-book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Inactive relations
    await createTestRelation({
      _listId: publicListId,
      _entityId: publicBookId,
      _kind: 'reading-list-book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(), // Expired
    });

    await createTestRelation({
      _listId: privateListId,
      _entityId: privateBookId,
      _kind: 'reading-list-book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(), // Expired
    });

    // Test 1: Filter for active relations where user-123 has access to both list and entity
    const userFilterStr =
      'listSet[audience][userIds]=user-123&' +
      'set[actives]=true&' +
      'entitySet[audience][userIds]=user-123';
    const userResponse = await client
      .get('/list-entity-relations')
      .query(userFilterStr)
      .expect(200);

    // Should return only the active relation where user-123 has access to both list and entity
    expect(userResponse.body).to.be.Array().and.have.length(1);
    expect(userResponse.body[0]._fromMetadata._name).to.equal('Private List');
    expect(userResponse.body[0]._toMetadata._name).to.equal('Private Book');
    expect(userResponse.body[0]._validUntilDateTime).to.equal(
      futureDate.toISOString(),
    );

    // Test 2: Filter for active relations where group-456 has access to both list and entity
    const groupFilterStr =
      'listSet[audience][groupIds]=group-456&' +
      'set[actives]=true&' +
      'entitySet[audience][groupIds]=group-456';
    const groupResponse = await client
      .get('/list-entity-relations')
      .query(groupFilterStr)
      .expect(200);

    // Should return only the active relation where group-456 has access to both list and entity
    expect(groupResponse.body).to.be.Array().and.have.length(1);
    expect(groupResponse.body[0]._fromMetadata._name).to.equal(
      'Protected List',
    );
    expect(groupResponse.body[0]._toMetadata._name).to.equal('Protected Book');
    expect(groupResponse.body[0]._validUntilDateTime).to.equal(
      futureDate.toISOString(),
    );

    // Test 3: Filter for active relations where user-123 has access to list and group-456 has access to entity
    const mixedFilterStr =
      'listSet[audience][userIds]=user-123&' +
      'set[actives]=true&' +
      'entitySet[audience][groupIds]=group-456';
    const mixedResponse = await client
      .get('/list-entity-relations')
      .query(mixedFilterStr)
      .expect(200);

    // Should return no relations since no relation matches both conditions
    expect(mixedResponse.body).to.be.Array().and.have.length(0);

    // Test 4: Filter for active relations where either user-123 or group-456 has access to both list and entity
    const combinedFilterStr =
      'listSet[audience][userIds]=user-123&' +
      'listSet[audience][groupIds]=group-456&' +
      'set[actives]=true&' +
      'entitySet[audience][userIds]=user-123&' +
      'entitySet[audience][groupIds]=group-456';
    const combinedResponse = await client
      .get('/list-entity-relations')
      .query(combinedFilterStr)
      .expect(200);

    // Should return active relations where either user-123 or group-456 has access to both list and entity
    expect(combinedResponse.body).to.be.Array().and.have.length(2);
    const combinedAccessibleLists = combinedResponse.body
      .map((r: any) => r._fromMetadata._name)
      .sort();
    expect(combinedAccessibleLists).to.eql(['Private List', 'Protected List']);
  });

  it('filter: by nested list properties using dot notation', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      list_kinds: 'reading-list,watch-list',
    });
    ({ client } = appWithClient);

    // Create test entities
    const bookId = await createTestEntity(client, {
      _name: 'Test Book',
      _kind: 'book',
    });

    // Create test lists with nested properties
    const readingListId = await createTestList(client, {
      _name: 'Reading List',
      _kind: 'reading-list',
      _visibility: 'public',
      metadata: {
        category: 'fiction',
        tags: ['novel', 'classic'],
        rating: {
          score: 4.5,
          reviews: 100,
        },
      },
    });

    const watchListId = await createTestList(client, {
      _name: 'Watch List',
      _kind: 'watch-list',
      _visibility: 'private',
      metadata: {
        category: 'non-fiction',
        tags: ['documentary', 'educational'],
        rating: {
          score: 3.8,
          reviews: 50,
        },
      },
    });

    // Create relations for both lists
    await createTestRelation({
      _listId: readingListId,
      _entityId: bookId,
      _kind: 'reading-list-book',
    });

    await createTestRelation({
      _listId: watchListId,
      _entityId: bookId,
      _kind: 'watch-list-book',
    });

    // Test filtering by nested category
    const categoryResponse = await client
      .get('/list-entity-relations')
      .query({
        listFilter: {
          where: {
            'metadata.category': 'fiction',
          },
        },
      })
      .expect(200);

    expect(categoryResponse.body).to.be.Array().and.have.length(1);
    expect(categoryResponse.body[0]._fromMetadata._name).to.equal(
      'Reading List',
    );
    expect(categoryResponse.body[0]._fromMetadata.metadata.category).to.equal(
      'fiction',
    );

    // Test filtering by nested array element
    const tagsResponse = await client
      .get('/list-entity-relations')
      .query({
        listFilter: {
          where: {
            'metadata.tags': { inq: ['documentary'] },
          },
        },
      })
      .expect(200);

    expect(tagsResponse.body).to.be.Array().and.have.length(1);
    expect(tagsResponse.body[0]._fromMetadata._name).to.equal('Watch List');
    expect(tagsResponse.body[0]._fromMetadata.metadata.tags).to.containDeep([
      'documentary',
    ]);

    // Test filtering by deeply nested property
    const ratingResponse = await client
      .get('/list-entity-relations')
      .query({
        listFilter: {
          where: {
            'metadata.rating.score': { gt: 4 },
          },
        },
      })
      .expect(200);

    expect(ratingResponse.body).to.be.Array().and.have.length(1);
    expect(ratingResponse.body[0]._fromMetadata._name).to.equal('Reading List');
    expect(ratingResponse.body[0]._fromMetadata.metadata.rating.score).to.equal(
      4.5,
    );

    // Test combining multiple nested filters
    const combinedResponse = await client
      .get('/list-entity-relations')
      .query({
        listFilter: {
          where: {
            and: [
              { 'metadata.category': 'non-fiction' },
              { 'metadata.rating.reviews': { gt: 40 } },
            ],
          },
        },
      })
      .expect(200);

    expect(combinedResponse.body).to.be.Array().and.have.length(1);
    expect(combinedResponse.body[0]._fromMetadata._name).to.equal('Watch List');
    expect(combinedResponse.body[0]._fromMetadata.metadata.category).to.equal(
      'non-fiction',
    );
    expect(
      combinedResponse.body[0]._fromMetadata.metadata.rating.reviews,
    ).to.equal(50);
  });
});
