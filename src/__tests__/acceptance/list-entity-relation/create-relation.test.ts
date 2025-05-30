import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { ListToEntityRelation } from '../../../models';
import {
  setupApplication,
  teardownApplication,
  type AppWithClient,
} from '../test-helper';

describe('POST /list-entity-relations', () => {
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
    const listResponse = await client.post('/lists').send({
      _name: 'test list',
    });
    expect(listResponse.status).to.equal(200);
    const list = listResponse.body;

    // Then create an entity
    const entityResponse = await client.post('/entities').send({
      _name: 'test entity',
    });
    expect(entityResponse.status).to.equal(200);
    const entity = entityResponse.body;

    // Finally create the relation
    const relationResponse = await client.post('/list-entity-relations').send({
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
    const listResponse = await client.post('/lists').send({
      _name: 'test list',
    });
    expect(listResponse.status).to.equal(200);
    const list = listResponse.body;

    // Then create an entity
    const entityResponse = await client.post('/entities').send({
      _name: 'test entity',
    });
    expect(entityResponse.status).to.equal(200);
    const entity = entityResponse.body;

    // Finally create the relation with a specific kind
    const newRelation: Partial<ListToEntityRelation> = {
      _listId: list._id,
      _entityId: entity._id,
      _kind: 'consists',
    };

    const response = await client
      .post('/list-entity-relations')
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
    const listResponse = await client.post('/lists').send({
      _name: 'test list',
    });
    expect(listResponse.status).to.equal(200);
    const list = listResponse.body;

    // Then create an entity
    const entityResponse = await client.post('/entities').send({
      _name: 'test entity',
    });
    expect(entityResponse.status).to.equal(200);
    const entity = entityResponse.body;

    // Try to create relation with invalid kind
    const newRelation: Partial<ListToEntityRelation> = {
      _listId: list._id,
      _entityId: entity._id,
      _kind: 'invalid-kind',
    };

    const response = await client
      .post('/list-entity-relations')
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
      RELATION_RECORD_LIMITS: '[{"scope":"","limit":2}]',
    });
    client = appWithClient.client;

    // First create a list
    const listResponse = await client.post('/lists').send({
      _name: 'test list',
    });
    expect(listResponse.status).to.equal(200);
    const list = listResponse.body;

    // Create three entities
    const entities = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        client
          .post('/entities')
          .send({ _name: `test entity ${i + 1}` })
          .then((res) => res.body),
      ),
    );

    // Create first relation - should succeed
    await client
      .post('/list-entity-relations')
      .send({
        _kind: 'consists',
        _listId: list._id,
        _entityId: entities[0]._id,
      })
      .expect(200);

    // Create second relation - should succeed
    await client
      .post('/list-entity-relations')
      .send({
        _kind: 'consists',
        _listId: list._id,
        _entityId: entities[1]._id,
      })
      .expect(200);

    // Try to create third relation - should fail due to limit
    const response = await client
      .post('/list-entity-relations')
      .send({
        _listId: list._id,
        _entityId: entities[2]._id,
        _kind: 'consists',
      })
      .expect(429);

    expect(response.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      message: 'Record limit exceeded for relation',
      code: 'RELATION-LIMIT-EXCEEDED',
      status: 429,
      details: [
        {
          code: 'RELATION-LIMIT-EXCEEDED',
          message: 'Record limit exceeded for relation',
          info: {
            limit: 2,
            scope: '',
          },
        },
      ],
    });
  });

  it('enforces kind-specific record count limit', async () => {
    appWithClient = await setupApplication({
      autoapprove_list_entity_relations: 'true',
      list_entity_rel_kinds: 'consists,references',
      RELATION_RECORD_LIMITS:
        '[{"scope":"where[_kind]=consists","limit":1},{"scope":"where[_kind]=references","limit":2}]',
    });
    client = appWithClient.client;

    // First create a list
    const listResponse = await client.post('/lists').send({
      _name: 'test list',
    });
    expect(listResponse.status).to.equal(200);
    const list = listResponse.body;

    // Create three entities
    const entities = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        client
          .post('/entities')
          .send({ _name: `test entity ${i + 1}` })
          .then((res) => res.body),
      ),
    );

    // Create first 'consists' relation - should succeed
    await client
      .post('/list-entity-relations')
      .send({
        _listId: list._id,
        _entityId: entities[0]._id,
        _kind: 'consists',
      })
      .expect(200);

    // Try to create second 'consists' relation - should fail due to kind-specific limit
    const consistsResponse = await client
      .post('/list-entity-relations')
      .send({
        _listId: list._id,
        _entityId: entities[1]._id,
        _kind: 'consists',
      })
      .expect(429);

    expect(consistsResponse.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      message: 'Record limit exceeded for relation',
      code: 'RELATION-LIMIT-EXCEEDED',
      status: 429,
      details: [
        {
          code: 'RELATION-LIMIT-EXCEEDED',
          message: 'Record limit exceeded for relation',
          info: {
            limit: 1,
            scope: 'where[_kind]=consists',
          },
        },
      ],
    });

    // Create first 'references' relation - should succeed
    await client
      .post('/list-entity-relations')
      .send({
        _listId: list._id,
        _entityId: entities[1]._id,
        _kind: 'references',
      })
      .expect(200);

    // Create second 'references' relation - should succeed
    await client
      .post('/list-entity-relations')
      .send({
        _listId: list._id,
        _entityId: entities[2]._id,
        _kind: 'references',
      })
      .expect(200);

    // Try to create third 'references' relation - should fail due to kind-specific limit
    const referencesResponse = await client
      .post('/list-entity-relations')
      .send({
        _listId: list._id,
        _entityId: entities[0]._id,
        _kind: 'references',
      })
      .expect(429);

    expect(referencesResponse.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      message: 'Record limit exceeded for relation',
      code: 'RELATION-LIMIT-EXCEEDED',
      status: 429,
      details: [
        {
          code: 'RELATION-LIMIT-EXCEEDED',
          message: 'Record limit exceeded for relation',
          info: {
            limit: 2,
            scope: 'where[_kind]=references',
          },
        },
      ],
    });
  });

  // it('enforces record set limit for active records', async () => {
  //   appWithClient = await setupApplication({
  //     autoapprove_list_entity_relations: 'true',
  //     list_entity_rel_kinds: 'consists,references',
  //     record_limit_list_entity_rel_count: '2',
  //     record_limit_list_entity_rel_scope: 'set[actives]',
  //   });
  //   client = appWithClient.client;

  //   const pastDate = new Date();
  //   pastDate.setDate(pastDate.getDate() - 1);

  //   const futureDate = new Date();
  //   futureDate.setDate(futureDate.getDate() + 7);

  //   // First create a list
  //   const listResponse = await client.post('/lists').send({
  //     _name: 'test list',
  //   });
  //   expect(listResponse.status).to.equal(200);
  //   const list = listResponse.body;

  //   // Create four entities
  //   const entities = await Promise.all(
  //     Array.from({ length: 4 }, (_, i) =>
  //       client
  //         .post('/entities')
  //         .send({ _name: `test entity ${i + 1}` })
  //         .then((res) => res.body),
  //     ),
  //   );

  //   // Create first active relation - should succeed
  //   await client
  //     .post('/list-entity-relations')
  //     .send({
  //       _listId: list._id,
  //       _entityId: entities[0]._id,
  //       _validFromDateTime: pastDate.toISOString(),
  //       _validUntilDateTime: futureDate.toISOString(),
  //     })
  //     .expect(200);

  //   // Create second active relation - should succeed
  //   await client
  //     .post('/list-entity-relations')
  //     .send({
  //       _listId: list._id,
  //       _entityId: entities[1]._id,
  //       _validFromDateTime: pastDate.toISOString(),
  //       _validUntilDateTime: futureDate.toISOString(),
  //     })
  //     .expect(200);

  //   // Create inactive relation - should succeed despite active records limit
  //   await client
  //     .post('/list-entity-relations')
  //     .send({
  //       _listId: list._id,
  //       _entityId: entities[2]._id,
  //       _validFromDateTime: pastDate.toISOString(),
  //       _validUntilDateTime: pastDate.toISOString(), // Already expired
  //     })
  //     .expect(200);

  //   // Try to create third active relation - should fail due to active records limit
  //   const response = await client
  //     .post('/list-entity-relations')
  //     .send({
  //       _listId: list._id,
  //       _entityId: entities[3]._id,
  //       _validFromDateTime: pastDate.toISOString(),
  //       _validUntilDateTime: futureDate.toISOString(),
  //     })
  //     .expect(429);

  //   expect(response.body).to.have.property('error');
  //   expect(response.body.error).to.have.property('name', 'LimitExceededError');
  //   expect(response.body.error).to.have.property('statusCode', 429);
  //   expect(response.body.error).to.have.property(
  //     'code',
  //     'RELATION-LIMIT-EXCEEDED',
  //   );
  //   expect(response.body.error).to.have.property(
  //     'message',
  //     'Relation limit is exceeded.',
  //   );
  //   expect(response.body.error).to.have.property('details').which.is.an.Array();
  //   expect(response.body.error.details[0]).to.have.properties({
  //     code: 'RELATION-LIMIT-EXCEEDED',
  //     info: { limit: 2 },
  //   });
  // });

  it('enforces list entity count limit', async () => {
    appWithClient = await setupApplication({
      autoapprove_list_entity_relations: 'true',
      list_entity_rel_kinds: 'consists,references',
      RELATION_RECORD_LIMITS:
        '[{"scope":"where[_listId]=${_listId}","limit":2}]',
    });
    client = appWithClient.client;

    // First create a list
    const listResponse = await client.post('/lists').send({
      _name: 'test list',
    });
    expect(listResponse.status).to.equal(200);
    const list = listResponse.body;

    // Create three entities
    const entities = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        client
          .post('/entities')
          .send({ _name: `test entity ${i + 1}` })
          .then((res) => res.body),
      ),
    );

    // Create first relation - should succeed
    await client
      .post('/list-entity-relations')
      .send({
        _kind: 'consists',
        _listId: list._id,
        _entityId: entities[0]._id,
      })
      .expect(200);

    // Create second relation - should succeed
    await client
      .post('/list-entity-relations')
      .send({
        _kind: 'consists',
        _listId: list._id,
        _entityId: entities[1]._id,
      })
      .expect(200);

    // Try to create third relation - should fail due to list entity count limit
    const response = await client
      .post('/list-entity-relations')
      .send({
        _listId: list._id,
        _entityId: entities[2]._id,
        _kind: 'consists',
      })
      .expect(429);

    expect(response.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      message: 'Record limit exceeded for relation',
      code: 'RELATION-LIMIT-EXCEEDED',
      status: 429,
      details: [
        {
          code: 'RELATION-LIMIT-EXCEEDED',
          message: 'Record limit exceeded for relation',
          info: {
            limit: 2,
            scope: `where[_listId]=${list._id}`,
          },
        },
      ],
    });
  });

  it('enforces kind-specific list entity count limit', async () => {
    appWithClient = await setupApplication({
      autoapprove_list_entity_relations: 'true',
      list_kinds: 'reading-list,watch-list',
      RELATION_RECORD_LIMITS:
        '[{"scope":"where[_listId]=${_listId}&listWhere[_kind]=reading-list","limit":1},{"scope":"where[_listId]=${_listId}&listWhere[_kind]=watch-list","limit":2}]',
    });
    client = appWithClient.client;

    // Create a reading list (limit: 1)
    const readingList = await client
      .post('/lists')
      .send({
        _name: 'My Reading List',
        _kind: 'reading-list',
      })
      .then((res) => res.body);

    // Create a watch list (limit: 2)
    const watchList = await client
      .post('/lists')
      .send({
        _name: 'My Watch List',
        _kind: 'watch-list',
      })
      .then((res) => res.body);

    // Create three entities
    const entities = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        client
          .post('/entities')
          .send({ _name: `test entity ${i + 1}` })
          .then((res) => res.body),
      ),
    );

    // Test reading-list (limit: 1)
    // Add first entity to reading list - should succeed
    await client
      .post('/list-entity-relations')
      .send({
        _listId: readingList._id,
        _entityId: entities[0]._id,
      })
      .expect(200);

    // Try to add second entity to reading list - should fail due to kind-specific limit
    const readingListResponse = await client
      .post('/list-entity-relations')
      .send({
        _listId: readingList._id,
        _entityId: entities[1]._id,
      })
      .expect(429);

    expect(readingListResponse.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      message: 'Record limit exceeded for relation',
      code: 'RELATION-LIMIT-EXCEEDED',
      status: 429,
      details: [
        {
          code: 'RELATION-LIMIT-EXCEEDED',
          message: 'Record limit exceeded for relation',
          info: {
            limit: 1,
            scope: `where[_listId]=${readingList._id}&listWhere[_kind]=reading-list`,
          },
        },
      ],
    });

    // Test watch-list (limit: 2)
    // Add first entity to watch list - should succeed
    await client
      .post('/list-entity-relations')
      .send({
        _listId: watchList._id,
        _entityId: entities[0]._id,
      })
      .expect(200);

    // Add second entity to watch list - should succeed
    await client
      .post('/list-entity-relations')
      .send({
        _listId: watchList._id,
        _entityId: entities[1]._id,
      })
      .expect(200);

    // Try to add third entity to watch list - should fail due to kind-specific limit
    const watchListResponse = await client
      .post('/list-entity-relations')
      .send({
        _listId: watchList._id,
        _entityId: entities[2]._id,
      })
      .expect(429);

    expect(watchListResponse.body.error).to.containDeep({
      statusCode: 429,
      name: 'LimitExceededError',
      message: 'Record limit exceeded for relation',
      code: 'RELATION-LIMIT-EXCEEDED',
      status: 429,
      details: [
        {
          code: 'RELATION-LIMIT-EXCEEDED',
          message: 'Record limit exceeded for relation',
          info: {
            limit: 2,
            scope: `where[_listId]=${watchList._id}&listWhere[_kind]=watch-list`,
          },
        },
      ],
    });
  });

  it('enforces uniqueness constraint for quarter field', async () => {
    appWithClient = await setupApplication({
      autoapprove_list_entity_relations: 'true',
      RELATION_UNIQUENESS: 'where[quarter]=${quarter}',
    });
    client = appWithClient.client;

    // Create a list
    const listResponse = await client.post('/lists').send({
      _name: 'test list',
    });
    expect(listResponse.status).to.equal(200);
    const list = listResponse.body;

    // Create two entities
    const entities = await Promise.all(
      Array.from({ length: 2 }, (_, i) =>
        client
          .post('/entities')
          .send({ _name: `test entity ${i + 1}` })
          .then((res) => res.body),
      ),
    );

    // Create first relation with quarter=q1 - should succeed
    await client
      .post('/list-entity-relations')
      .send({
        _listId: list._id,
        _entityId: entities[0]._id,
        quarter: 'q1',
      })
      .expect(200);

    // Try to create second relation with quarter=q1 - should fail due to uniqueness constraint
    const response = await client
      .post('/list-entity-relations')
      .send({
        _listId: list._id,
        _entityId: entities[1]._id,
        quarter: 'q1',
      })
      .expect(409);

    expect(response.body.error).to.containDeep({
      statusCode: 409,
      name: 'UniquenessViolationError',
      message: 'Relation already exists',
      code: 'RELATION-UNIQUENESS-VIOLATION',
      status: 409,
      details: [
        {
          code: 'RELATION-UNIQUENESS-VIOLATION',
          message: 'Relation already exists',
          info: {
            scope: 'where[quarter]=q1',
          },
        },
      ],
    });

    // Create relation with quarter=q2 - should succeed
    await client
      .post('/list-entity-relations')
      .send({
        _listId: list._id,
        _entityId: entities[1]._id,
        quarter: 'q2',
      })
      .expect(200);
  });
});
