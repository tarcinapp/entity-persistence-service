import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { GenericEntity } from '../../../models';
import type { AppWithClient } from '../test-helper';
import { setupApplication, teardownApplication } from '../test-helper';

describe('POST /entities/{id}/children', () => {
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

  it('creates a child entity under a parent entity', async () => {
    appWithClient = await setupApplication({
      // use default values
    });
    ({ client } = appWithClient);

    // First create a parent entity
    const parentEntity: Partial<GenericEntity> = {
      _name: 'Parent Entity',
      _kind: 'entity',
      description: 'A parent entity',
    };

    const parentResponse = await client
      .post('/entities')
      .send(parentEntity)
      .expect(200);

    // Verify parent entity was created successfully
    expect(parentResponse.body._id).to.be.String();
    expect(parentResponse.body._name).to.be.equal('Parent Entity');
    expect(parentResponse.body._slug).to.be.equal('parent-entity');

    // Create a child entity under the parent
    const childEntity: Partial<GenericEntity> = {
      _name: 'Child Entity',
      _kind: 'entity',
      description: 'A child entity',
    };

    const childResponse = await client
      .post(`/entities/${parentResponse.body._id}/children`)
      .send(childEntity)
      .expect(200);

    // Verify child entity was created successfully
    expect(childResponse.body._id).to.be.String();
    expect(childResponse.body._name).to.be.equal('Child Entity');
    expect(childResponse.body._slug).to.be.equal('child-entity');
    expect(childResponse.body._parents).to.be.Array().lengthOf(1);
    expect(childResponse.body._parents[0]).to.be.equal(
      `tapp://localhost/entities/${parentResponse.body._id}`,
    );

    // Verify the relationship by getting the parent's children
    const childrenResponse = await client
      .get(`/entities/${parentResponse.body._id}/children`)
      .expect(200);

    expect(childrenResponse.body).to.be.Array().lengthOf(1);
    expect(childrenResponse.body[0]._id).to.be.equal(childResponse.body._id);
  });
});
