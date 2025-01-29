import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { GenericListToEntityRelation } from '../../../models';
import {
  setupApplication,
  teardownApplication,
  type AppWithClient,
} from '../test-helper';

describe('POST /generic-list-entity-relations', () => {
  let client: Client;
  let appWithClient: AppWithClient;

  afterEach(async () => {
    await teardownApplication(appWithClient);
  });

  it('creates a relation with default values', async () => {
    appWithClient = await setupApplication({
      autoapprove_list_entity_relations: 'true',
    });
    client = appWithClient.client;

    // First create a list
    const listResponse = await client.post('/generic-lists').send({
      _name: 'test list',
    });
    expect(listResponse.status).to.equal(200);
    const list = listResponse.body;

    // Then create an entity
    const entityResponse = await client.post('/generic-entities').send({
      _name: 'test entity',
    });
    expect(entityResponse.status).to.equal(200);
    const entity = entityResponse.body;

    // Finally create the relation
    const relationResponse = await client
      .post('/generic-list-entity-relations')
      .send({
        _listId: list._id,
        _entityId: entity._id,
      });

    expect(relationResponse.status).to.equal(200);
    expect(relationResponse.body).to.have.property('_id');
    expect(relationResponse.body).to.have.property('_kind', 'relation');
    expect(relationResponse.body).to.have.property('_listId', list._id);
    expect(relationResponse.body).to.have.property('_entityId', entity._id);
    expect(relationResponse.body).to.have.property('_version', 1);
    expect(relationResponse.body).to.have.property('_validFromDateTime');
    expect(relationResponse.body).to.have.property('_createdDateTime');
    expect(relationResponse.body).to.have.property('_lastUpdatedDateTime');
  });

  it('creates a relation with specified kind', async () => {
    appWithClient = await setupApplication({
      autoapprove_list_entity_relations: 'true',
      list_entity_rel_kinds: 'consists,references',
    });
    client = appWithClient.client;

    // First create a list
    const listResponse = await client.post('/generic-lists').send({
      _name: 'test list',
    });
    expect(listResponse.status).to.equal(200);
    const list = listResponse.body;

    // Then create an entity
    const entityResponse = await client.post('/generic-entities').send({
      _name: 'test entity',
    });
    expect(entityResponse.status).to.equal(200);
    const entity = entityResponse.body;

    // Finally create the relation with a specific kind
    const newRelation: Partial<GenericListToEntityRelation> = {
      _listId: list._id,
      _entityId: entity._id,
      _kind: 'consists',
    };

    const response = await client
      .post('/generic-list-entity-relations')
      .send(newRelation)
      .expect(200);

    expect(response.body._kind).to.be.equal('consists');
    expect(response.body._listId).to.be.equal(list._id);
    expect(response.body._entityId).to.be.equal(entity._id);
    expect(response.body).to.have.property('_id');
    expect(response.body).to.have.property('_version', 1);
    expect(response.body).to.have.property('_validFromDateTime');
    expect(response.body).to.have.property('_createdDateTime');
    expect(response.body).to.have.property('_lastUpdatedDateTime');
  });

  it('rejects creation when invalid kind is specified', async () => {
    appWithClient = await setupApplication({
      autoapprove_list_entity_relations: 'true',
      list_entity_rel_kinds: 'consists,references',
    });
    client = appWithClient.client;

    // First create a list
    const listResponse = await client.post('/generic-lists').send({
      _name: 'test list',
    });
    expect(listResponse.status).to.equal(200);
    const list = listResponse.body;

    // Then create an entity
    const entityResponse = await client.post('/generic-entities').send({
      _name: 'test entity',
    });
    expect(entityResponse.status).to.equal(200);
    const entity = entityResponse.body;

    // Try to create relation with invalid kind
    const newRelation: Partial<GenericListToEntityRelation> = {
      _listId: list._id,
      _entityId: entity._id,
      _kind: 'invalid-kind',
    };

    const response = await client
      .post('/generic-list-entity-relations')
      .send(newRelation)
      .expect(422);

    expect(response.body).to.have.property('error');
    expect(response.body.error).to.have.property('name', 'InvalidKindError');
    expect(response.body.error).to.have.property('statusCode', 422);
    expect(response.body.error).to.have.property(
      'code',
      'INVALID-RELATION-KIND',
    );
    expect(response.body.error.message).to.match(
      /Relation kind 'invalid-kind' is not valid/,
    );
    expect(response.body.error.message).to.match(
      /Use any of these values instead: consists, references/,
    );
  });

  it('enforces global record count limit', async () => {
    appWithClient = await setupApplication({
      autoapprove_list_entity_relations: 'true',
      list_entity_rel_kinds: 'consists,references',
      record_limit_list_entity_rel_count: '2',
    });
    client = appWithClient.client;

    // First create a list
    const listResponse = await client.post('/generic-lists').send({
      _name: 'test list',
    });
    expect(listResponse.status).to.equal(200);
    const list = listResponse.body;

    // Create three entities
    const entities = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        client
          .post('/generic-entities')
          .send({ _name: `test entity ${i + 1}` })
          .then((res) => res.body),
      ),
    );

    // Create first relation - should succeed
    await client
      .post('/generic-list-entity-relations')
      .send({
        _listId: list._id,
        _entityId: entities[0]._id,
      })
      .expect(200);

    // Create second relation - should succeed
    await client
      .post('/generic-list-entity-relations')
      .send({
        _listId: list._id,
        _entityId: entities[1]._id,
      })
      .expect(200);

    // Try to create third relation - should fail due to limit
    const response = await client
      .post('/generic-list-entity-relations')
      .send({
        _listId: list._id,
        _entityId: entities[2]._id,
      })
      .expect(429);

    expect(response.body).to.have.property('error');
    expect(response.body.error).to.have.property('name', 'LimitExceededError');
    expect(response.body.error).to.have.property('statusCode', 429);
    expect(response.body.error).to.have.property(
      'code',
      'RELATION-LIMIT-EXCEEDED',
    );
    expect(response.body.error).to.have.property(
      'message',
      'Relation limit is exceeded.',
    );
    expect(response.body.error).to.have.property('details').which.is.an.Array();
    expect(response.body.error.details[0]).to.have.properties({
      code: 'RELATION-LIMIT-EXCEEDED',
      info: { limit: 2 },
    });
  });

  it('enforces kind-specific record count limit', async () => {
    appWithClient = await setupApplication({
      autoapprove_list_entity_relations: 'true',
      list_entity_rel_kinds: 'consists,references',
      record_limit_list_entity_rel_count_for_consists: '1',
      record_limit_list_entity_rel_count_for_references: '2',
    });
    client = appWithClient.client;

    // First create a list
    const listResponse = await client.post('/generic-lists').send({
      _name: 'test list',
    });
    expect(listResponse.status).to.equal(200);
    const list = listResponse.body;

    // Create three entities
    const entities = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        client
          .post('/generic-entities')
          .send({ _name: `test entity ${i + 1}` })
          .then((res) => res.body),
      ),
    );

    // Create first 'consists' relation - should succeed
    await client
      .post('/generic-list-entity-relations')
      .send({
        _listId: list._id,
        _entityId: entities[0]._id,
        _kind: 'consists',
      })
      .expect(200);

    // Try to create second 'consists' relation - should fail due to kind-specific limit
    const consistsResponse = await client
      .post('/generic-list-entity-relations')
      .send({
        _listId: list._id,
        _entityId: entities[1]._id,
        _kind: 'consists',
      })
      .expect(429);

    expect(consistsResponse.body).to.have.property('error');
    expect(consistsResponse.body.error).to.have.property(
      'name',
      'LimitExceededError',
    );
    expect(consistsResponse.body.error).to.have.property('statusCode', 429);
    expect(consistsResponse.body.error).to.have.property(
      'code',
      'RELATION-LIMIT-EXCEEDED',
    );
    expect(consistsResponse.body.error).to.have.property(
      'message',
      'Relation limit is exceeded.',
    );
    expect(consistsResponse.body.error)
      .to.have.property('details')
      .which.is.an.Array();
    expect(consistsResponse.body.error.details[0]).to.have.properties({
      code: 'RELATION-LIMIT-EXCEEDED',
      info: { limit: 1 },
    });

    // Create first 'references' relation - should succeed
    await client
      .post('/generic-list-entity-relations')
      .send({
        _listId: list._id,
        _entityId: entities[1]._id,
        _kind: 'references',
      })
      .expect(200);

    // Create second 'references' relation - should succeed
    await client
      .post('/generic-list-entity-relations')
      .send({
        _listId: list._id,
        _entityId: entities[2]._id,
        _kind: 'references',
      })
      .expect(200);

    // Try to create third 'references' relation - should fail due to kind-specific limit
    const referencesResponse = await client
      .post('/generic-list-entity-relations')
      .send({
        _listId: list._id,
        _entityId: entities[0]._id,
        _kind: 'references',
      })
      .expect(429);

    expect(referencesResponse.body).to.have.property('error');
    expect(referencesResponse.body.error).to.have.property(
      'name',
      'LimitExceededError',
    );
    expect(referencesResponse.body.error).to.have.property('statusCode', 429);
    expect(referencesResponse.body.error).to.have.property(
      'code',
      'RELATION-LIMIT-EXCEEDED',
    );
    expect(referencesResponse.body.error).to.have.property(
      'message',
      'Relation limit is exceeded.',
    );
    expect(referencesResponse.body.error)
      .to.have.property('details')
      .which.is.an.Array();
    expect(referencesResponse.body.error.details[0]).to.have.properties({
      code: 'RELATION-LIMIT-EXCEEDED',
      info: { limit: 2 },
    });
  });

  it('enforces record set limit for active records', async () => {
    appWithClient = await setupApplication({
      autoapprove_list_entity_relations: 'true',
      list_entity_rel_kinds: 'consists,references',
      record_limit_list_entity_rel_count: '2',
      record_limit_list_entity_rel_scope: 'set[actives]',
    });
    client = appWithClient.client;

    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    // First create a list
    const listResponse = await client.post('/generic-lists').send({
      _name: 'test list',
    });
    expect(listResponse.status).to.equal(200);
    const list = listResponse.body;

    // Create four entities
    const entities = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        client
          .post('/generic-entities')
          .send({ _name: `test entity ${i + 1}` })
          .then((res) => res.body),
      ),
    );

    // Create first active relation - should succeed
    await client
      .post('/generic-list-entity-relations')
      .send({
        _listId: list._id,
        _entityId: entities[0]._id,
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: futureDate.toISOString(),
      })
      .expect(200);

    // Create second active relation - should succeed
    await client
      .post('/generic-list-entity-relations')
      .send({
        _listId: list._id,
        _entityId: entities[1]._id,
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: futureDate.toISOString(),
      })
      .expect(200);

    // Create inactive relation - should succeed despite active records limit
    await client
      .post('/generic-list-entity-relations')
      .send({
        _listId: list._id,
        _entityId: entities[2]._id,
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: pastDate.toISOString(), // Already expired
      })
      .expect(200);

    // Try to create third active relation - should fail due to active records limit
    const response = await client
      .post('/generic-list-entity-relations')
      .send({
        _listId: list._id,
        _entityId: entities[3]._id,
        _validFromDateTime: pastDate.toISOString(),
        _validUntilDateTime: futureDate.toISOString(),
      })
      .expect(429);

    expect(response.body).to.have.property('error');
    expect(response.body.error).to.have.property('name', 'LimitExceededError');
    expect(response.body.error).to.have.property('statusCode', 429);
    expect(response.body.error).to.have.property(
      'code',
      'RELATION-LIMIT-EXCEEDED',
    );
    expect(response.body.error).to.have.property(
      'message',
      'Relation limit is exceeded.',
    );
    expect(response.body.error).to.have.property('details').which.is.an.Array();
    expect(response.body.error.details[0]).to.have.properties({
      code: 'RELATION-LIMIT-EXCEEDED',
      info: { limit: 2 },
    });
  });
});
