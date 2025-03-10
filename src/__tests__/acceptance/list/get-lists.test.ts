import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { List } from '../../../models';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestEntity,
} from '../test-helper';

describe('GET /lists', () => {
  let client: Client;
  let appWithClient: AppWithClient | undefined;

  // Store created list IDs for cleanup
  let createdListIds: string[] = [];

  beforeEach(async () => {
    if (appWithClient) {
      await teardownApplication(appWithClient);
    }

    appWithClient = undefined;

    // Clear all environment variables
    Object.keys(process.env).forEach((key) => {
      delete process.env[key];
    });

    // Reset created list IDs
    createdListIds = [];
  });

  afterEach(async () => {
    if (appWithClient) {
      // Clean up created lists
      for (const id of createdListIds) {
        try {
          await client.delete(`/lists/${id}`);
        } catch (error) {
          console.error(`Failed to delete list ${id}:`, error);
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

  async function createTestList(listData: Partial<List>): Promise<string> {
    const response = await client.post('/lists').send(listData).expect(200);
    const listId = response.body._id;
    createdListIds.push(listId);

    return listId;
  }

  it('basic: returns all lists when no filter is applied', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading,watching',
    });
    ({ client } = appWithClient);

    // Create test lists
    await createTestList({
      _name: 'Reading List 1',
      _kind: 'reading',
      description: 'First reading list',
    });

    await createTestList({
      _name: 'Watching List 1',
      _kind: 'watching',
      description: 'First watching list',
    });

    // Get all lists
    const response = await client.get('/lists').expect(200);

    expect(response.body).to.be.Array().and.have.length(2);
    expect(response.body.map((e: List) => e._name)).to.containDeep([
      'Reading List 1',
      'Watching List 1',
    ]);
  });

  it('filter: by kind', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading,watching',
    });
    ({ client } = appWithClient);

    // Create test lists
    await createTestList({
      _name: 'Reading List 1',
      _kind: 'reading',
      description: 'First reading list',
    });

    await createTestList({
      _name: 'Watching List 1',
      _kind: 'watching',
      description: 'First watching list',
    });

    // Get only reading lists
    const response = await client
      .get('/lists')
      .query({ filter: { where: { _kind: 'reading' } } })
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Reading List 1');
  });

  it('filter: filters active lists with complex filter', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);

    // Create active list
    await createTestList({
      _name: 'Active Reading List',
      _kind: 'reading',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create inactive list (expired)
    await createTestList({
      _name: 'Inactive Reading List',
      _kind: 'reading',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });

    // Get only active lists using complex filter
    const filterStr =
      `filter[where][and][0][or][0][_validUntilDateTime][eq]=null&` +
      `filter[where][and][0][or][1][_validUntilDateTime][gt]=${encodeURIComponent(now.toISOString())}&` +
      `filter[where][and][1][_validFromDateTime][neq]=null&` +
      `filter[where][and][2][_validFromDateTime][lt]=${encodeURIComponent(now.toISOString())}`;

    const response = await client.get('/lists').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Active Reading List');
  });

  it('filter: by visibility', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
    });
    ({ client } = appWithClient);

    // Create public list
    await createTestList({
      _name: 'Public Reading List',
      _kind: 'reading',
      _visibility: 'public',
    });

    // Create private list
    await createTestList({
      _name: 'Private Reading List',
      _kind: 'reading',
      _visibility: 'private',
    });

    // Get only public lists
    const response = await client
      .get('/lists')
      .query({ filter: { where: { _visibility: 'public' } } })
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Public Reading List');
    expect(response.body[0]._visibility).to.equal('public');
  });

  it('filter: by owner', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
    });
    ({ client } = appWithClient);

    const owner1 = 'user-123';
    const owner2 = 'user-456';

    // Create list with owner1
    await createTestList({
      _name: 'Owner1 Reading List',
      _kind: 'reading',
      _ownerUsers: [owner1],
    });

    // Create list with owner2
    await createTestList({
      _name: 'Owner2 Reading List',
      _kind: 'reading',
      _ownerUsers: [owner2],
    });

    // Get lists for owner1
    const filterStr = `filter[where][_ownerUsers][inq][]=${owner1}`;
    const response = await client.get('/lists').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Owner1 Reading List');
    expect(response.body[0]._ownerUsers).to.containDeep([owner1]);
  });

  it('pagination: applies response limit configuration', async () => {
    // Set up the application with response limit configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
      response_limit_list: '2', // Limit response to 2 items
    });
    ({ client } = appWithClient);

    // Create 3 lists
    await createTestList({
      _name: 'Reading List 1',
      _kind: 'reading',
    });

    await createTestList({
      _name: 'Reading List 2',
      _kind: 'reading',
    });

    await createTestList({
      _name: 'Reading List 3',
      _kind: 'reading',
    });

    // Get lists with limit
    const response = await client.get('/lists').expect(200);

    expect(response.body).to.be.Array().and.have.length(2);
  });

  it('pagination: supports pagination', async () => {
    // Set up the application
    appWithClient = await setupApplication({
      list_kinds: 'reading',
    });
    ({ client } = appWithClient);

    // Create test lists
    await createTestList({
      _name: 'Reading List 1',
      _kind: 'reading',
    });

    await createTestList({
      _name: 'Reading List 2',
      _kind: 'reading',
    });

    await createTestList({
      _name: 'Reading List 3',
      _kind: 'reading',
    });

    // Get first page
    const firstPage = await client
      .get('/lists')
      .query({ filter: { limit: 2, skip: 0 } })
      .expect(200);

    expect(firstPage.body).to.be.Array().and.have.length(2);

    // Get second page
    const secondPage = await client
      .get('/lists')
      .query({ filter: { limit: 2, skip: 2 } })
      .expect(200);

    expect(secondPage.body).to.be.Array().and.have.length(1);
  });

  it('pagination: supports sorting', async () => {
    // Set up the application
    appWithClient = await setupApplication({
      list_kinds: 'reading',
    });
    ({ client } = appWithClient);

    // Create test lists with different names
    await createTestList({
      _name: 'Reading List C',
      _kind: 'reading',
    });

    await createTestList({
      _name: 'Reading List A',
      _kind: 'reading',
    });

    await createTestList({
      _name: 'Reading List B',
      _kind: 'reading',
    });

    // Get lists sorted by name in ascending order
    const response = await client
      .get('/lists')
      .query({ filter: { order: ['_name ASC'] } })
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(3);
    expect(response.body.map((list: List) => list._name)).to.eql([
      'Reading List A',
      'Reading List B',
      'Reading List C',
    ]);

    // Get lists sorted by name in descending order
    const descendingResponse = await client
      .get('/lists')
      .query({ filter: { order: ['_name DESC'] } })
      .expect(200);

    expect(descendingResponse.body).to.be.Array().and.have.length(3);
    expect(descendingResponse.body.map((list: List) => list._name)).to.eql([
      'Reading List C',
      'Reading List B',
      'Reading List A',
    ]);
  });

  it('set-filter: filters lists by audience', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);

    // Create active list
    await createTestList({
      _name: 'Active Reading List',
      _kind: 'reading',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create inactive list (expired)
    await createTestList({
      _name: 'Inactive Reading List',
      _kind: 'reading',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });

    // Get only active lists using complex filter
    const filterStr =
      `filter[where][and][0][or][0][_validUntilDateTime][eq]=null&` +
      `filter[where][and][0][or][1][_validUntilDateTime][gt]=${encodeURIComponent(now.toISOString())}&` +
      `filter[where][and][1][_validFromDateTime][neq]=null&` +
      `filter[where][and][2][_validFromDateTime][lt]=${encodeURIComponent(now.toISOString())}`;

    const response = await client.get('/lists').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Active Reading List');
  });

  it('set-filter: filters active lists', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);

    // Create active list
    await createTestList({
      _name: 'Active Reading List',
      _kind: 'reading',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create inactive list (expired)
    await createTestList({
      _name: 'Inactive Reading List',
      _kind: 'reading',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });

    // Get only active lists using complex filter
    const filterStr =
      `filter[where][and][0][or][0][_validUntilDateTime][eq]=null&` +
      `filter[where][and][0][or][1][_validUntilDateTime][gt]=${encodeURIComponent(now.toISOString())}&` +
      `filter[where][and][1][_validFromDateTime][neq]=null&` +
      `filter[where][and][2][_validFromDateTime][lt]=${encodeURIComponent(now.toISOString())}`;

    const response = await client.get('/lists').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Active Reading List');
  });

  it('set-filter: filters public lists', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
    });
    ({ client } = appWithClient);

    // Create public list
    await createTestList({
      _name: 'Public Reading List',
      _kind: 'reading',
      _visibility: 'public',
    });

    // Create private list
    await createTestList({
      _name: 'Private Reading List',
      _kind: 'reading',
      _visibility: 'private',
    });

    // Get only public lists
    const response = await client
      .get('/lists')
      .query({ filter: { where: { _visibility: 'public' } } })
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Public Reading List');
    expect(response.body[0]._visibility).to.equal('public');
  });

  it('set-filter: filters inactive lists', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);

    // Create active list
    await createTestList({
      _name: 'Active Reading List',
      _kind: 'reading',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create inactive list (expired)
    await createTestList({
      _name: 'Inactive Reading List',
      _kind: 'reading',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });

    // Get only active lists using complex filter
    const filterStr =
      `filter[where][and][0][or][0][_validUntilDateTime][eq]=null&` +
      `filter[where][and][0][or][1][_validUntilDateTime][gt]=${encodeURIComponent(now.toISOString())}&` +
      `filter[where][and][1][_validFromDateTime][neq]=null&` +
      `filter[where][and][2][_validFromDateTime][lt]=${encodeURIComponent(now.toISOString())}`;

    const response = await client.get('/lists').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Active Reading List');
  });

  it('fields: returns only selected fields', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
    });
    ({ client } = appWithClient);

    // Create test list with multiple fields
    await createTestList({
      _name: 'Complete Reading List',
      _kind: 'reading',
      description: 'A list with many fields',
      _visibility: 'public',
      _ownerUsers: ['user-123'],
      _viewerUsers: ['viewer-456'],
      _validFromDateTime: new Date().toISOString(),
    });

    // Request only specific fields
    const filterStr =
      'filter[fields][_name]=true&filter[fields][description]=true&filter[fields][_visibility]=true';
    const response = await client.get('/lists').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    const list = response.body[0];

    // Should have the requested fields
    expect(list).to.have.property('_name', 'Complete Reading List');
    expect(list).to.have.property('description', 'A list with many fields');
    expect(list).to.have.property('_visibility', 'public');

    // Should not have other fields
    expect(list).to.not.have.property('_id');
    expect(list).to.not.have.property('_kind');
    expect(list).to.not.have.property('_ownerUsers');
    expect(list).to.not.have.property('_viewerUsers');
    expect(list).to.not.have.property('_validFromDateTime');
    expect(list).to.not.have.property('_creationDateTime');
    expect(list).to.not.have.property('_lastUpdatedDateTime');
  });

  it('fields: excludes specified fields from response', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
    });
    ({ client } = appWithClient);

    const now = new Date();

    // Create test list with multiple fields
    await createTestList({
      _name: 'Complete Reading List',
      _kind: 'reading',
      description: 'A list with many fields',
      _visibility: 'public',
      _ownerUsers: ['user-123'],
      _viewerUsers: ['viewer-456'],
      _validFromDateTime: now.toISOString(),
      _validUntilDateTime: new Date(now.getTime() + 86400000).toISOString(), // tomorrow
    });

    // Request to exclude specific fields
    const filterStr =
      'filter[fields][_ownerUsers]=false&filter[fields][_viewerUsers]=false&filter[fields][_validFromDateTime]=false&filter[fields][_validUntilDateTime]=false';
    const response = await client.get('/lists').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    const list = response.body[0];

    // Should have non-excluded fields
    expect(list).to.have.property('_id');
    expect(list).to.have.property('_name', 'Complete Reading List');
    expect(list).to.have.property('_kind', 'reading');
    expect(list).to.have.property('_visibility', 'public');
    expect(list).to.have.property('_createdDateTime');
    expect(list).to.have.property('_lastUpdatedDateTime');

    // Should not have excluded fields
    expect(list).to.not.have.property('_ownerUsers');
    expect(list).to.not.have.property('_viewerUsers');
    expect(list).to.not.have.property('_validFromDateTime');
    expect(list).to.not.have.property('_validUntilDateTime');
  });

  it('lookup: resolves entity references through lookup', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading,collection',
    });
    ({ client } = appWithClient);

    // Create a reading list
    const readingListId = await createTestList({
      _name: 'My Reading List',
      _kind: 'reading',
      description: 'A list of books to read',
    });

    // Create a collection list that references the reading list
    await createTestList({
      _name: 'My Collections',
      _kind: 'collection',
      description: 'A collection of lists',
      readingList: `tapp://localhost/lists/${readingListId}`,
    });

    // Get the collection list with reading list lookup
    const filterStr = 'filter[lookup][0][prop]=readingList';
    const response = await client.get('/lists').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(2);

    // Find the collection list in the response
    const list = response.body.find((l: List) => l._name === 'My Collections');
    expect(list).to.not.be.undefined();
    expect(list._kind).to.equal('collection');

    // Verify the reading list reference is resolved
    expect(list.readingList).to.be.an.Object();
    expect(list.readingList._id).to.equal(readingListId);
    expect(list.readingList._name).to.equal('My Reading List');
    expect(list.readingList._kind).to.equal('reading');
    expect(list.readingList.description).to.equal('A list of books to read');
  });

  it('lookup: resolves multiple lookups including nested property references', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading,collection,category',
    });
    ({ client } = appWithClient);

    // Create a reading list
    const readingListId = await createTestList({
      _name: 'My Reading List',
      _kind: 'reading',
      description: 'A list of books to read',
    });

    // Create a category list that will be referenced in metadata
    const categoryListId = await createTestList({
      _name: 'Fiction Category',
      _kind: 'category',
      description: 'Fiction books category',
    });

    // Create a collection list that references both the reading list and category list
    await createTestList({
      _name: 'My Collections',
      _kind: 'collection',
      description: 'A collection of lists',
      readingList: `tapp://localhost/lists/${readingListId}`,
      metadata: {
        references: {
          category: `tapp://localhost/lists/${categoryListId}`,
        },
      },
    });

    // Get the collection list with nested lookups for both reading list and category
    const filterStr =
      'filter[lookup][0][prop]=readingList&' +
      'filter[lookup][1][prop]=metadata.references.category';
    const response = await client.get('/lists').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(3);

    // Find the collection list in the response
    const list = response.body.find((l: List) => l._name === 'My Collections');
    expect(list).to.not.be.undefined();
    expect(list._kind).to.equal('collection');

    // Verify the reading list reference is resolved
    expect(list.readingList).to.be.an.Object();
    expect(list.readingList._id).to.equal(readingListId);
    expect(list.readingList._name).to.equal('My Reading List');
    expect(list.readingList._kind).to.equal('reading');
    expect(list.readingList.description).to.equal('A list of books to read');

    // Verify the nested category reference is resolved
    expect(list.metadata.references.category).to.be.an.Object();
    expect(list.metadata.references.category._id).to.equal(categoryListId);
    expect(list.metadata.references.category._name).to.equal(
      'Fiction Category',
    );
    expect(list.metadata.references.category._kind).to.equal('category');
    expect(list.metadata.references.category.description).to.equal(
      'Fiction books category',
    );
  });

  it('lookup: resolves lookups from nested property paths', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading,collection',
    });
    ({ client } = appWithClient);

    // Create a reading list
    const readingListId = await createTestList({
      _name: 'My Reading List',
      _kind: 'reading',
      description: 'A list of books to read',
    });

    // Create a collection list that references the reading list in a nested property
    await createTestList({
      _name: 'My Collections',
      _kind: 'collection',
      description: 'A collection of lists',
      metadata: {
        references: {
          readingList: `tapp://localhost/lists/${readingListId}`,
        },
      },
    });

    // Get the collection list with nested reading list lookup
    const filterStr = 'filter[lookup][0][prop]=metadata.references.readingList';
    const response = await client.get('/lists').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(2);

    // Find the collection list in the response
    const list = response.body.find((l: List) => l._name === 'My Collections');
    expect(list).to.not.be.undefined();
    expect(list._kind).to.equal('collection');

    // Verify the nested reading list reference is resolved
    expect(list.metadata.references.readingList).to.be.an.Object();
    expect(list.metadata.references.readingList._id).to.equal(readingListId);
    expect(list.metadata.references.readingList._name).to.equal(
      'My Reading List',
    );
    expect(list.metadata.references.readingList._kind).to.equal('reading');
    expect(list.metadata.references.readingList.description).to.equal(
      'A list of books to read',
    );
  });

  it('lookup: selects specific fields from looked-up entities using scope', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading,collection',
    });
    ({ client } = appWithClient);

    // Create a reading list with multiple fields
    const readingListId = await createTestList({
      _name: 'My Reading List',
      _kind: 'reading',
      description: 'A list of books to read',
      _visibility: 'public',
      _ownerUsers: ['user-123'],
      _viewerUsers: ['viewer-456'],
      _validFromDateTime: new Date().toISOString(),
    });

    // Create a collection list that references the reading list
    await createTestList({
      _name: 'My Collections',
      _kind: 'collection',
      description: 'A collection of lists',
      readingList: `tapp://localhost/lists/${readingListId}`,
    });

    // Get the collection list with reading list lookup, selecting only name and description fields
    const filterStr =
      'filter[lookup][0][prop]=readingList&' +
      'filter[lookup][0][scope][fields][_name]=true&' +
      'filter[lookup][0][scope][fields][description]=true';
    const response = await client.get('/lists').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(2);

    // Find the collection list in the response
    const list = response.body.find((l: List) => l._name === 'My Collections');
    expect(list).to.not.be.undefined();
    expect(list._kind).to.equal('collection');

    // Verify the reading list reference is resolved with only selected fields
    expect(list.readingList).to.be.an.Object();
    expect(list.readingList._name).to.equal('My Reading List');
    expect(list.readingList.description).to.equal('A list of books to read');

    // Verify other fields are not included
    expect(list.readingList).to.not.have.property('_id');
    expect(list.readingList).to.not.have.property('_kind');
    expect(list.readingList).to.not.have.property('_visibility');
    expect(list.readingList).to.not.have.property('_ownerUsers');
    expect(list.readingList).to.not.have.property('_viewerUsers');
    expect(list.readingList).to.not.have.property('_validFromDateTime');
  });

  it('lookup: resolves lookups from array properties containing list references', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading,collection',
    });
    ({ client } = appWithClient);

    // Create multiple reading lists
    const readingList1Id = await createTestList({
      _name: 'Reading List One',
      _kind: 'reading',
      description: 'First reading list',
    });

    const readingList2Id = await createTestList({
      _name: 'Reading List Two',
      _kind: 'reading',
      description: 'Second reading list',
    });

    // Create a collection list that references multiple reading lists
    await createTestList({
      _name: 'My Collections',
      _kind: 'collection',
      description: 'A collection with multiple lists',
      readingLists: [
        `tapp://localhost/lists/${readingList1Id}`,
        `tapp://localhost/lists/${readingList2Id}`,
      ],
    });

    // Get the collection list with reading lists lookup, using skip and limit in scope
    const filterStr =
      'filter[lookup][0][prop]=readingLists&' +
      'filter[lookup][0][scope][skip]=1&' +
      'filter[lookup][0][scope][limit]=2&' +
      'filter[lookup][0][scope][order][0]=_name ASC';
    const response = await client.get('/lists').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(3);

    // Find the collection list in the response
    const list = response.body.find((l: List) => l._name === 'My Collections');
    expect(list).to.not.be.undefined();
    expect(list._kind).to.equal('collection');

    // Verify the reading lists array is resolved with skip and limit applied
    expect(list.readingLists).to.be.Array().and.have.length(1);

    // Verify first reading list (should be Reading List Two, as Reading List One was skipped)
    const readingList = list.readingLists[0];
    expect(readingList).to.be.an.Object();
    expect(readingList._id).to.equal(readingList2Id);
    expect(readingList._name).to.equal('Reading List Two');
    expect(readingList._kind).to.equal('reading');
    expect(readingList.description).to.equal('Second reading list');
  });

  it('lookup: handles not-found lists with skip and limit', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading,collection',
    });
    ({ client } = appWithClient);

    // Create a collection list that references non-existent reading lists
    await createTestList({
      _name: 'My Collections',
      _kind: 'collection',
      description: 'A collection with missing lists',
      readingLists: [
        'tapp://localhost/lists/00000000-0000-0000-0000-000000000000', // Not found list 1
        'tapp://localhost/lists/11111111-1111-1111-1111-111111111111', // Not found list 2
        'tapp://localhost/lists/22222222-2222-2222-2222-222222222222', // Not found list 3
      ],
    });

    // Get the collection list with reading lists lookup, using skip and limit in scope
    const filterStr =
      'filter[lookup][0][prop]=readingLists&' +
      'filter[lookup][0][scope][skip]=1&' +
      'filter[lookup][0][scope][limit]=1';
    const response = await client.get('/lists').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);

    // Find the collection list in the response
    const list = response.body.find((l: List) => l._name === 'My Collections');
    expect(list).to.not.be.undefined();
    expect(list._kind).to.equal('collection');

    // Verify the reading lists array is empty since all references were not found
    expect(list.readingLists).to.be.Array().and.have.length(0);
  });

  it('lookup: applies skip and limit in scope when looking up array references', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading,collection',
    });
    ({ client } = appWithClient);

    // Create multiple reading lists
    const readingList1Id = await createTestList({
      _name: 'Reading List One',
      _kind: 'reading',
      description: 'First reading list',
    });

    const readingList2Id = await createTestList({
      _name: 'Reading List Two',
      _kind: 'reading',
      description: 'Second reading list',
    });

    const readingList3Id = await createTestList({
      _name: 'Reading List Three',
      _kind: 'reading',
      description: 'Third reading list',
    });

    // Create a collection list that references multiple reading lists
    await createTestList({
      _name: 'My Collections',
      _kind: 'collection',
      description: 'A collection with multiple lists',
      readingLists: [
        `tapp://localhost/lists/${readingList1Id}`,
        `tapp://localhost/lists/${readingList2Id}`,
        `tapp://localhost/lists/${readingList3Id}`,
      ],
    });

    // Get the collection list with reading lists lookup, using skip and limit in scope
    const filterStr =
      'filter[lookup][0][prop]=readingLists&' +
      'filter[lookup][0][scope][skip]=1&' +
      'filter[lookup][0][scope][limit]=1&' +
      'filter[lookup][0][scope][order][0]=_name ASC';
    const response = await client.get('/lists').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(4);

    // Find the collection list in the response
    const list = response.body.find((l: List) => l._name === 'My Collections');
    expect(list).to.not.be.undefined();
    expect(list._kind).to.equal('collection');

    // Verify the reading lists array is resolved with skip and limit applied
    expect(list.readingLists).to.be.Array().and.have.length(1);

    // Verify we get Reading List Three (after skipping Reading List One and omitting Reading List Two due to limit)
    const readingList = list.readingLists[0];
    expect(readingList).to.be.an.Object();
    expect(readingList._name).to.equal('Reading List Three');
    expect(readingList._id).to.equal(readingList3Id);
    expect(readingList._kind).to.equal('reading');
    expect(readingList.description).to.equal('Third reading list');

    // Get the collection list with different skip and limit values
    const secondFilterStr =
      'filter[lookup][0][prop]=readingLists&' +
      'filter[lookup][0][scope][skip]=2&' +
      'filter[lookup][0][scope][limit]=2&' +
      'filter[lookup][0][scope][order][0]=_name ASC';
    const secondResponse = await client
      .get('/lists')
      .query(secondFilterStr)
      .expect(200);

    const secondList = secondResponse.body.find(
      (l: List) => l._name === 'My Collections',
    );
    expect(secondList.readingLists).to.be.Array().and.have.length(1);

    // Verify the third reading list (after skipping Reading List One and Reading List Three, due to name sorting and skip=2)
    const thirdList = secondList.readingLists[0];
    expect(thirdList).to.be.an.Object();
    expect(thirdList._name).to.equal('Reading List Two');
    expect(thirdList._id).to.equal(readingList2Id);
    expect(thirdList._kind).to.equal('reading');
    expect(thirdList.description).to.equal('Second reading list');
  });

  it('lookup: handles invalid references and not-found lists with skip and limit', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading,collection',
    });
    ({ client } = appWithClient);

    // Create a reading list
    const readingListId = await createTestList({
      _name: 'Valid Reading List',
      _kind: 'reading',
      description: 'A valid reading list',
    });

    // Create a collection list with valid and invalid list references
    await createTestList({
      _name: 'My Collections',
      _kind: 'collection',
      description: 'A collection with mixed references',
      readingLists: [
        `tapp://localhost/lists/${readingListId}`, // Valid reference
        'tapp://localhost/lists/invalid-id', // Invalid reference
        'invalid-uri', // Invalid URI format
      ],
    });

    // Get the collection list with reading lists lookup, using skip and limit
    const filterStr =
      'filter[lookup][0][prop]=readingLists&' +
      'filter[lookup][0][scope][skip]=0&' +
      'filter[lookup][0][scope][limit]=3';
    const response = await client.get('/lists').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(2);

    // Find the collection list in the response
    const list = response.body.find((l: List) => l._name === 'My Collections');
    expect(list).to.not.be.undefined();
    expect(list._kind).to.equal('collection');

    // Verify the reading lists array is resolved with only valid references
    expect(list.readingLists).to.be.Array().and.have.length(1);

    // Verify only the valid reading list reference is resolved
    const readingList = list.readingLists[0];
    expect(readingList).to.be.an.Object();
    expect(readingList._id).to.equal(readingListId);
    expect(readingList._name).to.equal('Valid Reading List');
    expect(readingList._kind).to.equal('reading');
    expect(readingList.description).to.equal('A valid reading list');
  });

  it('entity-lookup: resolves entity references through lookup', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create a book entity
    const bookId = await createTestEntity(client, {
      _name: 'The Great Book',
      _kind: 'book',
      description: 'A great book',
    });

    // Create a reading list that references the book
    await createTestList({
      _name: 'My Reading List',
      _kind: 'reading',
      book: `tapp://localhost/entities/${bookId}`,
      description: 'A list for The Great Book',
    });

    // Get the list with book lookup
    const filterStr = 'filter[lookup][0][prop]=book';
    const response = await client.get('/lists').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);

    // Find the list in the response
    const list = response.body[0];
    expect(list._name).to.equal('My Reading List');

    // Verify the book reference is resolved
    expect(list.book).to.be.an.Object();
    expect(list.book._id).to.equal(bookId);
    expect(list.book._name).to.equal('The Great Book');
    expect(list.book._kind).to.equal('book');
    expect(list.book.description).to.equal('A great book');
  });

  it('entity-lookup: resolves lookups from nested property paths', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create a book entity
    const bookId = await createTestEntity(client, {
      _name: 'The Great Book',
      _kind: 'book',
      description: 'A great book',
    });

    // Create a reading list that references the book in a nested property
    await createTestList({
      _name: 'My Reading List',
      _kind: 'reading',
      metadata: {
        references: {
          book: `tapp://localhost/entities/${bookId}`,
        },
      },
      description: 'A list for The Great Book',
    });

    // Get the list with nested book lookup
    const filterStr = 'filter[lookup][0][prop]=metadata.references.book';
    const response = await client.get('/lists').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);

    // Find the list in the response
    const list = response.body[0];
    expect(list._name).to.equal('My Reading List');

    // Verify the nested book reference is resolved
    expect(list.metadata.references.book).to.be.an.Object();
    expect(list.metadata.references.book._id).to.equal(bookId);
    expect(list.metadata.references.book._name).to.equal('The Great Book');
    expect(list.metadata.references.book._kind).to.equal('book');
    expect(list.metadata.references.book.description).to.equal('A great book');
  });

  it('entity-lookup: resolves multiple lookups including nested entity references', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
      entity_kinds: 'book, author',
    });
    ({ client } = appWithClient);

    // Create an author entity
    const authorId = await createTestEntity(client, {
      _name: 'John Doe',
      _kind: 'author',
      biography: 'Famous author',
    });

    // Create a book entity that references the author
    const bookId = await createTestEntity(client, {
      _name: 'The Great Book',
      _kind: 'book',
      description: 'A great book',
      author: `tapp://localhost/entities/${authorId}`,
    });

    // Create a reading list that references the book
    await createTestList({
      _name: 'My Reading List',
      _kind: 'reading',
      book: `tapp://localhost/entities/${bookId}`,
      description: 'A list for The Great Book',
    });

    // Get the list with nested lookups for both book and author
    const filterStr =
      'filter[lookup][0][prop]=book&' +
      'filter[lookup][0][scope][lookup][0][prop]=author';
    const response = await client.get('/lists').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);

    // Find the list in the response
    const list = response.body[0];
    expect(list._name).to.equal('My Reading List');

    // Verify the book reference is resolved
    expect(list.book).to.be.an.Object();
    expect(list.book._id).to.equal(bookId);
    expect(list.book._name).to.equal('The Great Book');
    expect(list.book._kind).to.equal('book');
    expect(list.book.description).to.equal('A great book');

    // Verify the nested author reference is resolved
    expect(list.book.author).to.be.an.Object();
    expect(list.book.author._id).to.equal(authorId);
    expect(list.book.author._name).to.equal('John Doe');
    expect(list.book.author._kind).to.equal('author');
    expect(list.book.author.biography).to.equal('Famous author');
  });

  it('entity-lookup: selects specific fields from looked-up entities using scope', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create a book entity with multiple fields
    const bookId = await createTestEntity(client, {
      _name: 'The Great Book',
      _kind: 'book',
      description: 'A great book',
      author: 'John Doe',
      publisher: 'Great Books Inc',
      isbn: '123-456-789',
    });

    // Create a reading list that references the book
    await createTestList({
      _name: 'My Reading List',
      _kind: 'reading',
      book: `tapp://localhost/entities/${bookId}`,
      description: 'A list for The Great Book',
    });

    // Get the list with book lookup, selecting only name and description fields
    const filterStr =
      'filter[lookup][0][prop]=book&' +
      'filter[lookup][0][scope][fields][_name]=true&' +
      'filter[lookup][0][scope][fields][description]=true';
    const response = await client.get('/lists').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);

    // Find the list in the response
    const list = response.body[0];
    expect(list._name).to.equal('My Reading List');

    // Verify the book reference is resolved with only selected fields
    expect(list.book).to.be.an.Object();
    expect(list.book._name).to.equal('The Great Book');
    expect(list.book.description).to.equal('A great book');

    // Verify other fields are not included
    expect(list.book).to.not.have.property('_id');
    expect(list.book).to.not.have.property('_kind');
    expect(list.book).to.not.have.property('author');
    expect(list.book).to.not.have.property('publisher');
    expect(list.book).to.not.have.property('isbn');
  });

  it('entity-lookup: resolves lookups from array properties containing entity references', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create multiple book entities
    const book1Id = await createTestEntity(client, {
      _name: 'Book One',
      _kind: 'book',
      description: 'First book',
    });

    const book2Id = await createTestEntity(client, {
      _name: 'Book Two',
      _kind: 'book',
      description: 'Second book',
    });

    // Create a reading list with array of book references
    await createTestList({
      _name: 'My Reading List',
      _kind: 'reading',
      books: [
        `tapp://localhost/entities/${book1Id}`,
        `tapp://localhost/entities/${book2Id}`,
      ],
      description: 'A list with multiple books',
    });

    // Get the list with books lookup, using skip and limit in scope
    const filterStr =
      'filter[lookup][0][prop]=books&' +
      'filter[lookup][0][scope][skip]=1&' +
      'filter[lookup][0][scope][limit]=2&' +
      'filter[lookup][0][scope][order][0]=_name ASC';
    const response = await client.get('/lists').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);

    // Find the list in the response
    const list = response.body[0];
    expect(list._name).to.equal('My Reading List');

    // Verify the books array is resolved with skip and limit applied
    expect(list.books).to.be.Array().and.have.length(1);

    // Verify first book (should be Book Two, as Book One was skipped)
    const book = list.books[0];
    expect(book).to.be.an.Object();
    expect(book._id).to.equal(book2Id);
    expect(book._name).to.equal('Book Two');
    expect(book._kind).to.equal('book');
    expect(book.description).to.equal('Second book');
  });

  it('entity-lookup: applies skip and limit in scope when looking up array references', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create multiple book entities
    const book1Id = await createTestEntity(client, {
      _name: 'Book One',
      _kind: 'book',
      description: 'First book',
    });

    const book2Id = await createTestEntity(client, {
      _name: 'Book Two',
      _kind: 'book',
      description: 'Second book',
    });

    const book3Id = await createTestEntity(client, {
      _name: 'Book Three',
      _kind: 'book',
      description: 'Third book',
    });

    // Create a reading list with array of book references
    await createTestList({
      _name: 'My Reading List',
      _kind: 'reading',
      books: [
        `tapp://localhost/entities/${book1Id}`,
        `tapp://localhost/entities/${book2Id}`,
        `tapp://localhost/entities/${book3Id}`,
      ],
      description: 'A list with multiple books',
    });

    // Get the list with books lookup, using skip and limit in scope
    const filterStr =
      'filter[lookup][0][prop]=books&' +
      'filter[lookup][0][scope][skip]=1&' +
      'filter[lookup][0][scope][limit]=1&' +
      'filter[lookup][0][scope][order][0]=_name ASC';
    const response = await client.get('/lists').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);

    // Find the list in the response
    const list = response.body[0];
    expect(list._name).to.equal('My Reading List');

    // Verify the books array is resolved with skip and limit applied
    expect(list.books).to.be.Array().and.have.length(1);

    // Verify we get Book Three (after skipping Book One and omitting Book Two due to limit)
    const book = list.books[0];
    expect(book).to.be.an.Object();
    expect(book._name).to.equal('Book Three'); // Should be "Book Three" as "Book One" is skipped and "Book Two" comes last
    expect(book._id).to.equal(book3Id);
    expect(book._kind).to.equal('book');
    expect(book.description).to.equal('Third book');

    // Get the list with different skip and limit values
    const secondFilterStr =
      'filter[lookup][0][prop]=books&' +
      'filter[lookup][0][scope][skip]=2&' +
      'filter[lookup][0][scope][limit]=2&' +
      'filter[lookup][0][scope][order][0]=_name ASC';
    const secondResponse = await client
      .get('/lists')
      .query(secondFilterStr)
      .expect(200);

    const secondList = secondResponse.body[0];
    expect(secondList.books).to.be.Array().and.have.length(1);

    // Verify the third book (after skipping Book One and Book Three, due to name sorting and skip=2)
    const thirdBook = secondList.books[0];
    expect(thirdBook).to.be.an.Object();
    expect(thirdBook._name).to.equal('Book Two'); // Should be "Book Two" as it comes last in alphabetical order
    expect(thirdBook._id).to.equal(book2Id);
    expect(thirdBook._kind).to.equal('book');
    expect(thirdBook.description).to.equal('Second book');
  });

  it('entity-lookup: handles invalid references and not-found entities with skip and limit', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create a book entity
    const bookId = await createTestEntity(client, {
      _name: 'The Great Book',
      _kind: 'book',
      description: 'A great book',
    });

    // Create a reading list with valid and invalid book references
    await createTestList({
      _name: 'My Reading List',
      _kind: 'reading',
      books: [
        `tapp://localhost/entities/${bookId}`, // Valid reference
        'tapp://localhost/entities/invalid-id', // Invalid reference
        'invalid-uri', // Invalid URI format
      ],
      description: 'A list with mixed references',
    });

    // Get the list with books lookup, using skip and limit
    const filterStr =
      'filter[lookup][0][prop]=books&' +
      'filter[lookup][0][scope][skip]=0&' +
      'filter[lookup][0][scope][limit]=3';
    const response = await client.get('/lists').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);

    // Find the list in the response
    const list = response.body[0];
    expect(list._name).to.equal('My Reading List');

    // Verify the books array is resolved with only valid references
    expect(list.books).to.be.Array().and.have.length(1);

    // Verify only the valid book reference is resolved
    const book = list.books[0];
    expect(book).to.be.an.Object();
    expect(book._id).to.equal(bookId);
    expect(book._name).to.equal('The Great Book');
    expect(book._kind).to.equal('book');
    expect(book.description).to.equal('A great book');
  });

  it('entity-lookup: handles not-found lists with skip and limit', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create a reading list that references non-existent books
    await createTestList({
      _name: 'My Reading List',
      _kind: 'reading',
      books: [
        'tapp://localhost/entities/00000000-0000-0000-0000-000000000000', // Not found book 1
        'tapp://localhost/entities/11111111-1111-1111-1111-111111111111', // Not found book 2
        'tapp://localhost/entities/22222222-2222-2222-2222-222222222222', // Not found book 3
      ],
      description: 'A list with missing books',
    });

    // Get the list with books lookup, using skip and limit in scope
    const filterStr =
      'filter[lookup][0][prop]=books&' +
      'filter[lookup][0][scope][skip]=1&' +
      'filter[lookup][0][scope][limit]=1';
    const response = await client.get('/lists').query(filterStr).expect(200);

    expect(response.body).to.be.Array().and.have.length(1);

    // Find the list in the response
    const list = response.body[0];
    expect(list._name).to.equal('My Reading List');

    // Verify the books array is empty since all references were not found
    expect(list.books).to.be.Array().and.have.length(0);
  });
});
