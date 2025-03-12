import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { GenericEntity } from '../../../models';
import { setupApplication, teardownApplication } from '../test-helper';
import type { AppWithClient } from '../test-helper';

describe('GET /entities/{entityId}/parents', () => {
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

  it('basic: returns parent entities for a given entity', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create parent entity
    const parentEntity: Partial<GenericEntity> = {
      _name: 'Parent Entity',
      _kind: 'book',
      description: 'This is the parent entity',
    };

    const parentResponse = await client
      .post('/entities')
      .send(parentEntity)
      .expect(200);

    const parentId = parentResponse.body._id;

    // Create child entity with parent reference
    const childEntity: Partial<GenericEntity> = {
      _name: 'Child Entity',
      _kind: 'book',
      description: 'This is the child entity',
      _parents: [`tapp://localhost/entities/${parentId}`],
    };

    const childResponse = await client
      .post('/entities')
      .send(childEntity)
      .expect(200);

    // Get parents of the child entity
    const parentsResponse = await client
      .get(`/entities/${childResponse.body._id}/parents`)
      .expect(200);

    // Verify the response
    expect(parentsResponse.body).to.be.an.Array();
    expect(parentsResponse.body).to.have.length(1);
    expect(parentsResponse.body[0]).to.containDeep({
      _id: parentId,
      _name: 'Parent Entity',
      _kind: 'book',
      description: 'This is the parent entity',
    });
  });

  it('filter: by kind', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,movie',
    });
    ({ client } = appWithClient);

    // Create parent entities of different kinds
    const bookParent: Partial<GenericEntity> = {
      _name: 'Book Parent',
      _kind: 'book',
      description: 'This is a book parent',
    };

    const movieParent: Partial<GenericEntity> = {
      _name: 'Movie Parent',
      _kind: 'movie',
      description: 'This is a movie parent',
    };

    const bookParentResponse = await client
      .post('/entities')
      .send(bookParent)
      .expect(200);
    const movieParentResponse = await client
      .post('/entities')
      .send(movieParent)
      .expect(200);

    // Create child entity with both parents
    const childEntity: Partial<GenericEntity> = {
      _name: 'Child Entity',
      _kind: 'book',
      description: 'This is the child entity',
      _parents: [
        `tapp://localhost/entities/${bookParentResponse.body._id}`,
        `tapp://localhost/entities/${movieParentResponse.body._id}`,
      ],
    };

    const childResponse = await client
      .post('/entities')
      .send(childEntity)
      .expect(200);

    // Get only book parents
    const parentsResponse = await client
      .get(`/entities/${childResponse.body._id}/parents`)
      .query({ filter: { where: { _kind: 'book' } } })
      .expect(200);

    expect(parentsResponse.body).to.be.Array().and.have.length(1);
    expect(parentsResponse.body[0]._name).to.equal('Book Parent');
    expect(parentsResponse.body[0]._kind).to.equal('book');
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

    // Create active parent entity
    const activeParent: Partial<GenericEntity> = {
      _name: 'Active Parent',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
    };

    // Create inactive parent entity
    const inactiveParent: Partial<GenericEntity> = {
      _name: 'Inactive Parent',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
    };

    const activeParentResponse = await client
      .post('/entities')
      .send(activeParent)
      .expect(200);
    const inactiveParentResponse = await client
      .post('/entities')
      .send(inactiveParent)
      .expect(200);

    // Create child entity with both parents
    const childEntity: Partial<GenericEntity> = {
      _name: 'Child Entity',
      _kind: 'book',
      _parents: [
        `tapp://localhost/entities/${activeParentResponse.body._id}`,
        `tapp://localhost/entities/${inactiveParentResponse.body._id}`,
      ],
    };

    const childResponse = await client
      .post('/entities')
      .send(childEntity)
      .expect(200);

    // Get only active parents using complex filter
    const filterStr =
      `filter[where][and][0][or][0][_validUntilDateTime][eq]=null&` +
      `filter[where][and][0][or][1][_validUntilDateTime][gt]=${encodeURIComponent(now.toISOString())}&` +
      `filter[where][and][1][_validFromDateTime][neq]=null&` +
      `filter[where][and][2][_validFromDateTime][lt]=${encodeURIComponent(now.toISOString())}`;

    const parentsResponse = await client
      .get(`/entities/${childResponse.body._id}/parents`)
      .query(filterStr)
      .expect(200);

    expect(parentsResponse.body).to.be.Array().and.have.length(1);
    expect(parentsResponse.body[0]._name).to.equal('Active Parent');
  });

  it('filter: by visibility', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create public parent entity
    const publicParent: Partial<GenericEntity> = {
      _name: 'Public Parent',
      _kind: 'book',
      _visibility: 'public',
    };

    // Create private parent entity
    const privateParent: Partial<GenericEntity> = {
      _name: 'Private Parent',
      _kind: 'book',
      _visibility: 'private',
    };

    const publicParentResponse = await client
      .post('/entities')
      .send(publicParent)
      .expect(200);
    const privateParentResponse = await client
      .post('/entities')
      .send(privateParent)
      .expect(200);

    // Create child entity with both parents
    const childEntity: Partial<GenericEntity> = {
      _name: 'Child Entity',
      _kind: 'book',
      _parents: [
        `tapp://localhost/entities/${publicParentResponse.body._id}`,
        `tapp://localhost/entities/${privateParentResponse.body._id}`,
      ],
    };

    const childResponse = await client
      .post('/entities')
      .send(childEntity)
      .expect(200);

    // Get only public parents
    const parentsResponse = await client
      .get(`/entities/${childResponse.body._id}/parents`)
      .query({ filter: { where: { _visibility: 'public' } } })
      .expect(200);

    expect(parentsResponse.body).to.be.Array().and.have.length(1);
    expect(parentsResponse.body[0]._name).to.equal('Public Parent');
    expect(parentsResponse.body[0]._visibility).to.equal('public');
  });

  it('filter: by owner', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    const owner1 = 'user-123';
    const owner2 = 'user-456';

    // Create parent entity with owner1
    const parent1: Partial<GenericEntity> = {
      _name: 'Owner1 Parent',
      _kind: 'book',
      _ownerUsers: [owner1],
    };

    // Create parent entity with owner2
    const parent2: Partial<GenericEntity> = {
      _name: 'Owner2 Parent',
      _kind: 'book',
      _ownerUsers: [owner2],
    };

    const parent1Response = await client
      .post('/entities')
      .send(parent1)
      .expect(200);
    const parent2Response = await client
      .post('/entities')
      .send(parent2)
      .expect(200);

    // Create child entity with both parents
    const childEntity: Partial<GenericEntity> = {
      _name: 'Child Entity',
      _kind: 'book',
      _parents: [
        `tapp://localhost/entities/${parent1Response.body._id}`,
        `tapp://localhost/entities/${parent2Response.body._id}`,
      ],
    };

    const childResponse = await client
      .post('/entities')
      .send(childEntity)
      .expect(200);

    // Get parents for owner1
    const filterStr = `filter[where][_ownerUsers][inq][]=${owner1}`;

    const parentsResponse = await client
      .get(`/entities/${childResponse.body._id}/parents`)
      .query(filterStr)
      .expect(200);

    expect(parentsResponse.body).to.be.Array().and.have.length(1);
    expect(parentsResponse.body[0]._name).to.equal('Owner1 Parent');
    expect(parentsResponse.body[0]._ownerUsers).to.containDeep([owner1]);
  });

  it('pagination: applies response limit configuration', async () => {
    // Set up the application with response limit configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      response_limit_entity: '2', // Limit response to 2 items
    });
    ({ client } = appWithClient);

    // Create three parent entities
    const parent1 = await client
      .post('/entities')
      .send({
        _name: 'Parent 1',
        _kind: 'book',
      })
      .expect(200);

    const parent2 = await client
      .post('/entities')
      .send({
        _name: 'Parent 2',
        _kind: 'book',
      })
      .expect(200);

    const parent3 = await client
      .post('/entities')
      .send({
        _name: 'Parent 3',
        _kind: 'book',
      })
      .expect(200);

    // Create child entity with all three parents
    const childEntity: Partial<GenericEntity> = {
      _name: 'Child Entity',
      _kind: 'book',
      _parents: [
        `tapp://localhost/entities/${parent1.body._id}`,
        `tapp://localhost/entities/${parent2.body._id}`,
        `tapp://localhost/entities/${parent3.body._id}`,
      ],
    };

    const childResponse = await client
      .post('/entities')
      .send(childEntity)
      .expect(200);

    // Get parents with default limit
    const parentsResponse = await client
      .get(`/entities/${childResponse.body._id}/parents`)
      .expect(200);

    expect(parentsResponse.body).to.be.Array().and.have.length(2);
  });

  it('pagination: supports pagination', async () => {
    // Set up the application
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create three parent entities
    const parent1 = await client
      .post('/entities')
      .send({
        _name: 'Parent 1',
        _kind: 'book',
      })
      .expect(200);

    const parent2 = await client
      .post('/entities')
      .send({
        _name: 'Parent 2',
        _kind: 'book',
      })
      .expect(200);

    const parent3 = await client
      .post('/entities')
      .send({
        _name: 'Parent 3',
        _kind: 'book',
      })
      .expect(200);

    // Create child entity with all three parents
    const childEntity: Partial<GenericEntity> = {
      _name: 'Child Entity',
      _kind: 'book',
      _parents: [
        `tapp://localhost/entities/${parent1.body._id}`,
        `tapp://localhost/entities/${parent2.body._id}`,
        `tapp://localhost/entities/${parent3.body._id}`,
      ],
    };

    const childResponse = await client
      .post('/entities')
      .send(childEntity)
      .expect(200);

    // Get first page
    const firstPage = await client
      .get(`/entities/${childResponse.body._id}/parents`)
      .query({ filter: { limit: 2, skip: 0 } })
      .expect(200);

    expect(firstPage.body).to.be.Array().and.have.length(2);

    // Get second page
    const secondPage = await client
      .get(`/entities/${childResponse.body._id}/parents`)
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

    // Create three parent entities with different names
    const parentC = await client
      .post('/entities')
      .send({
        _name: 'Parent C',
        _kind: 'book',
      })
      .expect(200);

    const parentA = await client
      .post('/entities')
      .send({
        _name: 'Parent A',
        _kind: 'book',
      })
      .expect(200);

    const parentB = await client
      .post('/entities')
      .send({
        _name: 'Parent B',
        _kind: 'book',
      })
      .expect(200);

    // Create child entity with all three parents
    const childEntity: Partial<GenericEntity> = {
      _name: 'Child Entity',
      _kind: 'book',
      _parents: [
        `tapp://localhost/entities/${parentC.body._id}`,
        `tapp://localhost/entities/${parentA.body._id}`,
        `tapp://localhost/entities/${parentB.body._id}`,
      ],
    };

    const childResponse = await client
      .post('/entities')
      .send(childEntity)
      .expect(200);

    // Get parents sorted by name
    const parentsResponse = await client
      .get(`/entities/${childResponse.body._id}/parents`)
      .query({ filter: { order: ['_name ASC'] } })
      .expect(200);

    expect(parentsResponse.body).to.be.Array().and.have.length(3);
    expect(parentsResponse.body.map((e: GenericEntity) => e._name)).to.eql([
      'Parent A',
      'Parent B',
      'Parent C',
    ]);
  });

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

    // Create active parent entity
    const activeParent = await client
      .post('/entities')
      .send({
        _name: 'Active Parent',
        _kind: 'book',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: futureDate.toISOString(),
      })
      .expect(200);

    // Create inactive parent entity
    const inactiveParent = await client
      .post('/entities')
      .send({
        _name: 'Inactive Parent',
        _kind: 'book',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: pastDate.toISOString(),
      })
      .expect(200);

    // Create child entity with both parents
    const childEntity: Partial<GenericEntity> = {
      _name: 'Child Entity',
      _kind: 'book',
      _parents: [
        `tapp://localhost/entities/${activeParent.body._id}`,
        `tapp://localhost/entities/${inactiveParent.body._id}`,
      ],
    };

    const childResponse = await client
      .post('/entities')
      .send(childEntity)
      .expect(200);

    // Get active parents using set filter directly
    const response = await client
      .get(`/entities/${childResponse.body._id}/parents`)
      .query({ set: { actives: true } })
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Active Parent');

    // Get active and public parents using multiple set filters
    const multiSetResponse = await client
      .get(`/entities/${childResponse.body._id}/parents`)
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
    // Set up the application
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

    // Create parent entity with owner
    const ownerParent = await client
      .post('/entities')
      .send({
        _name: 'Owner Parent',
        _kind: 'book',
        _ownerUsers: [owner],
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: futureDate.toISOString(),
      })
      .expect(200);

    // Create parent entity with viewer
    const viewerParent = await client
      .post('/entities')
      .send({
        _name: 'Viewer Parent',
        _kind: 'book',
        _viewerUsers: [viewer],
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: futureDate.toISOString(),
      })
      .expect(200);

    // Create parent entity with neither owner nor viewer
    const otherParent = await client
      .post('/entities')
      .send({
        _name: 'Other Parent',
        _kind: 'book',
      })
      .expect(200);

    // Create child entity with all parents
    const childEntity: Partial<GenericEntity> = {
      _name: 'Child Entity',
      _kind: 'book',
      _parents: [
        `tapp://localhost/entities/${ownerParent.body._id}`,
        `tapp://localhost/entities/${viewerParent.body._id}`,
        `tapp://localhost/entities/${otherParent.body._id}`,
      ],
    };

    const childResponse = await client
      .post('/entities')
      .send(childEntity)
      .expect(200);

    // Get parents for owner using set[audience]
    const ownerFilterStr = `set[audience][userIds]=${owner}`;
    const ownerResponse = await client
      .get(`/entities/${childResponse.body._id}/parents`)
      .query(ownerFilterStr)
      .expect(200);

    expect(ownerResponse.body).to.be.Array().and.have.length(1);
    expect(ownerResponse.body[0]._name).to.equal('Owner Parent');
    expect(ownerResponse.body[0]._ownerUsers).to.containDeep([owner]);

    // Get parents for viewer using set[audience]
    const viewerFilterStr = `set[audience][userIds]=${viewer}`;
    const viewerResponse = await client
      .get(`/entities/${childResponse.body._id}/parents`)
      .query(viewerFilterStr)
      .expect(200);

    expect(viewerResponse.body).to.be.Array().and.have.length(1);
    expect(viewerResponse.body[0]._name).to.equal('Viewer Parent');
    expect(viewerResponse.body[0]._viewerUsers).to.containDeep([viewer]);

    // Get parents for user with no access
    const otherFilterStr = `set[audience][userIds]=${otherUser}`;
    const otherResponse = await client
      .get(`/entities/${childResponse.body._id}/parents`)
      .query(otherFilterStr)
      .expect(200);

    expect(otherResponse.body).to.be.Array().and.have.length(0);
  });

  it('set-filter: filters active entities', async () => {
    // Set up the application
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 7);

    // Create active parent entity
    const activeParent = await client
      .post('/entities')
      .send({
        _name: 'Active Parent',
        _kind: 'book',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: futureDate.toISOString(),
      })
      .expect(200);

    // Create inactive parent entity (expired)
    const inactiveParent = await client
      .post('/entities')
      .send({
        _name: 'Inactive Parent',
        _kind: 'book',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: pastDate.toISOString(),
      })
      .expect(200);

    // Create inactive parent entity (not started)
    const futureParent = await client
      .post('/entities')
      .send({
        _name: 'Future Parent',
        _kind: 'book',
        _validFromDateTime: futureDate.toISOString(),
        _validUntilDateTime: null,
      })
      .expect(200);

    // Create child entity with all parents
    const childEntity: Partial<GenericEntity> = {
      _name: 'Child Entity',
      _kind: 'book',
      _parents: [
        `tapp://localhost/entities/${activeParent.body._id}`,
        `tapp://localhost/entities/${inactiveParent.body._id}`,
        `tapp://localhost/entities/${futureParent.body._id}`,
      ],
    };

    const childResponse = await client
      .post('/entities')
      .send(childEntity)
      .expect(200);

    // Get active parents using set[actives]
    const filterStr = 'set[actives]=true';
    const response = await client
      .get(`/entities/${childResponse.body._id}/parents`)
      .query(filterStr)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Active Parent');
  });

  it('set-filter: filters public entities', async () => {
    // Set up the application
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create public parent entity
    const publicParent = await client
      .post('/entities')
      .send({
        _name: 'Public Parent',
        _kind: 'book',
        _visibility: 'public',
      })
      .expect(200);

    // Create protected parent entity
    const protectedParent = await client
      .post('/entities')
      .send({
        _name: 'Protected Parent',
        _kind: 'book',
        _visibility: 'protected',
      })
      .expect(200);

    // Create private parent entity
    const privateParent = await client
      .post('/entities')
      .send({
        _name: 'Private Parent',
        _kind: 'book',
        _visibility: 'private',
      })
      .expect(200);

    // Create child entity with all parents
    const childEntity: Partial<GenericEntity> = {
      _name: 'Child Entity',
      _kind: 'book',
      _parents: [
        `tapp://localhost/entities/${publicParent.body._id}`,
        `tapp://localhost/entities/${protectedParent.body._id}`,
        `tapp://localhost/entities/${privateParent.body._id}`,
      ],
    };

    const childResponse = await client
      .post('/entities')
      .send(childEntity)
      .expect(200);

    // Get public parents using set[publics]
    const filterStr = 'set[publics]=true';
    const response = await client
      .get(`/entities/${childResponse.body._id}/parents`)
      .query(filterStr)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Public Parent');
    expect(response.body[0]._visibility).to.equal('public');
  });

  it('set-filter: combines multiple sets with AND operator', async () => {
    // Set up the application
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 7);

    // Create active and public parent entity
    const activePublicParent = await client
      .post('/entities')
      .send({
        _name: 'Active Public Parent',
        _kind: 'book',
        _visibility: 'public',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: futureDate.toISOString(),
      })
      .expect(200);

    // Create active but private parent entity
    const activePrivateParent = await client
      .post('/entities')
      .send({
        _name: 'Active Private Parent',
        _kind: 'book',
        _visibility: 'private',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: futureDate.toISOString(),
      })
      .expect(200);

    // Create inactive but public parent entity
    const inactivePublicParent = await client
      .post('/entities')
      .send({
        _name: 'Inactive Public Parent',
        _kind: 'book',
        _visibility: 'public',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: pastDate.toISOString(),
      })
      .expect(200);

    // Create inactive and private parent entity
    const inactivePrivateParent = await client
      .post('/entities')
      .send({
        _name: 'Inactive Private Parent',
        _kind: 'book',
        _visibility: 'private',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: pastDate.toISOString(),
      })
      .expect(200);

    // Create child entity with all parents
    const childEntity: Partial<GenericEntity> = {
      _name: 'Child Entity',
      _kind: 'book',
      _parents: [
        `tapp://localhost/entities/${activePublicParent.body._id}`,
        `tapp://localhost/entities/${activePrivateParent.body._id}`,
        `tapp://localhost/entities/${inactivePublicParent.body._id}`,
        `tapp://localhost/entities/${inactivePrivateParent.body._id}`,
      ],
    };

    const childResponse = await client
      .post('/entities')
      .send(childEntity)
      .expect(200);

    // Get parents that are both active AND public using set[and]
    const filterStr = 'set[and][0][actives]=true&set[and][1][publics]=true';
    const response = await client
      .get(`/entities/${childResponse.body._id}/parents`)
      .query(filterStr)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]._name).to.equal('Active Public Parent');
    expect(response.body[0]._visibility).to.equal('public');
    expect(response.body[0]._validUntilDateTime).to.equal(
      futureDate.toISOString(),
    );
  });

  it('set-filter: combines multiple sets with OR operator', async () => {
    // Set up the application
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 7);

    // Create active parent entity
    const activeParent = await client
      .post('/entities')
      .send({
        _name: 'Active Parent',
        _kind: 'book',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: futureDate.toISOString(),
        _visibility: 'private',
      })
      .expect(200);

    // Create public parent entity (but not active)
    const publicParent = await client
      .post('/entities')
      .send({
        _name: 'Public Parent',
        _kind: 'book',
        _visibility: 'public',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: pastDate.toISOString(),
      })
      .expect(200);

    // Create inactive private parent entity
    const inactivePrivateParent = await client
      .post('/entities')
      .send({
        _name: 'Inactive Private Parent',
        _kind: 'book',
        _visibility: 'private',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: pastDate.toISOString(),
      })
      .expect(200);

    // Create child entity with all parents
    const childEntity: Partial<GenericEntity> = {
      _name: 'Child Entity',
      _kind: 'book',
      _parents: [
        `tapp://localhost/entities/${activeParent.body._id}`,
        `tapp://localhost/entities/${publicParent.body._id}`,
        `tapp://localhost/entities/${inactivePrivateParent.body._id}`,
      ],
    };

    const childResponse = await client
      .post('/entities')
      .send(childEntity)
      .expect(200);

    // Get parents that are either active OR public using set[or]
    const filterStr = 'set[or][0][actives]=true&set[or][1][publics]=true';
    const response = await client
      .get(`/entities/${childResponse.body._id}/parents`)
      .query(filterStr)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(2);
    expect(response.body.map((p: GenericEntity) => p._name).sort()).to.eql([
      'Active Parent',
      'Public Parent',
    ]);
  });

  it('set-filter: filters entities by audience groups', async () => {
    // Set up the application
    appWithClient = await setupApplication({
      entity_kinds: 'book',
      visibility_entity: 'protected',
      autoapprove_entity: 'true',
    });
    ({ client } = appWithClient);

    const ownerGroup = 'group-123';
    const viewerGroup = 'group-456';
    const otherGroup = 'group-789';

    // Create parent entity with owner group
    const ownerGroupParent = await client
      .post('/entities')
      .send({
        _name: 'Owner Group Parent',
        _kind: 'book',
        _ownerGroups: [ownerGroup],
      })
      .expect(200);

    // Create parent entity with viewer group
    const viewerGroupParent = await client
      .post('/entities')
      .send({
        _name: 'Viewer Group Parent',
        _kind: 'book',
        _viewerGroups: [viewerGroup],
      })
      .expect(200);

    // Create parent entity with neither owner nor viewer group
    const otherParent = await client
      .post('/entities')
      .send({
        _name: 'Other Parent',
        _kind: 'book',
      })
      .expect(200);

    // Create child entity with all parents
    const childEntity: Partial<GenericEntity> = {
      _name: 'Child Entity',
      _kind: 'book',
      _parents: [
        `tapp://localhost/entities/${ownerGroupParent.body._id}`,
        `tapp://localhost/entities/${viewerGroupParent.body._id}`,
        `tapp://localhost/entities/${otherParent.body._id}`,
      ],
    };

    const childResponse = await client
      .post('/entities')
      .send(childEntity)
      .expect(200);

    // Get parents for owner group using set[audience]
    const ownerFilterStr = `set[audience][groupIds]=${ownerGroup}`;
    const ownerResponse = await client
      .get(`/entities/${childResponse.body._id}/parents`)
      .query(ownerFilterStr)
      .expect(200);

    expect(ownerResponse.body).to.be.Array().and.have.length(1);
    expect(ownerResponse.body[0]._name).to.equal('Owner Group Parent');
    expect(ownerResponse.body[0]._ownerGroups).to.containDeep([ownerGroup]);

    // Get parents for viewer group using set[audience]
    const viewerFilterStr = `set[audience][groupIds]=${viewerGroup}`;
    const viewerResponse = await client
      .get(`/entities/${childResponse.body._id}/parents`)
      .query(viewerFilterStr)
      .expect(200);

    expect(viewerResponse.body).to.be.Array().and.have.length(1);
    expect(viewerResponse.body[0]._name).to.equal('Viewer Group Parent');
    expect(viewerResponse.body[0]._viewerGroups).to.containDeep([viewerGroup]);

    // Get parents for group with no access
    const otherFilterStr = `set[audience][groupIds]=${otherGroup}`;
    const otherResponse = await client
      .get(`/entities/${childResponse.body._id}/parents`)
      .query(otherFilterStr)
      .expect(200);

    expect(otherResponse.body).to.be.Array().and.have.length(0);

    // Test combined user and group audience filtering
    const combinedFilterStr = `set[audience][userIds]=user-999&set[audience][groupIds]=${viewerGroup}`;
    const combinedResponse = await client
      .get(`/entities/${childResponse.body._id}/parents`)
      .query(combinedFilterStr)
      .expect(200);

    expect(combinedResponse.body).to.be.Array().and.have.length(1);
    expect(combinedResponse.body[0]._name).to.equal('Viewer Group Parent');
  });

  it('field-selection: includes only specified fields', async () => {
    // Set up the application
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create parent entity with multiple fields
    const parentEntity = await client
      .post('/entities')
      .send({
        _name: 'Parent Entity',
        _kind: 'book',
        description: 'This is a detailed description',
        _visibility: 'public',
        _ownerUsers: ['user-123'],
        customField: 'custom value',
      })
      .expect(200);

    // Create child entity with parent reference
    const childEntity: Partial<GenericEntity> = {
      _name: 'Child Entity',
      _kind: 'book',
      _parents: [`tapp://localhost/entities/${parentEntity.body._id}`],
    };

    const childResponse = await client
      .post('/entities')
      .send(childEntity)
      .expect(200);

    // Get parents with only specific fields
    const response = await client
      .get(`/entities/${childResponse.body._id}/parents`)
      .query({
        filter: {
          fields: {
            _id: true,
            _name: true,
            _kind: true,
            description: true,
          },
        },
      })
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]).to.have.properties([
      '_id',
      '_name',
      '_kind',
      'description',
    ]);
    expect(response.body[0]).to.not.have.properties([
      '_visibility',
      '_ownerUsers',
      'customField',
    ]);
    expect(response.body[0]._name).to.equal('Parent Entity');
    expect(response.body[0]._kind).to.equal('book');
    expect(response.body[0].description).to.equal(
      'This is a detailed description',
    );
  });

  it('field-selection: excludes specified fields', async () => {
    // Set up the application
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create parent entity with multiple fields
    const parentEntity = await client
      .post('/entities')
      .send({
        _name: 'Parent Entity',
        _kind: 'book',
        description: 'This is a detailed description',
        _visibility: 'public',
        _ownerUsers: ['user-123'],
        _viewerUsers: ['user-456'],
        customField: 'custom value',
      })
      .expect(200);

    // Create child entity with parent reference
    const childEntity: Partial<GenericEntity> = {
      _name: 'Child Entity',
      _kind: 'book',
      _parents: [`tapp://localhost/entities/${parentEntity.body._id}`],
    };

    const childResponse = await client
      .post('/entities')
      .send(childEntity)
      .expect(200);

    // Get parents excluding specific fields
    const response = await client
      .get(`/entities/${childResponse.body._id}/parents`)
      .query({
        filter: {
          fields: {
            _ownerUsers: false,
            _viewerUsers: false,
            customField: false,
          },
        },
      })
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    expect(response.body[0]).to.have.properties([
      '_id',
      '_name',
      '_kind',
      '_visibility',
    ]);
    expect(response.body[0]).to.not.have.properties([
      '_ownerUsers',
      '_viewerUsers',
      'customField',
      'description', // Due to Loopback's behavior with arbitrary fields, description will also be excluded
    ]);
    expect(response.body[0]._name).to.equal('Parent Entity');
    expect(response.body[0]._visibility).to.equal('public');
  });

  it('lookup: resolves references with complex filters, sets, and pagination', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,author,review',
      visibility_entity: 'public',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 7);

    // Create multiple parent entities with different properties
    const activePublicAuthor = await client
      .post('/entities')
      .send({
        _name: 'Active Public Author',
        _kind: 'author',
        _visibility: 'public',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: futureDate.toISOString(),
        nationality: 'British',
        birthYear: 1960,
        relatedReviews: [
          'tapp://localhost/entities/review1',
          'tapp://localhost/entities/review2',
        ],
      })
      .expect(200);

    const inactivePublicAuthor = await client
      .post('/entities')
      .send({
        _name: 'Inactive Public Author',
        _kind: 'author',
        _visibility: 'public',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: pastDate.toISOString(),
        nationality: 'American',
        birthYear: 1970,
        relatedReviews: [],
      })
      .expect(200);

    const activePrivateAuthor = await client
      .post('/entities')
      .send({
        _name: 'Active Private Author',
        _kind: 'author',
        _visibility: 'private',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: futureDate.toISOString(),
        nationality: 'French',
        birthYear: 1980,
        relatedReviews: ['tapp://localhost/entities/review3'],
      })
      .expect(200);

    // Create review entities that will be referenced
    const review1 = await client
      .post('/entities')
      .send({
        _name: 'Review 1',
        _kind: 'review',
        _visibility: 'public',
        rating: 5, // Store as string to match query parameter type
        content: 'Excellent author',
      })
      .expect(200);

    const review2 = await client
      .post('/entities')
      .send({
        _name: 'Review 2',
        _kind: 'review',
        _visibility: 'public',
        rating: 4, // Store as string to match query parameter type
        content: 'Very good author',
      })
      .expect(200);

    const review3 = await client
      .post('/entities')
      .send({
        _name: 'Review 3',
        _kind: 'review',
        _visibility: 'private',
        rating: 3, // Store as string to match query parameter type
        content: 'Good author',
      })
      .expect(200);

    // Update authors with actual review references
    await client
      .patch(`/entities/${activePublicAuthor.body._id}`)
      .send({
        relatedReviews: [
          `tapp://localhost/entities/${review1.body._id}`,
          `tapp://localhost/entities/${review2.body._id}`,
        ],
      })
      .expect(204);

    await client
      .patch(`/entities/${activePrivateAuthor.body._id}`)
      .send({
        relatedReviews: [`tapp://localhost/entities/${review3.body._id}`],
      })
      .expect(204);

    // Create a book with parent references
    const bookWithAuthors = await client
      .post('/entities')
      .send({
        _name: 'Book with Authors',
        _kind: 'book',
        _parents: [
          `tapp://localhost/entities/${activePublicAuthor.body._id}`,
          `tapp://localhost/entities/${inactivePublicAuthor.body._id}`,
          `tapp://localhost/entities/${activePrivateAuthor.body._id}`,
        ],
      })
      .expect(200);

    // Test lookup with complex filter, set filter, and pagination
    const queryStr =
      'filter[where][nationality]=British&' +
      'filter[lookup][0][prop]=relatedReviews&' +
      'filter[lookup][0][scope][where][rating][gt]=3&' +
      'filter[lookup][0][scope][where][rating][type]=number&' +
      'filter[order][0]=birthYear DESC&' +
      'filter[skip]=0&' +
      'filter[limit]=2&' +
      'set[actives]=true&' +
      'set[publics]=true';

    const response = await client
      .get(`/entities/${bookWithAuthors.body._id}/parents?${queryStr}`)
      .expect(200);

    // Verify response
    expect(response.body).to.be.Array();
    expect(response.body).to.have.length(1);
    expect(response.body[0]).to.containDeep({
      _id: activePublicAuthor.body._id,
      _name: 'Active Public Author',
      _kind: 'author',
      _visibility: 'public',
      nationality: 'British',
      birthYear: 1960,
    });

    // Verify that inactive and private authors are filtered out
    expect(
      response.body.some(
        (author: any) =>
          author._id === inactivePublicAuthor.body._id ||
          author._id === activePrivateAuthor.body._id,
      ),
    ).to.be.false();

    // Verify relatedReviews is included and properly filtered
    expect(response.body[0]).to.have.property('relatedReviews');
    expect(response.body[0].relatedReviews).to.be.Array();
    expect(response.body[0].relatedReviews).to.have.length(2);
    expect(
      response.body[0].relatedReviews.every(
        (review: any) => review.rating > '3',
      ),
    ).to.be.true();
  });

  it('lookup: resolves references in arbitrary fields with complex filters', async () => {
    // Set up the application
    appWithClient = await setupApplication({
      entity_kinds: 'book,author',
    });
    ({ client } = appWithClient);

    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(pastDate.getDate() - 1);
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + 7);

    // Create referenced entities (authors) with different properties
    const activeAuthor = await client
      .post('/entities')
      .send({
        _name: 'Active Author',
        _kind: 'author',
        _visibility: 'public',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: futureDate.toISOString(),
        nationality: 'British',
        rating: 4.5,
      })
      .expect(200);

    const inactiveAuthor = await client
      .post('/entities')
      .send({
        _name: 'Inactive Author',
        _kind: 'author',
        _visibility: 'public',
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: pastDate.toISOString(),
        nationality: 'American',
        rating: 3.8,
      })
      .expect(200);

    // Create parent entity (book) with references in an arbitrary field
    const parentBook = await client
      .post('/entities')
      .send({
        _name: 'Book with Authors',
        _kind: 'book',
        relatedAuthors: [
          `tapp://localhost/entities/${activeAuthor.body._id}`,
          `tapp://localhost/entities/${inactiveAuthor.body._id}`,
          'tapp://localhost/entities/non-existent-id',
          'invalid-uri-format',
        ],
      })
      .expect(200);

    // Create child entity referencing the parent book
    const childBook = await client
      .post('/entities')
      .send({
        _name: 'Sequel Book',
        _kind: 'book',
        _parents: [`tapp://localhost/entities/${parentBook.body._id}`],
      })
      .expect(200);

    // Get parent with lookup on arbitrary field, using complex filter
    const queryStr =
      'filter[lookup][0][prop]=relatedAuthors&' +
      'filter[lookup][0][scope][where][and][0][rating][gt]=4&' +
      'filter[lookup][0][scope][where][and][0][rating][type]=number&' +
      `filter[lookup][0][scope][where][and][1][or][0][_validUntilDateTime][gt]=${encodeURIComponent(now.toISOString())}&` +
      'filter[lookup][0][scope][where][and][1][or][1][_validUntilDateTime][eq]=null&' +
      'filter[lookup][0][scope][order][0]=rating DESC';

    const response = await client
      .get(`/entities/${childBook.body._id}/parents?${queryStr}`)
      .expect(200);

    // Verify response
    expect(response.body).to.be.Array();
    expect(response.body).to.have.length(1);
    expect(response.body[0]).to.containDeep({
      _id: parentBook.body._id,
      _name: 'Book with Authors',
      _kind: 'book',
    });

    // Verify lookup results
    expect(response.body[0]).to.have.property('relatedAuthors');
    expect(response.body[0].relatedAuthors).to.be.Array();
    expect(response.body[0].relatedAuthors).to.have.length(1);
    expect(response.body[0].relatedAuthors[0]).to.containDeep({
      _id: activeAuthor.body._id,
      _name: 'Active Author',
      rating: 4.5,
      nationality: 'British',
    });

    // Verify that inactive author and invalid references are not included
    expect(
      response.body[0].relatedAuthors.some(
        (author: any) => author._id === inactiveAuthor.body._id,
      ),
    ).to.be.false();
  });
});
