import { expect } from '@loopback/testlab';
import type { Client } from '@loopback/testlab';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  createTestEntity,
  createTestEntityReaction,
  teardownApplication,
} from '../test-helper';

describe('GET /entity-reactions/{id}/parents', () => {
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
    appWithClient = await setupApplication({ entity_kinds: 'book' });
    ({ client } = appWithClient);
    const entityId = await createTestEntity(client, {
      _name: 'Book 1',
      _kind: 'book',
    });
    const parentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
    });
    const childId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _parents: [`tapp://localhost/entity-reactions/${parentId}`],
    });
    const response = await client
      .get(`/entity-reactions/${childId}/parents`)
      .expect(200);
    expect(response.body).to.be.an.Array();
    expect(response.body).to.have.length(1);
    expect(response.body[0]._id).to.equal(parentId);
    expect(response.body[0]._entityId).to.equal(entityId);
  });

  it('filter: by kind', async () => {
    appWithClient = await setupApplication({ entity_kinds: 'book' });
    ({ client } = appWithClient);
    const entityId = await createTestEntity(client, {
      _name: 'Book 1',
      _kind: 'book',
    });
    const parentLikeId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
    });
    const parentCommentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'comment',
    });
    const childId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/entity-reactions/${parentLikeId}`,
        `tapp://localhost/entity-reactions/${parentCommentId}`,
      ],
    });
    const response = await client
      .get(`/entity-reactions/${childId}/parents`)
      .query({ filter: { where: { _kind: 'like' } } })
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._kind).to.equal('like');
  });

  it('filter: active reactions with complex filter', async () => {
    appWithClient = await setupApplication({ entity_kinds: 'book' });
    ({ client } = appWithClient);
    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);
    const entityId = await createTestEntity(client, {
      _name: 'Book 1',
      _kind: 'book',
    });
    const activeParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });
    const inactiveParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });
    const childId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/entity-reactions/${activeParentId}`,
        `tapp://localhost/entity-reactions/${inactiveParentId}`,
      ],
    });
    const filterStr =
      `filter[where][and][0][or][0][_validUntilDateTime][eq]=null&` +
      `filter[where][and][0][or][1][_validUntilDateTime][gt]=${encodeURIComponent(now.toISOString())}&` +
      `filter[where][and][1][_validFromDateTime][neq]=null&` +
      `filter[where][and][2][_validFromDateTime][lt]=${encodeURIComponent(now.toISOString())}`;
    const response = await client
      .get(`/entity-reactions/${childId}/parents`)
      .query(filterStr)
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._id).to.equal(activeParentId);
  });

  it('filter: by visibility', async () => {
    appWithClient = await setupApplication({ entity_kinds: 'book' });
    ({ client } = appWithClient);
    const entityId = await createTestEntity(client, {
      _name: 'Book 2',
      _kind: 'book',
    });
    const publicParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _visibility: 'public',
    });
    const privateParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _visibility: 'private',
    });
    const childId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/entity-reactions/${publicParentId}`,
        `tapp://localhost/entity-reactions/${privateParentId}`,
      ],
    });
    const response = await client
      .get(`/entity-reactions/${childId}/parents`)
      .query({ filter: { where: { _visibility: 'public' } } })
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._visibility).to.equal('public');
  });

  it('filter: by owner', async () => {
    appWithClient = await setupApplication({ entity_kinds: 'book' });
    ({ client } = appWithClient);
    const entityId = await createTestEntity(client, {
      _name: 'Book 3',
      _kind: 'book',
    });
    const owner1 = 'user-123';
    const owner2 = 'user-456';
    const parent1Id = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _ownerUsers: [owner1],
    });
    const parent2Id = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _ownerUsers: [owner2],
    });
    const childId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/entity-reactions/${parent1Id}`,
        `tapp://localhost/entity-reactions/${parent2Id}`,
      ],
    });
    const filterStr = `filter[where][_ownerUsers][inq][]=${owner1}`;
    const response = await client
      .get(`/entity-reactions/${childId}/parents`)
      .query(filterStr)
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._ownerUsers).to.containDeep([owner1]);
  });

  it('field-selection: excludes specified fields', async () => {
    appWithClient = await setupApplication({ entity_kinds: 'book' });
    ({ client } = appWithClient);
    const entityId = await createTestEntity(client, {
      _name: 'Book 4',
      _kind: 'book',
    });
    const parentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _visibility: 'public',
      _ownerUsers: ['user-123'],
      customField: 'custom value',
    });
    const childId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _parents: [`tapp://localhost/entity-reactions/${parentId}`],
    });
    const response = await client
      .get(`/entity-reactions/${childId}/parents`)
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
    appWithClient = await setupApplication({ entity_kinds: 'book' });
    ({ client } = appWithClient);
    const entityId = await createTestEntity(client, {
      _name: 'Book 5',
      _kind: 'book',
    });
    const germanParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      nationality: 'DE',
    });
    const frenchParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      nationality: 'FR',
    });
    const childId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/entity-reactions/${germanParentId}`,
        `tapp://localhost/entity-reactions/${frenchParentId}`,
      ],
    });
    const response = await client
      .get(`/entity-reactions/${childId}/parents`)
      .query({ filter: { where: { nationality: 'DE' } } })
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0].nationality).to.equal('DE');
  });

  it('filter: by rating with type hint', async () => {
    appWithClient = await setupApplication({ entity_kinds: 'book' });
    ({ client } = appWithClient);
    const entityId = await createTestEntity(client, {
      _name: 'Book 6',
      _kind: 'book',
    });
    const highRatedParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      rating: 4,
    });
    const lowRatedParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      rating: 2,
    });
    const childId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/entity-reactions/${highRatedParentId}`,
        `tapp://localhost/entity-reactions/${lowRatedParentId}`,
      ],
    });
    const filterStr = `filter[where][rating][gt]=3&filter[where][rating][type]=number`;
    const response = await client
      .get(`/entity-reactions/${childId}/parents`)
      .query(filterStr)
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0].rating).to.equal(4);
  });

  it('pagination: applies response limit configuration', async () => {
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      response_limit_entity_reaction: '2',
    });
    ({ client } = appWithClient);
    const entityId = await createTestEntity(client, {
      _name: 'Book 7',
      _kind: 'book',
    });
    const parent1Id = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
    });
    const parent2Id = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
    });
    const parent3Id = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
    });
    const childId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/entity-reactions/${parent1Id}`,
        `tapp://localhost/entity-reactions/${parent2Id}`,
        `tapp://localhost/entity-reactions/${parent3Id}`,
      ],
    });
    const response = await client
      .get(`/entity-reactions/${childId}/parents`)
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(2);
  });

  it('pagination: supports pagination', async () => {
    appWithClient = await setupApplication({ entity_kinds: 'book' });
    ({ client } = appWithClient);
    const entityId = await createTestEntity(client, {
      _name: 'Book 8',
      _kind: 'book',
    });
    const parent1Id = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
    });
    const parent2Id = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
    });
    const parent3Id = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
    });
    const childId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/entity-reactions/${parent1Id}`,
        `tapp://localhost/entity-reactions/${parent2Id}`,
        `tapp://localhost/entity-reactions/${parent3Id}`,
      ],
    });
    const firstPage = await client
      .get(`/entity-reactions/${childId}/parents`)
      .query({ filter: { limit: 2, skip: 0 } })
      .expect(200);
    expect(firstPage.body).to.be.Array().and.have.length(2);
    const secondPage = await client
      .get(`/entity-reactions/${childId}/parents`)
      .query({ filter: { limit: 2, skip: 2 } })
      .expect(200);
    expect(secondPage.body).to.be.Array().and.have.length(1);
  });

  it('pagination: supports sorting', async () => {
    appWithClient = await setupApplication({ entity_kinds: 'book' });
    ({ client } = appWithClient);
    const entityId = await createTestEntity(client, {
      _name: 'Book 9',
      _kind: 'book',
    });
    const parentCId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      sortField: 'C',
    });
    const parentAId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      sortField: 'A',
    });
    const parentBId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      sortField: 'B',
    });
    const childId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/entity-reactions/${parentCId}`,
        `tapp://localhost/entity-reactions/${parentAId}`,
        `tapp://localhost/entity-reactions/${parentBId}`,
      ],
    });
    const response = await client
      .get(`/entity-reactions/${childId}/parents`)
      .query({ filter: { order: ['sortField ASC'] } })
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(3);
    expect(response.body.map((e: any) => e.sortField)).to.eql(['A', 'B', 'C']);
  });

  it('set-filter: supports set filters via query parameters', async () => {
    appWithClient = await setupApplication({ entity_kinds: 'book' });
    ({ client } = appWithClient);
    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 1);
    const entityId = await createTestEntity(client, {
      _name: 'Book 10',
      _kind: 'book',
    });
    const activeParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });
    const inactiveParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });
    const childId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/entity-reactions/${activeParentId}`,
        `tapp://localhost/entity-reactions/${inactiveParentId}`,
      ],
    });
    const response = await client
      .get(`/entity-reactions/${childId}/parents`)
      .query({ set: { actives: true } })
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._id).to.equal(activeParentId);
  });

  it('set-filter: filters reactions by audience', async () => {
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      autoapprove_entity_reaction: 'true',
    });
    ({ client } = appWithClient);
    const owner = 'user-123';
    const viewer = 'user-456';
    const otherUser = 'user-789';
    const entityId = await createTestEntity(client, {
      _name: 'Book 11',
      _kind: 'book',
    });
    const ownerParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _ownerUsers: [owner],
    });
    const viewerParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _viewerUsers: [viewer],
    });
    const otherParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
    });
    const childId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/entity-reactions/${ownerParentId}`,
        `tapp://localhost/entity-reactions/${viewerParentId}`,
        `tapp://localhost/entity-reactions/${otherParentId}`,
      ],
    });
    const ownerFilterStr = `set[audience][userIds]=${owner}`;
    const ownerResponse = await client
      .get(`/entity-reactions/${childId}/parents`)
      .query(ownerFilterStr)
      .expect(200);
    expect(ownerResponse.body).to.be.Array().and.have.length(1);
    expect(ownerResponse.body[0]._ownerUsers).to.containDeep([owner]);
    const viewerFilterStr = `set[audience][userIds]=${viewer}`;
    const viewerResponse = await client
      .get(`/entity-reactions/${childId}/parents`)
      .query(viewerFilterStr)
      .expect(200);
    expect(viewerResponse.body).to.be.Array().and.have.length(1);
    expect(viewerResponse.body[0]._viewerUsers).to.containDeep([viewer]);
    const otherFilterStr = `set[audience][userIds]=${otherUser}`;
    const otherResponse = await client
      .get(`/entity-reactions/${childId}/parents`)
      .query(otherFilterStr)
      .expect(200);
    expect(otherResponse.body).to.be.Array().and.have.length(0);
  });

  it('set-filter: filters active reactions', async () => {
    appWithClient = await setupApplication({ entity_kinds: 'book' });
    ({ client } = appWithClient);
    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 7);
    const entityId = await createTestEntity(client, {
      _name: 'Book 12',
      _kind: 'book',
    });
    const activeParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });
    const inactiveParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });
    const futureParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _validFromDateTime: futureDate.toISOString(),
      _validUntilDateTime: null,
    });
    const childId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/entity-reactions/${activeParentId}`,
        `tapp://localhost/entity-reactions/${inactiveParentId}`,
        `tapp://localhost/entity-reactions/${futureParentId}`,
      ],
    });
    const filterStr = 'set[actives]=true';
    const response = await client
      .get(`/entity-reactions/${childId}/parents`)
      .query(filterStr)
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._id).to.equal(activeParentId);
  });

  it('set-filter: filters public reactions', async () => {
    appWithClient = await setupApplication({ entity_kinds: 'book' });
    ({ client } = appWithClient);
    const entityId = await createTestEntity(client, {
      _name: 'Book 13',
      _kind: 'book',
    });
    const publicParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _visibility: 'public',
    });
    const protectedParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _visibility: 'protected',
    });
    const privateParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _visibility: 'private',
    });
    const childId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/entity-reactions/${publicParentId}`,
        `tapp://localhost/entity-reactions/${protectedParentId}`,
        `tapp://localhost/entity-reactions/${privateParentId}`,
      ],
    });
    const filterStr = 'set[publics]=true';
    const response = await client
      .get(`/entity-reactions/${childId}/parents`)
      .query(filterStr)
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._visibility).to.equal('public');
  });

  it('set-filter: combines multiple sets with AND operator', async () => {
    appWithClient = await setupApplication({ entity_kinds: 'book' });
    ({ client } = appWithClient);
    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 7);
    const entityId = await createTestEntity(client, {
      _name: 'Book 14',
      _kind: 'book',
    });
    const activePublicParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });
    const activePrivateParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _visibility: 'private',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    });
    const inactivePublicParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });
    const inactivePrivateParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _visibility: 'private',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });
    const childId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/entity-reactions/${activePublicParentId}`,
        `tapp://localhost/entity-reactions/${activePrivateParentId}`,
        `tapp://localhost/entity-reactions/${inactivePublicParentId}`,
        `tapp://localhost/entity-reactions/${inactivePrivateParentId}`,
      ],
    });
    const filterStr = 'set[and][0][actives]=true&set[and][1][publics]=true';
    const response = await client
      .get(`/entity-reactions/${childId}/parents`)
      .query(filterStr)
      .expect(200);
    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._visibility).to.equal('public');
    expect(response.body[0]._validUntilDateTime).to.equal(
      futureDate.toISOString(),
    );
  });

  it('set-filter: combines multiple sets with OR operator', async () => {
    appWithClient = await setupApplication({ entity_kinds: 'book' });
    ({ client } = appWithClient);
    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 7);
    const entityId = await createTestEntity(client, {
      _name: 'Book 15',
      _kind: 'book',
    });
    const activeParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      _visibility: 'private',
    });
    const publicParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });
    const inactivePrivateParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _visibility: 'private',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    });
    const childId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/entity-reactions/${activeParentId}`,
        `tapp://localhost/entity-reactions/${publicParentId}`,
        `tapp://localhost/entity-reactions/${inactivePrivateParentId}`,
      ],
    });
    const filterStr = 'set[or][0][actives]=true&set[or][1][publics]=true';
    const response = await client
      .get(`/entity-reactions/${childId}/parents`)
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
      entity_kinds: 'book',
      visibility_entity_reaction: 'protected',
      autoapprove_entity_reaction: 'true',
    });
    ({ client } = appWithClient);
    const ownerGroup = 'group-123';
    const viewerGroup = 'group-456';
    const otherGroup = 'group-789';
    const entityId = await createTestEntity(client, {
      _name: 'Book 16',
      _kind: 'book',
    });
    const ownerGroupParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _ownerGroups: [ownerGroup],
    });
    const viewerGroupParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _viewerGroups: [viewerGroup],
    });
    const otherParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
    });
    const childId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/entity-reactions/${ownerGroupParentId}`,
        `tapp://localhost/entity-reactions/${viewerGroupParentId}`,
        `tapp://localhost/entity-reactions/${otherParentId}`,
      ],
    });
    const ownerFilterStr = `set[audience][groupIds]=${ownerGroup}`;
    const ownerResponse = await client
      .get(`/entity-reactions/${childId}/parents`)
      .query(ownerFilterStr)
      .expect(200);
    expect(ownerResponse.body).to.be.Array().and.have.length(1);
    expect(ownerResponse.body[0]._ownerGroups).to.containDeep([ownerGroup]);
    const viewerFilterStr = `set[audience][groupIds]=${viewerGroup}`;
    const viewerResponse = await client
      .get(`/entity-reactions/${childId}/parents`)
      .query(viewerFilterStr)
      .expect(200);
    expect(viewerResponse.body).to.be.Array().and.have.length(1);
    expect(viewerResponse.body[0]._viewerGroups).to.containDeep([viewerGroup]);
    const otherFilterStr = `set[audience][groupIds]=${otherGroup}`;
    const otherResponse = await client
      .get(`/entity-reactions/${childId}/parents`)
      .query(otherFilterStr)
      .expect(200);
    expect(otherResponse.body).to.be.Array().and.have.length(0);
    // Test combined user and group audience filtering
    const combinedFilterStr = `set[audience][userIds]=user-999&set[audience][groupIds]=${viewerGroup}`;
    const combinedResponse = await client
      .get(`/entity-reactions/${childId}/parents`)
      .query(combinedFilterStr)
      .expect(200);
    expect(combinedResponse.body).to.be.Array().and.have.length(1);
    expect(combinedResponse.body[0]._viewerGroups).to.containDeep([
      viewerGroup,
    ]);
  });

  it('field-selection: includes only specified fields', async () => {
    appWithClient = await setupApplication({ entity_kinds: 'book' });
    ({ client } = appWithClient);
    const entityId = await createTestEntity(client, {
      _name: 'Book 17',
      _kind: 'book',
    });
    const parentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _visibility: 'public',
      customField: 'custom value',
    });
    const childId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _parents: [`tapp://localhost/entity-reactions/${parentId}`],
    });
    const response = await client
      .get(`/entity-reactions/${childId}/parents`)
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
      entity_kinds: 'book,author,review',
      visibility_entity_reaction: 'public',
    });
    ({ client } = appWithClient);
    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);
    const futureDate = new Date(now);
    futureDate.setDate(now.getDate() + 7);
    // Create the entity first
    const entityId = await createTestEntity(client, {
      _name: 'Book 18',
      _kind: 'book',
    });
    // Create parent reactions with different properties, all linked to the entity
    const activePublicParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'author',
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      nationality: 'British',
      rating: 5,
    });
    const inactivePublicParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'author',
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
      nationality: 'American',
      rating: 3,
    });
    const activePrivateParentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'author',
      _visibility: 'private',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      nationality: 'French',
      rating: 4,
    });
    // Create child reaction with all parents
    const childId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _parents: [
        `tapp://localhost/entity-reactions/${activePublicParentId}`,
        `tapp://localhost/entity-reactions/${inactivePublicParentId}`,
        `tapp://localhost/entity-reactions/${activePrivateParentId}`,
      ],
    });
    // Test lookup with complex filter, set filter, and pagination
    const queryStr =
      'filter[where][nationality]=British&' +
      'filter[order][0]=rating DESC&' +
      'filter[skip]=0&' +
      'filter[limit]=2&' +
      'set[actives]=true&' +
      'set[publics]=true';
    const response = await client
      .get(`/entity-reactions/${childId}/parents?${queryStr}`)
      .expect(200);
    expect(response.body).to.be.Array();
    expect(response.body).to.have.length(1);
    expect(response.body[0].nationality).to.equal('British');
    expect(response.body[0]._visibility).to.equal('public');
    expect(response.body[0].rating).to.equal(5);
  });

  it('lookup: resolves references in arbitrary fields with complex filters', async () => {
    appWithClient = await setupApplication({ entity_kinds: 'book,author' });
    ({ client } = appWithClient);
    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);
    const futureDate = new Date(now);
    futureDate.setDate(now.getDate() + 7);
    // Create the entity first
    const entityId = await createTestEntity(client, {
      _name: 'Book 19',
      _kind: 'book',
    });
    // Create referenced reactions (authors) with different properties, all linked to the entity
    const activeAuthorId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'author',
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      nationality: 'British',
      rating: 4.5,
    });
    const inactiveAuthorId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'author',
      _visibility: 'public',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
      nationality: 'American',
      rating: 3.8,
    });
    // Create parent reaction with references in an arbitrary field
    const parentId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'book',
      relatedAuthors: [
        `tapp://localhost/entity-reactions/${activeAuthorId}`,
        `tapp://localhost/entity-reactions/${inactiveAuthorId}`,
        'tapp://localhost/entity-reactions/non-existent-id',
        'invalid-uri-format',
      ],
    });
    // Create child reaction referencing the parent
    const childId = await createTestEntityReaction(client, {
      _entityId: entityId,
      _kind: 'like',
      _parents: [`tapp://localhost/entity-reactions/${parentId}`],
    });
    // Get parent with lookup on arbitrary field, using complex filter
    const queryStr =
      'filter[lookup][0][prop]=relatedAuthors&' +
      'filter[lookup][0][scope][where][and][0][rating][gt]=4&' +
      'filter[lookup][0][scope][where][and][0][rating][type]=number&' +
      `filter[lookup][0][scope][where][and][1][or][0][_validUntilDateTime][gt]=${encodeURIComponent(now.toISOString())}&` +
      'filter[lookup][0][scope][where][and][1][or][1][_validUntilDateTime][eq]=null&' +
      'filter[lookup][0][scope][order][0]=rating DESC';
    const response = await client
      .get(`/entity-reactions/${childId}/parents?${queryStr}`)
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
    appWithClient = await setupApplication({ entity_kinds: 'book' });
    ({ client } = appWithClient);
    const nonExistentId = 'non-existent-id';
    const response = await client
      .get(`/entity-reactions/${nonExistentId}/parents`)
      .expect(404);
    expect(response.body.error).to.have.property('statusCode', 404);
  });
});
