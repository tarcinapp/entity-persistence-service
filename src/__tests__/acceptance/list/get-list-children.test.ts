import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestList,
} from '../test-helper';

describe('GET /lists/{id}/children', () => {
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

  it('field-selection: supports nested field selection in lookups', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading,author,publisher',
    });
    ({ client } = appWithClient);

    // Create publisher list
    const publisher = await createTestList(client, {
      _name: 'Test Publisher',
      _kind: 'publisher',
      country: 'DE',
      founded: 1950,
      description: 'A test publisher description',
    });

    // Create author list with publisher reference
    const author = await createTestList(client, {
      _name: 'Test Author',
      _kind: 'author',
      nationality: 'DE',
      rating: 5,
      publisher: `tapp://localhost/lists/${publisher}`,
      description: 'A test author description',
    });

    // Create parent list
    const parentList = await createTestList(client, {
      _name: 'Parent Reading List',
      _kind: 'reading',
      description: 'A parent reading list',
    });

    // Create child list with author reference
    await createTestList(client, {
      _name: 'Child Reading List',
      _kind: 'reading',
      description: 'A child reading list',
      relatedAuthors: [`tapp://localhost/lists/${author}`],
      _parents: [`tapp://localhost/lists/${parentList}`],
    });

    // Get children with nested field selection and lookups
    const queryStr =
      `filter[fields][_name]=true&` +
      `filter[fields][relatedAuthors]=true&` +
      `filter[lookup][0][prop]=relatedAuthors&` +
      `filter[lookup][0][scope][fields][_name]=true&` +
      `filter[lookup][0][scope][fields][publisher]=true&` +
      `filter[lookup][0][scope][lookup][0][prop]=publisher&` +
      `filter[lookup][0][scope][lookup][0][scope][fields][_name]=true&` +
      `filter[lookup][0][scope][lookup][0][scope][fields][country]=true`;

    const response = await client
      .get(`/lists/${parentList}/children?${queryStr}`)
      .expect(200);

    expect(response.body).to.be.Array().and.have.length(1);
    const childResult = response.body[0];

    // Verify child fields selection
    expect(childResult).to.have.property('_name', 'Child Reading List');
    expect(childResult).to.have.property('relatedAuthors');
    expect(childResult).to.not.have.property('description');

    // Verify author fields selection
    expect(childResult.relatedAuthors).to.be.Array().and.have.length(1);
    const authorResult = childResult.relatedAuthors[0];
    expect(authorResult).to.have.property('_name', 'Test Author');
    expect(authorResult).to.have.property('publisher');
    expect(authorResult).to.not.have.property('nationality');
    expect(authorResult).to.not.have.property('rating');

    // Verify publisher fields selection
    const publisherResult = authorResult.publisher;
    expect(publisherResult).to.have.property('_name', 'Test Publisher');
    expect(publisherResult).to.have.property('country', 'DE');
    expect(publisherResult).to.not.have.property('founded');
    expect(publisherResult).to.not.have.property('description');
  });

  it('returns 404 when list is not found', async () => {
    // Set up the application with default configuration
    appWithClient = await setupApplication({
      list_kinds: 'reading',
    });
    ({ client } = appWithClient);

    // Try to get children of a non-existent list
    const nonExistentId = 'non-existent-id';
    const response = await client
      .get(`/lists/${nonExistentId}/children`)
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
