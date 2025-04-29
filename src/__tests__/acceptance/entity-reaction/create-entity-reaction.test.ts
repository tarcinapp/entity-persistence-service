import type { Client } from '@loopback/testlab';
import { expect } from '@loopback/testlab';
import type { EntityReaction } from '../../../models';
import type { AppWithClient } from '../test-helper';
import {
  setupApplication,
  teardownApplication,
  createTestEntity,
} from '../test-helper';

describe('POST /entity-reactions', () => {
  let client: Client;
  let appWithClient: AppWithClient | undefined;

  beforeEach(async () => {
    if (appWithClient) {
      await teardownApplication(appWithClient);
    }

    appWithClient = undefined;
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

  it('creates a new entity reaction with default kind', async () => {
    appWithClient = await setupApplication({});
    ({ client } = appWithClient);

    // First, create an entity to react to
    const entityId = await createTestEntity(client, {
      _name: 'Sample Book',
      description: 'A sample book entity',
    });

    const newReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _name: 'Like',
      description: 'A like reaction',
    };

    const response = await client
      .post('/entity-reactions')
      .send(newReaction)
      .expect(200);

    expect(response.body).to.containDeep(newReaction);
    expect(response.body._id).to.be.String();
    expect(response.body._entityId).to.equal(entityId);
    expect(response.body._kind).to.be.equal('entity-reaction'); // default kind
    expect(response.body._slug).to.be.equal('like');
    expect(response.body._createdDateTime).to.be.String();
    expect(response.body._lastUpdatedDateTime).to.be.String();
    expect(response.body._visibility).to.be.String();
    expect(response.body._version).to.be.equal(1);
  });

  it('creates an entity reaction with specified kind', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like,dislike',
    });
    ({ client } = appWithClient);

    const entityId = await createTestEntity(client, {
      _name: 'Sample Book',
      description: 'A sample book entity',
    });

    const newReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'like',
      _name: 'Like',
      description: 'A like reaction',
    };

    const response = await client
      .post('/entity-reactions')
      .send(newReaction)
      .expect(200);

    expect(response.body).to.containDeep(newReaction);
    expect(response.body._kind).to.be.equal('like');
  });

  it('rejects invalid entity reaction kind', async () => {
    appWithClient = await setupApplication({
      entity_reaction_kinds: 'like,dislike',
    });
    ({ client } = appWithClient);

    const entityId = await createTestEntity(client, {
      _name: 'Sample Book',
      description: 'A sample book entity',
    });

    const newReaction: Partial<EntityReaction> = {
      _entityId: entityId,
      _kind: 'love', // Invalid kind
      _name: 'Love',
      description: 'A love reaction',
    };

    const errorResponse = await client
      .post('/entity-reactions')
      .send(newReaction)
      .expect(422);

    expect(errorResponse.body.error).to.containDeep({
      statusCode: 422,
      name: 'InvalidKindError',
      code: 'INVALID-ENTITY-REACTION-KIND',
      status: 422,
    });
  });
});
