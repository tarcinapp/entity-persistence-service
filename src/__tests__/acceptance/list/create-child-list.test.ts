import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { List } from '../../../models';
import type { AppWithClient } from '../test-helper';
import { setupApplication, teardownApplication } from '../test-helper';

describe('POST /lists/{id}/children', () => {
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

  it('returns 404 when parent list does not exist', async () => {
    appWithClient = await setupApplication({
      // use default values
    });
    ({ client } = appWithClient);

    const nonExistentId = 'non-existent-id';
    const childList: Partial<List> = {
      _name: 'Child List',
      _kind: 'list',
      description: 'A child list',
    };

    const response = await client
      .post(`/lists/${nonExistentId}/children`)
      .send(childList)
      .expect(404);

    // Verify error response
    expect(response.body.error).to.have.property('statusCode', 404);
    expect(response.body.error).to.have.property('name', 'NotFoundError');
    expect(response.body.error).to.have.property(
      'message',
      `List with id '${nonExistentId}' could not be found.`,
    );
    expect(response.body.error).to.have.property('code', 'LIST-NOT-FOUND');
  });

  it('creates a child list under a parent list', async () => {
    appWithClient = await setupApplication({
      // use default values
    });
    ({ client } = appWithClient);

    // First create a parent list
    const parentList: Partial<List> = {
      _name: 'Parent List',
      _kind: 'list',
      description: 'A parent list',
    };

    const parentResponse = await client
      .post('/lists')
      .send(parentList)
      .expect(200);

    // Verify parent list was created successfully
    expect(parentResponse.body._id).to.be.String();
    expect(parentResponse.body._name).to.be.equal('Parent List');
    expect(parentResponse.body._slug).to.be.equal('parent-list');

    // Create a child list under the parent
    const childList: Partial<List> = {
      _name: 'Child List',
      _kind: 'list',
      description: 'A child list',
    };

    const childResponse = await client
      .post(`/lists/${parentResponse.body._id}/children`)
      .send(childList)
      .expect(200);

    // Verify child list was created successfully
    expect(childResponse.body._id).to.be.String();
    expect(childResponse.body._name).to.be.equal('Child List');
    expect(childResponse.body._slug).to.be.equal('child-list');
    expect(childResponse.body._parents).to.be.Array().lengthOf(1);
    expect(childResponse.body._parents[0]).to.be.equal(
      `tapp://localhost/lists/${parentResponse.body._id}`,
    );

    // Verify the relationship by getting the parent's children
    const childrenResponse = await client
      .get(`/lists/${parentResponse.body._id}/children`)
      .expect(200);

    expect(childrenResponse.body).to.be.Array().lengthOf(1);
    expect(childrenResponse.body[0]._id).to.be.equal(childResponse.body._id);
  });
});
