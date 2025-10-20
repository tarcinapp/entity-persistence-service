import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { ListReaction } from '../../../models';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestList,
  createTestListReaction,
  cleanupCreatedLists,
  cleanupCreatedListReactions,
} from '../test-helper';

describe('GET /list-reactions', () => {
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
      // Clean up created list reactions and lists
      await cleanupCreatedListReactions(client);
      await cleanupCreatedLists(client);

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
  it('basic: returns all list reactions when no filter is applied', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create test lists first
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

    // Create test list reactions
    await createTestListReaction(client, {
      _name: 'Reaction 1',
      _listId: list1Id,
      _kind: 'like',
    });

    await createTestListReaction(client, {
      _name: 'Reaction 2',
      _listId: list2Id,
      _kind: 'comment',
    });

    // Get all list reactions
    const response = await client.get('/list-reactions').expect(200);

    expect(response.body).to.be.Array().and.have.length(2);
    expect(response.body.map((e: ListReaction) => e._name)).to.containDeep([
      'Reaction 1',
      'Reaction 2',
    ]);
  });

  // Filter Tests
  it('filter: by kind', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create test lists first
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

    // Create test list reactions
    await createTestListReaction(client, {
      _name: 'Like Reaction',
      _listId: list1Id,
      _kind: 'like',
    });

    await createTestListReaction(client, {
      _name: 'Comment Reaction',
      _listId: list2Id,
      _kind: 'comment',
    });

    // Get only like reactions
    const response = await client
      .get('/list-reactions')
      .query({ filter: { where: { _kind: 'like' } } })
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Like Reaction');
    expect(response.body[0]._kind).to.equal('like');
    expect(response.body[0]._listId).to.equal(list1Id);
  });

  it('filter: by listId', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create test lists first
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

    // Create test list reactions
    await createTestListReaction(client, {
      _name: 'Reaction for List 1',
      _listId: list1Id,
      _kind: 'like',
    });

    await createTestListReaction(client, {
      _name: 'Reaction for List 2',
      _listId: list2Id,
      _kind: 'like',
    });

    // Get reactions for specific list
    const response = await client
      .get('/list-reactions')
      .query({ filter: { where: { _listId: list1Id } } })
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Reaction for List 1');
    expect(response.body[0]._listId).to.equal(list1Id);
  });

  it('filter: with complex filter', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);

    // Create test lists first
    const list1Id = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
      description: 'First list',
    });

    // Create test reactions with different dates
    await createTestListReaction(client, {
      _name: 'Active Reaction',
      _listId: list1Id,
      _kind: 'like',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    await createTestListReaction(client, {
      _name: 'Inactive Reaction',
      _listId: list1Id,
      _kind: 'like',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });

    // Get only active reactions using complex filter
    const filterStr =
      `filter[where][and][0][or][0][_validUntilDateTime][eq]=null&` +
      `filter[where][and][0][or][1][_validUntilDateTime][gt]=${encodeURIComponent(now.toISOString())}&` +
      `filter[where][and][1][_validFromDateTime][neq]=null&` +
      `filter[where][and][2][_validFromDateTime][lt]=${encodeURIComponent(now.toISOString())}`;

    const response = await client
      .get('/list-reactions')
      .query(filterStr)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Active Reaction');
  });

  it('filter: by visibility', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create test lists first
    const list1Id = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
      description: 'First list',
    });

    // Create public reaction
    await createTestListReaction(client, {
      _name: 'Public Reaction',
      _listId: list1Id,
      _kind: 'like',
      _visibility: 'public',
    });

    // Create private reaction
    await createTestListReaction(client, {
      _name: 'Private Reaction',
      _listId: list1Id,
      _kind: 'like',
      _visibility: 'private',
    });

    // Get only public reactions
    const response = await client
      .get('/list-reactions')
      .query({ filter: { where: { _visibility: 'public' } } })
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Public Reaction');
    expect(response.body[0]._visibility).to.equal('public');
  });

  it('filter: by validFromDateTime', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);

    // Create test lists first
    const list1Id = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
      description: 'First list',
    });

    // Create reaction with past validFromDateTime
    await createTestListReaction(client, {
      _name: 'Past Reaction',
      _listId: list1Id,
      _kind: 'like',
      _validFromDateTime: pastDate.toISOString(),
    });

    // Create reaction with future validFromDateTime
    await createTestListReaction(client, {
      _name: 'Future Reaction',
      _listId: list1Id,
      _kind: 'like',
      _validFromDateTime: futureDate.toISOString(),
    });

    // Get reactions with validFromDateTime in the past
    const filterStr = `filter[where][_validFromDateTime][lt]=${encodeURIComponent(now.toISOString())}`;
    const response = await client
      .get('/list-reactions')
      .query(filterStr)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Past Reaction');
    expect(response.body[0]._validFromDateTime).to.equal(
      pastDate.toISOString(),
    );
  });

  it('filter: by arbitrary date field (createdAt)', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    // Create test lists first
    const list1Id = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
      description: 'First list',
    });

    // Create reaction with past createdAt
    await createTestListReaction(client, {
      _name: 'Old Reaction',
      _listId: list1Id,
      _kind: 'like',
      createdAt: lastMonth.toISOString(),
    });

    // Create reaction with future createdAt
    await createTestListReaction(client, {
      _name: 'New Reaction',
      _listId: list1Id,
      _kind: 'like',
      createdAt: nextMonth.toISOString(),
    });

    // Create reaction with no createdAt
    await createTestListReaction(client, {
      _name: 'No Date Reaction',
      _listId: list1Id,
      _kind: 'like',
    });

    // Get reactions created before now
    const filterStr = `filter[where][and][0][createdAt][lt]=${encodeURIComponent(now.toISOString())}&filter[where][and][1][createdAt][neq]=null`;
    const response = await client
      .get('/list-reactions')
      .query(filterStr)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Old Reaction');
    expect(response.body[0].createdAt).to.equal(lastMonth.toISOString());
  });

  it('filter: by arbitrary number fields (score and weight)', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create test lists first
    const list1Id = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
      description: 'First list',
    });

    // Create reactions with different scores and weights
    await createTestListReaction(client, {
      _name: 'Low Score Light Reaction',
      _listId: list1Id,
      _kind: 'like',
      score: 2,
      weight: 1.5,
    });

    await createTestListReaction(client, {
      _name: 'High Score Heavy Reaction',
      _listId: list1Id,
      _kind: 'like',
      score: 8,
      weight: 4.5,
    });

    await createTestListReaction(client, {
      _name: 'Medium Score Medium Reaction',
      _listId: list1Id,
      _kind: 'like',
      score: 5,
      weight: 2.5,
    });

    // Get reactions with score > 4 and weight < 3.0
    const filterStr =
      `filter[where][score][gt]=4&` +
      `filter[where][score][type]=number&` +
      `filter[where][weight][lt]=3.0&` +
      `filter[where][weight][type]=number`;

    const response = await client
      .get('/list-reactions')
      .query(filterStr)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Medium Score Medium Reaction');
    expect(response.body[0].score).to.equal(5);
    expect(response.body[0].weight).to.equal(2.5);
  });

  it('filter: by owner', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    const owner1 = 'user-123';
    const owner2 = 'user-456';

    // Create test lists first
    const list1Id = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
      description: 'First list',
    });

    // Create reaction with owner1
    await createTestListReaction(client, {
      _name: 'Owner1 Reaction',
      _listId: list1Id,
      _kind: 'like',
      _ownerUsers: [owner1],
    });

    // Create reaction with owner2
    await createTestListReaction(client, {
      _name: 'Owner2 Reaction',
      _listId: list1Id,
      _kind: 'like',
      _ownerUsers: [owner2],
    });

    // Get reactions for owner1
    const filterStr = `filter[where][_ownerUsers][inq][]=${owner1}`;
    const response = await client
      .get('/list-reactions')
      .query(filterStr)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Owner1 Reaction');
    expect(response.body[0]._ownerUsers).to.containDeep([owner1]);
  });

  it('filter: by nested fields using dot notation', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create test lists first
    const list1Id = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
      description: 'First list',
    });

    // Create reaction with nested fields
    await createTestListReaction(client, {
      _name: 'Nested Fields Reaction',
      _listId: list1Id,
      _kind: 'like',
      metadata: {
        details: {
          source: 'web',
          browser: {
            name: 'Chrome',
            version: '91.0',
          },
        },
        stats: {
          views: 100,
          shares: 50,
        },
      },
    });

    // Get reactions with specific nested field values
    const filterStr = 'filter[where][metadata.details.browser.name]=Chrome';
    const response = await client
      .get('/list-reactions')
      .query(filterStr)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Nested Fields Reaction');
    expect(response.body[0].metadata.details.browser.name).to.equal('Chrome');
  });

  // Pagination Tests
  it('pagination: applies response limit configuration', async () => {
    // Set up the application with response limit configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
      response_limit_list_reaction: '2', // Limit response to 2 items
    });
    ({ client } = appWithClient);

    // Create test lists first
    const list1Id = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
    });

    // Create 3 reactions
    await createTestListReaction(client, {
      _name: 'Reaction 1',
      _listId: list1Id,
      _kind: 'like',
    });

    await createTestListReaction(client, {
      _name: 'Reaction 2',
      _listId: list1Id,
      _kind: 'like',
    });

    await createTestListReaction(client, {
      _name: 'Reaction 3',
      _listId: list1Id,
      _kind: 'like',
    });

    // Get reactions with limit
    const response = await client.get('/list-reactions').expect(200);

    expect(response.body).to.be.Array().and.have.length(2);
  });

  it('pagination: supports pagination', async () => {
    // Set up the application
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create test lists first
    const list1Id = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
    });

    // Create test reactions
    await createTestListReaction(client, {
      _name: 'Reaction 1',
      _listId: list1Id,
      _kind: 'like',
    });

    await createTestListReaction(client, {
      _name: 'Reaction 2',
      _listId: list1Id,
      _kind: 'like',
    });

    await createTestListReaction(client, {
      _name: 'Reaction 3',
      _listId: list1Id,
      _kind: 'like',
    });

    // Get first page
    const firstPage = await client
      .get('/list-reactions')
      .query({ filter: { limit: 2, skip: 0 } })
      .expect(200);

    expect(firstPage.body).to.be.Array().and.have.length(2);

    // Get second page
    const secondPage = await client
      .get('/list-reactions')
      .query({ filter: { limit: 2, skip: 2 } })
      .expect(200);

    expect(secondPage.body).to.be.Array().and.have.length(1);
  });

  it('pagination: supports sorting', async () => {
    // Set up the application
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create test lists first
    const list1Id = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
    });

    // Create test reactions
    await createTestListReaction(client, {
      _name: 'Reaction C',
      _listId: list1Id,
      _kind: 'like',
    });

    await createTestListReaction(client, {
      _name: 'Reaction A',
      _listId: list1Id,
      _kind: 'like',
    });

    await createTestListReaction(client, {
      _name: 'Reaction B',
      _listId: list1Id,
      _kind: 'like',
    });

    // Get reactions sorted by name
    const response = await client
      .get('/list-reactions')
      .query({ filter: { order: ['_name ASC'] } })
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(3);
    expect(response.body.map((e: ListReaction) => e._name)).to.eql([
      'Reaction A',
      'Reaction B',
      'Reaction C',
    ]);
  });

  // Set Filter Tests
  it('set-filter: supports set filters via query parameters', async () => {
    // Set up the application
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);

    // Create test lists first
    const list1Id = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
    });

    // Create active reaction
    await createTestListReaction(client, {
      _name: 'Active Reaction',
      _listId: list1Id,
      _kind: 'like',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create inactive reaction
    await createTestListReaction(client, {
      _name: 'Inactive Reaction',
      _listId: list1Id,
      _kind: 'like',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });

    // Get active reactions using set filter directly
    const response = await client
      .get('/list-reactions')
      .query({ set: { actives: true } })
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Active Reaction');

    // Get active and public reactions using multiple set filters
    const multiSetResponse = await client
      .get('/list-reactions')
      .query({
        set: {
          actives: true,
          publics: true,
        },
      })
      .expect(200);

    expect(multiSetResponse.body).to.be.Array();
  });

  it('set-filter: filters reactions by audience', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
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

    // Create test lists first
    const list1Id = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
    });

    // Create reaction with owner
    await createTestListReaction(client, {
      _name: 'Owner Reaction',
      _listId: list1Id,
      _kind: 'like',
      _ownerUsers: [owner],
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create reaction with viewer
    await createTestListReaction(client, {
      _name: 'Viewer Reaction',
      _listId: list1Id,
      _kind: 'like',
      _viewerUsers: [viewer],
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create reaction with neither owner nor viewer
    await createTestListReaction(client, {
      _name: 'Other Reaction',
      _listId: list1Id,
      _kind: 'like',
    });

    // Get reactions for owner using set[audience]
    const ownerFilterStr = `set[audience][userIds]=${owner}`;
    const ownerResponse = await client
      .get('/list-reactions')
      .query(ownerFilterStr)
      .expect(200);

    expect(ownerResponse.body).to.be.Array().and.have.length(1);
    expect(ownerResponse.body[0]._name).to.equal('Owner Reaction');
    expect(ownerResponse.body[0]._ownerUsers).to.containDeep([owner]);

    // Get reactions for viewer using set[audience]
    const viewerFilterStr = `set[audience][userIds]=${viewer}`;
    const viewerResponse = await client
      .get('/list-reactions')
      .query(viewerFilterStr)
      .expect(200);

    expect(viewerResponse.body).to.be.Array().and.have.length(1);
    expect(viewerResponse.body[0]._name).to.equal('Viewer Reaction');
    expect(viewerResponse.body[0]._viewerUsers).to.containDeep([viewer]);

    // Get reactions for user with no access
    const otherFilterStr = `set[audience][userIds]=${otherUser}`;
    const otherResponse = await client
      .get('/list-reactions')
      .query(otherFilterStr)
      .expect(200);

    expect(otherResponse.body).to.be.Array().and.have.length(0);
  });

  it('set-filter: filters active reactions', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 7);

    // Create test lists first
    const list1Id = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
    });

    // Create active reaction
    await createTestListReaction(client, {
      _name: 'Active Reaction',
      _listId: list1Id,
      _kind: 'like',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create inactive reaction (expired)
    await createTestListReaction(client, {
      _name: 'Inactive Reaction',
      _listId: list1Id,
      _kind: 'like',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });

    // Create inactive reaction (not started)
    await createTestListReaction(client, {
      _name: 'Future Reaction',
      _listId: list1Id,
      _kind: 'like',
      _validFromDateTime: futureDate.toISOString(),
      _validUntilDateTime: null,
    });

    // Get active reactions using set[actives]
    const filterStr = 'set[actives]=true';
    const response = await client
      .get('/list-reactions')
      .query(filterStr)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Active Reaction');
  });

  it('set-filter: filters public reactions', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create test lists first
    const list1Id = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
    });

    // Create public reaction
    await createTestListReaction(client, {
      _name: 'Public Reaction',
      _listId: list1Id,
      _kind: 'like',
      _visibility: 'public',
    });

    // Create protected reaction
    await createTestListReaction(client, {
      _name: 'Protected Reaction',
      _listId: list1Id,
      _kind: 'like',
      _visibility: 'protected',
    });

    // Create private reaction
    await createTestListReaction(client, {
      _name: 'Private Reaction',
      _listId: list1Id,
      _kind: 'like',
      _visibility: 'private',
    });

    // Get public reactions using set[publics]
    const filterStr = 'set[publics]=true';
    const response = await client
      .get('/list-reactions')
      .query(filterStr)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Public Reaction');
    expect(response.body[0]._visibility).to.equal('public');
  });

  it('set-filter: combines multiple sets with AND operator', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 7);

    // Create test lists first
    const list1Id = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
    });

    // Create active and public reaction
    await createTestListReaction(client, {
      _name: 'Active Public Reaction',
      _listId: list1Id,
      _kind: 'like',
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create active but private reaction
    await createTestListReaction(client, {
      _name: 'Active Private Reaction',
      _listId: list1Id,
      _kind: 'like',
      _visibility: 'private',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create inactive but public reaction
    await createTestListReaction(client, {
      _name: 'Inactive Public Reaction',
      _listId: list1Id,
      _kind: 'like',
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });

    // Get reactions that are both active AND public using set[and]
    const filterStr = 'set[and][0][actives]=true&set[and][1][publics]=true';
    const response = await client
      .get('/list-reactions')
      .query(filterStr)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Active Public Reaction');
    expect(response.body[0]._visibility).to.equal('public');
    expect(response.body[0]._validUntilDateTime).to.equal(
      futureDate.toISOString(),
    );
  });

  it('set-filter: combines set filters with regular filters', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    const now = new Date();
  // Use explicit, unambiguous offsets to avoid month-length edge cases.
  const oldDate = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000); // 40 days ago
  const recentDate = new Date(now.getTime() - 3 * 60 * 60 * 1000); // 3 hours ago
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Create test lists first
    const list1Id = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
    });

    // Create an old inactive positive reaction (previous month)
    await createTestListReaction(client, {
      _name: 'Old Inactive Positive Reaction',
      _listId: list1Id,
      _kind: 'like',
      sentiment: 'positive',
  _createdDateTime: oldDate.toISOString(),
  _validFromDateTime: oldDate.toISOString(),
  _validUntilDateTime: oldDate.toISOString(),
    });

    // Create a recent inactive positive reaction (this month, and expired)
    await createTestListReaction(client, {
      _name: 'Recent Inactive Positive Reaction',
      _listId: list1Id,
      _kind: 'like',
      sentiment: 'positive',
  _createdDateTime: recentDate.toISOString(),
  _validFromDateTime: recentDate.toISOString(),
      _validUntilDateTime: oneHourAgo.toISOString(),
    });

    // Create a recent inactive negative reaction (this month)
    await createTestListReaction(client, {
      _name: 'Recent Inactive Negative Reaction',
      _listId: list1Id,
      _kind: 'dislike',
      sentiment: 'negative',
  _createdDateTime: twoDaysAgo.toISOString(),
  _validFromDateTime: twoDaysAgo.toISOString(),
      _validUntilDateTime: oneHourAgo.toISOString(),
    });

    // Get inactive reactions created within the last 30 days that have 'positive' sentiment
    const filterStr =
  'set[and][0][expireds]=true&set[and][1][createds-30d]=true&filter[where][sentiment]=positive';
    const response = await client
      .get('/list-reactions')
      .query(filterStr)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal(
      'Recent Inactive Positive Reaction',
    );
    expect(response.body[0].sentiment).to.equal('positive');

    // Verify it was created within the last 30 days
  const createdDate = new Date(response.body[0]._createdDateTime);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    expect(createdDate.getTime()).to.be.greaterThan(thirtyDaysAgo.getTime());

    // Verify it is inactive (validUntilDateTime is in the past)
    expect(
      new Date(response.body[0]._validUntilDateTime).getTime(),
    ).to.be.lessThan(now.getTime());
  });

  it('set-filter: filters inactive reactions', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const olderPastDate = new Date(now);
    olderPastDate.setDate(olderPastDate.getDate() - 2);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 7);

    // Create test lists first
    const list1Id = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
    });

    // Create an inactive reaction (expired yesterday)
    await createTestListReaction(client, {
      _name: 'Recently Expired Reaction',
      _listId: list1Id,
      _kind: 'like',
      _validFromDateTime: olderPastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });

    // Create another inactive reaction (expired 2 days ago)
    await createTestListReaction(client, {
      _name: 'Old Expired Reaction',
      _listId: list1Id,
      _kind: 'like',
      _validFromDateTime: olderPastDate.toISOString(),
      _validUntilDateTime: olderPastDate.toISOString(),
    });

    // Create an active reaction with future expiration
    await createTestListReaction(client, {
      _name: 'Active Reaction',
      _listId: list1Id,
      _kind: 'like',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });

    // Create an active reaction with no expiration
    await createTestListReaction(client, {
      _name: 'Indefinite Reaction',
      _listId: list1Id,
      _kind: 'like',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: null,
    });

  // Get inactive reactions using set[expireds]
  const filterStr = 'set[expireds]=true';
    const response = await client
      .get('/list-reactions')
      .query(filterStr)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(2);

    // Sort the results by name for consistent testing
    const sortedResults = response.body.sort((a: any, b: any) =>
      a._name.localeCompare(b._name),
    );

    // Check first reaction (Old Expired Reaction)
    expect(sortedResults[0]._name).to.equal('Old Expired Reaction');
    expect(
      new Date(sortedResults[0]._validUntilDateTime).getTime(),
    ).to.be.lessThanOrEqual(now.getTime());

    // Check second reaction (Recently Expired Reaction)
    expect(sortedResults[1]._name).to.equal('Recently Expired Reaction');
    expect(
      new Date(sortedResults[1]._validUntilDateTime).getTime(),
    ).to.be.lessThanOrEqual(now.getTime());
  });

  // Field Selection Tests
  it('field-selection: returns only selected fields', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create test lists first
    const list1Id = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
    });

    // Create test list reaction with various fields
    await createTestListReaction(client, {
      _name: 'Test Reaction',
      _listId: list1Id,
      _kind: 'like',
      _visibility: 'public',
      _validFromDateTime: new Date().toISOString(),
      _validUntilDateTime: null,
      sentiment: 'positive',
      score: 5,
      metadata: {
        source: 'web',
        details: {
          browser: 'Chrome',
        },
      },
    });

    // Request only specific fields
    const filterStr =
      'filter[fields][_name]=true&filter[fields][_kind]=true&filter[fields][sentiment]=true';
    const response = await client
      .get('/list-reactions')
      .query(filterStr)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);

    // Verify only requested fields are present
    const reaction = response.body[0];
    expect(reaction).to.have.properties(['_name', '_kind', 'sentiment']);
    expect(reaction).to.not.have.properties([
      '_listId',
      '_visibility',
      '_validFromDateTime',
      '_validUntilDateTime',
      'score',
      'metadata',
    ]);

    // Verify the values of the returned fields
    expect(reaction._name).to.equal('Test Reaction');
    expect(reaction._kind).to.equal('like');
    expect(reaction.sentiment).to.equal('positive');
  });

  it('field-selection: excludes specified fields from response', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create test lists first
    const list1Id = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
    });

    // Create test list reaction with various fields
    await createTestListReaction(client, {
      _name: 'Test Reaction',
      _listId: list1Id,
      _kind: 'like',
      _visibility: 'public',
      _validFromDateTime: new Date().toISOString(),
      _validUntilDateTime: null,
      sentiment: 'positive',
      score: 5,
      metadata: {
        source: 'web',
        details: {
          browser: 'Chrome',
        },
      },
    });

    // Request all fields except specified ones
    const filterStr =
      'filter[fields][_name]=false&filter[fields][_kind]=false&filter[fields][sentiment]=false';
    const response = await client
      .get('/list-reactions')
      .query(filterStr)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);

    // Verify excluded fields are not present
    const reaction = response.body[0];
    expect(reaction).to.not.have.properties(['_name', '_kind', 'sentiment']);

    // Verify other fields are present
    expect(reaction).to.have.properties([
      '_listId',
      '_visibility',
      '_validFromDateTime',
      '_validUntilDateTime',
    ]);

    // Verify the values of some remaining fields
    expect(reaction._listId).to.equal(list1Id);
    expect(reaction._visibility).to.equal('public');
  });

  // Continue with lookup tests...
  it('lookup: resolves list-reactions references through lookup', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create a test list
    const listId = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
    });

    // Create a parent list-reaction
    const parentReactionId = await createTestListReaction(client, {
      _name: 'Parent Reaction',
      _listId: listId,
      _kind: 'like',
      sentiment: 'positive',
    });

    // Create a child list-reaction that references the parent via an arbitrary property
    await createTestListReaction(client, {
      _name: 'Child Reaction',
      _listId: listId,
      _kind: 'like',
      relatedReaction: `tapp://localhost/list-reactions/${parentReactionId}`,
      sentiment: 'positive',
    });

    // Get the reactions with lookup on relatedReaction
    const filterStr = 'filter[lookup][0][prop]=relatedReaction';
    const response = await client
      .get('/list-reactions')
      .query(filterStr)
      .expect(200);

    // Should return both reactions
    expect(response.body).to.be.Array().and.have.length(2);

    // Find the child reaction in the response
    const child = response.body.find((r: ListReaction) => r._name === 'Child Reaction');
    expect(child).to.not.be.undefined();
    expect(child.relatedReaction).to.be.an.Object();
    expect(child.relatedReaction._id).to.equal(parentReactionId);
    expect(child.relatedReaction._name).to.equal('Parent Reaction');
    expect(child.relatedReaction._kind).to.equal('like');
    expect(child.relatedReaction.sentiment).to.equal('positive');
  });

  it('lookup: resolves multiple lookups including nested property references', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
    });
    ({ client } = appWithClient);

    // Create a test list
    const listId = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
    });

    // Create a "grandparent" list-reaction
    const grandparentId = await createTestListReaction(client, {
      _name: 'Grandparent Reaction',
      _listId: listId,
      _kind: 'like',
      sentiment: 'positive',
    });

    // Create a "parent" list-reaction that references the grandparent
    const parentId = await createTestListReaction(client, {
      _name: 'Parent Reaction',
      _listId: listId,
      _kind: 'like',
      sentiment: 'positive',
      relatedReaction: `tapp://localhost/list-reactions/${grandparentId}`,
    });

    // Create a "child" list-reaction that references the parent
    await createTestListReaction(client, {
      _name: 'Child Reaction',
      _listId: listId,
      _kind: 'like',
      nested: {
        parent: `tapp://localhost/list-reactions/${parentId}`,
      },
      sentiment: 'positive',
    });

    // Get the reactions with lookup on nested.parent and nested lookup on relatedReaction
    const filterStr =
      'filter[lookup][0][prop]=nested.parent&' +
      'filter[lookup][0][scope][lookup][0][prop]=relatedReaction';
    const response = await client
      .get('/list-reactions')
      .query(filterStr)
      .expect(200);

    // Should return all three reactions
    expect(response.body).to.be.Array().and.have.length(3);

    // Find the child reaction in the response
    const child = response.body.find((r: ListReaction) => r._name === 'Child Reaction');
    expect(child).to.not.be.undefined();
    expect(child.nested.parent).to.be.an.Object();
    expect(child.nested.parent._id).to.equal(parentId);
    expect(child.nested.parent._name).to.equal('Parent Reaction');
    expect(child.nested.parent.relatedReaction).to.be.an.Object();
    expect(child.nested.parent.relatedReaction._id).to.equal(grandparentId);
    expect(child.nested.parent.relatedReaction._name).to.equal(
      'Grandparent Reaction',
    );
  });

  it('lookup: resolves lookups from nested property paths', async () => {
    appWithClient = await setupApplication({ list_kinds: 'reading-list' });
    ({ client } = appWithClient);
    const listId = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
    });
    const parentId = await createTestListReaction(client, {
      _name: 'Parent Reaction',
      _listId: listId,
      _kind: 'like',
    });
    await createTestListReaction(client, {
      _name: 'Child Reaction',
      _listId: listId,
      _kind: 'like',
      nested: { related: `tapp://localhost/list-reactions/${parentId}` },
    });
    const filterStr = 'filter[lookup][0][prop]=nested.related';
    const response = await client
      .get('/list-reactions')
      .query(filterStr)
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(2);
    const child = response.body.find((r: ListReaction) => r._name === 'Child Reaction');
    expect(child.nested.related).to.be.an.Object();
    expect(child.nested.related._id).to.equal(parentId);
    expect(child.nested.related._name).to.equal('Parent Reaction');
  });

  it('lookup: selects specific fields from looked-up list-reactions using scope', async () => {
    appWithClient = await setupApplication({ list_kinds: 'reading-list' });
    ({ client } = appWithClient);
    const listId = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
    });
    const parentId = await createTestListReaction(client, {
      _name: 'Parent Reaction',
      _listId: listId,
      _kind: 'like',
      sentiment: 'positive',
      score: 10,
      extra: 'should not appear',
    });
    await createTestListReaction(client, {
      _name: 'Child Reaction',
      _listId: listId,
      _kind: 'like',
      relatedReaction: `tapp://localhost/list-reactions/${parentId}`,
    });
    const filterStr =
      'filter[lookup][0][prop]=relatedReaction&' +
      'filter[lookup][0][scope][fields][_name]=true&' +
      'filter[lookup][0][scope][fields][sentiment]=true';
    const response = await client
      .get('/list-reactions')
      .query(filterStr)
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(2);
    const child = response.body.find((r: ListReaction) => r._name === 'Child Reaction');
    expect(child.relatedReaction).to.be.an.Object();
    expect(child.relatedReaction._name).to.equal('Parent Reaction');
    expect(child.relatedReaction.sentiment).to.equal('positive');
    expect(child.relatedReaction).to.not.have.property('score');
    expect(child.relatedReaction).to.not.have.property('extra');
  });

  it('lookup: resolves lookups from array properties containing list-reaction references', async () => {
    appWithClient = await setupApplication({ list_kinds: 'reading-list' });
    ({ client } = appWithClient);
    const listId = await createTestList(client, {
      _name: 'List 1',
      _kind: 'reading-list',
    });
    const parent1Id = await createTestListReaction(client, {
      _name: 'Parent 1',
      _listId: listId,
      _kind: 'like',
    });
    const parent2Id = await createTestListReaction(client, {
      _name: 'Parent 2',
      _listId: listId,
      _kind: 'like',
    });
    await createTestListReaction(client, {
      _name: 'Child Reaction',
      _listId: listId,
      _kind: 'like',
      relatedReactions: [
        `tapp://localhost/list-reactions/${parent1Id}`,
        `tapp://localhost/list-reactions/${parent2Id}`,
      ],
    });
    const filterStr = 'filter[lookup][0][prop]=relatedReactions';
    const response = await client
      .get('/list-reactions')
      .query(filterStr)
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(3);
    const child = response.body.find((r: ListReaction) => r._name === 'Child Reaction');
    expect(child.relatedReactions).to.be.an.Array().and.have.length(2);
    const ids = child.relatedReactions.map((r: any) => r._id);
    expect(ids).to.containEql(parent1Id);
    expect(ids).to.containEql(parent2Id);
  });

  it('lookup: applies skip and limit in scope when looking up array references', async () => {
    appWithClient = await setupApplication({ list_kinds: 'reading-list' });
    ({ client } = appWithClient);
    const listId = await createTestList(client, { _name: 'List 1', _kind: 'reading-list' });
    const ids = [];
    for (let i = 1; i <= 4; i++) {
      ids.push(
        await createTestListReaction(client, {
          _name: `Parent ${i}`,
          _listId: listId,
          _kind: 'like',
        }),
      );
    }

    await createTestListReaction(client, {
      _name: 'Child Reaction',
      _listId: listId,
      _kind: 'like',
      relatedReactions: ids.map((id) => `tapp://localhost/list-reactions/${id}`),
    });
    const filterStr =
      'filter[lookup][0][prop]=relatedReactions&' +
      'filter[lookup][0][scope][skip]=1&' +
      'filter[lookup][0][scope][limit]=2&' +
      'filter[lookup][0][scope][order][0]=_name ASC';
    const response = await client
      .get('/list-reactions')
      .query(filterStr)
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(5);
    const child = response.body.find((r: ListReaction) => r._name === 'Child Reaction');
    expect(child.relatedReactions).to.be.an.Array().and.have.length(2);
    // After ordering by name ASC: Parent 1, Parent 2, Parent 3, Parent 4
    // After skip=1: Parent 2, Parent 3
    expect(child.relatedReactions[0]._name).to.equal('Parent 2');
    expect(child.relatedReactions[1]._name).to.equal('Parent 3');
  });

  it('lookup: handles invalid references and not-found list-reactions with skip and limit', async () => {
    appWithClient = await setupApplication({ list_kinds: 'reading-list' });
    ({ client } = appWithClient);
    const listId = await createTestList(client, { _name: 'List 1', _kind: 'reading-list' });
    const parent1Id = await createTestListReaction(client, { _name: 'Parent 1', _listId: listId, _kind: 'like' });
    const parent2Id = await createTestListReaction(client, { _name: 'Parent 2', _listId: listId, _kind: 'like' });
    await createTestListReaction(client, {
      _name: 'Child Reaction',
      _listId: listId,
      _kind: 'like',
      relatedReactions: [
        'invalid-reference',
        `tapp://localhost/list-reactions/${parent1Id}`,
        'tapp://localhost/list-reactions/invalid-guid',
        `tapp://localhost/list-reactions/${parent2Id}`,
        'tapp://localhost/list-reactions/00000000-0000-0000-0000-000000000000',
      ],
    });
    const filterStr =
      'filter[lookup][0][prop]=relatedReactions&' +
      'filter[lookup][0][scope][skip]=1&' +
      'filter[lookup][0][scope][limit]=2&' +
      'filter[lookup][0][scope][order][0]=_name ASC';
    const response = await client
      .get('/list-reactions')
      .query(filterStr)
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(3);
    const child = response.body.find((r: ListReaction) => r._name === 'Child Reaction');
    expect(child.relatedReactions).to.be.an.Array().and.have.length(1);
    expect(child.relatedReactions[0]._id).to.equal(parent2Id);
    expect(child.relatedReactions[0]._name).to.equal('Parent 2');
  });

  it('lookup: handles not-found list-reactions with skip and limit', async () => {
    appWithClient = await setupApplication({ list_kinds: 'reading-list' });
    ({ client } = appWithClient);
    const listId = await createTestList(client, { _name: 'List 1', _kind: 'reading-list' });
    await createTestListReaction(client, {
      _name: 'Child Reaction',
      _listId: listId,
      _kind: 'like',
      relatedReactions: [
        'tapp://localhost/list-reactions/00000000-0000-0000-0000-000000000000',
        'tapp://localhost/list-reactions/11111111-1111-1111-1111-111111111111',
        'tapp://localhost/list-reactions/22222222-2222-2222-2222-222222222222',
      ],
    });
    const filterStr =
      'filter[lookup][0][prop]=relatedReactions&' +
      'filter[lookup][0][scope][skip]=1&' +
      'filter[lookup][0][scope][limit]=1';
    const response = await client
      .get('/list-reactions')
      .query(filterStr)
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(1);
    const child = response.body.find((r: ListReaction) => r._name === 'Child Reaction');
    expect(child.relatedReactions).to.be.Array().and.have.length(0);
  });
});



































