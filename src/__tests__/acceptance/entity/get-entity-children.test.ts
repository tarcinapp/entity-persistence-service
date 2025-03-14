import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { GenericEntity } from '../../../models';
import { setupApplication, teardownApplication } from '../test-helper';
import type { AppWithClient } from '../test-helper';

describe('GET /entities/{entityId}/children', () => {
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

  it('basic: returns child entities for a given entity', async () => {
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

    // Create child entity with parent reference
    const childEntity: Partial<GenericEntity> = {
      _name: 'Child Entity',
      _kind: 'book',
      description: 'This is the child entity',
      _parents: [`tapp://localhost/entities/${parentResponse.body._id}`],
    };

    const childResponse = await client
      .post('/entities')
      .send(childEntity)
      .expect(200);

    // Get children of the parent entity
    const childrenResponse = await client
      .get(`/entities/${parentResponse.body._id}/children`)
      .expect(200);

    // Verify the response
    expect(childrenResponse.body).to.be.an.Array();
    expect(childrenResponse.body).to.have.length(1);
    expect(childrenResponse.body[0]).to.containDeep({
      _id: childResponse.body._id,
      _name: 'Child Entity',
      _kind: 'book',
      description: 'This is the child entity',
    });
  });

  it('filter: by kind', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,movie',
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

    // Create child entities of different kinds
    const bookChild: Partial<GenericEntity> = {
      _name: 'Book Child',
      _kind: 'book',
      description: 'This is a book child',
      _parents: [`tapp://localhost/entities/${parentResponse.body._id}`],
    };

    const movieChild: Partial<GenericEntity> = {
      _name: 'Movie Child',
      _kind: 'movie',
      description: 'This is a movie child',
      _parents: [`tapp://localhost/entities/${parentResponse.body._id}`],
    };

    await client.post('/entities').send(bookChild).expect(200);
    await client.post('/entities').send(movieChild).expect(200);

    // Get only book children
    const childrenResponse = await client
      .get(`/entities/${parentResponse.body._id}/children`)
      .query({ filter: { where: { _kind: 'book' } } })
      .expect(200);

    expect(childrenResponse.body).to.be.Array().and.have.length(1);
    expect(childrenResponse.body[0]._name).to.equal('Book Child');
    expect(childrenResponse.body[0]._kind).to.equal('book');
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

    // Create parent entity
    const parentEntity: Partial<GenericEntity> = {
      _name: 'Parent Entity',
      _kind: 'book',
    };

    const parentResponse = await client
      .post('/entities')
      .send(parentEntity)
      .expect(200);

    // Create active child entity
    const activeChild: Partial<GenericEntity> = {
      _name: 'Active Child',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: futureDate.toISOString(),
      _parents: [`tapp://localhost/entities/${parentResponse.body._id}`],
    };

    // Create inactive child entity
    const inactiveChild: Partial<GenericEntity> = {
      _name: 'Inactive Child',
      _kind: 'book',
      _validFromDateTime: pastDate.toISOString(),
      _validUntilDateTime: pastDate.toISOString(),
      _parents: [`tapp://localhost/entities/${parentResponse.body._id}`],
    };

    await client.post('/entities').send(activeChild).expect(200);
    await client.post('/entities').send(inactiveChild).expect(200);

    // Get only active children using complex filter
    const filterStr =
      `filter[where][and][0][or][0][_validUntilDateTime][eq]=null&` +
      `filter[where][and][0][or][1][_validUntilDateTime][gt]=${encodeURIComponent(now.toISOString())}&` +
      `filter[where][and][1][_validFromDateTime][neq]=null&` +
      `filter[where][and][2][_validFromDateTime][lt]=${encodeURIComponent(now.toISOString())}`;

    const childrenResponse = await client
      .get(`/entities/${parentResponse.body._id}/children`)
      .query(filterStr)
      .expect(200);

    expect(childrenResponse.body).to.be.Array().and.have.length(1);
    expect(childrenResponse.body[0]._name).to.equal('Active Child');
  });

  it('filter: by visibility', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create parent entity
    const parentEntity: Partial<GenericEntity> = {
      _name: 'Parent Entity',
      _kind: 'book',
    };

    const parentResponse = await client
      .post('/entities')
      .send(parentEntity)
      .expect(200);

    // Create public child entity
    const publicChild: Partial<GenericEntity> = {
      _name: 'Public Child',
      _kind: 'book',
      _visibility: 'public',
      _parents: [`tapp://localhost/entities/${parentResponse.body._id}`],
    };

    // Create private child entity
    const privateChild: Partial<GenericEntity> = {
      _name: 'Private Child',
      _kind: 'book',
      _visibility: 'private',
      _parents: [`tapp://localhost/entities/${parentResponse.body._id}`],
    };

    await client.post('/entities').send(publicChild).expect(200);
    await client.post('/entities').send(privateChild).expect(200);

    // Get only public children
    const childrenResponse = await client
      .get(`/entities/${parentResponse.body._id}/children`)
      .query({ filter: { where: { _visibility: 'public' } } })
      .expect(200);

    expect(childrenResponse.body).to.be.Array().and.have.length(1);
    expect(childrenResponse.body[0]._name).to.equal('Public Child');
    expect(childrenResponse.body[0]._visibility).to.equal('public');
  });

  it('filter: by owner', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    const owner1 = 'user-123';
    const owner2 = 'user-456';

    // Create parent entity
    const parentEntity: Partial<GenericEntity> = {
      _name: 'Parent Entity',
      _kind: 'book',
    };

    const parentResponse = await client
      .post('/entities')
      .send(parentEntity)
      .expect(200);

    // Create child entity with owner1
    const child1: Partial<GenericEntity> = {
      _name: 'Owner1 Child',
      _kind: 'book',
      _ownerUsers: [owner1],
      _parents: [`tapp://localhost/entities/${parentResponse.body._id}`],
    };

    // Create child entity with owner2
    const child2: Partial<GenericEntity> = {
      _name: 'Owner2 Child',
      _kind: 'book',
      _ownerUsers: [owner2],
      _parents: [`tapp://localhost/entities/${parentResponse.body._id}`],
    };

    await client.post('/entities').send(child1).expect(200);
    await client.post('/entities').send(child2).expect(200);

    // Get children for owner1
    const filterStr = `filter[where][_ownerUsers][inq][]=${owner1}`;

    const childrenResponse = await client
      .get(`/entities/${parentResponse.body._id}/children`)
      .query(filterStr)
      .expect(200);

    expect(childrenResponse.body).to.be.Array().and.have.length(1);
    expect(childrenResponse.body[0]._name).to.equal('Owner1 Child');
    expect(childrenResponse.body[0]._ownerUsers).to.containDeep([owner1]);
  });

  it('filter: by nationality', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create parent entity
    const parentEntity: Partial<GenericEntity> = {
      _name: 'Parent Entity',
      _kind: 'book',
    };

    const parentResponse = await client
      .post('/entities')
      .send(parentEntity)
      .expect(200);

    // Create child entities with different nationalities
    const germanChild: Partial<GenericEntity> = {
      _name: 'German Child',
      _kind: 'book',
      nationality: 'DE',
      _parents: [`tapp://localhost/entities/${parentResponse.body._id}`],
    };

    const frenchChild: Partial<GenericEntity> = {
      _name: 'French Child',
      _kind: 'book',
      nationality: 'FR',
      _parents: [`tapp://localhost/entities/${parentResponse.body._id}`],
    };

    await client.post('/entities').send(germanChild).expect(200);
    await client.post('/entities').send(frenchChild).expect(200);

    // Get only German children
    const childrenResponse = await client
      .get(`/entities/${parentResponse.body._id}/children`)
      .query({ filter: { where: { nationality: 'DE' } } })
      .expect(200);

    expect(childrenResponse.body).to.be.Array().and.have.length(1);
    expect(childrenResponse.body[0]._name).to.equal('German Child');
    expect(childrenResponse.body[0].nationality).to.equal('DE');
  });

  it('filter: by rating with type hint', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book',
    });
    ({ client } = appWithClient);

    // Create parent entity
    const parentEntity: Partial<GenericEntity> = {
      _name: 'Parent Entity',
      _kind: 'book',
    };

    const parentResponse = await client
      .post('/entities')
      .send(parentEntity)
      .expect(200);

    // Create child entities with different ratings
    const highRatedChild: Partial<GenericEntity> = {
      _name: 'High Rated Child',
      _kind: 'book',
      rating: 4,
      _parents: [`tapp://localhost/entities/${parentResponse.body._id}`],
    };

    const lowRatedChild: Partial<GenericEntity> = {
      _name: 'Low Rated Child',
      _kind: 'book',
      rating: 2,
      _parents: [`tapp://localhost/entities/${parentResponse.body._id}`],
    };

    await client.post('/entities').send(highRatedChild).expect(200);
    await client.post('/entities').send(lowRatedChild).expect(200);

    // Get only high rated children using type hint
    const filterStr = `filter[where][rating][gt]=3&filter[where][rating][type]=number`;

    const childrenResponse = await client
      .get(`/entities/${parentResponse.body._id}/children`)
      .query(filterStr)
      .expect(200);

    expect(childrenResponse.body).to.be.Array().and.have.length(1);
    expect(childrenResponse.body[0]._name).to.equal('High Rated Child');
    expect(childrenResponse.body[0].rating).to.equal(4);
  });

  it('lookup: resolves references with complex filters', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,author',
    });
    ({ client } = appWithClient);

    const now = new Date();

    // Create parent entity
    const parentEntity: Partial<GenericEntity> = {
      _name: 'Parent Entity',
      _kind: 'book',
    };

    const parentResponse = await client
      .post('/entities')
      .send(parentEntity)
      .expect(200);

    // Create author entities
    const author1: Partial<GenericEntity> = {
      _name: 'Popular Author',
      _kind: 'author',
      rating: 5,
      _validUntilDateTime: null,
    };

    const author2: Partial<GenericEntity> = {
      _name: 'Unpopular Author',
      _kind: 'author',
      rating: 2,
      _validUntilDateTime: now.toISOString(),
    };

    const author1Response = await client
      .post('/entities')
      .send(author1)
      .expect(200);
    const author2Response = await client
      .post('/entities')
      .send(author2)
      .expect(200);

    // Create child entities with author references
    const child1: Partial<GenericEntity> = {
      _name: 'Child by Popular Author',
      _kind: 'book',
      relatedAuthors: [`tapp://localhost/entities/${author1Response.body._id}`],
      _parents: [`tapp://localhost/entities/${parentResponse.body._id}`],
    };

    const child2: Partial<GenericEntity> = {
      _name: 'Child by Unpopular Author',
      _kind: 'book',
      relatedAuthors: [`tapp://localhost/entities/${author2Response.body._id}`],
      _parents: [`tapp://localhost/entities/${parentResponse.body._id}`],
    };

    await client.post('/entities').send(child1).expect(200);
    await client.post('/entities').send(child2).expect(200);

    // Get children with lookup filter for highly rated and active authors
    const queryStr =
      `filter[lookup][0][prop]=relatedAuthors&` +
      `filter[lookup][0][scope][where][and][0][rating][gt]=4&` +
      `filter[lookup][0][scope][where][and][0][rating][type]=number&` +
      `filter[lookup][0][scope][where][and][1][or][0][_validUntilDateTime][eq]=null&` +
      `filter[lookup][0][scope][where][and][1][or][1][_validUntilDateTime][gt]=${encodeURIComponent(now.toISOString())}`;

    const childrenResponse = await client
      .get(`/entities/${parentResponse.body._id}/children`)
      .query(queryStr)
      .expect(200);

    // Sort results by name for consistent testing
    const sortedResults = childrenResponse.body.sort((a: any, b: any) =>
      a._name.localeCompare(b._name),
    );

    expect(sortedResults).to.be.Array().and.have.length(2);

    // Check the book with popular author (comes first alphabetically)
    const popularBook = sortedResults[0];
    expect(popularBook._name).to.equal('Child by Popular Author');
    expect(popularBook.relatedAuthors).to.be.Array().and.have.length(1);
    expect(popularBook.relatedAuthors[0]._name).to.equal('Popular Author');
    expect(popularBook.relatedAuthors[0].rating).to.equal(5);

    // Check the book with no matching authors
    const unpopularBook = sortedResults[1];
    expect(unpopularBook._name).to.equal('Child by Unpopular Author');
    expect(unpopularBook.relatedAuthors).to.be.Array().and.have.length(0);
  });

  it('lookup: resolves references with simple equality filter', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,author',
    });
    ({ client } = appWithClient);

    // Create parent entity
    const parentEntity: Partial<GenericEntity> = {
      _name: 'Parent Entity',
      _kind: 'book',
    };

    const parentResponse = await client
      .post('/entities')
      .send(parentEntity)
      .expect(200);

    // Create author entities
    const author1: Partial<GenericEntity> = {
      _name: 'Author One',
      _kind: 'author',
      nationality: 'DE',
    };

    const author2: Partial<GenericEntity> = {
      _name: 'Author Two',
      _kind: 'author',
      nationality: 'FR',
    };

    const author1Response = await client
      .post('/entities')
      .send(author1)
      .expect(200);
    const author2Response = await client
      .post('/entities')
      .send(author2)
      .expect(200);

    // Create child entities with author references
    const child1: Partial<GenericEntity> = {
      _name: 'Child with German Author',
      _kind: 'book',
      relatedAuthors: [`tapp://localhost/entities/${author1Response.body._id}`],
      _parents: [`tapp://localhost/entities/${parentResponse.body._id}`],
    };

    const child2: Partial<GenericEntity> = {
      _name: 'Child with French Author',
      _kind: 'book',
      relatedAuthors: [`tapp://localhost/entities/${author2Response.body._id}`],
      _parents: [`tapp://localhost/entities/${parentResponse.body._id}`],
    };

    await client.post('/entities').send(child1).expect(200);
    await client.post('/entities').send(child2).expect(200);

    // Get children with lookup filter for German authors
    const queryStr =
      `filter[lookup][0][prop]=relatedAuthors&` +
      `filter[lookup][0][scope][where][nationality]=DE`;

    const childrenResponse = await client
      .get(`/entities/${parentResponse.body._id}/children`)
      .query(queryStr)
      .expect(200);

    // Sort results by name for consistent testing
    const sortedResults = childrenResponse.body.sort((a: any, b: any) =>
      a._name.localeCompare(b._name),
    );

    expect(sortedResults).to.be.Array().and.have.length(2);

    // Check the book with French author (should have empty relatedAuthors due to filter)
    const frenchBook = sortedResults[0];
    expect(frenchBook._name).to.equal('Child with French Author');
    expect(frenchBook.relatedAuthors).to.be.Array().and.have.length(0);

    // Check the book with German author
    const germanBook = sortedResults[1];
    expect(germanBook._name).to.equal('Child with German Author');
    expect(germanBook.relatedAuthors).to.be.Array().and.have.length(1);
    expect(germanBook.relatedAuthors[0]._name).to.equal('Author One');
    expect(germanBook.relatedAuthors[0].nationality).to.equal('DE');
  });

  it('lookup: resolves references with pagination', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      entity_kinds: 'book,author',
    });
    ({ client } = appWithClient);

    // Create parent entity
    const parentEntity: Partial<GenericEntity> = {
      _name: 'Parent Entity',
      _kind: 'book',
    };

    const parentResponse = await client
      .post('/entities')
      .send(parentEntity)
      .expect(200);

    // Create author entities
    const authors = Array.from({ length: 5 }, (_, i) => ({
      _name: `Author ${i + 1}`,
      _kind: 'author',
      rating: i + 1,
    }));

    const authorResponses = await Promise.all(
      authors.map((author) =>
        client.post('/entities').send(author).expect(200),
      ),
    );

    // Create child entities with author references
    await Promise.all(
      authorResponses.map((authorResponse, i) =>
        client
          .post('/entities')
          .send({
            _name: `Child with Author ${i + 1}`,
            _kind: 'book',
            relatedAuthors: [
              `tapp://localhost/entities/${authorResponse.body._id}`,
            ],
            _parents: [`tapp://localhost/entities/${parentResponse.body._id}`],
          })
          .expect(200),
      ),
    );

    // Get children with lookup filter and pagination
    const queryStr =
      `filter[lookup][0][prop]=relatedAuthors&` +
      `filter[lookup][0][scope][where][rating][gt]=2&` +
      `filter[lookup][0][scope][where][rating][type]=number&` +
      `filter[lookup][0][scope][order][0]=rating DESC&` +
      `filter[limit]=2&` +
      `filter[skip]=1`;

    const childrenResponse = await client
      .get(`/entities/${parentResponse.body._id}/children`)
      .query(queryStr)
      .expect(200);

    // We get 2 children due to pagination limit
    expect(childrenResponse.body).to.be.Array().and.have.length(2);

    // For each child, verify that relatedAuthors only contains authors with rating > 2
    childrenResponse.body.forEach((child: any) => {
      expect(child.relatedAuthors).to.be.Array();
      if (child.relatedAuthors.length > 0) {
        // If there are related authors, they must have rating > 2
        child.relatedAuthors.forEach((author: any) => {
          expect(author.rating).to.be.greaterThan(2);
        });
      }
    });
  });
});
