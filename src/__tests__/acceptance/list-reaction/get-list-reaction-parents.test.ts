import { expect } from '@loopback/testlab';
import type { Client } from '@loopback/testlab';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  createTestList,
  createTestListReaction,
  teardownApplication,
} from '../test-helper';

describe('GET /list-reactions/{id}/parents', () => {
  let client: Client;
  let appWithClient: AppWithClient | undefined;

  beforeEach(async () => {
    if (appWithClient) {
      await teardownApplication(appWithClient);
    }

    appWithClient = undefined;
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

  it('basic: returns parent reactions for a given reaction', async () => {
    appWithClient = await setupApplication({ list_kinds: 'reading-list' });
    ({ client } = appWithClient);
    const listId = await createTestList(client, {
      _name: 'Reading List 1',
      _kind: 'reading-list',
    });
    const parentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
    });
    const childId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _parents: [`tapp://localhost/list-reactions/${parentId}`],
    });
    const response = await client
      .get(`/list-reactions/${childId}/parents`)
      .expect(200);
    expect(response.body).to.be.an.Array();
    expect(response.body).to.have.length(1);
    expect(response.body[0]._id).to.equal(parentId);
    expect(response.body[0]._listId).to.equal(listId);
  });

  it('filter: by kind', async () => {
    appWithClient = await setupApplication({ list_kinds: 'reading-list' });
    ({ client } = appWithClient);
    const listId = await createTestList(client, {
      _name: 'Reading List 1',
      _kind: 'reading-list',
    });
    const parentLikeId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
    });
    const parentCommentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'comment',
    });
    const childId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/list-reactions/${parentLikeId}`,
        `tapp://localhost/list-reactions/${parentCommentId}`,
      ],
    });
    const response = await client
      .get(`/list-reactions/${childId}/parents`)
      .query({ filter: { where: { _kind: 'like' } } })
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._kind).to.equal('like');
  });

  it('filter: active reactions with complex filter', async () => {
    appWithClient = await setupApplication({ list_kinds: 'reading-list' });
    ({ client } = appWithClient);
    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);
    const listId = await createTestList(client, {
      _name: 'Reading List 1',
      _kind: 'reading-list',
    });
    const activeParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });
    const inactiveParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });
    const childId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/list-reactions/${activeParentId}`,
        `tapp://localhost/list-reactions/${inactiveParentId}`,
      ],
    });
    const filterStr =
      `filter[where][and][0][or][0][_validUntilDateTime][eq]=null&` +
      `filter[where][and][0][or][1][_validUntilDateTime][gt]=${encodeURIComponent(now.toISOString())}&` +
      `filter[where][and][1][_validFromDateTime][neq]=null&` +
      `filter[where][and][2][_validFromDateTime][lt]=${encodeURIComponent(now.toISOString())}`;
    const response = await client
      .get(`/list-reactions/${childId}/parents`)
      .query(filterStr)
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._id).to.equal(activeParentId);
  });

  it('filter: by visibility', async () => {
    appWithClient = await setupApplication({ list_kinds: 'reading-list' });
    ({ client } = appWithClient);
    const listId = await createTestList(client, {
      _name: 'Reading List 2',
      _kind: 'reading-list',
    });
    const publicParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _visibility: 'public',
    });
    const privateParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _visibility: 'private',
    });
    const childId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/list-reactions/${publicParentId}`,
        `tapp://localhost/list-reactions/${privateParentId}`,
      ],
    });
    const response = await client
      .get(`/list-reactions/${childId}/parents`)
      .query({ filter: { where: { _visibility: 'public' } } })
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._visibility).to.equal('public');
  });

  it('filter: by owner', async () => {
    appWithClient = await setupApplication({ list_kinds: 'reading-list' });
    ({ client } = appWithClient);
    const listId = await createTestList(client, {
      _name: 'Reading List 3',
      _kind: 'reading-list',
    });
    const owner1 = 'user-123';
    const owner2 = 'user-456';
    const parent1Id = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _ownerUsers: [owner1],
    });
    const parent2Id = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _ownerUsers: [owner2],
    });
    const childId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/list-reactions/${parent1Id}`,
        `tapp://localhost/list-reactions/${parent2Id}`,
      ],
    });
    const filterStr = `filter[where][_ownerUsers][inq][]=${owner1}`;
    const response = await client
      .get(`/list-reactions/${childId}/parents`)
      .query(filterStr)
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._ownerUsers).to.containDeep([owner1]);
  });

  it('field-selection: excludes specified fields', async () => {
    appWithClient = await setupApplication({ list_kinds: 'reading-list' });
    ({ client } = appWithClient);
    const listId = await createTestList(client, {
      _name: 'Reading List 4',
      _kind: 'reading-list',
    });
    const parentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _visibility: 'public',
      _ownerUsers: ['user-123'],
      customField: 'custom value',
    });
    const childId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _parents: [`tapp://localhost/list-reactions/${parentId}`],
    });
    const response = await client
      .get(`/list-reactions/${childId}/parents`)
      .query({
        filter: {
          fields: {
            _ownerUsers: false,
            customField: false,
          },
        },
      })
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]).to.have.properties([
      '_id',
      '_kind',
      '_visibility',
    ]);
    expect(response.body[0]).to.not.have.properties([
      '_ownerUsers',
      'customField',
    ]);
  });

  it('filter: by nationality', async () => {
    appWithClient = await setupApplication({ list_kinds: 'reading-list' });
    ({ client } = appWithClient);
    const listId = await createTestList(client, {
      _name: 'Reading List 5',
      _kind: 'reading-list',
    });
    const germanParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      nationality: 'DE',
    });
    const frenchParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      nationality: 'FR',
    });
    const childId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/list-reactions/${germanParentId}`,
        `tapp://localhost/list-reactions/${frenchParentId}`,
      ],
    });
    const response = await client
      .get(`/list-reactions/${childId}/parents`)
      .query({ filter: { where: { nationality: 'DE' } } })
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0].nationality).to.equal('DE');
  });

  it('filter: by rating with type hint', async () => {
    appWithClient = await setupApplication({ list_kinds: 'reading-list' });
    ({ client } = appWithClient);
    const listId = await createTestList(client, {
      _name: 'Reading List 6',
      _kind: 'reading-list',
    });
    const highRatedParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      rating: 4,
    });
    const lowRatedParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      rating: 2,
    });
    const childId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/list-reactions/${highRatedParentId}`,
        `tapp://localhost/list-reactions/${lowRatedParentId}`,
      ],
    });
    const filterStr = `filter[where][rating][gt]=3&filter[where][rating][type]=number`;
    const response = await client
      .get(`/list-reactions/${childId}/parents`)
      .query(filterStr)
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0].rating).to.equal(4);
  });

  it('pagination: applies response limit configuration', async () => {
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
      response_limit_list_reaction: '2',
    });
    ({ client } = appWithClient);
    const listId = await createTestList(client, {
      _name: 'Reading List 7',
      _kind: 'reading-list',
    });
    const parent1Id = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
    });
    const parent2Id = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
    });
    const parent3Id = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
    });
    const childId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/list-reactions/${parent1Id}`,
        `tapp://localhost/list-reactions/${parent2Id}`,
        `tapp://localhost/list-reactions/${parent3Id}`,
      ],
    });
    const response = await client
      .get(`/list-reactions/${childId}/parents`)
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(2);
  });

  it('pagination: supports pagination', async () => {
    appWithClient = await setupApplication({ list_kinds: 'reading-list' });
    ({ client } = appWithClient);
    const listId = await createTestList(client, {
      _name: 'Reading List 8',
      _kind: 'reading-list',
    });
    const parent1Id = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
    });
    const parent2Id = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
    });
    const parent3Id = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
    });
    const childId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/list-reactions/${parent1Id}`,
        `tapp://localhost/list-reactions/${parent2Id}`,
        `tapp://localhost/list-reactions/${parent3Id}`,
      ],
    });
    const firstPage = await client
      .get(`/list-reactions/${childId}/parents`)
      .query({ filter: { limit: 2, skip: 0 } })
      .expect(200);
    expect(firstPage.body).to.be.Array().and.have.length(2);
    const secondPage = await client
      .get(`/list-reactions/${childId}/parents`)
      .query({ filter: { limit: 2, skip: 2 } })
      .expect(200);
    expect(secondPage.body).to.be.Array().and.have.length(1);
  });

  it('pagination: supports sorting', async () => {
    appWithClient = await setupApplication({ list_kinds: 'reading-list' });
    ({ client } = appWithClient);
    const listId = await createTestList(client, {
      _name: 'Reading List 9',
      _kind: 'reading-list',
    });
    const parentCId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      sortField: 'C',
    });
    const parentAId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      sortField: 'A',
    });
    const parentBId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      sortField: 'B',
    });
    const childId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/list-reactions/${parentCId}`,
        `tapp://localhost/list-reactions/${parentAId}`,
        `tapp://localhost/list-reactions/${parentBId}`,
      ],
    });
    const response = await client
      .get(`/list-reactions/${childId}/parents`)
      .query({ filter: { order: ['sortField ASC'] } })
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(3);
    expect(response.body.map((e: any) => e.sortField)).to.eql(['A', 'B', 'C']);
  });

  it('set-filter: supports set filters via query parameters', async () => {
    appWithClient = await setupApplication({ list_kinds: 'reading-list' });
    ({ client } = appWithClient);
    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);
    const listId = await createTestList(client, {
      _name: 'Reading List 10',
      _kind: 'reading-list',
    });
    const activeParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });
    const inactiveParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });
    const childId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/list-reactions/${activeParentId}`,
        `tapp://localhost/list-reactions/${inactiveParentId}`,
      ],
    });
    const response = await client
      .get(`/list-reactions/${childId}/parents`)
      .query({ set: { actives: true } })
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._id).to.equal(activeParentId);
  });

  it('set-filter: filters reactions by audience', async () => {
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
      autoapprove_list_reaction: 'true',
    });
    ({ client } = appWithClient);
    const owner = 'user-123';
    const viewer = 'user-456';
    const otherUser = 'user-789';
    const listId = await createTestList(client, {
      _name: 'Reading List 11',
      _kind: 'reading-list',
    });
    const ownerParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _ownerUsers: [owner],
    });
    const viewerParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _viewerUsers: [viewer],
    });
    const otherParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
    });
    const childId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/list-reactions/${ownerParentId}`,
        `tapp://localhost/list-reactions/${viewerParentId}`,
        `tapp://localhost/list-reactions/${otherParentId}`,
      ],
    });
    const ownerFilterStr = `set[audience][userIds]=${owner}`;
    const ownerResponse = await client
      .get(`/list-reactions/${childId}/parents`)
      .query(ownerFilterStr)
      .expect(200);
    expect(ownerResponse.body).to.be.Array().and.have.length(1);
    expect(ownerResponse.body[0]._ownerUsers).to.containDeep([owner]);
    const viewerFilterStr = `set[audience][userIds]=${viewer}`;
    const viewerResponse = await client
      .get(`/list-reactions/${childId}/parents`)
      .query(viewerFilterStr)
      .expect(200);
    expect(viewerResponse.body).to.be.Array().and.have.length(1);
    expect(viewerResponse.body[0]._viewerUsers).to.containDeep([viewer]);
    const otherFilterStr = `set[audience][userIds]=${otherUser}`;
    const otherResponse = await client
      .get(`/list-reactions/${childId}/parents`)
      .query(otherFilterStr)
      .expect(200);
    expect(otherResponse.body).to.be.Array().and.have.length(0);
  });

  it('set-filter: filters active reactions', async () => {
    appWithClient = await setupApplication({ list_kinds: 'reading-list' });
    ({ client } = appWithClient);
    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 7);
    const listId = await createTestList(client, {
      _name: 'Reading List 12',
      _kind: 'reading-list',
    });
    const activeParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });
    const inactiveParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });
    const futureParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _validFromDateTime: futureDate.toISOString(),
      _validUntilDateTime: null,
    });
    const childId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/list-reactions/${activeParentId}`,
        `tapp://localhost/list-reactions/${inactiveParentId}`,
        `tapp://localhost/list-reactions/${futureParentId}`,
      ],
    });
    const filterStr = 'set[actives]=true';
    const response = await client
      .get(`/list-reactions/${childId}/parents`)
      .query(filterStr)
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._id).to.equal(activeParentId);
  });

  it('set-filter: filters public reactions', async () => {
    appWithClient = await setupApplication({ list_kinds: 'reading-list' });
    ({ client } = appWithClient);
    const listId = await createTestList(client, {
      _name: 'Reading List 13',
      _kind: 'reading-list',
    });
    const publicParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _visibility: 'public',
    });
    const protectedParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _visibility: 'protected',
    });
    const privateParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _visibility: 'private',
    });
    const childId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/list-reactions/${publicParentId}`,
        `tapp://localhost/list-reactions/${protectedParentId}`,
        `tapp://localhost/list-reactions/${privateParentId}`,
      ],
    });
    const filterStr = 'set[publics]=true';
    const response = await client
      .get(`/list-reactions/${childId}/parents`)
      .query(filterStr)
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._visibility).to.equal('public');
  });

  it('set-filter: combines multiple sets with AND operator', async () => {
    appWithClient = await setupApplication({ list_kinds: 'reading-list' });
    ({ client } = appWithClient);
    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 7);
    const listId = await createTestList(client, {
      _name: 'Reading List 14',
      _kind: 'reading-list',
    });
    const activePublicParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });
    const activePrivateParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _visibility: 'private',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });
    const inactivePublicParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });
    const inactivePrivateParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _visibility: 'private',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });
    const childId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/list-reactions/${activePublicParentId}`,
        `tapp://localhost/list-reactions/${activePrivateParentId}`,
        `tapp://localhost/list-reactions/${inactivePublicParentId}`,
        `tapp://localhost/list-reactions/${inactivePrivateParentId}`,
      ],
    });
    const filterStr = 'set[and][0][actives]=true&set[and][1][publics]=true';
    const response = await client
      .get(`/list-reactions/${childId}/parents`)
      .query(filterStr)
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._visibility).to.equal('public');
    expect(response.body[0]._validUntilDateTime).to.equal(
      futureDate.toISOString(),
    );
  });

  it('set-filter: combines multiple sets with OR operator', async () => {
    appWithClient = await setupApplication({ list_kinds: 'reading-list' });
    ({ client } = appWithClient);
    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 7);
    const listId = await createTestList(client, {
      _name: 'Reading List 15',
      _kind: 'reading-list',
    });
    const activeParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      _visibility: 'private',
    });
    const publicParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });
    const inactivePrivateParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _visibility: 'private',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });
    const childId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/list-reactions/${activeParentId}`,
        `tapp://localhost/list-reactions/${publicParentId}`,
        `tapp://localhost/list-reactions/${inactivePrivateParentId}`,
      ],
    });
    const filterStr = 'set[or][0][actives]=true&set[or][1][publics]=true';
    const response = await client
      .get(`/list-reactions/${childId}/parents`)
      .query(filterStr)
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(2);
    expect(response.body.map((p: any) => p._visibility).sort()).to.eql([
      'private',
      'public',
    ]);
  });

  it('set-filter: filters reactions by audience groups', async () => {
    appWithClient = await setupApplication({
      list_kinds: 'reading-list',
      visibility_list_reaction: 'protected',
      autoapprove_list_reaction: 'true',
    });
    ({ client } = appWithClient);
    const ownerGroup = 'group-123';
    const viewerGroup = 'group-456';
    const otherGroup = 'group-789';
    const listId = await createTestList(client, {
      _name: 'Reading List 16',
      _kind: 'reading-list',
    });
    const ownerGroupParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _ownerGroups: [ownerGroup],
    });
    const viewerGroupParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _viewerGroups: [viewerGroup],
    });
    const otherParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
    });
    const childId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/list-reactions/${ownerGroupParentId}`,
        `tapp://localhost/list-reactions/${viewerGroupParentId}`,
        `tapp://localhost/list-reactions/${otherParentId}`,
      ],
    });
    const ownerFilterStr = `set[audience][groupIds]=${ownerGroup}`;
    const ownerResponse = await client
      .get(`/list-reactions/${childId}/parents`)
      .query(ownerFilterStr)
      .expect(200);
    expect(ownerResponse.body).to.be.Array().and.have.length(1);
    expect(ownerResponse.body[0]._ownerGroups).to.containDeep([ownerGroup]);
    const viewerFilterStr = `set[audience][groupIds]=${viewerGroup}`;
    const viewerResponse = await client
      .get(`/list-reactions/${childId}/parents`)
      .query(viewerFilterStr)
      .expect(200);
    expect(viewerResponse.body).to.be.Array().and.have.length(1);
    expect(viewerResponse.body[0]._viewerGroups).to.containDeep([viewerGroup]);
    const otherFilterStr = `set[audience][groupIds]=${otherGroup}`;
    const otherResponse = await client
      .get(`/list-reactions/${childId}/parents`)
      .query(otherFilterStr)
      .expect(200);
    expect(otherResponse.body).to.be.Array().and.have.length(0);
    // Test combined user and group audience filtering
    const combinedFilterStr = `set[audience][userIds]=user-999&set[audience][groupIds]=${viewerGroup}`;
    const combinedResponse = await client
      .get(`/list-reactions/${childId}/parents`)
      .query(combinedFilterStr)
      .expect(200);
    expect(combinedResponse.body).to.be.Array().and.have.length(1);
    expect(combinedResponse.body[0]._viewerGroups).to.containDeep([
      viewerGroup,
    ]);
  });

  it('field-selection: includes only specified fields', async () => {
    appWithClient = await setupApplication({ list_kinds: 'reading-list' });
    ({ client } = appWithClient);
    const listId = await createTestList(client, {
      _name: 'Reading List 17',
      _kind: 'reading-list',
    });
    const parentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _visibility: 'public',
      customField: 'custom value',
    });
    const childId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _parents: [`tapp://localhost/list-reactions/${parentId}`],
    });
    const response = await client
      .get(`/list-reactions/${childId}/parents`)
      .query({
        filter: {
          fields: {
            _id: true,
            _kind: true,
            _visibility: true,
          },
        },
      })
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]).to.have.properties([
      '_id',
      '_kind',
      '_visibility',
    ]);
    expect(response.body[0]).to.not.have.properties(['customField']);
  });

  it('lookup: resolves references with complex filters, sets, and pagination', async () => {
    appWithClient = await setupApplication({
      list_kinds: 'reading-list,author,review',
      visibility_list_reaction: 'public',
    });
    ({ client } = appWithClient);
    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);
    const futureDate = new Date(now);
    futureDate.setDate(now.getDate() + 7);
    const listId = await createTestList(client, {
      _name: 'Reading List 18',
      _kind: 'reading-list',
    });
    const activePublicParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'author',
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      nationality: 'British',
      rating: 5,
    });
    const inactivePublicParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'author',
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
      nationality: 'American',
      rating: 3,
    });
    const activePrivateParentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'author',
      _visibility: 'private',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      nationality: 'French',
      rating: 4,
    });
    const childId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/list-reactions/${activePublicParentId}`,
        `tapp://localhost/list-reactions/${inactivePublicParentId}`,
        `tapp://localhost/list-reactions/${activePrivateParentId}`,
      ],
    });
    const queryStr =
      'filter[where][nationality]=British&' +
      'filter[order][0]=rating DESC&' +
      'filter[skip]=0&' +
      'filter[limit]=2&' +
      'set[actives]=true&' +
      'set[publics]=true';
    const response = await client
      .get(`/list-reactions/${childId}/parents?${queryStr}`)
      .expect(200);
    expect(response.body).to.be.Array();
    expect(response.body).to.have.length(1);
    expect(response.body[0].nationality).to.equal('British');
    expect(response.body[0]._visibility).to.equal('public');
    expect(response.body[0].rating).to.equal(5);
  });

  it('lookup: resolves references in arbitrary fields with complex filters', async () => {
    appWithClient = await setupApplication({
      list_kinds: 'reading-list,author',
    });
    ({ client } = appWithClient);
    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);
    const futureDate = new Date(now);
    futureDate.setDate(now.getDate() + 7);
    const listId = await createTestList(client, {
      _name: 'Reading List 19',
      _kind: 'reading-list',
    });
    const activeAuthorId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'author',
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      nationality: 'British',
      rating: 4.5,
    });
    const inactiveAuthorId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'author',
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
      nationality: 'American',
      rating: 3.8,
    });
    const parentId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'book',
      relatedAuthors: [
        `tapp://localhost/list-reactions/${activeAuthorId}`,
        `tapp://localhost/list-reactions/${inactiveAuthorId}`,
        'tapp://localhost/list-reactions/non-existent-id',
        'invalid-uri-format',
      ],
    });
    const childId = await createTestListReaction(client, {
      _listId: listId,
      _kind: 'like',
      _parents: [`tapp://localhost/list-reactions/${parentId}`],
    });
    const queryStr =
      'filter[lookup][0][prop]=relatedAuthors&' +
      'filter[lookup][0][scope][where][and][0][rating][gt]=4&' +
      'filter[lookup][0][scope][where][and][0][rating][type]=number&' +
      `filter[lookup][0][scope][where][and][1][or][0][_validUntilDateTime][gt]=${encodeURIComponent(now.toISOString())}&` +
      'filter[lookup][0][scope][where][and][1][or][1][_validUntilDateTime][eq]=null&' +
      'filter[lookup][0][scope][order][0]=rating DESC';
    const response = await client
      .get(`/list-reactions/${childId}/parents?${queryStr}`)
      .expect(200);
    expect(response.body).to.be.Array();
    expect(response.body).to.have.length(1);
    expect(response.body[0]).to.have.property('relatedAuthors');
    expect(response.body[0].relatedAuthors).to.be.Array();
    expect(response.body[0].relatedAuthors).to.have.length(1);
    expect(response.body[0].relatedAuthors[0].nationality).to.equal('British');
    expect(response.body[0].relatedAuthors[0].rating).to.equal(4.5);
  });

  it('returns 404 when reaction is not found', async () => {
    appWithClient = await setupApplication({ list_kinds: 'reading-list' });
    ({ client } = appWithClient);
    const nonExistentId = 'non-existent-id';
    const response = await client
      .get(`/list-reactions/${nonExistentId}/parents`)
      .expect(404);
    expect(response.body.error).to.have.property(
      'code',
      'LIST-REACTION-NOT-FOUND',
    );
  });
});
