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
});
