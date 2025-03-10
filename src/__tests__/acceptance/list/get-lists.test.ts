import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { List } from '../../../models';
import type { AppWithClient } from '../test-helper';
import { setupApplication, teardownApplication } from '../test-helper';

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

  it('returns all lists when no filter is applied', async () => {
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

  it('filters lists by kind', async () => {
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
    expect(response.body[0]._kind).to.equal('reading');
  });

  it('filters active lists with complex filter', async () => {
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

  it('filters lists by visibility', async () => {
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

  it('filters lists by owner', async () => {
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

  it('applies response limit configuration', async () => {
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

  it('supports pagination', async () => {
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

  it('supports sorting', async () => {
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

  it('returns only selected fields', async () => {
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

  it('excludes specified fields from response', async () => {
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
});
