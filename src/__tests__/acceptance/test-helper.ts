import type { DataSource } from '@loopback/repository';
import { RestBindings } from '@loopback/rest';
import type { Client } from '@loopback/testlab';
import {
  createRestAppClient,
  givenHttpServerConfig,
  expect,
} from '@loopback/testlab';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { parse } from 'qs';
import { EntityPersistenceApplication } from '../..';
import { EntityDbDataSource } from '../../datasources/entity-db.datasource';
import {
  UniquenessBindings,
  UniquenessConfigurationReader,
  RecordLimitsBindings,
  RecordLimitsConfigurationReader,
  VisibilityConfigBindings,
  VisibilityConfigurationReader,
  IdempotencyConfigBindings,
  IdempotencyConfigurationReader,
  ValidFromConfigBindings,
  ValidfromConfigurationReader,
  ResponseLimitConfigBindings,
  ResponseLimitConfigurationReader,
  KindBindings,
  KindConfigurationReader,
} from '../../extensions';
import {
  LookupBindings,
  LookupHelper,
} from '../../extensions/utils/lookup-helper';
import type { GenericEntity, List } from '../../models';
import { LookupConstraintBindings } from '../../services/lookup-constraint.bindings';
import { LookupConstraintService } from '../../services/lookup-constraint.service';
import { RecordLimitCheckerBindings } from '../../services/record-limit-checker.bindings';
import { RecordLimitCheckerService } from '../../services/record-limit-checker.service';

/**
 * Utility function to verify that all fields in two responses match exactly
 * @param actual The actual response to verify
 * @param expected The expected response to compare against
 */
export function expectResponseToMatch(actual: object, expected: object): void {
  // Get all keys from both objects
  const allKeys = new Set([...Object.keys(actual), ...Object.keys(expected)]);

  allKeys.forEach((key) => {
    expect(actual).to.have.property(key);
    expect(expected).to.have.property(key);

    if (Array.isArray(actual[key as keyof typeof actual])) {
      expect(actual[key as keyof typeof actual]).to.deepEqual(
        expected[key as keyof typeof expected],
        `Array field ${key} should match`,
      );
    } else {
      expect(actual[key as keyof typeof actual]).to.equal(
        expected[key as keyof typeof expected],
        `Field ${key} should match`,
      );
    }
  });
}

export interface TestEnvironmentVariables {
  // Database Configuration
  mongodb_url?: string;
  mongodb_database?: string;
  mongodb_host?: string;
  mongodb_port?: string;
  mongodb_user?: string;
  mongodb_password?: string;

  // Collection Names
  collection_entity?: string;
  collection_list?: string;
  collection_list_entity_rel?: string;
  collection_entity_reaction?: string;
  collection_list_reaction?: string;
  collection_tag?: string;
  collection_list_tag_rel?: string;
  collection_entity_tag_rel?: string;

  // Allowed Kinds Configuration
  entity_kinds?: string;
  list_kinds?: string;
  list_entity_rel_kinds?: string;

  // Default Values Configuration
  default_entity_kind?: string;
  default_list_kind?: string;
  default_relation_kind?: string;

  // Uniqueness Configuration
  uniqueness_entity_fields?: string;
  uniqueness_list_fields?: string;
  uniqueness_list_entity_rel_fields?: string;
  uniqueness_entity_scope?: string;
  uniqueness_list_scope?: string;
  uniqueness_list_entity_rel_scope?: string;
  ENTITY_UNIQUENESS?: string;
  LIST_UNIQUENESS?: string;
  RELATION_UNIQUENESS?: string;
  ENTITY_REACTION_UNIQUENESS?: string;
  LIST_REACTION_UNIQUENESS?: string;

  // Auto Approve Configuration
  autoapprove_entity?: string;
  autoapprove_list?: string;
  autoapprove_list_entity_relations?: string;

  // Visibility Configuration
  visibility_entity?: string;
  visibility_list?: string;
  visibility_entity_reaction?: string;
  visibility_list_reaction?: string;

  // Response Limits Configuration
  response_limit_entity?: string;
  response_limit_list_entity_rel?: string;
  response_limit_entity_reaction?: string;
  response_limit_list_reaction?: string;

  // Record Limits Configuration
  ENTITY_RECORD_LIMITS?: string;
  LIST_RECORD_LIMITS?: string;
  RELATION_RECORD_LIMITS?: string;
  ENTITY_REACTION_RECORD_LIMITS?: string;
  LIST_REACTION_RECORD_LIMITS?: string;

  // Idempotency Configuration
  idempotency_entity?: string;
  idempotency_entity_set?: string;
  idempotency_list?: string;
  idempotency_list_set?: string;
  idempotency_list_entity_rel?: string;
  idempotency_list_entity_rel_set?: string;
  idempotency_entity_reaction?: string;
  idempotency_entity_reaction_set?: string;
  idempotency_list_reaction?: string;
  idempotency_list_reaction_set?: string;
  idempotency_tag?: string;
  idempotency_tag_set?: string;

  // Dynamic kind-specific configurations
  [key: `uniqueness_entity_fields_for_${string}`]: string;
  [key: `uniqueness_list_fields_for_${string}`]: string;
  [key: `uniqueness_list_entity_rel_fields_for_${string}`]: string;
  [key: `uniqueness_entity_scope_for_${string}`]: string;
  [key: `uniqueness_list_scope_for_${string}`]: string;
  [key: `uniqueness_list_entity_rel_scope_for_${string}`]: string;

  [key: `visibility_entity_for_${string}`]: string;
  [key: `visibility_list_for_${string}`]: string;
  [key: `visibility_entity_reaction_for_${string}`]: string;
  [key: `visibility_list_reaction_for_${string}`]: string;
  [key: `visibility_tag_for_${string}`]: string;

  [key: `autoapprove_entity_for_${string}`]: string;
  [key: `autoapprove_list_for_${string}`]: string;
  [key: `autoapprove_list_entity_rel_for_${string}`]: string;
  [key: `autoapprove_entity_reaction_for_${string}`]: string;
  [key: `autoapprove_list_reaction_for_${string}`]: string;
  [key: `autoapprove_tag_for_${string}`]: string;

  [key: `response_limit_entity_for_${string}`]: string;
  [key: `response_limit_list_for_${string}`]: string;
  [key: `response_limit_list_entity_rel_for_${string}`]: string;
  [key: `response_limit_entity_reaction_for_${string}`]: string;
  [key: `response_limit_list_reaction_for_${string}`]: string;
  [key: `response_limit_tag_for_${string}`]: string;

  [key: string]: string | undefined;
}

export async function setupApplication(
  envVars?: TestEnvironmentVariables,
): Promise<AppWithClient> {
  // Set test environment
  process.env.NODE_ENV = 'test';

  // Set higher timeout for tests
  process.env.MOCHA_TIMEOUT = '30000';

  // Store original env vars
  const originalEnv: TestEnvironmentVariables = {
    // Database Configuration
    mongodb_url: process.env.mongodb_url,
    mongodb_database: process.env.mongodb_database,
    mongodb_host: process.env.mongodb_host,
    mongodb_port: process.env.mongodb_port,
    mongodb_user: process.env.mongodb_user,
    mongodb_password: process.env.mongodb_password,

    // Collection Names
    collection_entity: process.env.collection_entity,
    collection_list: process.env.collection_list,
    collection_list_entity_rel: process.env.collection_list_entity_rel,
    collection_entity_reaction: process.env.collection_entity_reaction,
    collection_list_reaction: process.env.collection_list_reaction,
    collection_tag: process.env.collection_tag,
    collection_list_tag_rel: process.env.collection_list_tag_rel,
    collection_entity_tag_rel: process.env.collection_entity_tag_rel,

    // Allowed Kinds Configuration
    entity_kinds: process.env.entity_kinds,
    list_kinds: process.env.list_kinds,
    list_entity_rel_kinds: process.env.list_entity_rel_kinds,

    // Default Values Configuration
    default_entity_kind: process.env.default_entity_kind,
    default_list_kind: process.env.default_list_kind,
    default_relation_kind: process.env.default_relation_kind,

    // Uniqueness Configuration
    uniqueness_entity_fields: process.env.uniqueness_entity_fields,
    uniqueness_list_fields: process.env.uniqueness_list_fields,
    uniqueness_list_entity_rel_fields:
      process.env.uniqueness_list_entity_rel_fields,
    uniqueness_entity_scope: process.env.uniqueness_entity_scope,
    uniqueness_list_scope: process.env.uniqueness_list_scope,
    uniqueness_list_entity_rel_scope:
      process.env.uniqueness_list_entity_rel_scope,

    // Auto Approve Configuration
    autoapprove_entity: process.env.autoapprove_entity,
    autoapprove_list: process.env.autoapprove_list,
    autoapprove_list_entity_relations:
      process.env.autoapprove_list_entity_relations,

    // Visibility Configuration
    visibility_entity: process.env.visibility_entity,
    visibility_list: process.env.visibility_list,
    visibility_entity_reaction: process.env.visibility_entity_reaction,
    visibility_list_reaction: process.env.visibility_list_reaction,

    // Response Limits Configuration
    response_limit_entity: process.env.response_limit_entity,
    response_limit_list_entity_rel: process.env.response_limit_list_entity_rel,
    response_limit_entity_reaction: process.env.response_limit_entity_reaction,
    response_limit_list_reaction: process.env.response_limit_list_reaction,

    // Record Limits Configuration
    record_limit_entity_count: process.env.record_limit_entity_count,
    record_limit_entity_set: process.env.record_limit_entity_set,
    record_limit_list_count: process.env.record_limit_list_count,
    record_limit_list_set: process.env.record_limit_list_set,
    record_limit_list_entity_rel_count:
      process.env.record_limit_list_entity_rel_count,
    record_limit_list_entity_rel_set:
      process.env.record_limit_list_entity_rel_set,
    record_limit_entity_reaction_count:
      process.env.record_limit_entity_reaction_count,
    record_limit_entity_reaction_set:
      process.env.record_limit_entity_reaction_set,
    record_limit_list_reaction_count:
      process.env.record_limit_list_reaction_count,
    record_limit_list_reaction_set: process.env.record_limit_list_reaction_set,
    record_limit_tag_count: process.env.record_limit_tag_count,
    record_limit_tag_set: process.env.record_limit_tag_set,

    // Idempotency Configuration
    idempotency_entity: process.env.idempotency_entity,
    idempotency_entity_set: process.env.idempotency_entity_set,
    idempotency_list: process.env.idempotency_list,
    idempotency_list_set: process.env.idempotency_list_set,
    idempotency_list_entity_rel: process.env.idempotency_list_entity_rel,
    idempotency_list_entity_rel_set:
      process.env.idempotency_list_entity_rel_set,
    idempotency_entity_reaction: process.env.idempotency_entity_reaction,
    idempotency_entity_reaction_set:
      process.env.idempotency_entity_reaction_set,
    idempotency_list_reaction: process.env.idempotency_list_reaction,
    idempotency_list_reaction_set: process.env.idempotency_list_reaction_set,
    idempotency_tag: process.env.idempotency_tag,
    idempotency_tag_set: process.env.idempotency_tag_set,

    // Store any existing dynamic kind-specific configurations
    ...Object.entries(process.env)
      .filter(
        ([key]) =>
          key.startsWith('uniqueness_entity_fields_for_') ||
          key.startsWith('uniqueness_list_fields_for_') ||
          key.startsWith('uniqueness_list_entity_rel_fields_for_') ||
          key.startsWith('uniqueness_entity_scope_for_') ||
          key.startsWith('uniqueness_list_scope_for_') ||
          key.startsWith('uniqueness_list_entity_rel_scope_for_') ||
          key.startsWith('visibility_entity_for_') ||
          key.startsWith('visibility_list_for_') ||
          key.startsWith('visibility_entity_reaction_for_') ||
          key.startsWith('visibility_list_reaction_for_') ||
          key.startsWith('visibility_tag_for_') ||
          key.startsWith('autoapprove_entity_for_') ||
          key.startsWith('autoapprove_list_for_') ||
          key.startsWith('autoapprove_list_entity_rel_for_') ||
          key.startsWith('autoapprove_entity_reaction_for_') ||
          key.startsWith('autoapprove_list_reaction_for_') ||
          key.startsWith('autoapprove_tag_for_') ||
          key.startsWith('response_limit_entity_for_') ||
          key.startsWith('response_limit_list_for_') ||
          key.startsWith('response_limit_list_entity_rel_for_') ||
          key.startsWith('response_limit_entity_reaction_for_') ||
          key.startsWith('response_limit_list_reaction_for_') ||
          key.startsWith('response_limit_tag_for_') ||
          key.startsWith('record_limit_entity_count_for_') ||
          key.startsWith('record_limit_entity_set_for_') ||
          key.startsWith('record_limit_list_count_for_') ||
          key.startsWith('record_limit_list_set_for_') ||
          key.startsWith('record_limit_list_entity_rel_count_for_') ||
          key.startsWith('record_limit_list_entity_rel_set_for_') ||
          key.startsWith('record_limit_entity_reaction_count_for_') ||
          key.startsWith('record_limit_entity_reaction_set_for_') ||
          key.startsWith('record_limit_list_reaction_count_for_') ||
          key.startsWith('record_limit_list_reaction_set_for_') ||
          key.startsWith('record_limit_tag_count_for_') ||
          key.startsWith('record_limit_tag_set_for_') ||
          key.startsWith('idempotency_entity_for_') ||
          key.startsWith('idempotency_entity_set_for_') ||
          key.startsWith('idempotency_list_for_') ||
          key.startsWith('idempotency_list_set_for_') ||
          key.startsWith('idempotency_list_entity_rel_for_') ||
          key.startsWith('idempotency_list_entity_rel_set_for_') ||
          key.startsWith('idempotency_entity_reaction_for_') ||
          key.startsWith('idempotency_entity_reaction_set_for_') ||
          key.startsWith('idempotency_list_reaction_for_') ||
          key.startsWith('idempotency_list_reaction_set_for_') ||
          key.startsWith('idempotency_tag_for_') ||
          key.startsWith('idempotency_tag_set_for_') ||
          key.startsWith('record_limit_entity_scope_for_') ||
          key.startsWith('record_limit_list_scope_for_') ||
          key.startsWith('record_limit_list_entity_rel_scope_for_') ||
          key.startsWith('record_limit_entity_reaction_scope_for_') ||
          key.startsWith('record_limit_list_reaction_scope_for_') ||
          key.startsWith('record_limit_tag_scope_for_'),
      )
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
  };

  // Clear all environment variables first
  Object.keys(process.env).forEach((key) => {
    delete process.env[key];
  });

  // Set new environment variables
  if (envVars) {
    Object.entries(envVars).forEach(([key, value]) => {
      if (value !== undefined) {
        process.env[key] = value;
      }
    });
  }

  const mongod = await MongoMemoryServer.create();

  // Set MongoDB environment variables
  process.env.mongodb_url = mongod.getUri();
  process.env.mongodb_database = 'testdb';

  const app = new EntityPersistenceApplication({
    rest: {
      ...givenHttpServerConfig(),
      port: 0, // Let the OS pick an available port
      expressSettings: {
        'x-powered-by': false,
        'query parser': (query: any) => {
          return parse(query, { depth: 10 });
        },
      },
    },
  });

  // Set project root and boot options for test environment
  app.projectRoot = __dirname;
  app.bootOptions = {
    controllers: {
      dirs: ['../../controllers'],
      extensions: ['.controller.ts'],
      nested: true,
    },
    repositories: {
      dirs: ['../../repositories'],
      extensions: ['.repository.ts'],
      nested: true,
    },
  };

  // Configure the app to use the in-memory MongoDB
  const mongoDsConfig = {
    name: 'EntityDb',
    connector: 'mongodb',
    url: mongod.getUri(),
    database: 'testdb',
    useNewUrlParser: true,
    useUnifiedTopology: true,
  };

  app.bind('datasources.config.EntityDb').to(mongoDsConfig);

  // Create and bind the datasource
  const dataSource = new EntityDbDataSource(mongoDsConfig);
  app.dataSource(dataSource);

  app.bind(RestBindings.ERROR_WRITER_OPTIONS).to({
    debug: true,
    safeFields: ['errorCode', 'message'],
  });

  // add uniqueness configuration reader to context
  app
    .bind(UniquenessBindings.CONFIG_READER)
    .toClass(UniquenessConfigurationReader);

  // add record limits configuration reader to context
  app
    .bind(RecordLimitsBindings.CONFIG_READER)
    .toClass(RecordLimitsConfigurationReader);

  // add kind limits configuration reader to context
  app.bind(KindBindings.CONFIG_READER).toClass(KindConfigurationReader);

  app
    .bind(VisibilityConfigBindings.CONFIG_READER)
    .toClass(VisibilityConfigurationReader);

  app
    .bind(IdempotencyConfigBindings.CONFIG_READER)
    .toClass(IdempotencyConfigurationReader);

  app
    .bind(ValidFromConfigBindings.CONFIG_READER)
    .toClass(ValidfromConfigurationReader);

  // add response limit configuration reader to context
  app
    .bind(ResponseLimitConfigBindings.CONFIG_READER)
    .toClass(ResponseLimitConfigurationReader);

  // Add lookup helper binding for tests
  app.bind(LookupBindings.HELPER).toClass(LookupHelper);

  // add record limit checker service to context
  app
    .bind(RecordLimitCheckerBindings.SERVICE)
    .toClass(RecordLimitCheckerService);

  // add lookup constraint service to context
  app.bind(LookupConstraintBindings.SERVICE).toClass(LookupConstraintService);

  await app.boot();
  await app.start();

  const client = createRestAppClient(app);

  return { app, client, mongod, originalEnv };
}

export interface AppWithClient {
  app: EntityPersistenceApplication;
  client: Client;
  mongod: MongoMemoryServer;
  originalEnv: TestEnvironmentVariables;
}

export async function teardownApplication(appWithClient: AppWithClient) {
  // Restore original env vars
  Object.entries(appWithClient.originalEnv).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });

  if (appWithClient.app) {
    // Stop the application and disconnect all datasources
    await appWithClient.app.stop();
    for (const ds of appWithClient.app.find('datasources.*')) {
      const dataSource = appWithClient.app.getSync<DataSource>(ds.key);
      if (dataSource.disconnect) {
        await dataSource.disconnect();
      }
    }
  }

  if (appWithClient.mongod) {
    // Ensure MongoDB memory server is properly stopped
    await appWithClient.mongod.stop();
  }
}

// Store created entity IDs for cleanup
let createdEntityIds: string[] = [];

/**
 * Creates a test entity and returns its ID
 */
export async function createTestEntity(
  client: Client,
  entityData: Partial<GenericEntity>,
): Promise<string> {
  const response = await client.post('/entities').send(entityData).expect(200);
  const entityId = response.body._id;
  createdEntityIds.push(entityId);

  return entityId;
}

/**
 * Creates a test list and returns its ID
 */
export async function createTestList(
  client: Client,
  listData: Partial<List>,
): Promise<string> {
  const response = await client.post('/lists').send(listData).expect(200);

  return response.body._id;
}

/**
 * Cleans up all created entities
 */
export async function cleanupCreatedEntities(client: Client): Promise<void> {
  for (const id of createdEntityIds) {
    try {
      await client.delete(`/entities/${id}`);
    } catch (error) {
      console.error(`Failed to delete entity ${id}:`, error);
    }
  }

  createdEntityIds = [];
}
