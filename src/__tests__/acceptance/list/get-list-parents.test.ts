import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestList,
} from '../test-helper';

describe('GET /lists/{id}/parents', () => {
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

  it('lookup: resolves references in arbitrary fields with complex filters', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading,author',
    });
    ({ client } = appWithClient);

    // Create parent list with references
    const parentList = await createTestList(client, {
      _name: 'Parent Reading List',
      _kind: 'reading',
      description: 'A parent reading list',
      relatedAuthors: [], // Will be populated later
    });

    // Create author lists that will be referenced
    const activeAuthor = await createTestList(client, {
      _name: 'Active Author',
      _kind: 'author',
      rating: 4.5,
      nationality: 'British',
      _validUntilDateTime: null,
    });

    const inactiveAuthor = await createTestList(client, {
      _name: 'Inactive Author',
      _kind: 'author',
      rating: 2,
      nationality: 'American',
      _validUntilDateTime: new Date().toISOString(),
    });

    // Update parent list with author references
    await client.patch(`/lists/${parentList}`).send({
      relatedAuthors: [
        `tapp://localhost/lists/${activeAuthor}`,
        `tapp://localhost/lists/${inactiveAuthor}`,
      ],
    });
    //.expect(204);

    // Create child list with parent reference
    const childList = await createTestList(client, {
      _name: 'Child Reading List',
      _kind: 'reading',
      description: 'A child reading list',
      _parents: [`tapp://localhost/lists/${parentList}`],
    });

    // Get parents with lookup filter for highly rated and active authors
    const queryStr =
      `filter[lookup][0][prop]=relatedAuthors&` +
      `filter[lookup][0][scope][where][and][0][rating][gt]=4&` +
      `filter[lookup][0][scope][where][and][0][rating][type]=number&` +
      `filter[lookup][0][scope][where][and][1][or][0][_validUntilDateTime][eq]=null&` +
      `filter[lookup][0][scope][where][and][1][or][1][_validUntilDateTime][gt]=${encodeURIComponent(new Date().toISOString())}`;

    const response = await client
      .get(`/lists/${childList}/parents?${queryStr}`)
      .expect(200);

    // Verify response
    expect(response.body).to.be.Array();
    expect(response.body).to.have.length(1);
    expect(response.body[0]).to.containDeep({
      _id: parentList,
      _name: 'Parent Reading List',
      _kind: 'reading',
    });

    // Verify lookup results
    expect(response.body[0]).to.have.property('relatedAuthors');
    expect(response.body[0].relatedAuthors).to.be.Array();
    expect(response.body[0].relatedAuthors).to.have.length(1);
    expect(response.body[0].relatedAuthors[0]).to.containDeep({
      _id: activeAuthor,
      _name: 'Active Author',
      rating: 4.5,
      nationality: 'British',
    });

    // Verify that inactive author is not included
    expect(
      response.body[0].relatedAuthors.some(
        (author: any) => author._id === inactiveAuthor,
      ),
    ).to.be.false();
  });

  it('returns 404 when list is not found', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
    });
    ({ client } = appWithClient);

    // Try to get parents of a non-existent list
    const nonExistentId = 'non-existent-id';
    const response = await client
      .get(`/lists/${nonExistentId}/parents`)
      .expect(404);

    // Verify error response
    expect(response.body.error).to.have.property('statusCode', 404);
    expect(response.body.error).to.have.property('name', 'NotFoundError');
    expect(response.body.error).to.have.property(
      'message',
      `List with id '${nonExistentId}' could not be found.`,
    );
    expect(response.body.error).to.have.property('code', 'LIST-NOT-FOUND');
    expect(response.body.error).to.have.property('status', 404);
  });
});
